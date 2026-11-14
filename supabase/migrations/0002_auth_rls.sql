-- 0002_auth_rls: Supabase Auth + RLS + roles de grupo + código de invitación + RPCs.
--
-- ⚠️  MIGRACIÓN DESTRUCTIVA PARA USUARIOS ANTIGUOS ⚠️
-- Las cuentas heredadas (profiles con password_hash, sin fila en auth.users) NO se pueden
-- convertir: Supabase Auth necesita email y no tenemos sus contraseñas (solo un SHA-256).
-- Esta migración COPIA esas filas a legacy.* (copia de seguridad) y las BORRA de public.*,
-- junto con sus horarios, grupos, amistades y planes. Quien ya tenía cuenta debe registrarse
-- de nuevo con email. Si no quieres perder nada, NO la apliques todavía.

-- ---------------------------------------------------------------------------
-- 1. Copia de seguridad de los datos heredados y limpieza
-- ---------------------------------------------------------------------------
create schema if not exists legacy;
revoke all on schema legacy from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles','group_memberships','group_settings','schedules',
                           'schedule_overrides','friendships','events','event_invitations']
  loop
    if not exists (select 1 from information_schema.tables where table_schema='legacy' and table_name=t) then
      execute format('create table legacy.%I as table public.%I', t, t);
    end if;
  end loop;
end $$;

-- Borra todo lo que cuelgue de perfiles que no existen en auth.users.
delete from public.event_invitations where invitee_id not in (select id from auth.users)
   or event_id in (select id from public.events where creator_id not in (select id from auth.users));
delete from public.events where creator_id not in (select id from auth.users);
delete from public.friendships where user_a not in (select id from auth.users)
   or user_b not in (select id from auth.users);
delete from public.schedule_overrides where user_id not in (select id from auth.users);
delete from public.schedules where user_id not in (select id from auth.users);
delete from public.group_memberships where user_id not in (select id from auth.users);
delete from public.profiles where id not in (select id from auth.users);
-- Ajustes de grupo sin ningún miembro restante quedan huérfanos.
delete from public.group_settings
 where group_code not in (select group_code from public.group_memberships);

-- ---------------------------------------------------------------------------
-- 2. profiles ligado a auth.users, sin password_hash
-- ---------------------------------------------------------------------------
alter table public.profiles drop column if exists password_hash;
alter table public.profiles alter column id drop default;
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.profiles drop constraint if exists profiles_username_key;
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
alter table public.profiles
  add constraint profiles_username_len check (char_length(btrim(username)) between 2 and 30);
alter table public.profiles
  add constraint profiles_bio_len check (bio is null or char_length(bio) <= 500);

-- Crea el perfil al registrarse. El nombre llega en options.data.username del signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_name text;
begin
  v_name := btrim(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  insert into public.profiles (id, username) values (new.id, v_name);
  return new;
exception when unique_violation then
  raise exception 'username_taken' using errcode = 'P0001';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comprobar disponibilidad antes de registrarse (callable sin sesión).
create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(btrim(p_username)));
$$;

-- ---------------------------------------------------------------------------
-- 3. Grupos: código visible + código de invitación largo, roles
-- ---------------------------------------------------------------------------
create table public.groups (
  code       text primary key check (code = lower(code) and char_length(code) between 2 and 40),
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
insert into public.groups (code, created_by)
select gm.group_code, (array_agg(gm.user_id order by gm.joined_at))[1]
from public.group_memberships gm group by gm.group_code
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
  select exists (select 1 from public.group_memberships where group_code = p_code and user_id = auth.uid());
$$;

create or replace function public.is_group_admin(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_memberships
                  where group_code = p_code and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.shares_group_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_memberships a
    join public.group_memberships b on a.group_code = b.group_code
    where a.user_id = auth.uid() and b.user_id = p_user);
$$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships
                  where user_a = least(p_a, p_b) and user_b = greatest(p_a, p_b) and status = 'accepted');
$$;

create or replace function public.is_event_creator(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = p_event and creator_id = auth.uid());
$$;

create or replace function public.is_event_participant(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = p_event and creator_id = auth.uid())
      or exists (select 1 from public.event_invitations where event_id = p_event and invitee_id = auth.uid());
$$;

