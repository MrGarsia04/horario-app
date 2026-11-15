// Migración 0006 (capas): conversión de los bloques quincenales A/B, restricciones, RLS y
// equivalencia día a día con la lógica de la app (src/lib/schedule/availability.ts).
import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { busyIntervalsForDate, weekParity } from '../../src/lib/schedule/availability'

const sql = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const U1 = '00000000-0000-0000-0000-000000000001'
const U2 = '00000000-0000-0000-0000-000000000002'
const AUTH = { [U1]: '00000000-0000-0000-0000-0000000000a0', [U2]: '00000000-0000-0000-0000-0000000000a1' }

let db
const q = (t, p) => db.query(t, p)
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
const iso = (d) => d.toISOString().slice(0, 10)

async function model(userId, layers = true) {
  const d = (col) => `to_char(${col},'YYYY-MM-DD')`
  return {
    userId, name: 'x', mode: 'blocks', visibility: 'busy', legacyBase: [], legacyOverrides: [], exceptions: [],
    templates: (await q(`select id, user_id, name, is_active, ${d('active_from')} active_from, ${d('active_to')} active_to${layers ? `, every_n_weeks, ${d('anchor_week')} anchor_week` : ''} from schedule_templates where user_id=$1`, [userId])).rows,
    blocks: (await q(`select id, template_id, user_id, group_code, title, color, location, day, start_min, end_min, repeat, ${d('valid_from')} valid_from, ${d('valid_to')} valid_to from schedule_blocks where user_id=$1`, [userId])).rows,
  }
}
function dates(from, days) {
  const out = []
  for (let i = 0; i < days; i++) out.push(iso(new Date(Date.UTC(from[0], from[1] - 1, from[2] + i))))
  return out
}

let before
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
  await q(`insert into profiles (id, username, password_hash) values ($1,'ana','h1'), ($2,'beto','h2')`, [U1, U2])
  await q(`insert into group_memberships (user_id, group_code) values ($1,'uni'), ($2,'uni')`, [U1, U2])
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated;`)
  for (const f of ['0002_auth_rls.sql', '0003_usuario_login.sql', '0004_recuperacion.sql']) await db.exec(sql(f))
  for (const [i, name] of ['ana', 'beto'].entries()) {
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)`, [`00000000-0000-0000-0000-0000000000a${i}`, `u${i}@usuarios.horario-app.com`, JSON.stringify({ legacy_username: name, legacy_hash: `h${i + 1}` })])
  }
  await db.exec(sql('0005_horarios_bloques.sql'))

  // Datos «como de 0005»: una plantilla con bloques semanales, quincenales A y quincenales B (con validez en uno)
  const t1 = (await q(`insert into schedule_templates (user_id, name, active_to) values ($1,'Clases','2027-06-30') returning id`, [U1])).rows[0].id
  const t2 = (await q(`insert into schedule_templates (user_id, name, is_active) values ($1,'Prácticas', false) returning id`, [U1])).rows[0].id
  const t3 = (await q(`insert into schedule_templates (user_id, name) values ($1,'Turnos') returning id`, [U2])).rows[0].id
  const ins = (t, u, day, s, e, repeat, extra = '') => q(`insert into schedule_blocks (template_id, user_id, group_code, day, start_min, end_min, repeat, color${extra ? ', valid_from' : ''}) values ($1,$2,'uni',$3,$4,$5,$6,'#4C7C7C'${extra ? ",'2026-12-01'" : ''})`, [t, u, day, s, e, repeat])
  await ins(t1, U1, 'mon', 540, 630, 'weekly')
  await ins(t1, U1, 'mon', 700, 760, 'biweekly_a')
  await ins(t1, U1, 'wed', 540, 600, 'biweekly_b')
  await ins(t1, U1, 'fri', 600, 660, 'biweekly_a', 'validez')
  await ins(t2, U1, 'tue', 540, 600, 'biweekly_b')
  await ins(t3, U2, 'thu', 800, 860, 'biweekly_a')
  await ins(t3, U2, 'thu', 900, 960, 'weekly')
  await q(`insert into schedule_exceptions (user_id, group_code, date, kind) values ($1,'uni','2026-11-18','free')`, [U1])

  before = { U1: await model(U1, false), U2: await model(U2, false) }
  await db.exec(sql('0006_capas.sql'))
})

