// Migración 0005 (horarios por bloques) probada en PGlite con datos de ejemplo en el FORMATO REAL
// de producción (busy_slots = [{day,start,end}], overrides por week_start que se arrastran).
import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { busyIntervalsForDate } from '../../src/lib/schedule/availability'

const sql = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const U1 = '00000000-0000-0000-0000-000000000001'
const U2 = '00000000-0000-0000-0000-000000000002'
const U3 = '00000000-0000-0000-0000-000000000003'

const dayISO = (d) => d.toISOString().slice(0, 10)
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return dayISO(d) }
// Lunes de la semana actual (la migración convierte «el horario de HOY»)
const W0 = (() => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return dayISO(t) })()

let db
const q = (t, p) => db.query(t, p)
// uid = id de PERFIL; la sesión usa el id de Auth enlazado (cuentas antiguas reclamadas)
const AUTH = { [U1]: '00000000-0000-0000-0000-0000000000a0', [U2]: '00000000-0000-0000-0000-0000000000a1', [U3]: '00000000-0000-0000-0000-0000000000a2' }
async function as(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${AUTH[uid]}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
async function fails(t, p) {
  try {
    await q(t, p)
  } catch (e) {
    return e.message
  }
  return null
}

// Reconstruye un MemberSchedule del modelo nuevo a partir de las tablas
async function newModel(userId, name = 'x') {
  return {
    userId, name, mode: 'blocks', visibility: 'busy', legacyBase: [], legacyOverrides: [],
    templates: (await q(`select id, user_id, name, is_active, to_char(active_from,'YYYY-MM-DD') active_from, to_char(active_to,'YYYY-MM-DD') active_to from schedule_templates where user_id=$1`, [userId])).rows,
    blocks: (await q(`select id, template_id, user_id, group_code, title, color, location, day, start_min, end_min, repeat, to_char(valid_from,'YYYY-MM-DD') valid_from, to_char(valid_to,'YYYY-MM-DD') valid_to from schedule_blocks where user_id=$1`, [userId])).rows,
    exceptions: [],
  }
}
async function legacyModel(userId, group) {
  const base = (await q(`select busy_slots from schedules where user_id=$1 and group_code=$2`, [userId, group])).rows[0]?.busy_slots ?? []
  const ov = (await q(`select to_char(week_start,'YYYY-MM-DD') week_start, busy_slots from schedule_overrides where user_id=$1 and group_code=$2`, [userId, group])).rows
  return { userId, name: 'x', mode: 'legacy', visibility: 'busy', blocks: [], templates: [], exceptions: [], legacyBase: base, legacyOverrides: ov }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    create table auth.identities (user_id uuid, provider text, provider_id text, identity_data jsonb);
  `)
  await db.exec(sql('0001_base.sql'))
  // Datos antiguos en formato real
  await q(`insert into profiles (id, username, password_hash) values ($1,'ana','h1'), ($2,'beto','h2'), ($3,'carla','h3')`, [U1, U2, U3])
  await q(`insert into group_memberships (user_id, group_code, joined_at) values
    ($1,'uni','2026-01-01'), ($2,'uni','2026-01-02'), ($1,'piso','2026-01-03'), ($3,'uni','2026-01-04')`, [U1, U2, U3])
  await q(`insert into schedules (group_code, user_id, busy_slots) values
    ('uni',$1,'[{"day":"mon","start":"09:00","end":"10:30"},{"day":"mon","start":"10:30","end":"12:00"},{"day":"wed","start":"15:30","end":"17:00"}]'),
    ('piso',$1,'[{"day":"fri","start":"18:00","end":"20:00"}]'),
    ('uni',$2,'[{"day":"tue","start":"09:00","end":"10:30"}]')`, [U1, U2])
  // Overrides en formato real, RELATIVOS a hoy: dos pasados, uno de esta semana y uno futuro (U1); uno pasado (U2)
  await q(`insert into schedule_overrides (group_code, user_id, week_start, busy_slots) values
    ('uni',$1,$3,'[{"day":"mon","start":"08:00","end":"09:00"}]'),
    ('uni',$1,$4,'[]'),
    ('uni',$1,$5,'[{"day":"mon","start":"12:00","end":"13:30"}]'),
    ('uni',$1,$6,'[{"day":"thu","start":"09:00","end":"10:00"}]'),
    ('uni',$2,$4,'[{"day":"tue","start":"11:00","end":"12:00"}]')`, [U1, U2, addDays(W0, -14), addDays(W0, -7), W0, addDays(W0, 14)])
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant execute on all functions in schema public to anon, authenticated;`)
  for (const f of ['0002_auth_rls.sql', '0003_usuario_login.sql', '0004_recuperacion.sql']) {
    if (f === '0004_recuperacion.sql') await db.exec(`create role service_role nologin bypassrls; create table auth.sessions (id uuid default gen_random_uuid(), user_id uuid);`)
    await db.exec(sql(f))
  }
  // 0002 enlaza perfiles con auth: simulamos que ya se han migrado a Auth
  for (const i of [0, 1, 2]) {
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)`, [`00000000-0000-0000-0000-0000000000a${i}`, `u${i}@usuarios.horario-app.com`, JSON.stringify({ legacy_username: ['ana', 'beto', 'carla'][i], legacy_hash: ['h1', 'h2', 'h3'][i] })])
  }
  await db.exec(sql('0005_horarios_bloques.sql'))
})

describe('0005: conversión de datos antiguos a UNA capa', () => {
  it('no borra nada de schedules ni schedule_overrides', async () => {
    expect((await q(`select count(*)::int n from schedules`)).rows[0].n).toBe(3)
    expect((await q(`select count(*)::int n from schedule_overrides`)).rows[0].n).toBe(5)
  })
  it('una sola capa «Mi horario» por persona (los overrides pasados NO crean capas), desde el lunes de esta semana y sin fin', async () => {
    const r = (await q(`select name, to_char(active_from,'YYYY-MM-DD') f, active_to from schedule_templates where user_id=$1 order by name`, [U1])).rows
    expect(r.map((x) => x.name)).toEqual(['Mi horario', `Mi horario desde ${addDays(W0, 14)} (uni)`]) // la 2.ª es el override FUTURO
    expect(r[0]).toMatchObject({ f: W0, active_to: null })
    const u2 = (await q(`select name from schedule_templates where user_id=$1`, [U2])).rows
    expect(u2.map((x) => x.name)).toEqual(['Mi horario'])
    expect((await q(`select count(*)::int n from schedule_templates where user_id=$1`, [U3])).rows[0].n).toBe(0)
  })
  it('lleva el horario que tiene HOY: el último override <= esta semana (o el habitual) y por grupo', async () => {
    const hoy = (await q(`select b.group_code g, b.day, b.start_min s from schedule_blocks b join schedule_templates t on t.id = b.template_id where b.user_id=$1 and t.name = 'Mi horario' order by 1,2`, [U1])).rows
    expect(hoy).toEqual([{ g: 'piso', day: 'fri', s: 1080 }, { g: 'uni', day: 'mon', s: 720 }]) // override de esta semana (12:00) y base de «piso»
    const u2 = (await q(`select day, start_min s from schedule_blocks where user_id=$1`, [U2])).rows
    expect(u2).toEqual([{ day: 'tue', s: 660 }]) // el override pasado manda sobre el habitual
  })
  it('es idempotente: aplicar de nuevo la parte de conversión no duplica', async () => {
    const before = (await q(`select count(*)::int n from schedule_blocks`)).rows[0].n
    const body = sql('0005_horarios_bloques.sql')
    const from = body.lastIndexOf('-- ----', body.indexOf('-- Conversión de los horarios antiguos'))
    await db.exec(body.slice(from).replace(/^-- -+\n/, ''))
    expect((await q(`select count(*)::int n from schedule_blocks`)).rows[0].n).toBe(before)
  })
  it('equivalencia desde esta semana: el modelo nuevo da los MISMOS ocupados que el antiguo, día a día (200 días)', async () => {
    const dates = []
    for (let i = 0; i < 200; i++) dates.push(addDays(W0, i))
    for (const [u, g] of [[U1, 'uni'], [U1, 'piso'], [U2, 'uni']]) {
      const nuevo = await newModel(u)
      const viejo = await legacyModel(u, g)
      for (const date of dates) {
        expect(busyIntervalsForDate(nuevo, date, g), `${u} ${g} ${date}`).toEqual(busyIntervalsForDate(viejo, date, g))
      }
    }
  })
})

describe('0005: RLS y visibilidad', () => {
  it('cada uno solo ve y edita lo suyo en las tablas directas', async () => {
    await as(U2, async () => {
      expect((await q(`select * from schedule_blocks where user_id <> '${U2}'`)).rows).toHaveLength(0)
      expect(await fails(`insert into schedule_blocks (template_id, user_id, day, start_min, end_min) select id, '${U1}', 'mon', 60, 120 from schedule_templates limit 1`)).toBeTruthy()
    })
  })
  it('no se puede poner un bloque en una plantilla ajena ni en un grupo ajeno', async () => {
    const tplU1 = (await q(`select id from schedule_templates where user_id=$1 limit 1`, [U1])).rows[0].id
    await as(U2, async () => {
      expect(await fails(`insert into schedule_blocks (template_id, user_id, day, start_min, end_min) values ('${tplU1}', '${U2}', 'mon', 60, 120)`)).toBeTruthy()
    })
    await as(U2, async () => {
      const t = (await q(`insert into schedule_templates (user_id, name) values ('${U2}','Verano') returning id`)).rows[0].id
      expect(await fails(`insert into schedule_blocks (template_id, user_id, group_code, day, start_min, end_min) values ('${t}', '${U2}', 'piso', 'mon', 60, 120)`)).toBeTruthy() // U2 no está en 'piso'
      await q(`insert into schedule_blocks (template_id, user_id, group_code, title, day, start_min, end_min) values ('${t}', '${U2}', 'uni', 'Secreto', 'mon', 60, 120)`)
    })
  })
  it('group_schedules: por defecto otros ven ocupado pero NO el título; uno mismo sí', async () => {
    await as(U1, async () => {
      const r = (await q(`select group_schedules('uni') g`)).rows[0].g
      const ajeno = r.blocks.find((b) => b.title === null && b.user_id === U2 && b.start_min === 60)
      expect(ajeno).toBeTruthy()
      expect(JSON.stringify(r)).not.toContain('Secreto')
    })
    await as(U2, async () => {
      const r = (await q(`select group_schedules('uni') g`)).rows[0].g
      expect(r.blocks.some((b) => b.title === 'Secreto')).toBe(true)
    })
  })
  it("con visibilidad 'full' los demás ven el título", async () => {
    await as(U2, () => q(`select set_schedule_visibility('uni', 'full')`))
    await as(U1, async () => {
      const r = (await q(`select group_schedules('uni') g`)).rows[0].g
      expect(r.blocks.some((b) => b.title === 'Secreto')).toBe(true)
    })
  })
  it('un no miembro no puede pedir el horario del grupo', async () => {
    await as(U3, async () => expect(await fails(`select group_schedules('piso')`)).toMatch(/forbidden/))
  })
  it("group_schedules no filtra bloques de otros grupos del mismo usuario", async () => {
    await as(U3, async () => {
      const r = (await q(`select group_schedules('uni') g`)).rows[0].g
      // el bloque de U1 ligado al grupo 'piso' no aparece en 'uni'
      expect(r.blocks.some((b) => b.group_code === 'piso')).toBe(false)
    })
  })
  it('valores no válidos rechazados por restricciones', async () => {
    const t = (await q(`select id from schedule_templates where user_id=$1 limit 1`, [U2])).rows[0].id
    expect(await fails(`insert into schedule_blocks (template_id, user_id, day, start_min, end_min) values ('${t}','${U2}','mon',600,600)`)).toBeTruthy()
    expect(await fails(`insert into schedule_blocks (template_id, user_id, day, start_min, end_min) values ('${t}','${U2}','xxx',60,120)`)).toBeTruthy()
    expect(await fails(`insert into schedule_blocks (template_id, user_id, day, start_min, end_min, color) values ('${t}','${U2}','mon',60,120,'rojo')`)).toBeTruthy()
  })
  it('excepciones propias, y las ajenas no se leen directamente', async () => {
    await as(U1, () => q(`insert into schedule_exceptions (user_id, date, kind) values ('${U1}', '2026-11-09', 'free')`))
    await as(U2, async () => expect((await q(`select * from schedule_exceptions`)).rows).toHaveLength(0))
    await as(U2, async () => {
      const r = (await q(`select group_schedules('uni') g`)).rows[0].g
      expect(r.exceptions.some((e) => e.user_id === U1 && e.kind === 'free')).toBe(true)
    })
  })
})
