-- 0002_auth_rls: Supabase Auth + RLS + roles de grupo + código de invitación + RPCs.
--
-- CONSERVA TODOS LOS DATOS EXISTENTES. Los usuarios antiguos (sin email) mantienen su
-- perfil con su mismo id: la primera vez que entren, la app les pide un email y una
-- contraseña nueva, demuestran que son ellos con su contraseña antigua, y su perfil
-- queda enlazado a su nueva cuenta de Supabase Auth (profiles.auth_id). Nada se borra.
--
-- Por eso las políticas no usan auth.uid() directamente sino public.me(), que traduce
-- el usuario de Auth a su perfil (para cuentas nuevas, profile.id = auth.users.id).

-- ---------------------------------------------------------------------------
-- 1. profiles enlazado a auth.users (por auth_id) y credenciales heredadas aparte
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists auth_id uuid unique references auth.users(id) on delete cascade;

-- Hash SHA-256 antiguo, sacado de profiles para que ningún cliente pueda leerlo.
-- Solo sirve para verificar al reclamar la cuenta y se borra al reclamarla.
create table if not exists public.legacy_credentials (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null
);
insert into public.legacy_credentials (profile_id, password_hash)
select id, password_hash from public.profiles
 where password_hash is not null and auth_id is null
on conflict do nothing;
alter table public.profiles drop column if exists password_hash;
alter table public.legacy_credentials enable row level security; -- sin políticas: solo funciones

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles
  add constraint profiles_username_len check (char_length(btrim(username)) between 2 and 30) not valid;
alter table public.profiles
  add constraint profiles_bio_len check (bio is null or char_length(bio) <= 500) not valid;

-- Perfil del usuario autenticado (null si no tiene sesión).
create or replace function public.me()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_id = auth.uid();
$$;

-- Al registrarse: o se crea un perfil nuevo, o se reclama un perfil antiguo.
-- El signUp envía en options.data: username (cuenta nueva) o
-- legacy_username + legacy_hash (SHA-256 de la contraseña antigua) para reclamar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name   text;
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
    return new;
  end if;

  v_name := btrim(coalesce(v_meta ->> 'username', split_part(new.email, '@', 1)));
  insert into public.profiles (id, auth_id, username) values (new.id, new.id, v_name);
  return new;
exception when unique_violation then
  raise exception 'username_taken' using errcode = 'P0001';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nombre libre para una cuenta nueva (callable sin sesión).
create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(btrim(p_username)));
$$;

-- ¿Es un usuario antiguo pendiente de reclamar? (para guiar al usuario en el login)
create or replace function public.legacy_account_pending(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles p join public.legacy_credentials c on c.profile_id = p.id
                  where lower(p.username) = lower(btrim(p_username)) and p.auth_id is null);
$$;

-- Comprobación previa al reclamar (Supabase oculta los mensajes de errores del trigger).
create or replace function public.legacy_claim_valid(p_username text, p_hash text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles p join public.legacy_credentials c on c.profile_id = p.id
                  where lower(p.username) = lower(btrim(p_username)) and p.auth_id is null
                    and c.password_hash = lower(p_hash));
$$;

