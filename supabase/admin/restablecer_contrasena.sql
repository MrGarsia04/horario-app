-- Restablecer la contraseña de alguien (opción B: manual, para administradores).
-- Se ejecuta en Supabase → SQL Editor (corre con permisos de administrador; ningún cliente
-- de la app puede hacerlo). No es una migración: no se aplica con `db push`.
--
-- PASO 0 (seguridad): antes de cambiar nada, comprueba que quien lo pide es quien dice.
--   Pídele el correo que guardó en la app y compáralo con el del paso 1. Si no coincide
--   (o no tiene correo guardado), NO lo restablezcas.

-- 1) ¿Existe el usuario y qué correo tiene guardado?
select p.username,
       p.auth_id is not null as migrado,          -- false = cuenta antigua, aún sin entrar
       pp.contact_email
  from public.profiles p
  left join public.profile_private pp on pp.profile_id = p.id
 where lower(p.username) = lower('USUARIO');       -- <- cambia USUARIO

-- 2) Ponerle una contraseña temporal (mín. 6 caracteres). Debe responder UPDATE 1.
--    Dásela por un canal privado y pídele que la cambie en Perfil → Cuenta.
update auth.users
   set encrypted_password = extensions.crypt('CLAVE-TEMPORAL', extensions.gen_salt('bf'))   -- <- cambia
 where id = (select auth_id from public.profiles where lower(username) = lower('USUARIO')); -- <- cambia

-- 2b) Si en el paso 1 salió migrado = false (cuenta antigua sin entrar todavía), no hay cuenta
--     de Auth: se le deja una contraseña antigua temporal y entrará con ella como siempre.
update public.legacy_credentials
   set password_hash = encode(sha256(convert_to('CLAVE-TEMPORAL', 'UTF8')), 'hex')           -- <- cambia
 where profile_id = (select id from public.profiles where lower(username) = lower('USUARIO')); -- <- cambia

-- Extra: ¿quién no tiene correo guardado? (para recordarles que lo añadan)
select p.username
  from public.profiles p
  left join public.profile_private pp on pp.profile_id = p.id
 where pp.contact_email is null
 order by 1;
