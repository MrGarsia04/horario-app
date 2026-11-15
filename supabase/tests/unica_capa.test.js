// Migración 0007: reconstruye UNA capa «Mi horario» en una base donde la conversión ANTIGUA de 0005
// ya creó una capa por cada override. Reproduce esa base con la conversión antigua (fixture) y datos tipo.
import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { busyIntervalsForDate } from '../../src/lib/schedule/availability'

const sql = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const fixture = readFileSync(new URL('./fixtures/conversion_antigua_0005.sql', import.meta.url), 'utf8')
const U = [1, 2, 3, 4, 5].map((n) => `00000000-0000-0000-0000-00000000000${n}`)
const [U1, U2, U3, U4, U5] = U
const dayISO = (d) => d.toISOString().slice(0, 10)
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return dayISO(d) }
const W0 = (() => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return dayISO(t) })()

let db
const q = (t, p) => db.query(t, p)
async function as(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
const names = async (u) => (await q(`select name from schedule_templates where user_id=$1 order by name`, [u])).rows.map((r) => r.name)
const nBlocks = async (u) => (await q(`select count(*)::int n from schedule_blocks where user_id=$1`, [u])).rows[0].n

async function newModel(userId) {
  const d = (c) => `to_char(${c},'YYYY-MM-DD')`
  return {
    userId, name: 'x', mode: 'blocks', visibility: 'busy', legacyBase: [], legacyOverrides: [], exceptions: [],
    templates: (await q(`select id, user_id, name, is_active, ${d('active_from')} active_from, ${d('active_to')} active_to, every_n_weeks, ${d('anchor_week')} anchor_week from schedule_templates where user_id=$1`, [userId])).rows,
    blocks: (await q(`select id, template_id, user_id, group_code, title, color, location, day, start_min, end_min, repeat, ${d('valid_from')} valid_from, ${d('valid_to')} valid_to from schedule_blocks where user_id=$1`, [userId])).rows,
  }
}
async function legacyModel(userId, group) {
  const base = (await q(`select busy_slots from schedules where user_id=$1 and group_code=$2`, [userId, group])).rows[0]?.busy_slots ?? []
  const ov = (await q(`select to_char(week_start,'YYYY-MM-DD') week_start, busy_slots from schedule_overrides where user_id=$1 and group_code=$2`, [userId, group])).rows
  return { userId, name: 'x', mode: 'legacy', visibility: 'busy', blocks: [], templates: [], exceptions: [], legacyBase: base, legacyOverrides: ov }
}

let snapshotOverrides
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    create table auth.identities (user_id uuid, provider text, provider_id text, identity_data jsonb);
    create role service_role nologin bypassrls; create table auth.sessions (id uuid default gen_random_uuid(), user_id uuid);
  `)
  await db.exec(sql('0001_base.sql'))
  await q(`insert into profiles (id, username, password_hash) values ($1,'u1','h'),($2,'u2','h'),($3,'u3','h'),($4,'u4','h'),($5,'u5','h')`, U)
  await q(`insert into group_memberships (user_id, group_code, joined_at) values ($1,'uni','2026-01-01'),($1,'piso','2026-01-02'),($2,'uni','2026-01-03'),($3,'uni','2026-01-04'),($4,'uni','2026-01-05'),($5,'uni','2026-01-06')`, U)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;`)
  for (const f of ['0002_auth_rls.sql', '0003_usuario_login.sql', '0004_recuperacion.sql']) await db.exec(sql(f))
  await db.exec(`grant all on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated;`)
  await db.exec(sql('0005_horarios_bloques.sql')) // sin datos antiguos todavía: no convierte nada
  await db.exec(sql('0006_capas.sql'))

  // Datos antiguos reales: el programa viejo guardaba un override cada vez que se editaba una semana
  const slot = (day, s, e) => ({ day, start: s, end: e })
  const j = (a) => JSON.stringify(a)
  await q(`insert into schedules (group_code, user_id, busy_slots) values
    ('uni',$1,$4),('piso',$1,$5),('uni',$2,$4),('uni',$3,$4)`, [U1, U2, U3, j([slot('mon', '09:00', '10:30'), slot('wed', '15:30', '17:00')]), j([slot('fri', '18:00', '20:00')])])
  for (const u of [U1, U2, U3]) {
    await q(`insert into schedule_overrides (group_code, user_id, week_start, busy_slots) values
      ('uni',$1,$2,$6),('uni',$1,$3,$7),('uni',$1,$4,$8),('uni',$1,$5,$9)`,
      [u, addDays(W0, -21), addDays(W0, -14), addDays(W0, -7), W0, j([slot('mon', '08:00', '09:00')]), j([slot('tue', '10:00', '11:30')]), j([]), j([slot('mon', '12:00', '13:30'), slot('thu', '09:00', '10:00')])])
  }
  await q(`insert into schedule_overrides (group_code, user_id, week_start, busy_slots) values ('uni',$1,$2,$3)`, [U1, addDays(W0, 14), j([slot('thu', '09:00', '10:00')])])

  // La conversión ANTIGUA (una capa por override) y las capas vacías «Mi horario» que creó el programa al abrir el editor
  await db.exec(fixture)
  for (let i = 0; i < 3; i++) await q(`insert into schedule_templates (user_id, name, created_at) values ($1,'Mi horario', now() + ($2 || ' seconds')::interval)`, [U1, String(i)])
  // U2: además una capa MANUAL con bloques (con título y color) y una excepción
  const man = (await q(`insert into schedule_templates (user_id, name, color, every_n_weeks, anchor_week) values ($1,'Clases','#5B8DEF',2,$2) returning id`, [U2, W0])).rows[0].id
  await q(`insert into schedule_blocks (template_id, user_id, group_code, title, color, day, start_min, end_min) values ($1,$2,null,'Mates','#5B8DEF','mon',540,600)`, [man, U2])
  // U3: edita un bloque de una capa generada (le pone título): esa capa NO debe borrarse
  await q(`update schedule_blocks set title = 'Física' where id = (select b.id from schedule_blocks b join schedule_templates t on t.id = b.template_id where b.user_id = $1 and t.name like 'Mi horario desde %' order by b.id limit 1)`, [U3])
  // U4: solo capas vacías por defecto
  for (let i = 0; i < 2; i++) await q(`insert into schedule_templates (user_id, name, created_at) values ($1,'Mi horario', now() + ($2 || ' seconds')::interval)`, [U4, String(i)])

  snapshotOverrides = (await q(`select count(*)::int n from schedule_overrides`)).rows[0].n
  globalThis.__antes = {
    u1: (await q(`select count(*)::int n from schedule_templates where user_id=$1`, [U1])).rows[0].n,
    u2manual: (await q(`select * from schedule_templates where id=$1`, [man])).rows[0],
  }
  await db.exec(sql('0007_unica_capa_migrada.sql'))
})