-- ---------------------------------------------------------------------------
-- 3. Grupos: código visible + código de invitación largo, roles
-- ---------------------------------------------------------------------------
create table public.groups (
  code       text primary key,  -- sin checks: los códigos antiguos se conservan tal cual
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Aparte de groups para que solo los admins puedan leer el código de invitación.
create table public.group_invites (
  group_code  text primary key references public.groups(code) on delete cascade,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
);

alter table public.group_memberships
  add column role text not null default 'member' check (role in ('owner', 'admin', 'member'));

-- Grupos que ya tuvieran miembros (por si se reaplica sobre datos de Auth).
-- Los grupos antiguos eran solo un texto: se crean ahora a partir de todo lo que existe.
-- El miembro más antiguo de cada grupo pasa a ser su owner.
insert into public.groups (code, created_by)
select c.code, (select m.user_id from public.group_memberships m where m.group_code = c.code
                order by m.joined_at asc limit 1)
from (select group_code as code from public.group_memberships
      union select group_code from public.group_settings
      union select group_code from public.schedules
      union select group_code from public.schedule_overrides) c
on conflict do nothing;
insert into public.group_invites (group_code) select code from public.groups on conflict do nothing;
update public.group_memberships gm set role = 'owner'
 from public.groups g where g.code = gm.group_code and g.created_by = gm.user_id;

alter table public.group_memberships
  add constraint group_memberships_group_fkey foreign key (group_code) references public.groups(code) on delete cascade;
alter table public.group_settings
  add constraint group_settings_group_fkey foreign key (group_code) references public.groups(code) on delete cascade;
alter table public.schedules
  add constraint schedules_group_fkey foreign key (group_code) references public.groups(code) on delete cascade;
alter table public.schedule_overrides
  add constraint schedule_overrides_group_fkey foreign key (group_code) references public.groups(code) on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. Funciones auxiliares para las políticas (security definer: evitan recursión de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_memberships where group_code = p_code and user_id = public.me());
$$;

create or replace function public.is_group_admin(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_memberships
                  where group_code = p_code and user_id = public.me() and role in ('owner', 'admin'));
$$;

create or replace function public.shares_group_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_memberships a
    join public.group_memberships b on a.group_code = b.group_code
    where a.user_id = public.me() and b.user_id = p_user);
$$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships
                  where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b) and status = 'accepted');
$$;

create or replace function public.is_event_creator(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = p_event and creator_id = public.me());
$$;

create or replace function public.is_event_participant(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = p_event and creator_id = public.me())
      or exists (select 1 from public.event_invitations where event_id = p_event and invitee_id = public.me());
$$;

-- Comparten algún plan (para ver el perfil/nombre de los otros participantes).
create or replace function public.shares_event_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where (e.creator_id = public.me() and exists (select 1 from public.event_invitations i where i.event_id = e.id and i.invitee_id = p_user))
       or (e.creator_id = p_user and exists (select 1 from public.event_invitations i where i.event_id = e.id and i.invitee_id = public.me()))
       or (exists (select 1 from public.event_invitations i1 where i1.event_id = e.id and i1.invitee_id = public.me())
           and exists (select 1 from public.event_invitations i2 where i2.event_id = e.id and i2.invitee_id = p_user)));
$$;

