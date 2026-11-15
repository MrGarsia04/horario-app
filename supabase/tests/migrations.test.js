// Prueba las migraciones en un Postgres en memoria (PGlite), con un stub mínimo del
// esquema `auth` de Supabase. No toca ninguna base real. Ejecutar con: npm test
import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const sql = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const C = '00000000-0000-0000-0000-00000000000c'
const LEGACY = '00000000-0000-0000-0000-0000000000ff'
const LEGACY_AUTH = '00000000-0000-0000-0000-0000000000fe'
const HASH = 'abc123'
const PRE = '00000000-0000-0000-0000-0000000000aa'

let db

async function as(uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
const q = (text, params) => db.query(text, params)
async function fails(text, params) {
  try {
    await q(text, params)
  } catch (e) {
    return e.message
  }
  return null
}
async function signup(id, name, email) {
  await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    email,
    JSON.stringify({ username: name }),
  ])
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
  `)
  await db.exec(sql('0001_base.sql'))
  // Políticas abiertas como las de la versión antigua: 0002 debe eliminarlas
  await db.exec(`alter table schedules enable row level security;
    create policy "Cualquiera puede leer" on schedules for select using (true);`)
  // Datos heredados: un usuario antiguo con horario y grupo
  await q(`insert into profiles (id, username, password_hash) values ($1, 'viejo', '${HASH}')`, [LEGACY])
  await q(`insert into group_memberships (user_id, group_code) values ($1, 'old')`, [LEGACY])
  await q(`insert into schedules (group_code, user_id, busy_slots) values ('old', $1, '[{"day":"mon"}]')`, [LEGACY])
  await q(`insert into group_settings (group_code, config) values ('old', '{"k":1}')`)
  // Como en Supabase: privilegios por defecto a los roles de la API
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;
                 alter default privileges in schema public grant execute on functions to anon, authenticated;
                 grant all on all tables in schema public to anon, authenticated;
                 grant execute on all functions in schema public to anon, authenticated;`)
  await db.exec(sql('0002_auth_rls.sql'))
})

describe('0002: conserva los datos heredados', () => {
  it('elimina las políticas abiertas antiguas', async () => {
    expect((await q(`select count(*)::int n from pg_policies where policyname = 'Cualquiera puede leer'`)).rows[0].n).toBe(0)
  })
  it('no borra nada de public', async () => {
    expect((await q(`select count(*)::int n from public.profiles`)).rows[0].n).toBe(1)
    expect((await q(`select count(*)::int n from public.group_memberships`)).rows[0].n).toBe(1)
    expect((await q(`select count(*)::int n from public.schedules where busy_slots::text like '%mon%'`)).rows[0].n).toBe(1)
  })
  it('crea el grupo antiguo con su miembro como owner y le pone invitación', async () => {
    const r = await q(`select g.code, m.role from groups g join group_memberships m on m.group_code = g.code`)
    expect(r.rows).toEqual([{ code: 'old', role: 'owner' }])
    expect((await q(`select count(*)::int n from group_invites`)).rows[0].n).toBe(1)
  })
  it('el hash antiguo ya no está en profiles y ningún cliente lo lee', async () => {
    const r = await q(`select 1 from information_schema.columns where table_name='profiles' and table_schema='public' and column_name='password_hash'`)
    expect(r.rows).toHaveLength(0)
    await as(A, async () => expect(await fails(`select * from legacy_credentials`)).toMatch(/permission denied|row-level/))
  })
  it('el usuario antiguo figura como pendiente de reclamar', async () => {
    expect((await q(`select legacy_account_pending('VIEJO') r`)).rows[0].r).toBe(true)
    expect((await q(`select legacy_account_pending('nadie') r`)).rows[0].r).toBe(false)
  })
})

