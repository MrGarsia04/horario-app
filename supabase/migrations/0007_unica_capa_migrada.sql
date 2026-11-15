-- 0007_unica_capa_migrada: UNA sola capa «Mi horario» por persona (arregla la conversión de 0005).
--
-- La conversión original de 0005 creaba una capa por cada override semanal antiguo (el programa viejo
-- guardaba uno cada vez que se editaba una semana), y a quien editó muchas semanas le salieron decenas.
-- Esta migración, para la base donde 0005/0006 YA se aplicaron:
--
--  QUÉ BORRA (y solo esto):
--   1) Las capas generadas por esa conversión, que se reconocen por TODAS estas señales a la vez:
--      nombre «Mi horario (grupo)» o «Mi horario desde AAAA-MM-DD (grupo)», sin color, sin frecuencia,
--      sin excepciones apuntando a ellas, y con todos sus bloques sin tocar (sin título, color, lugar,
--      repetición ni fechas, y del grupo del nombre). Si el usuario retocó algo de una, NO se borra.
--      Al borrar una capa se borran sus bloques.
--   2) Capas vacías llamadas exactamente «Mi horario» que sobren (las creó el programa al abrir el
--      editor varias veces): si la persona tiene otra capa con bloques se borran todas las vacías;
--      si no, se conserva la más antigua.
--   NUNCA borra capas con otros nombres ni con bloques editados. No toca schedules ni schedule_overrides.
--
--  QUÉ RECONSTRUYE: si tras lo anterior la persona no tiene NINGUNA capa con bloques y sí horario antiguo,
--  rellena su capa «Mi horario» (la vacía más antigua, o una nueva) con el horario que tiene HOY, para
--  todas las semanas y desde el lunes de esta semana (ver criterio abajo). Si ya tenía capas con
--  bloques (hechas a mano), no añade nada: asume que ya montó su horario.
--
-- Además: ensure_default_layer() crea «Mi horario» de forma segura (con bloqueo), para que dos pantallas
-- abiertas a la vez no vuelvan a crear capas de más. Idempotente.

create or replace function public.ensure_default_layer()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.me();
  v_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ensure_default_layer:' || v_me::text, 0));
  select id into v_id from public.schedule_templates where user_id = v_me order by created_at, id limit 1;
  if v_id is null then
    insert into public.schedule_templates (user_id, name, color, active_from)
      values (v_me, 'Mi horario', '#4C7C7C', date_trunc('week', current_date)::date)
      returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.ensure_default_layer() from public, anon;
grant execute on function public.ensure_default_layer() to authenticated;

-- Conversión de los horarios antiguos a UNA sola capa «Mi horario» por persona.
-- Criterio: el horario que la persona tiene HOY (para cada grupo: el último override con
-- week_start <= esta semana; si no hay, el horario habitual). Los overrides pasados NO crean
-- capas (siguen en schedule_overrides, que no se toca). Empieza el lunes de esta semana, sin fin.
-- Un override FUTURO (semana posterior a esta) sí se conserva, como capa «Mi horario desde <fecha>
-- (grupo)» con sus fechas, y el horario de hoy de ese grupo termina el día anterior (valid_to).
-- Cada bloque queda ligado a su grupo (group_code) para ver exactamente lo mismo que antes.
create or replace function pg_temp.insertar_bloques(
  p_layer uuid, p_user uuid, p_group text, p_slots jsonb, p_valid_to date, p_valid_from date default null
) returns void language plpgsql as $f$
declare v_item jsonb; v_s int; v_e int;
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then return; end if;
  for v_item in select * from jsonb_array_elements(p_slots) loop
    continue when (v_item ->> 'day') not in ('mon','tue','wed','thu','fri','sat','sun');
    v_s := split_part(v_item ->> 'start', ':', 1)::int * 60 + split_part(v_item ->> 'start', ':', 2)::int;
    v_e := split_part(v_item ->> 'end',   ':', 1)::int * 60 + split_part(v_item ->> 'end',   ':', 2)::int;
    continue when v_e <= v_s or v_s < 0 or v_e > 1440;
    insert into public.schedule_blocks (template_id, user_id, group_code, day, start_min, end_min, valid_from, valid_to)
      values (p_layer, p_user, p_group, v_item ->> 'day', v_s, v_e, p_valid_from, p_valid_to);
  end loop;
end $f$;

create or replace function pg_temp.convertir_usuario(p_user uuid, p_layer uuid)
returns void language plpgsql as $f$
declare
  w date := date_trunc('week', current_date)::date;
  g record; o record; v_slots jsonb; v_first_future date; v_fut uuid;
