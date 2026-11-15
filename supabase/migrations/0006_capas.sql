-- 0006_capas: las plantillas pasan a ser CAPAS de horario con frecuencia propia.
--   * color base (los bloques lo heredan), orden, frecuencia «cada N semanas» y semana ancla.
--   * las excepciones pueden apuntar a una capa concreta.
--   * la repetición quincenal A/B de cada BLOQUE se convierte en una capa propia de frecuencia 2.
--
-- ADITIVA e idempotente: no borra nada. Solo mueve los bloques quincenales a su nueva capa y los deja
-- como «todas las semanas» dentro de ella (mismo resultado, día a día). Se aplica igual tras 0005 en
-- seguida o mucho después.

alter table public.schedule_templates
  add column if not exists color text,
  add column if not exists every_n_weeks int not null default 1,
  add column if not exists anchor_week date,
  add column if not exists sort_order int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schedule_templates_color_check2') then
    alter table public.schedule_templates add constraint schedule_templates_color_check2
      check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schedule_templates_every_check') then
    alter table public.schedule_templates add constraint schedule_templates_every_check
      check (every_n_weeks between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schedule_templates_anchor_check') then
    -- con frecuencia > 1 hace falta ancla, y el ancla es siempre un lunes
    alter table public.schedule_templates add constraint schedule_templates_anchor_check
      check ((every_n_weeks = 1 or anchor_week is not null)
             and (anchor_week is null or extract(isodow from anchor_week) = 1));
  end if;
end $$;

alter table public.schedule_exceptions
  add column if not exists template_id uuid references public.schedule_templates(id) on delete cascade;

drop policy if exists exceptions_own on public.schedule_exceptions;
create policy exceptions_own on public.schedule_exceptions for all to authenticated
  using (user_id = public.me())
  with check (user_id = public.me()
              and (group_code is null or public.is_group_member(group_code))
              and (template_id is null or public.owns_template(template_id)));

-- ---------------------------------------------------------------------------
-- Conversión: bloques quincenales (A/B) -> capa propia «cada 2 semanas»
-- La paridad se cuenta desde el lunes 1970-01-05 (semana A = semanas pares), igual que en la app.
-- ---------------------------------------------------------------------------
do $$
declare
  r record; v_new uuid; v_w int; v_anchor date; v_target int; v_name text;
begin
  for r in
    select distinct t.id as tid, t.user_id, t.name, t.is_active, t.active_from, t.active_to, t.color, b.repeat
      from public.schedule_templates t
      join public.schedule_blocks b on b.template_id = t.id
     where b.repeat in ('biweekly_a', 'biweekly_b')
  loop
    v_target := case when r.repeat = 'biweekly_a' then 0 else 1 end;
    v_w := floor((current_date - date '1970-01-05') / 7.0)::int;
    if v_w % 2 <> v_target then v_w := v_w - 1; end if;
    v_anchor := date '1970-01-05' + v_w * 7;   -- lunes reciente de la paridad correcta
    v_name := left(r.name, 34) || case when r.repeat = 'biweekly_a' then ' · cada 2 semanas' else ' · cada 2 semanas (la otra)' end;

    insert into public.schedule_templates (user_id, name, is_active, active_from, active_to, color, every_n_weeks, anchor_week)
      values (r.user_id, v_name, r.is_active, r.active_from, r.active_to, r.color, 2, v_anchor)
      returning id into v_new;
    update public.schedule_blocks set template_id = v_new, repeat = 'weekly'
     where template_id = r.tid and repeat = r.repeat;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- group_schedules: ahora las excepciones indican a qué capa apuntan
-- ---------------------------------------------------------------------------
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
               'id', e.id, 'user_id', e.user_id, 'template_id', e.template_id, 'group_code', e.group_code,
               'date', e.date, 'kind', e.kind, 'start_min', e.start_min, 'end_min', e.end_min,
               'title', case when e.user_id = v_me or m.schedule_visibility = 'full' then e.title end))
        from public.schedule_exceptions e
        join public.group_memberships m on m.user_id = e.user_id and m.group_code = p_group
       where e.group_code is null or e.group_code = p_group), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

revoke execute on function public.group_schedules(text) from public, anon;
grant execute on function public.group_schedules(text) to authenticated;

notify pgrst, 'reload schema';