describe('reclamar cuenta antigua', () => {
  const claim = (hash, name = 'viejo') =>
    q(`insert into auth.users (id,email,raw_user_meta_data) values ($1,'viejo@x.com',$2)`, [
      LEGACY_AUTH,
      JSON.stringify({ legacy_username: name, legacy_hash: hash }),
    ])
  it('con contraseña antigua incorrecta falla y no crea nada', async () => {
    expect(await fails(`insert into auth.users (id,email,raw_user_meta_data) values ($1,'viejo@x.com',$2)`, [LEGACY_AUTH, JSON.stringify({ legacy_username: 'viejo', legacy_hash: 'mal' })])).toMatch(/invalid_legacy_credentials/)
    expect((await q(`select count(*)::int n from auth.users`)).rows[0].n).toBe(0)
  })
  it('legacy_claim_valid distingue hash bueno y malo', async () => {
    expect((await q(`select legacy_claim_valid('viejo', 'mal') r`)).rows[0].r).toBe(false)
    expect((await q(`select legacy_claim_valid('viejo', $1) r`, [HASH])).rows[0].r).toBe(true)
  })
  it('con la correcta enlaza el perfil existente (mismo id) a la cuenta nueva', async () => {
    await claim(HASH.toUpperCase())
    const r = await q(`select id, auth_id from profiles where username='viejo'`)
    expect(r.rows[0]).toEqual({ id: LEGACY, auth_id: LEGACY_AUTH })
    expect((await q(`select count(*)::int n from legacy_credentials`)).rows[0].n).toBe(0)
    expect((await q(`select legacy_account_pending('viejo') r`)).rows[0].r).toBe(false)
  })
  it('ya con sesión ve sus datos de siempre y es owner de su grupo', async () => {
    await as(LEGACY_AUTH, async () => {
      expect((await q(`select me() m`)).rows[0].m).toBe(LEGACY)
      expect((await q(`select group_code from group_memberships`)).rows).toEqual([{ group_code: 'old' }])
      expect((await q(`select busy_slots from schedules`)).rows).toHaveLength(1)
      expect((await q(`select config from group_settings`)).rows).toHaveLength(1)
      expect((await q(`select get_invite_code('old') c`)).rows[0].c).toHaveLength(24)
    })
  })
  it('no se puede reclamar dos veces', async () => {
    expect(await fails(`insert into auth.users (id,email,raw_user_meta_data) values (gen_random_uuid(),'otro@x.com',$1)`, [JSON.stringify({ legacy_username: 'viejo', legacy_hash: HASH })])).toMatch(/invalid_legacy_credentials/)
  })
})

describe('registro', () => {
  it('el trigger crea el perfil con el username', async () => {
    await signup(A, 'Ana', 'a@x.com')
    await signup(B, 'Beto', 'b@x.com')
    await signup(C, 'Carla', 'c@x.com')
    const r = await q(`select username from profiles where id=$1`, [A])
    expect(r.rows[0].username).toBe('Ana')
  })
  it('rechaza username repetido (sin distinguir mayúsculas)', async () => {
    expect(await fails(`insert into auth.users (id,email,raw_user_meta_data) values (gen_random_uuid(),'z@x.com','{"username":"ana"}')`)).toMatch(/username_taken/)
  })
  it('username_available funciona', async () => {
    expect((await q(`select username_available('ANA') r`)).rows[0].r).toBe(false)
    expect((await q(`select username_available('nuevo') r`)).rows[0].r).toBe(true)
  })
})

