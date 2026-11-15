-- 0004_recuperacion: recuperación de contraseña por código enviado al correo de contacto.
-- Solo la usan las funciones serverless de /api (con la service role key). RLS activada SIN
-- políticas y sin permisos para anon/authenticated: ningún cliente puede leer ni escribir.

-- Un código vigente por perfil (pedir otro lo sustituye = invalida el anterior).
create table public.recovery_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code_hash  text not null,                 -- HMAC del código, nunca el código
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);

-- Registro de solicitudes para limitar abusos (por perfil y por IP con hash).
create table public.recovery_requests (
  id           bigint generated always as identity primary key,
  profile_id   uuid references public.profiles(id) on delete cascade,
  ip_hash      text,
  requested_at timestamptz not null default now()
);
create index recovery_requests_profile_idx on public.recovery_requests (profile_id, requested_at);
create index recovery_requests_ip_idx on public.recovery_requests (ip_hash, requested_at);

alter table public.recovery_codes    enable row level security;
alter table public.recovery_requests enable row level security;
revoke all on public.recovery_codes, public.recovery_requests from anon, authenticated;

-- Tras cambiar la contraseña se cierran todas las sesiones de esa cuenta.
create or replace function public.revoke_user_sessions(p_auth_id uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  delete from auth.sessions where user_id = p_auth_id;  -- los refresh tokens caen en cascada
end $$;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- Cuenta un intento de forma atómica y devuelve el total (0 si no hay código vigente).
create or replace function public.bump_recovery_attempts(p_profile uuid)
returns int
language sql security definer set search_path = public as $$
  with u as (
    update public.recovery_codes set attempts = attempts + 1 where profile_id = p_profile returning attempts
  )
  select coalesce((select attempts from u), 0);
$$;
revoke execute on function public.bump_recovery_attempts(uuid) from public, anon, authenticated;
grant execute on function public.bump_recovery_attempts(uuid) to service_role;

-- Limpieza de lo caducado (llamable a mano o desde un cron).
create or replace function public.purge_recovery_data()
returns void language sql security definer set search_path = public as $$
  delete from public.recovery_codes where expires_at < now();
  delete from public.recovery_requests where requested_at < now() - interval '2 days';
$$;
revoke execute on function public.purge_recovery_data() from public, anon, authenticated;
grant execute on function public.purge_recovery_data() to service_role;

notify pgrst, 'reload schema';