describe('0007: estado previo reproducido (la base del usuario)', () => {
  it('la conversión antigua había creado muchas capas para U1', () => {
    expect(globalThis.__antes.u1).toBeGreaterThanOrEqual(8)
  })
})

describe('0007: U1 (solo conversión automática + capas vacías)', () => {
  it('queda UNA capa «Mi horario» (todas las semanas, desde esta semana, sin fin) + el override futuro', async () => {
    expect(await names(U1)).toEqual(['Mi horario', `Mi horario desde ${addDays(W0, 14)} (uni)`])
    const r = (await q(`select every_n_weeks n, to_char(active_from,'YYYY-MM-DD') f, active_to from schedule_templates where user_id=$1 and name='Mi horario'`, [U1])).rows[0]
    expect(r).toEqual({ n: 1, f: W0, active_to: null })
  })
  it('lleva el horario de hoy por grupo (el override de esta semana, no el histórico)', async () => {
    const r = (await q(`select b.group_code g, b.day d, b.start_min s from schedule_blocks b join schedule_templates t on t.id = b.template_id where t.name='Mi horario' and b.user_id=$1 order by 1,2,3`, [U1])).rows
    expect(r).toEqual([{ g: 'piso', d: 'fri', s: 1080 }, { g: 'uni', d: 'mon', s: 720 }, { g: 'uni', d: 'thu', s: 540 }])
  })
  it('equivalencia desde esta semana: mismos ocupados que el modelo antiguo, 200 días', async () => {
    const nuevo = await newModel(U1)
    for (const g of ['uni', 'piso']) {
      const viejo = await legacyModel(U1, g)
      for (let i = 0; i < 200; i++) {
        const date = addDays(W0, i)
        expect(busyIntervalsForDate(nuevo, date, g), `${g} ${date}`).toEqual(busyIntervalsForDate(viejo, date, g))
      }
    }
  })
})

