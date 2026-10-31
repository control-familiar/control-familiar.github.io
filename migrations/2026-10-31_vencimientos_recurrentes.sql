-- ============================================================
-- MIGRACIÓN: vencimientos recurrentes (V1–V6)
--
-- Aplicada en el proyecto Supabase el 2026-10-31.
--
-- Aplica a la base ya creada lo que agregó schema.sql: tabla
-- vencimientos_recurrentes, columnas nuevas de vencimientos,
-- estado 'salteado', generar_vencimientos_recurrentes() y la
-- tabla nueva en restaurar_familia(). No borra nada.
-- Todo o nada: si algo falla no queda aplicado a medias.
-- ============================================================

begin;

create table vencimientos_recurrentes (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  concepto text not null,
  monto numeric(14,2) default 0,
  dia int not null check (dia between 1 and 31),
  centro_id uuid,
  categoria_id uuid,
  subcategoria_id uuid,
  desde date not null check (extract(day from desde) = 1),
  hasta date check (extract(day from hasta) = 1 and hasta >= desde),
  generado_hasta date,
  created_at timestamptz default now(),
  unique (familia_id, id),
  foreign key (familia_id, centro_id) references centros(familia_id, id) on delete set null (centro_id),
  foreign key (familia_id, categoria_id) references categorias(familia_id, id) on delete set null (categoria_id),
  foreign key (familia_id, subcategoria_id) references subcategorias(familia_id, id) on delete set null (subcategoria_id)
);

alter table vencimientos
  add column categoria_id uuid,
  add column subcategoria_id uuid,
  add column recurrente_id uuid,
  add column periodo date,
  add constraint vencimientos_estado_check check (estado in ('pendiente', 'pagado', 'salteado')),
  add constraint vencimientos_recurrente_id_periodo_key unique (recurrente_id, periodo),
  add foreign key (familia_id, categoria_id) references categorias(familia_id, id) on delete set null (categoria_id),
  add foreign key (familia_id, subcategoria_id) references subcategorias(familia_id, id) on delete set null (subcategoria_id),
  add foreign key (familia_id, recurrente_id) references vencimientos_recurrentes(familia_id, id) on delete set null (recurrente_id);

alter table vencimientos_recurrentes enable row level security;
create policy leer on vencimientos_recurrentes for select to authenticated
  using (familia_id = (select familia_actual()) or (select es_superadmin()));
create policy insertar on vencimientos_recurrentes for insert to authenticated
  with check (familia_id = (select familia_actual()));
create policy editar on vencimientos_recurrentes for update to authenticated
  using (familia_id = (select familia_actual()))
  with check (familia_id = (select familia_actual()));
create policy borrar on vencimientos_recurrentes for delete to authenticated
  using (familia_id = (select familia_actual()));

create or replace function generar_vencimientos_recurrentes(p_hoy date default current_date)
  returns int
  language plpgsql security invoker set search_path = ''
as $$
declare
  r record;
  mes date;
  ultimo date;
  agregadas int;
  n int := 0;
begin
  for r in select * from public.vencimientos_recurrentes
           where familia_id = public.familia_actual()
           for update
  loop
    mes := greatest(r.desde, (r.generado_hasta + interval '1 month')::date);
    ultimo := least(date_trunc('month', p_hoy)::date, coalesce(r.hasta, 'infinity'::date));
    continue when mes > ultimo;
    while mes <= ultimo loop
      insert into public.vencimientos
        (familia_id, concepto, fecha, monto, centro_id, categoria_id, subcategoria_id, recurrente_id, periodo)
      values
        (r.familia_id, r.concepto,
         mes + least(r.dia, extract(day from (mes + interval '1 month - 1 day'))::int) - 1,
         r.monto, r.centro_id, r.categoria_id, r.subcategoria_id, r.id, mes)
      on conflict (recurrente_id, periodo) do nothing;
      get diagnostics agregadas = row_count;
      n := n + agregadas;
      mes := (mes + interval '1 month')::date;
    end loop;
    update public.vencimientos_recurrentes set generado_hasta = ultimo where id = r.id;
  end loop;
  return n;
end $$;

revoke execute on function generar_vencimientos_recurrentes(date) from public, anon;
grant execute on function generar_vencimientos_recurrentes(date) to authenticated;

-- Misma función, con vencimientos_recurrentes en la lista de tablas.
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

-- Verificación: tiene que devolver una fila por cada cosa nueva.
select 'tabla' as que, count(*) from information_schema.tables where table_schema = 'public' and table_name = 'vencimientos_recurrentes'
union all
select 'columnas nuevas', count(*) from information_schema.columns
  where table_schema = 'public' and table_name = 'vencimientos' and column_name in ('categoria_id', 'subcategoria_id', 'recurrente_id', 'periodo')
union all
select 'función', count(*) from pg_proc where proname = 'generar_vencimientos_recurrentes';
