-- 0005_horarios_bloques: horarios personales por BLOQUES (minutos reales), con plantillas,
-- repetición quincenal, excepciones por fecha y visibilidad por persona y grupo.
--
-- ADITIVA: no borra ni modifica schedules / schedule_overrides. Los convierte (una sola vez, por
-- usuario) en plantillas y bloques; los datos antiguos quedan intactos hasta que decidas retirarlos.
-- Los horarios ajenos NO se leen con SELECT directo sino con la RPC group_schedules, que oculta
-- título/color/lugar salvo que el dueño haya elegido visibilidad 'full' en ese grupo.

alter table public.group_memberships
  add column if not exists schedule_visibility text not null default 'busy'
  check (schedule_visibility in ('busy', 'full'));

create table public.schedule_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  is_active   boolean not null default true,
  active_from date,
  active_to   date,
  created_at  timestamptz not null default now(),
  check (active_from is null or active_to is null or active_from <= active_to)
);
create index schedule_templates_user_idx on public.schedule_templates (user_id);

create table public.schedule_blocks (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.schedule_templates(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  group_code  text references public.groups(code) on delete cascade,  -- null = todos mis grupos
  title       text check (title is null or char_length(title) <= 80),
  color       text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  location    text check (location is null or char_length(location) <= 80),
  day         text not null check (day in ('mon','tue','wed','thu','fri','sat','sun')),
  start_min   int  not null check (start_min between 0 and 1439),
  end_min     int  not null check (end_min between 1 and 1440),
  repeat      text not null default 'weekly' check (repeat in ('weekly','biweekly_a','biweekly_b')),
  valid_from  date,
  valid_to    date,
  created_at  timestamptz not null default now(),
  check (end_min > start_min),
  check (valid_from is null or valid_to is null or valid_from <= valid_to)
);
create index schedule_blocks_user_idx on public.schedule_blocks (user_id);
create index schedule_blocks_template_idx on public.schedule_blocks (template_id);

create table public.schedule_exceptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  group_code text references public.groups(code) on delete cascade,
  date       date not null,
  kind       text not null check (kind in ('free', 'busy')),
  start_min  int check (start_min is null or start_min between 0 and 1439),
  end_min    int check (end_min is null or end_min between 1 and 1440),
  title      text check (title is null or char_length(title) <= 80),
  created_at timestamptz not null default now(),
  check ((start_min is null) = (end_min is null)),
  check (start_min is null or end_min > start_min),
  check (kind = 'free' or start_min is not null)  -- una ocupación puntual necesita rango
);
create index schedule_exceptions_user_idx on public.schedule_exceptions (user_id, date);

-- ---------------------------------------------------------------------------
-- RLS: cada persona gestiona solo lo suyo
-- ---------------------------------------------------------------------------
alter table public.schedule_templates  enable row level security;
alter table public.schedule_blocks     enable row level security;
alter table public.schedule_exceptions enable row level security;

create or replace function public.owns_template(p_template uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.schedule_templates where id = p_template and user_id = public.me());
$$;

create policy templates_own on public.schedule_templates for all to authenticated
  using (user_id = public.me()) with check (user_id = public.me());

create policy blocks_own on public.schedule_blocks for all to authenticated
  using (user_id = public.me())
  with check (user_id = public.me() and public.owns_template(template_id)
              and (group_code is null or public.is_group_member(group_code)));

create policy exceptions_own on public.schedule_exceptions for all to authenticated
  using (user_id = public.me())
  with check (user_id = public.me() and (group_code is null or public.is_group_member(group_code)));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Horarios de todos los miembros del grupo, respetando la visibilidad de cada persona.