begin
  for g in
    select distinct x.group_code
      from (select group_code from public.schedules where user_id = p_user
            union select group_code from public.schedule_overrides where user_id = p_user) x
      join public.groups gr on gr.code = x.group_code
  loop
    select min(week_start) into v_first_future from public.schedule_overrides
     where user_id = p_user and group_code = g.group_code and week_start > w;

    select busy_slots into v_slots from public.schedule_overrides
     where user_id = p_user and group_code = g.group_code and week_start <= w
     order by week_start desc limit 1;
    if not found then
      select busy_slots into v_slots from public.schedules where user_id = p_user and group_code = g.group_code;
    end if;
    perform pg_temp.insertar_bloques(p_layer, p_user, g.group_code, v_slots,
      case when v_first_future is null then null else v_first_future - 1 end);

    for o in
      select week_start, busy_slots, lead(week_start) over (order by week_start) as next_ws
        from public.schedule_overrides
       where user_id = p_user and group_code = g.group_code and week_start > w
       order by week_start
    loop
      if jsonb_typeof(o.busy_slots) = 'array' and jsonb_array_length(o.busy_slots) > 0 then
        insert into public.schedule_templates (user_id, name, active_from, active_to)
          values (p_user, left('Mi horario desde ' || o.week_start || ' (' || g.group_code || ')', 60), o.week_start,
                  case when o.next_ws is null then null else o.next_ws - 1 end)
          returning id into v_fut;
        -- valid_from marca estas capas como «con fechas propias» (no se confunden con las de la conversión antigua)
        perform pg_temp.insertar_bloques(v_fut, p_user, g.group_code, o.busy_slots, null, o.week_start);
      end if;
    end loop;
  end loop;
end $f$;

-- 1) capas generadas por la conversión antigua
create temp table _capas_generadas as
select t.id
  from public.schedule_templates t
 where (t.name ~ '^Mi horario \(.+\)$' or t.name ~ '^Mi horario desde [0-9]{4}-[0-9]{2}-[0-9]{2} \(.+\)$')
   and t.color is null and t.every_n_weeks = 1 and t.anchor_week is null and t.sort_order = 0
   and not exists (select 1 from public.schedule_exceptions e where e.template_id = t.id)
   and not exists (
     select 1 from public.schedule_blocks b
      where b.template_id = t.id
        and (b.group_code is null
             or right(t.name, length(b.group_code) + 2) <> '(' || b.group_code || ')'
             or b.title is not null or b.color is not null or b.location is not null
             or b.repeat <> 'weekly' or b.valid_from is not null or b.valid_to is not null));

do $$
declare v_n int; v_kept int;
begin
  select count(*) into v_n from _capas_generadas;
  select count(*) into v_kept from public.schedule_templates t
   where (t.name ~ '^Mi horario \(.+\)$' or t.name ~ '^Mi horario desde [0-9]{4}-[0-9]{2}-[0-9]{2} \(.+\)$')
     and t.id not in (select id from _capas_generadas);
  raise notice '0007: se borran % capas generadas por la conversión antigua; se conservan % (editadas a mano)', v_n, v_kept;
end $$;

delete from public.schedule_templates where id in (select id from _capas_generadas);
drop table _capas_generadas;

-- 2) «Mi horario» vacías que sobran
delete from public.schedule_templates t
 where t.name = 'Mi horario'
   and not exists (select 1 from public.schedule_blocks b where b.template_id = t.id)
   and (
         exists (select 1 from public.schedule_templates o
                  where o.user_id = t.user_id and o.id <> t.id
                    and exists (select 1 from public.schedule_blocks ob where ob.template_id = o.id))
         or t.id <> (select e.id from public.schedule_templates e
                      where e.user_id = t.user_id and e.name = 'Mi horario'
                        and not exists (select 1 from public.schedule_blocks eb where eb.template_id = e.id)
                      order by e.created_at, e.id limit 1)
       );

-- 3) reconstrucción: solo a quien se ha quedado sin ninguna capa con bloques y tiene horario antiguo
do $$
declare r record; v_layer uuid;
begin
  for r in
    select distinct x.user_id
      from (select user_id from public.schedules union select user_id from public.schedule_overrides) x
     where not exists (select 1 from public.schedule_blocks b where b.user_id = x.user_id)
       and not exists (select 1 from public.schedule_templates t where t.user_id = x.user_id and t.name like 'Mi horario desde %')
  loop
    select id into v_layer from public.schedule_templates
     where user_id = r.user_id and name = 'Mi horario' order by created_at, id limit 1;
    if v_layer is null then
      insert into public.schedule_templates (user_id, name, color, active_from)
        values (r.user_id, 'Mi horario', '#4C7C7C', date_trunc('week', current_date)::date)
        returning id into v_layer;
    else
      update public.schedule_templates set active_from = coalesce(active_from, date_trunc('week', current_date)::date)
       where id = v_layer;
    end if;
    perform pg_temp.convertir_usuario(r.user_id, v_layer);
  end loop;
end $$;

notify pgrst, 'reload schema';