describe('grupos, roles e invitación', () => {
  let invite
  it('A crea un grupo y es owner con ajustes por defecto', async () => {
    await as(A, () => q(`select create_group('Mi-Grupo')`))
    const r = await q(`select role from group_memberships where user_id=$1 and group_code='mi-grupo'`, [A])
    expect(r.rows[0].role).toBe('owner')
    expect((await q(`select count(*)::int n from group_settings where group_code='mi-grupo'`)).rows[0].n).toBe(1)
  })
  it('crear un código existente falla', async () => {
    await as(B, async () => expect(await fails(`select create_group('mi-grupo')`)).toMatch(/group_exists/))
  })
  it('un no miembro no ve nada del grupo ni su código de invitación', async () => {
    await as(B, async () => {
      expect((await q(`select * from groups`)).rows).toHaveLength(0)
      expect((await q(`select * from group_settings`)).rows).toHaveLength(0)
      expect(await fails(`select * from group_invites`)).toMatch(/permission denied/)
      expect(await fails(`select get_invite_code('mi-grupo')`)).toMatch(/forbidden/)
    })
  })
  it('no puedes unirte insertando directamente, ni adivinando solo el código visible', async () => {
    await as(B, async () => {
      expect(await fails(`insert into group_memberships (user_id, group_code) values ('${B}','mi-grupo')`)).toBeTruthy()
      expect(await fails(`select join_group('mi-grupo')`)).toMatch(/invalid_invite/)
    })
  })
  it('con el código de invitación largo sí', async () => {
    invite = (await as(A, () => q(`select get_invite_code('mi-grupo') c`))).rows[0].c
    expect(invite).toHaveLength(24)
    await as(B, () => q(`select join_group($1)`, [invite]))
    const r = await q(`select role from group_memberships where user_id=$1`, [B])
    expect(r.rows[0].role).toBe('member')
  })
  it('un miembro normal no puede cambiar ajustes; el owner sí', async () => {
    await as(B, async () => {
      const r = await q(`update group_settings set config='{"x":1}' where group_code='mi-grupo'`)
      expect(r.affectedRows).toBe(0)
    })
    await as(A, async () => {
      const r = await q(`update group_settings set config='{"x":2}' where group_code='mi-grupo'`)
      expect(r.affectedRows).toBe(1)
    })
  })
  it('no puede auto-promocionarse', async () => {
    await as(B, async () => {
      const r = await q(`update group_memberships set role='owner' where user_id='${B}'`)
      expect(r.affectedRows).toBe(0)
      expect(await fails(`select set_member_role('mi-grupo','${B}','admin')`)).toMatch(/forbidden/)
    })
  })
  it('el owner hace admin a B y B ya puede cambiar ajustes y rotar la invitación', async () => {
    await as(A, () => q(`select set_member_role('mi-grupo', $1, 'admin')`, [B]))
    await as(B, async () => {
      expect((await q(`update group_settings set config='{"x":3}' where group_code='mi-grupo'`)).affectedRows).toBe(1)
      const nuevo = (await q(`select rotate_invite_code('mi-grupo') c`)).rows[0].c
      expect(nuevo).not.toBe(invite)
    })
    await as(C, async () => expect(await fails(`select join_group('${invite}')`)).toMatch(/invalid_invite/))
  })
  it('horarios: ves los de tu grupo pero solo escribes los tuyos', async () => {
    await as(A, () => q(`insert into schedule_overrides (group_code,user_id,week_start,busy_slots) values ('mi-grupo',$1,'2026-11-09','[]')`, [A]))
    await as(B, async () => {
      expect((await q(`select * from schedule_overrides`)).rows).toHaveLength(1)
      expect(await fails(`insert into schedule_overrides (group_code,user_id,week_start) values ('mi-grupo','${A}','2026-11-16')`)).toBeTruthy()
    })
    await as(C, async () => expect((await q(`select * from schedule_overrides`)).rows).toHaveLength(0))
  })
  it('perfiles: compañeros de grupo sí, extraños no', async () => {
    await as(B, async () => {
      const names = (await q(`select username from profiles order by 1`)).rows.map((r) => r.username)
      expect(names).toEqual(['Ana', 'Beto'])
    })
  })
  it('si el owner se va, el admin hereda; si no queda nadie, se borra el grupo', async () => {
    await as(A, () => q(`select leave_group('mi-grupo')`))
    expect((await q(`select role from group_memberships where user_id=$1`, [B])).rows[0].role).toBe('owner')
    await as(B, () => q(`select leave_group('mi-grupo')`))
    expect((await q(`select count(*)::int n from groups where code='mi-grupo'`)).rows[0].n).toBe(0)
  })
})

describe('amistades y planes', () => {
  it('flujo de solicitud: solo el destinatario acepta', async () => {
    await as(A, async () => {
      const [x, y] = A < B ? [A, B] : [B, A]
      await q(`insert into friendships (user_a,user_b,requested_by) values ($1,$2,$3)`, [x, y, A])
      expect((await q(`select * from find_user_by_username('beto')`)).rows).toHaveLength(1)
      expect((await q(`update friendships set status='accepted'`)).affectedRows).toBe(0)
    })
    await as(C, async () => expect((await q(`select * from friendships`)).rows).toHaveLength(0))
    await as(B, async () => expect((await q(`update friendships set status='accepted'`)).affectedRows).toBe(1))
  })
  it('no se puede falsificar requested_by', async () => {
    await as(A, async () => {
      const [x, y] = A < C ? [A, C] : [C, A]
      expect(await fails(`insert into friendships (user_a,user_b,requested_by) values ($1,$2,$3)`, [x, y, C])).toBeTruthy()
    })
  })
  let eventId
  it('solo puedes invitar a amigos; el invitado ve el plan, un extraño no', async () => {
    await as(A, async () => {
      eventId = (await q(`insert into events (creator_id,title,event_date) values ($1,'Cena','2026-12-01') returning id`, [A])).rows[0].id
      expect(await fails(`insert into event_invitations (event_id,invitee_id) values ($1,$2)`, [eventId, C])).toBeTruthy()
      await q(`insert into event_invitations (event_id,invitee_id) values ($1,$2)`, [eventId, B])
    })
    await as(B, async () => expect((await q(`select * from events`)).rows).toHaveLength(1))
    await as(C, async () => expect((await q(`select * from events`)).rows).toHaveLength(0))
  })
  it('el invitado responde solo en lo suyo y no edita el plan', async () => {
    await as(B, async () => {
      expect((await q(`update event_invitations set status='accepted'`)).affectedRows).toBe(1)
      expect((await q(`update events set title='hack'`)).affectedRows).toBe(0)
      expect((await q(`delete from events`)).affectedRows).toBe(0)
      expect(await fails(`update event_invitations set status='pending'`)).toBeTruthy()
    })
  })
  it('anon no ve nada', async () => {
    await db.exec(`set role anon`)
    expect(await fails(`select * from profiles`)).toMatch(/permission denied/)
    await db.exec(`reset role`)
  })
})