-- ---------------------------------------------------------------------------
-- 5. RPCs de grupos (único camino para crear/unirse/salir/cambiar roles)
-- ---------------------------------------------------------------------------
create or replace function public.create_group(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_code text := lower(btrim(p_code));
begin
  if public.me() is null then raise exception 'not_authenticated'; end if;
  if char_length(v_code) < 2 or char_length(v_code) > 40 then raise exception 'invalid_code'; end if;
  insert into public.groups (code, created_by) values (v_code, public.me());
  insert into public.group_invites (group_code) values (v_code);
  insert into public.group_memberships (user_id, group_code, role) values (public.me(), v_code, 'owner');
  insert into public.group_settings (group_code, config) values (v_code,
    '{"days":["mon","tue","wed","thu","fri"],"startTime":"09:00","endTime":"18:30","slotMinutes":90,"breaks":[{"start":"13:30","end":"14:00"}]}'::jsonb);
  return v_code;
exception when unique_violation then
  raise exception 'group_exists';
end $$;

-- Devuelve el código visible del grupo al que te has unido.
create or replace function public.join_group(p_invite text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if public.me() is null then raise exception 'not_authenticated'; end if;
  select group_code into v_code from public.group_invites where invite_code = lower(btrim(p_invite));
  if v_code is null then raise exception 'invalid_invite'; end if;
  insert into public.group_memberships (user_id, group_code, role) values (public.me(), v_code, 'member')
    on conflict do nothing;
  return v_code;
end $$;

-- Solo admins: leer el código de invitación (y regenerarlo si se filtró).
create or replace function public.get_invite_code(p_code text)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_group_admin(p_code) then raise exception 'forbidden'; end if;
  return (select invite_code from public.group_invites where group_code = p_code);
end $$;

create or replace function public.rotate_invite_code(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare v text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
begin
  if not public.is_group_admin(p_code) then raise exception 'forbidden'; end if;
  update public.group_invites set invite_code = v where group_code = p_code;
  return v;
end $$;

-- Salir del grupo. Si eras el último owner, el miembro más antiguo (admins primero) pasa a owner;
-- si no queda nadie, el grupo se borra con sus datos.
create or replace function public.leave_group(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_role text; v_next uuid;
begin
  select role into v_role from public.group_memberships where group_code = p_code and user_id = public.me();
  if v_role is null then return; end if;
  delete from public.schedule_overrides where group_code = p_code and user_id = public.me();
  delete from public.schedules where group_code = p_code and user_id = public.me();
  delete from public.group_memberships where group_code = p_code and user_id = public.me();
  if not exists (select 1 from public.group_memberships where group_code = p_code) then
    delete from public.groups where code = p_code;
  elsif v_role = 'owner' and not exists (select 1 from public.group_memberships where group_code = p_code and role = 'owner') then
    select user_id into v_next from public.group_memberships where group_code = p_code
      order by (role = 'admin') desc, joined_at asc limit 1;
    update public.group_memberships set role = 'owner' where group_code = p_code and user_id = v_next;
  end if;
end $$;

-- Solo el owner cambia roles (admin/member). Las transferencias de owner no se hacen aquí.
create or replace function public.set_member_role(p_code text, p_user uuid, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  if not exists (select 1 from public.group_memberships where group_code = p_code and user_id = public.me() and role = 'owner') then
    raise exception 'forbidden';
  end if;
  update public.group_memberships set role = p_role
   where group_code = p_code and user_id = p_user and role <> 'owner';
end $$;

-- Buscar a alguien por nombre exacto para mandarle solicitud de amistad (no expone más datos).
create or replace function public.find_user_by_username(p_username text)
returns table (id uuid, username text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username from public.profiles p
   where public.me() is not null and lower(p.username) = lower(btrim(p_username)) limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 6. Triggers de protección (columnas que el cliente no debe poder cambiar)
-- ---------------------------------------------------------------------------
create or replace function public.freeze_friendship_cols() returns trigger language plpgsql as $$
begin
  if new.user_a <> old.user_a or new.user_b <> old.user_b or new.requested_by <> old.requested_by then
    raise exception 'immutable_columns';
  end if;
  return new;
end $$;
create trigger friendships_freeze before update on public.friendships
  for each row execute function public.freeze_friendship_cols();

create or replace function public.freeze_invitation_cols() returns trigger language plpgsql as $$
begin
  if new.event_id <> old.event_id or new.invitee_id <> old.invitee_id then
    raise exception 'immutable_columns';
  end if;
  return new;
end $$;
create trigger invitations_freeze before update on public.event_invitations
  for each row execute function public.freeze_invitation_cols();

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_invites     enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_settings    enable row level security;
alter table public.schedules         enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.friendships       enable row level security;
alter table public.events            enable row level security;
alter table public.event_invitations enable row level security;

-- profiles: te ves a ti, a tus compañeros de grupo, amigos y participantes de tus planes.
create policy profiles_select on public.profiles for select to authenticated using (
  id = public.me() or public.shares_group_with(id) or public.are_friends(public.me(), id)
  or public.shares_event_with(id)
  or exists (select 1 from public.friendships f where f.status = 'pending'
              and ((f.user_a = public.me() and f.user_b = profiles.id) or (f.user_b = public.me() and f.user_a = profiles.id))));
create policy profiles_update on public.profiles for update to authenticated
  using (id = public.me()) with check (id = public.me());

-- groups / invites
create policy groups_select on public.groups for select to authenticated using (public.is_group_member(code));
-- group_invites: sin políticas = nadie del cliente; se accede solo por RPC (get_invite_code).

-- group_memberships: ver a los miembros de tus grupos; sin escritura directa (RPCs).
create policy memberships_select on public.group_memberships for select to authenticated
  using (public.is_group_member(group_code));

-- group_settings: leer si eres miembro, modificar solo admin/owner.
create policy settings_select on public.group_settings for select to authenticated
  using (public.is_group_member(group_code));
create policy settings_insert on public.group_settings for insert to authenticated
  with check (public.is_group_admin(group_code));
create policy settings_update on public.group_settings for update to authenticated
  using (public.is_group_admin(group_code)) with check (public.is_group_admin(group_code));

-- horarios: los ve tu grupo, solo escribes los tuyos.
create policy schedules_select on public.schedules for select to authenticated
  using (public.is_group_member(group_code));
create policy schedules_write on public.schedules for all to authenticated
  using (user_id = public.me() and public.is_group_member(group_code))
  with check (user_id = public.me() and public.is_group_member(group_code));

create policy overrides_select on public.schedule_overrides for select to authenticated
  using (public.is_group_member(group_code));
create policy overrides_write on public.schedule_overrides for all to authenticated
  using (user_id = public.me() and public.is_group_member(group_code))
  with check (user_id = public.me() and public.is_group_member(group_code));

-- amistades
create policy friendships_select on public.friendships for select to authenticated
  using (public.me() in (user_a, user_b));
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requested_by = public.me() and public.me() in (user_a, user_b) and status = 'pending');
create policy friendships_accept on public.friendships for update to authenticated
  using (public.me() in (user_a, user_b) and requested_by <> public.me())
  with check (status = 'accepted');
create policy friendships_delete on public.friendships for delete to authenticated
  using (public.me() in (user_a, user_b));

-- planes
create policy events_select on public.events for select to authenticated
  using (creator_id = public.me() or public.is_event_participant(id));
create policy events_insert on public.events for insert to authenticated with check (creator_id = public.me());
create policy events_update on public.events for update to authenticated
  using (creator_id = public.me()) with check (creator_id = public.me());
create policy events_delete on public.events for delete to authenticated using (creator_id = public.me());

create policy invitations_select on public.event_invitations for select to authenticated
  using (public.is_event_participant(event_id));
create policy invitations_insert on public.event_invitations for insert to authenticated
  with check (public.is_event_creator(event_id) and status = 'pending'
              and public.are_friends(public.me(), invitee_id));
create policy invitations_respond on public.event_invitations for update to authenticated
  using (invitee_id = public.me()) with check (invitee_id = public.me() and status in ('accepted', 'declined'));
create policy invitations_delete on public.event_invitations for delete to authenticated
  using (public.is_event_creator(event_id));

-- ---------------------------------------------------------------------------
-- 8. Permisos
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text), public.legacy_account_pending(text), public.legacy_claim_valid(text, text) to anon, authenticated;
grant execute on function
  public.create_group(text), public.join_group(text), public.get_invite_code(text),
  public.rotate_invite_code(text), public.leave_group(text), public.set_member_role(text, uuid, text),
  public.find_user_by_username(text), public.is_group_member(text), public.is_group_admin(text),
  public.shares_group_with(uuid), public.are_friends(uuid, uuid), public.is_event_creator(uuid),
  public.is_event_participant(uuid), public.shares_event_with(uuid), public.me()
  to authenticated;
-- Los clientes no insertan/borran en estas tablas directamente:
revoke all on public.legacy_credentials from authenticated;
revoke all on public.group_invites from authenticated;  -- solo vía RPC get_invite_code
revoke insert, delete on public.groups, public.group_memberships from authenticated;
revoke insert, delete, update on public.profiles from authenticated;
grant update (username, birthday, bio) on public.profiles to authenticated;