describe('0006: conversión de bloques quincenales en capas', () => {
  it('cada plantilla con bloques A/B genera capas «cada 2 semanas» con ancla en lunes y frecuencia 2', async () => {
    const r = (await q(`select name, every_n_weeks, to_char(anchor_week,'YYYY-MM-DD') a, extract(isodow from anchor_week)::int dow, is_active from schedule_templates where every_n_weeks = 2 order by name`)).rows
    expect(r.map((x) => x.name)).toEqual(['Clases · cada 2 semanas', 'Clases · cada 2 semanas (la otra)', 'Prácticas · cada 2 semanas (la otra)', 'Turnos · cada 2 semanas'])
    expect(r.every((x) => x.dow === 1)).toBe(true)
    expect(r.find((x) => x.name.startsWith('Prácticas')).is_active).toBe(false) // hereda el interruptor
  })
  it('hereda las fechas de la capa original y los bloques pasan a «todas las semanas»', async () => {
    const c = (await q(`select to_char(active_to,'YYYY-MM-DD') t from schedule_templates where name = 'Clases · cada 2 semanas'`)).rows[0]
    expect(c.t).toBe('2027-06-30')
    expect((await q(`select count(*)::int n from schedule_blocks where repeat <> 'weekly'`)).rows[0].n).toBe(0)
    expect((await q(`select count(*)::int n from schedule_blocks`)).rows[0].n).toBe(7) // no se pierde ninguno
  })
  it('las capas originales conservan sus bloques semanales', async () => {
    const r = (await q(`select t.name, count(*)::int n from schedule_blocks b join schedule_templates t on t.id = b.template_id group by t.name order by t.name`)).rows
    expect(r.find((x) => x.name === 'Clases').n).toBe(1)
  })
  it('equivalencia día a día (6 meses): mismos ocupados antes y después, para todos', async () => {
    const after = { U1: await model(U1), U2: await model(U2) }
    for (const u of ['U1', 'U2']) {
      for (const date of dates([2026, 10, 26], 200)) {
        expect(busyIntervalsForDate(after[u], date, 'uni'), `${u} ${date}`).toEqual(busyIntervalsForDate(before[u], date, 'uni'))
      }
    }
  })
  it('la paridad de las anclas coincide con weekParity de la app', async () => {
    const r = (await q(`select name, to_char(anchor_week,'YYYY-MM-DD') a from schedule_templates where every_n_weeks = 2`)).rows
    const a = r.find((x) => x.name === 'Clases · cada 2 semanas')
    const otra = r.find((x) => x.name === 'Clases · cada 2 semanas (la otra)')
    expect(weekParity(a.a)).toBe('a')
    expect(weekParity(otra.a)).toBe('b')
  })
  it('es idempotente: repetir 0006 no duplica capas ni cambia nada', async () => {
    const n = (await q(`select count(*)::int n from schedule_templates`)).rows[0].n
    await db.exec(sql('0006_capas.sql'))
    expect((await q(`select count(*)::int n from schedule_templates`)).rows[0].n).toBe(n)
  })
})

describe('0006: restricciones', () => {
  it('frecuencia entre 1 y 12; con frecuencia > 1 hace falta un ancla que sea lunes', async () => {
    expect(await fails(`insert into schedule_templates (user_id, name, every_n_weeks) values ('${U1}','x',0)`)).toBeTruthy()
    expect(await fails(`insert into schedule_templates (user_id, name, every_n_weeks) values ('${U1}','x',13)`)).toBeTruthy()
    expect(await fails(`insert into schedule_templates (user_id, name, every_n_weeks) values ('${U1}','x',3)`)).toBeTruthy() // sin ancla
    expect(await fails(`insert into schedule_templates (user_id, name, every_n_weeks, anchor_week) values ('${U1}','x',3,'2026-11-11')`)).toBeTruthy() // miércoles
    expect(await fails(`insert into schedule_templates (user_id, name, every_n_weeks, anchor_week) values ('${U1}','x',3,'2026-11-09')`)).toBeNull()
  })
  it('color de capa válido o nulo', async () => {
    expect(await fails(`insert into schedule_templates (user_id, name, color) values ('${U1}','x','rojo')`)).toBeTruthy()
    expect(await fails(`insert into schedule_templates (user_id, name, color) values ('${U1}','c','#C0504D')`)).toBeNull()
  })
})

describe('0006: RLS y visibilidad', () => {
  it('cada uno gestiona solo sus capas', async () => {
    await as(U2, async () => {
      expect((await q(`select * from schedule_templates where user_id <> '${U2}'`)).rows).toHaveLength(0)
      expect((await q(`update schedule_templates set name = 'hack' where user_id = '${U1}'`)).affectedRows).toBe(0)
      const t = (await q(`insert into schedule_templates (user_id, name, every_n_weeks, anchor_week, color) values ('${U2}','Mía',2,'2026-11-09','#5B8DEF') returning id`)).rows[0].id
      expect(t).toBeTruthy()
    })
  })
  it('una excepción solo puede apuntar a una capa propia', async () => {
    const ajena = (await q(`select id from schedule_templates where user_id = $1 limit 1`, [U1])).rows[0].id
    await as(U2, async () => {
      expect(await fails(`insert into schedule_exceptions (user_id, date, kind, template_id) values ('${U2}','2026-12-01','free','${ajena}')`)).toBeTruthy()
      const propia = (await q(`select id from schedule_templates where user_id = '${U2}' limit 1`)).rows[0].id
      expect(await fails(`insert into schedule_exceptions (user_id, date, kind, template_id) values ('${U2}','2026-12-01','free','${propia}')`)).toBeNull()
    })
  })
  it('group_schedules devuelve frecuencia, ancla y la capa de las excepciones, y mantiene la visibilidad', async () => {
    await as(U1, async () => {
      const r = (await q(`select group_schedules('uni') g`)).rows[0].g
      expect(r.templates.some((t) => t.every_n_weeks === 2 && t.anchor_week)).toBe(true)
      expect(r.exceptions.every((e) => 'template_id' in e)).toBe(true)
      const ajeno = r.blocks.filter((b) => b.user_id === U2)
      expect(ajeno.length).toBeGreaterThan(0)
      expect(ajeno.every((b) => b.title === null && b.color === null)).toBe(true) // visibilidad 'busy' por defecto
    })
  })
  it('un no miembro sigue sin poder pedir horarios', async () => {
    const Z = '00000000-0000-0000-0000-0000000000a9'
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ($1,'z@usuarios.horario-app.com','{"username":"zed"}')`, [Z])
    AUTH[Z] = Z
    await as(Z, async () => expect(await fails(`select group_schedules('uni')`)).toMatch(/forbidden/))
  })
})
