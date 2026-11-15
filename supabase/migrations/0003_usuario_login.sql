-- 0003_login_por_usuario: se entra con NOMBRE DE USUARIO + contraseña; el email real es un
-- dato opcional que se pide después de iniciar sesión.
--
-- Supabase Auth exige un email para cada cuenta. Cada cuenta usa por dentro un email
-- interno inventado (<uuid>@usuarios.horario-app.com) que el usuario nunca ve ni usa:
--   * login_aliases: perfil -> email interno (sin acceso de cliente; la app lo consulta
--     por la RPC login_alias al iniciar sesión).
--   * profile_private: el email REAL de contacto, visible solo para su dueño.
-- Requiere "Confirm email" DESACTIVADO en Supabase (no se envía ningún correo).

-- Borrar una cuenta de Auth NO debe arrastrar el perfil (con sus horarios y grupos): en 0002 el
-- enlace era ON DELETE CASCADE. Ahora el perfil se queda y solo pierde el enlace (auth_id = null).
alter table public.profiles drop constraint if exists profiles_auth_id_fkey;
alter table public.profiles
  add constraint profiles_auth_id_fkey foreign key (auth_id) references auth.users(id) on delete set null;

create table if not exists public.login_aliases (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email      text not null unique
);
alter table public.login_aliases enable row level security; -- sin políticas: solo funciones

create table if not exists public.profile_private (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  contact_email text,
  updated_at    timestamptz not null default now()
);
alter table public.profile_private enable row level security;
create policy profile_private_own on public.profile_private for all to authenticated
  using (profile_id = public.me()) with check (profile_id = public.me());

-- Cuentas ya creadas con un email real (pruebas con el flujo anterior): el email real pasa
-- a ser el de contacto y la cuenta recibe un email interno, para que no se filtre.
do $$
declare r record; v_alias text;
begin
  for r in select p.id as profile_id, u.id as user_id, u.email
             from public.profiles p join auth.users u on u.id = p.auth_id
            where not exists (select 1 from public.login_aliases a where a.profile_id = p.id)
  loop
    v_alias := case when r.email like '%@usuarios.horario-app.com' then r.email
                    else gen_random_uuid()::text || '@usuarios.horario-app.com' end;
    if v_alias <> r.email then
      insert into public.profile_private (profile_id, contact_email) values (r.profile_id, r.email)
        on conflict (profile_id) do nothing;
      update auth.users set email = v_alias where id = r.user_id;
      update auth.identities
         set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_alias)),
             provider_id = case when provider = 'email' then r.user_id::text else provider_id end
       where user_id = r.user_id and provider = 'email';
    end if;
    insert into public.login_aliases (profile_id, email) values (r.profile_id, v_alias);
  end loop;
end $$;

-- El trigger de registro guarda el email interno de la cuenta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name    text;
  v_profile uuid;
begin
  if v_meta ? 'legacy_username' then
    select p.id into v_profile
      from public.profiles p
      join public.legacy_credentials c on c.profile_id = p.id
     where lower(p.username) = lower(btrim(v_meta ->> 'legacy_username'))
       and p.auth_id is null
       and c.password_hash = lower(v_meta ->> 'legacy_hash');
    if v_profile is null then
      raise exception 'invalid_legacy_credentials' using errcode = 'P0001';
    end if;
    update public.profiles set auth_id = new.id where id = v_profile;
    delete from public.legacy_credentials where profile_id = v_profile;
    insert into public.login_aliases (profile_id, email) values (v_profile, new.email);
    return new;
  end if;

  v_name := btrim(coalesce(v_meta ->> 'username', split_part(new.email, '@', 1)));
  insert into public.profiles (id, auth_id, username) values (new.id, new.id, v_name);
  insert into public.login_aliases (profile_id, email) values (new.id, new.email);
  return new;
exception when unique_violation then
  raise exception 'username_taken' using errcode = 'P0001';
end;
$$;

-- Email interno para iniciar sesión con un nombre de usuario (null si no existe o aún es
-- una cuenta antigua sin reclamar). No revela ningún dato personal.
create or replace function public.login_alias(p_username text)
returns text
language sql stable security definer set search_path = public
as $$
  select a.email from public.profiles p join public.login_aliases a on a.profile_id = p.id
   where lower(p.username) = lower(btrim(p_username)) and p.auth_id is not null;
$$;

revoke execute on function public.login_alias(text) from public;
grant execute on function public.login_alias(text) to anon, authenticated;
revoke all on public.login_aliases from anon, authenticated;
revoke all on public.profile_private from anon;

notify pgrst, 'reload schema';
