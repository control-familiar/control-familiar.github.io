-- ============================================================
-- MIGRACIÓN: auditoría de movimientos (A1)
--
-- Aplicada en el proyecto Supabase el 2026-11-01.
--
-- Aplica a la base ya creada lo que agregó schema.sql: columna
-- movimientos.creado_por (miembro que lo cargó), el trigger que
-- la completa junto con created_at (y no deja cambiarlos al
-- editar), y restaurar_familia() deja sin ese dato los
-- movimientos de alguien que ya no es miembro. Los movimientos
-- que ya existen quedan con creado_por en null. No borra nada.
-- Todo o nada: si algo falla no queda aplicado a medias.
-- ============================================================

begin;

alter table movimientos add column creado_por uuid;
alter table movimientos add foreign key (familia_id, creado_por)
  references miembros(familia_id, user_id) on delete set null (creado_por);

-- Auditoría (A1): quién cargó cada movimiento y cuándo lo pone la base, no la app, y al editarlo no se
-- cambia. El superadmin no carga movimientos: solo restaura, y ahí se conserva lo que trae el backup.
create function auditar_movimiento() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if public.es_superadmin() then return new; end if;
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.created_at := now();
  else
    new.creado_por := old.creado_por;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger movimientos_auditar before insert or update on movimientos
  for each row execute function auditar_movimiento();

create or replace function restaurar_familia(p_familia_id uuid, p_datos jsonb)
  returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  -- En orden de dependencias: primero las que otras referencian.
  tablas text[] := array['centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos_recurrentes',
                         'vencimientos', 'deudas', 'usdt_movimientos', 'facturas', 'reglas_categorizacion', 'familia_config', 'familia_importadores_ocultos'];
  t text;
  filas jsonb;
  columnas text;
  actualizar text;
  n int;
  resultado jsonb := '{}';
begin
  if not public.es_superadmin() then
    raise exception 'Solo el superadmin puede restaurar backups' using errcode = '42501';
  end if;
  if p_familia_id is null then
    raise exception 'Falta elegir la familia a restaurar';
  end if;

  -- Validar todo antes de escribir nada.
  foreach t in array tablas loop
    filas := coalesce(p_datos -> t, '[]');
    if jsonb_typeof(filas) <> 'array' then
      raise exception 'El backup tiene un formato inesperado en %', t;
    end if;
    if exists (select 1 from jsonb_array_elements(filas) e where e ->> 'familia_id' is distinct from p_familia_id::text) then
      raise exception 'El backup tiene filas de otra familia en %', t;
    end if;
    if t not in ('familia_config', 'familia_importadores_ocultos') then
      execute format('select count(*) from public.%I x join jsonb_array_elements($1) e on x.id = (e ->> ''id'')::uuid
                      where x.familia_id <> $2', t)
        using filas, p_familia_id into n;
      if n > 0 then
        raise exception '% fila(s) de % ya existen en otra familia: no se pueden restaurar en esta', n, t;
      end if;
    end if;
  end loop;

  -- Si la familia ya no existe (se borró), se vuelve a crear con el mismo id y nombre.
  if not exists (select 1 from public.familias where id = p_familia_id) then
    if p_datos -> 'familia' ->> 'nombre' is null then
      raise exception 'La familia no existe en la base y el backup no trae su nombre';
    end if;
    insert into public.familias (id, nombre) values (p_familia_id, p_datos -> 'familia' ->> 'nombre');
  end if;

  foreach t in array tablas loop
    filas := coalesce(p_datos -> t, '[]');
    continue when jsonb_array_length(filas) = 0;

    -- Un centro cuyo titular ya no es miembro de esta familia vuelve sin titular (los miembros no se
    -- restauran: dependen de los usuarios de Auth).
    -- Importadores ocultos que ya no existen: se descartan.
    if t = 'familia_importadores_ocultos' then
      select coalesce(jsonb_agg(e), '[]') into filas
      from jsonb_array_elements(filas) e
      where exists (select 1 from public.importadores i where i.codigo = e ->> 'importador_codigo');
      continue when jsonb_array_length(filas) = 0;
    end if;

    if t = 'centros' then
      select jsonb_agg(case
               when e ->> 'titular_id' is not null and not exists (
                 select 1 from public.miembros m where m.user_id = (e ->> 'titular_id')::uuid and m.familia_id = p_familia_id)
               then jsonb_set(e, '{titular_id}', 'null'::jsonb)
               else e end)
        into filas
      from jsonb_array_elements(filas) e;
    end if;
    -- Lo mismo con quién cargó un movimiento (A1): si ya no es miembro, el movimiento vuelve sin ese dato.
    if t = 'movimientos' then
      select jsonb_agg(case
               when e ->> 'creado_por' is not null and not exists (
                 select 1 from public.miembros m where m.user_id = (e ->> 'creado_por')::uuid and m.familia_id = p_familia_id)
               then jsonb_set(e, '{creado_por}', 'null'::jsonb)
               else e end)
        into filas
      from jsonb_array_elements(filas) e;
    end if;

    -- Solo las columnas que trae el backup: si es anterior a una columna nueva, esa toma su default.
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum),
           string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' order by a.attnum)
             filter (where a.attname not in ('id', 'familia_id', 'clave'))
      into columnas, actualizar
    from pg_attribute a
    where a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped
      and exists (select 1 from jsonb_array_elements(filas) e where e ? a.attname);

    execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)
                    on conflict %3$s do %4$s',
                   t, columnas,
                   case t when 'familia_config' then '(familia_id, clave)'
                          when 'familia_importadores_ocultos' then '(familia_id, importador_codigo)'
                          else '(id)' end,
                   coalesce('update set ' || actualizar, 'nothing'))
      using filas;
    get diagnostics n = row_count;
    resultado := resultado || jsonb_build_object(t, n);
  end loop;

  return resultado;
end $$;

commit;
