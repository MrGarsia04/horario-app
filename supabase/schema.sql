-- Ejecuta esto en Supabase: proyecto > SQL Editor > New query > pega y ejecuta

create table if not exists schedules (
  id bigint generated always as identity primary key,
  group_code text not null,
  member_name text not null,
  busy_slots jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (group_code, member_name)
);

-- Habilita Row Level Security y permite leer/escribir sin login propio,
-- ya que el "código de grupo" hace de contraseña compartida sencilla.
alter table schedules enable row level security;

create policy "Cualquiera puede leer horarios"
  on schedules for select
  using (true);

create policy "Cualquiera puede insertar su horario"
  on schedules for insert
  with check (true);

create policy "Cualquiera puede actualizar su horario"
  on schedules for update
  using (true);