describe('0007: respeta lo hecho a mano', () => {
  it('U2: conserva su capa manual intacta, borra las generadas y NO reconstruye encima', async () => {
    expect(await names(U2)).toEqual(['Clases'])
    const ahora = (await q(`select * from schedule_templates where name='Clases' and user_id=$1`, [U2])).rows[0]
    expect(ahora).toEqual(globalThis.__antes.u2manual)
    expect((await q(`select title, color from schedule_blocks where user_id=$1`, [U2])).rows).toEqual([{ title: 'Mates', color: '#5B8DEF' }])
  })
  it('U3: una capa generada que el usuario retocó (título) se conserva; el resto se borra; no reconstruye', async () => {
    const n = await names(U3)
    expect(n.length).toBe(1)
    expect(n[0]).toMatch(/^Mi horario desde /)
    expect((await q(`select title from schedule_blocks where user_id=$1`, [U3])).rows.map((r) => r.title)).toContain('Física')
  })
  it('U4 (sin horario antiguo): solo sobra una «Mi horario» vacía', async () => {
    expect(await names(U4)).toEqual(['Mi horario'])
    expect(await nBlocks(U4)).toBe(0)
  })
  it('U5 (sin nada): no se le crea ninguna capa', async () => {
    expect(await names(U5)).toEqual([])
  })
  it('no toca schedules ni schedule_overrides', async () => {
    expect((await q(`select count(*)::int n from schedule_overrides`)).rows[0].n).toBe(snapshotOverrides)
    expect((await q(`select count(*)::int n from schedules`)).rows[0].n).toBe(4)
  })
})

describe('0007: idempotencia y ensure_default_layer', () => {
  it('repetir 0007 no cambia nada', async () => {
    const antes = [await names(U1), await names(U2), await names(U3), await names(U4), await nBlocks(U1)]
    await db.exec(sql('0007_unica_capa_migrada.sql'))
    expect([await names(U1), await names(U2), await names(U3), await names(U4), await nBlocks(U1)]).toEqual(antes)
  })
  it('ensure_default_layer crea «Mi horario» desde esta semana solo si no hay ninguna, también en paralelo', async () => {
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f1','n@usuarios.horario-app.com','{"username":"nuevo"}')`)
    const F = '00000000-0000-0000-0000-0000000000f1'
    await as(F, async () => { await Promise.all([q(`select ensure_default_layer()`), q(`select ensure_default_layer()`), q(`select ensure_default_layer()`)]) })
    const r = (await q(`select name, to_char(active_from,'YYYY-MM-DD') f from schedule_templates where user_id=$1`, [F])).rows
    expect(r).toEqual([{ name: 'Mi horario', f: W0 }])
  })
  it('exige sesión', async () => {
    await db.exec(`set role anon`)
    let msg = ''
    try { await q(`select ensure_default_layer()`) } catch (e) { msg = e.message }
    await db.exec(`reset role`)
    expect(msg).toMatch(/permission denied/)
  })
})