create or replace function public.group_schedules(p_group text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := public.me();
  v_result jsonb;
begin
  if not public.is_group_member(p_group) then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'visibility', coalesce((select jsonb_object_agg(user_id, schedule_visibility)
                              from public.group_memberships where group_code = p_group), '{}'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(t))
                             from public.schedule_templates t
                            where t.user_id in (select user_id from public.group_memberships where group_code = p_group)), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'template_id', b.template_id, 'user_id', b.user_id, 'group_code', b.group_code,
               'title',    case when b.user_id = v_me or m.schedule_visibility = 'full' then b.title end,
               'color',    case when b.user_id = v_me or m.schedule_visibility = 'full' then b.color end,
               'location', case when b.user_id = v_me or m.schedule_visibility = 'full' then b.location end,
               'day', b.day, 'start_min', b.start_min, 'end_min', b.end_min, 'repeat', b.repeat,
               'valid_from', b.valid_from, 'valid_to', b.valid_to))
        from public.schedule_blocks b
        join public.group_memberships m on m.user_id = b.user_id and m.group_code = p_group
       where b.group_code is null or b.group_code = p_group), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'user_id', e.user_id, 'group_code', e.group_code, 'date', e.date, 'kind', e.kind,
               'start_min', e.start_min, 'end_min', e.end_min,
               'title', case when e.user_id = v_me or m.schedule_visibility = 'full' then e.title end))
        from public.schedule_exceptions e
        join public.group_memberships m on m.user_id = e.user_id and m.group_code = p_group
       where e.group_code is null or e.group_code = p_group), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.set_schedule_visibility(p_group text, p_visibility text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_visibility not in ('busy', 'full') then raise exception 'invalid_visibility'; end if;
  update public.group_memberships set schedule_visibility = p_visibility
   where group_code = p_group and user_id = public.me();
end $$;

revoke execute on function public.group_schedules(text), public.set_schedule_visibility(text, text),
  public.owns_template(uuid) from public, anon;
grant execute on function public.group_schedules(text), public.set_schedule_visibility(text, text),
  public.owns_template(uuid) to authenticated;
revoke all on public.schedule_templates, public.schedule_blocks, public.schedule_exceptions from anon;

-- ---------------------------------------------------------------------------
-- Conversión de los horarios antiguos (aditiva e idempotente: solo a quien aún no tiene plantillas)
--   schedules.busy_slots          -> horario habitual
--   schedule_overrides (por semana, se arrastra hacia delante y REEMPLAZA todo el horario)
--                                 -> una plantilla por tramo de fechas (active_from / active_to)
-- Cada bloque queda ligado a su grupo (group_code) para conservar exactamente lo que se veía.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.legacy_to_template(
  p_user uuid, p_group text, p_name text, p_from date, p_to date, p_slots jsonb
) returns void language plpgsql as $$
declare v_tpl uuid; v_item jsonb; v_s int; v_e int;
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then return; end if;
  insert into public.schedule_templates (user_id, name, is_active, active_from, active_to)
    values (p_user, left(p_name, 60), true, p_from, p_to) returning id into v_tpl;
  for v_item in select * from jsonb_array_elements(p_slots) loop
    continue when (v_item ->> 'day') not in ('mon','tue','wed','thu','fri','sat','sun');
    v_s := split_part(v_item ->> 'start', ':', 1)::int * 60 + split_part(v_item ->> 'start', ':', 2)::int;
    v_e := split_part(v_item ->> 'end',   ':', 1)::int * 60 + split_part(v_item ->> 'end',   ':', 2)::int;
    continue when v_e <= v_s or v_s < 0 or v_e > 1440;
    insert into public.schedule_blocks (template_id, user_id, group_code, day, start_min, end_min)
      values (v_tpl, p_user, p_group, v_item ->> 'day', v_s, v_e);
  end loop;
end $$;

-- Usuarios a convertir (se calcula ANTES del bucle: al crear plantillas de un grupo no deben
-- quedar excluidos sus otros grupos).
create temp table _usuarios_a_migrar as
  select distinct x.user_id
    from (select user_id from public.schedules union select user_id from public.schedule_overrides) x
   where not exists (select 1 from public.schedule_templates t where t.user_id = x.user_id);

do $$
declare
  r record; v_prev_ws date; v_next date; o record; v_base jsonb; v_first_override date;
begin
  for r in
    select distinct x.user_id, x.group_code
      from (select user_id, group_code from public.schedules
            union select user_id, group_code from public.schedule_overrides) x
      join public.groups g on g.code = x.group_code
     where x.user_id in (select user_id from _usuarios_a_migrar)
  loop
    select busy_slots into v_base from public.schedules where user_id = r.user_id and group_code = r.group_code;
    select min(week_start) into v_first_override
      from public.schedule_overrides where user_id = r.user_id and group_code = r.group_code;

    perform pg_temp.legacy_to_template(r.user_id, r.group_code, 'Mi horario (' || r.group_code || ')',
      null, case when v_first_override is null then null else v_first_override - 1 end, v_base);

    for o in
      select week_start, busy_slots,
             lead(week_start) over (order by week_start) as next_ws
        from public.schedule_overrides where user_id = r.user_id and group_code = r.group_code
       order by week_start
    loop
      perform pg_temp.legacy_to_template(r.user_id, r.group_code,
        'Mi horario desde ' || o.week_start || ' (' || r.group_code || ')',
        o.week_start, case when o.next_ws is null then null else o.next_ws - 1 end, o.busy_slots);
    end loop;
  end loop;
end $$;

drop table _usuarios_a_migrar;

notify pgrst, 'reload schema';