-- Comparten algún plan (para ver el perfil/nombre de los otros participantes).
create or replace function public.shares_event_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where (e.creator_id = auth.uid() and exists (select 1 from public.event_invitations i where i.event_id = e.id and i.invitee_id = p_user))
       or (e.creator_id = p_user and exists (select 1 from public.event_invitations i where i.event_id = e.id and i.invitee_id = auth.uid()))
       or (exists (select 1 from public.event_invitations i1 where i1.event_id = e.id and i1.invitee_id = auth.uid())
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
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(v_code) < 2 or char_length(v_code) > 40 then raise exception 'invalid_code'; end if;
  insert into public.groups (code, created_by) values (v_code, auth.uid());
  insert into public.group_invites (group_code) values (v_code);
  insert into public.group_memberships (user_id, group_code, role) values (auth.uid(), v_code, 'owner');
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
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select group_code into v_code from public.group_invites where invite_code = lower(btrim(p_invite));
  if v_code is null then raise exception 'invalid_invite'; end if;
  insert into public.group_memberships (user_id, group_code, role) values (auth.uid(), v_code, 'member')
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
  select role into v_role from public.group_memberships where group_code = p_code and user_id = auth.uid();
  if v_role is null then return; end if;
  delete from public.schedule_overrides where group_code = p_code and user_id = auth.uid();
  delete from public.schedules where group_code = p_code and user_id = auth.uid();
  delete from public.group_memberships where group_code = p_code and user_id = auth.uid();
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
  if not exists (select 1 from public.group_memberships where group_code = p_code and user_id = auth.uid() and role = 'owner') then
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
   where auth.uid() is not null and lower(p.username) = lower(btrim(p_username)) limit 1;
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
  id = auth.uid() or public.shares_group_with(id) or public.are_friends(auth.uid(), id)
  or public.shares_event_with(id)
  or exists (select 1 from public.friendships f where f.status = 'pending'
              and ((f.user_a = auth.uid() and f.user_b = profiles.id) or (f.user_b = auth.uid() and f.user_a = profiles.id))));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

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
  using (user_id = auth.uid() and public.is_group_member(group_code))
  with check (user_id = auth.uid() and public.is_group_member(group_code));

create policy overrides_select on public.schedule_overrides for select to authenticated
  using (public.is_group_member(group_code));
create policy overrides_write on public.schedule_overrides for all to authenticated
  using (user_id = auth.uid() and public.is_group_member(group_code))
  with check (user_id = auth.uid() and public.is_group_member(group_code));

-- amistades
create policy friendships_select on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requested_by = auth.uid() and auth.uid() in (user_a, user_b) and status = 'pending');
create policy friendships_accept on public.friendships for update to authenticated
  using (auth.uid() in (user_a, user_b) and requested_by <> auth.uid())
  with check (status = 'accepted');
create policy friendships_delete on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

-- planes
create policy events_select on public.events for select to authenticated
  using (creator_id = auth.uid() or public.is_event_participant(id));
create policy events_insert on public.events for insert to authenticated with check (creator_id = auth.uid());
create policy events_update on public.events for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy events_delete on public.events for delete to authenticated using (creator_id = auth.uid());

create policy invitations_select on public.event_invitations for select to authenticated
  using (public.is_event_participant(event_id));
create policy invitations_insert on public.event_invitations for insert to authenticated
  with check (public.is_event_creator(event_id) and status = 'pending'
              and public.are_friends(auth.uid(), invitee_id));
create policy invitations_respond on public.event_invitations for update to authenticated
  using (invitee_id = auth.uid()) with check (invitee_id = auth.uid() and status in ('accepted', 'declined'));
create policy invitations_delete on public.event_invitations for delete to authenticated
  using (public.is_event_creator(event_id));

-- ---------------------------------------------------------------------------
-- 8. Permisos
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function
  public.create_group(text), public.join_group(text), public.get_invite_code(text),
  public.rotate_invite_code(text), public.leave_group(text), public.set_member_role(text, uuid, text),
  public.find_user_by_username(text), public.is_group_member(text), public.is_group_admin(text),
  public.shares_group_with(uuid), public.are_friends(uuid, uuid), public.is_event_creator(uuid),
  public.is_event_participant(uuid), public.shares_event_with(uuid)
  to authenticated;
-- Los clientes no insertan/borran en estas tablas directamente:
revoke all on public.group_invites from authenticated;  -- solo vía RPC get_invite_code
revoke insert, delete on public.groups, public.group_memberships from authenticated;
revoke insert, delete, update on public.profiles from authenticated;
grant update (username, birthday, bio) on public.profiles to authenticated;