describe('0003: login por nombre de usuario', () => {
  beforeAll(async () => {
    // Cuenta creada con email real ANTES de 0003 (flujo anterior)
    await db.exec(`create table auth.identities (user_id uuid, provider text, provider_id text, identity_data jsonb);`)
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ('${PRE}','real@gmail.com','{"username":"Pre"}')`)
    await q(`insert into auth.identities values ('${PRE}','email','real@gmail.com','{"email":"real@gmail.com"}')`)
    await db.exec(sql('0003_usuario_login.sql'))
  })
  const ALIAS = /@usuarios\.horario-app\.com$/
  it('la cuenta previa con email real pasa a email interno y el real se guarda como contacto', async () => {
    const u = (await q(`select email from auth.users where id=$1`, [PRE])).rows[0].email
    expect(u).toMatch(ALIAS)
    expect((await q(`select contact_email from profile_private where profile_id=$1`, [PRE])).rows[0].contact_email).toBe('real@gmail.com')
    const i = (await q(`select identity_data->>'email' e, provider_id p from auth.identities where user_id=$1`, [PRE])).rows[0]
    expect(i.e).toMatch(ALIAS)
    expect(i.p).toBe(PRE)
  })
  it('login_alias devuelve el email interno por nombre (sin distinguir mayúsculas) y null si no existe', async () => {
    const a = (await q(`select login_alias('PRE') a`)).rows[0].a
    expect(a).toMatch(ALIAS)
    expect((await q(`select login_alias('nadie') a`)).rows[0].a).toBeNull()
  })
  it('una cuenta nueva registrada con email interno recibe alias', async () => {
    const mail = 'f0f0f0f0-0000-0000-0000-000000000001@usuarios.horario-app.com'
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d1',$1,'{"username":"Nuevo"}')`, [mail])
    expect((await q(`select login_alias('nuevo') a`)).rows[0].a).toBe(mail)
  })
  it('anon puede llamar a login_alias pero no leer login_aliases', async () => {
    await db.exec(`set role anon`)
    expect((await q(`select login_alias('pre') a`)).rows[0].a).toMatch(ALIAS)
    expect(await fails(`select * from login_aliases`)).toMatch(/permission denied/)
    await db.exec(`reset role`)
  })
  it('el email de contacto es privado: solo su dueño lo ve y lo edita', async () => {
    await as(PRE, async () => expect((await q(`select * from profile_private`)).rows).toHaveLength(1))
    await as(A, async () => {
      expect((await q(`select profile_id from profile_private`)).rows).toEqual([{ profile_id: A }])
      expect(await fails(`insert into profile_private (profile_id, contact_email) values ('${PRE}','x@y.com')`)).toBeTruthy()
    })
  })
  it('borrar una cuenta de Auth no borra el perfil ni sus datos', async () => {
    const T = '00000000-0000-0000-0000-0000000000f1'
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ($1,'t@usuarios.horario-app.com','{"username":"Temp"}')`, [T])
    await q(`delete from auth.users where id=$1`, [T])
    const r = await q(`select auth_id from profiles where id=$1`, [T])
    expect(r.rows).toEqual([{ auth_id: null }])
  })
  it('la cuenta antigua ya reclamada también recibe alias y conserva su email como contacto', async () => {
    expect((await q(`select login_alias('viejo') a`)).rows[0].a).toMatch(ALIAS)
    expect((await q(`select contact_email from profile_private where profile_id=$1`, [LEGACY])).rows[0].contact_email).toBe('viejo@x.com')
  })
  it('reclamar una cuenta antigua con el trigger nuevo deja alias', async () => {
    const P = '00000000-0000-0000-0000-0000000000e1'
    await q(`insert into profiles (id, username) values ($1, 'otro')`, [P])
    await q(`insert into legacy_credentials values ($1, 'h2')`, [P])
    await q(`insert into auth.users (id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d2','zz@usuarios.horario-app.com',$1)`, [JSON.stringify({ legacy_username: 'otro', legacy_hash: 'h2' })])
    expect((await q(`select login_alias('otro') a`)).rows[0].a).toBe('zz@usuarios.horario-app.com')
  })
})

