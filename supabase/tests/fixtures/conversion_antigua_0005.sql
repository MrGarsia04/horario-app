-- COPIA de la conversión que traía 0005 antes de corregirla (solo para tests): una plantilla por cada override.
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
