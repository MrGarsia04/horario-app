-- 0001_base: esquema ACTUAL de la app, reconstruido a partir del código (src/lib, src/hooks)
-- porque no se pudo hacer `supabase db pull` (sin Docker). Es idempotente (IF NOT EXISTS):
-- si ya lo tienes en producción, no cambia nada. REVISA que coincida con tu base real
-- antes de aplicar (ver `supabase db pull` en el README).
--
-- Estado "heredado": sin Supabase Auth, usuarios propios con password_hash (SHA-256)
-- y sin RLS efectiva. La migración 0002 lo sustituye por Auth + RLS.

create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text,
  birthday      date,
  bio           text,
  created_at    timestamptz not null default now()
);

create table if not exists public.group_memberships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  group_code text not null,
  joined_at  timestamptz not null default now(),
  primary key (user_id, group_code)
);

create table if not exists public.group_settings (
  group_code text primary key,
  config     jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  group_code text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  busy_slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (group_code, user_id)
);

create table if not exists public.schedule_overrides (
  group_code text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  busy_slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (group_code, user_id, week_start)
);

-- Pareja ordenada (user_a < user_b) para que solo exista una fila por amistad.
create table if not exists public.friendships (
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  event_date  date not null,
  start_time  time,
  end_time    time,
  created_at  timestamptz not null default now()
);

create table if not exists public.event_invitations (
  event_id   uuid not null references public.events(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  primary key (event_id, invitee_id)
);
