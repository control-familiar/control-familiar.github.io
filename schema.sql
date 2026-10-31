-- ============================================================
-- ESQUEMA "CONTROL ECONÓMICO FAMILIAR" (multi-familia)
--
-- Pegar todo esto en el SQL Editor de Supabase (Project → SQL
-- Editor → New query → Run) sobre una base VACÍA para levantarla
-- desde cero. No trae datos: las familias, miembros y superadmins
-- se dan de alta con scripts/sql/alta_*.sql, y los datos de
-- prueba están en scripts/sql/datos_dummy.sql.
--
-- Diseño y decisiones: docs/MULTI-FAMILIA.md.
--
-- Mientras la base tenga solo familias dummy, los cambios de
-- esquema se hacen directamente acá y la base se recrea. Desde
-- que entre la primera familia real, cada cambio va como
-- migración nueva en migrations/ Y se refleja acá.
-- migrations/historico/ son las migraciones del proyecto
-- original (una sola familia), solo como registro.
-- ============================================================

-- ============================================================
-- FAMILIAS, MIEMBROS Y SUPERADMINS
-- ============================================================

create table familias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,  -- único: los scripts de alta identifican la familia por nombre
  created_at timestamptz default now()
);

-- Un usuario pertenece a UNA sola familia (por eso user_id es la PK).
-- Cambiar a alguien de familia = cambiar su fila; lo que cargó queda en la familia anterior.
create table miembros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  familia_id uuid not null references familias(id) on delete restrict,
  created_at timestamptz default now()
);

-- Cuentas de soporte: no pertenecen a ninguna familia, ven todas en solo lectura.
create table superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Un usuario no puede ser a la vez miembro de una familia y superadmin.
create function impedir_miembro_y_superadmin() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'miembros'
     and exists (select 1 from public.superadmins where user_id = new.user_id) then
    raise exception 'El usuario % es superadmin: no puede ser miembro de una familia', new.user_id;
  end if;
  if tg_table_name = 'superadmins'
     and exists (select 1 from public.miembros where user_id = new.user_id) then
    raise exception 'El usuario % es miembro de una familia: no puede ser superadmin', new.user_id;
  end if;
  return new;
end $$;

create trigger miembros_no_superadmin before insert or update on miembros
  for each row execute function impedir_miembro_y_superadmin();
create trigger superadmins_no_miembro before insert or update on superadmins
  for each row execute function impedir_miembro_y_superadmin();

-- Familia del usuario logueado (null si no es miembro de ninguna).
-- security definer: lee miembros sin pasar por su RLS. Siempre con search_path vacío
-- y nombres calificados, para que nadie pueda colarle otra tabla "miembros".
create function familia_actual() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select familia_id from public.miembros where user_id = auth.uid() $$;

create function es_superadmin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists(select 1 from public.superadmins where user_id = auth.uid()) $$;

-- ============================================================
-- DATOS DE CADA FAMILIA
--
-- Todas las tablas llevan familia_id, que la base completa sola
-- con familia_actual(): la app NO lo manda en los insert ni filtra
-- por familia en los select (RLS ya devuelve solo lo de su familia).
--
-- Las tablas que otras referencian tienen unique (familia_id, id)
-- y todas las FK son compuestas (familia_id, x_id): así una fila de
-- una familia no puede apuntar a una fila de otra.
-- "on delete set null (x_id)" vacía solo esa columna, no familia_id.
-- ============================================================

-- Centros de Costo
create table centros (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  codigo text not null,
  nombre text not null,
  color text,  -- color de fondo del chip en Movimientos y ABM, ej: '#4E9D77'
  color_texto text,  -- color de texto del chip (opcional); si es null, se calcula el contraste automático
  entidad text,  -- banco/billetera para el logo en Saldos: 'santander' | 'nacion' | 'provincia' | 'icbc' | 'mercadopago' | null
  moneda text not null default 'ARS' check (moneda in ('ARS','USD','AMBAS')),  -- 'AMBAS': la cuenta tiene un saldo en pesos y otro en dólares
  created_at timestamptz default now(),
  unique (familia_id, id)
);

-- Categorías
create table categorias (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  nombre text not null,
  tipo text,  -- tratamiento en reportes: null (normal) | 'tec' | 'inversion' | 'sueldo' | 'control'
  color text,  -- color de fondo del chip en Movimientos y ABM, ej: '#D97B6C'
  color_texto text,  -- color de texto del chip (opcional); si es null, se calcula el contraste automático
  created_at timestamptz default now(),
  unique (familia_id, id)
);

-- Subcategorías
create table subcategorias (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  categoria_id uuid,
  nombre text not null,
  created_at timestamptz default now(),
  unique (familia_id, id),
  foreign key (familia_id, categoria_id) references categorias(familia_id, id) on delete cascade
);

-- Movimientos
create table movimientos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  fecha date not null,
  centro_id uuid,
  categoria_id uuid,
  subcategoria_id uuid,
  proveedor text,
  detalle text,
  ingreso numeric(14,2) default 0,
  egreso numeric(14,2) default 0,
  fecha_consumo date, -- fecha real de la compra (para movimientos de tarjeta); puede diferir de "fecha" (vencimiento del resumen)
  tarjeta boolean not null default false, -- si se pagó con tarjeta de crédito (agrupa en el resumen de tarjeta)
  tarjeta_marca text, -- Visa, Mastercard, Amex, etc. (para agrupar y titular el resumen de tarjeta correspondiente)
  cuotas text, -- texto libre, ej. "5/6"
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  cambio_id uuid, -- une las dos patas (USD y pesos) de una compra/venta de dólares
  created_at timestamptz default now(),
  unique (familia_id, id),
  foreign key (familia_id, centro_id) references centros(familia_id, id) on delete set null (centro_id),
  foreign key (familia_id, categoria_id) references categorias(familia_id, id) on delete set null (categoria_id),
  foreign key (familia_id, subcategoria_id) references subcategorias(familia_id, id) on delete set null (subcategoria_id)
);
create index movimientos_cambio_id_idx on movimientos(cambio_id);

-- Vencimientos
create table vencimientos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  concepto text not null,
  fecha date not null,
  monto numeric(14,2) default 0,
  centro_id uuid,
  estado text default 'pendiente', -- 'pendiente' | 'pagado'
  created_at timestamptz default now(),
  foreign key (familia_id, centro_id) references centros(familia_id, id) on delete set null (centro_id)
);

-- Deudas (para la pestaña "Flujo de Caja")
create table deudas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  concepto text not null,
  saldo_pendiente numeric(14,2) default 0,   -- lo que falta pagar hoy
  cuota_mensual numeric(14,2) default 0,
  centro_id uuid,  -- de dónde sale la cuota (opcional)
  estado text default 'activa', -- 'activa' | 'cancelada'
  created_at timestamptz default now(),
  foreign key (familia_id, centro_id) references centros(familia_id, id) on delete set null (centro_id)
);

-- Tenencia de USDT (ingresos y ventas)
create table usdt_movimientos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  fecha date not null,
  tipo text not null check (tipo in ('ingreso','venta')),
  cantidad numeric(18,8) not null,              -- USDT (positivo siempre; el signo lo da "tipo")
  monto_ars numeric(14,2),                       -- pesos recibidos, solo en 'venta'
  cotizacion numeric(14,4),                      -- monto_ars / cantidad, solo en 'venta' (informativo)
  centro_id uuid,                                -- CC destino de los pesos, solo en 'venta'
  categoria_id uuid,
  subcategoria_id uuid,
  movimiento_id uuid,                            -- ingreso en pesos creado automáticamente por la venta
  detalle text,
  created_at timestamptz default now(),
  foreign key (familia_id, centro_id) references centros(familia_id, id) on delete set null (centro_id),
  foreign key (familia_id, categoria_id) references categorias(familia_id, id) on delete set null (categoria_id),
  foreign key (familia_id, subcategoria_id) references subcategorias(familia_id, id) on delete set null (subcategoria_id),
  foreign key (familia_id, movimiento_id) references movimientos(familia_id, id) on delete set null (movimiento_id)
);

-- Facturación ARCA de ventas de USDT
create table facturas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  movimiento_id uuid,
  fecha date not null,
  tipo_comprobante text not null default 'C',   -- Factura C (Monotributo, a Consumidor Final)
  punto_venta integer not null,
  numero integer,                                -- lo asigna ARCA; queda null hasta que estado='emitida'
  importe numeric(14,2) not null,
  cae text,
  cae_vencimiento date,
  estado text not null default 'pendiente' check (estado in ('pendiente','emitida','error')),
  error text,                                    -- motivo del rechazo (propio o de ARCA), solo si estado='error'
  ambiente text not null default 'homologacion' check (ambiente in ('homologacion','produccion')),
  detalle text,                                  -- ej: "5.2 USDT a $850" (solo informativo, no se envía a ARCA)
  created_at timestamptz default now(),
  foreign key (familia_id, movimiento_id) references movimientos(familia_id, id) on delete set null (movimiento_id)
);

-- Evita facturar dos veces el mismo movimiento EN EL MISMO AMBIENTE (una vez emitida).
-- Cada ambiente lleva su propia cuenta, para no bloquear producción con algo ya probado en homologación.
-- No hace falta familia_id: el movimiento ya es de una sola familia.
create unique index facturas_movimiento_emitida_unq on facturas (movimiento_id, ambiente) where estado = 'emitida';

-- ============================================================
-- CONFIGURACIÓN POR FAMILIA (D3)
--
-- config_catalogo define cada configuración posible y la documenta
-- (global). familia_config guarda solo lo que cada familia tiene
-- distinto del default. Valor efectivo = el de la familia o, si no
-- tiene, el default (config_valor() acá, configuracionValor() en
-- app.js). Todos los valores se guardan como texto; "tipo" dice
-- cómo interpretarlo y se valida al guardar.
--
-- Una clave nueva se agrega con un insert en config_catalogo acá
-- (y como migración cuando haya familias reales), junto con el
-- código que la usa: el catálogo no se edita desde la app.
-- ============================================================

create function valor_config_valido(p_tipo text, p_valor text) returns boolean
  language sql immutable set search_path = ''
  as $$ select p_valor is null or case p_tipo
                 when 'numero' then p_valor ~ '^-?[0-9]+(\.[0-9]+)?$'
                 when 'booleano' then p_valor in ('true', 'false')
                 else true
               end $$;

create table config_catalogo (
  clave text primary key,
  tipo text not null check (tipo in ('texto', 'numero', 'booleano')),
  descripcion text not null,
  valor_default text,  -- null: sin valor salvo que la familia lo configure
  grupo text not null,  -- para agrupar en la pantalla del superadmin, ej: 'Facturación'
  orden integer not null default 0,
  check (valor_config_valido(tipo, valor_default))
);

-- Si se saca una clave del catálogo, se van con ella los valores de las familias.
create table familia_config (
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  clave text not null references config_catalogo(clave) on delete cascade,
  valor text not null,
  primary key (familia_id, clave)
);

create function validar_familia_config() returns trigger
  language plpgsql set search_path = ''
as $$
declare
  v_tipo text;
begin
  select tipo into v_tipo from public.config_catalogo where clave = new.clave;
  if v_tipo is not null and not public.valor_config_valido(v_tipo, new.valor) then
    raise exception 'Valor inválido para % (tipo %): "%"', new.clave, v_tipo, new.valor
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger familia_config_validar before insert or update on familia_config
  for each row execute function validar_familia_config();

-- Valor efectivo de una configuración para la familia del usuario logueado (o el default).
-- Corre con los permisos de quien la llama: RLS sigue aplicando.
create function config_valor(p_clave text) returns text
  language sql stable set search_path = ''
  as $$ select coalesce(
           (select valor from public.familia_config where familia_id = public.familia_actual() and clave = p_clave),
           (select valor_default from public.config_catalogo where clave = p_clave)) $$;

insert into config_catalogo (clave, tipo, descripcion, valor_default, grupo, orden) values
  ('arca_cuit', 'texto', 'CUIT del emisor de las facturas, sin guiones. Va en el comprobante y en su QR.',
   null, 'Facturación', 1),
  ('arca_razon_social', 'texto', 'Razón social del emisor, como figura en el comprobante.',
   null, 'Facturación', 2),
  ('monotributo_limite_categoria_b', 'numero',
   'Tope de facturación de los últimos 12 meses para la categoría de Monotributo, en pesos. Vacío: no se controla.',
   null, 'Facturación', 3);

-- Caché del Token+Sign de WSAA (dura ~12hs; pedir uno nuevo antes de que expire el
-- anterior hace que ARCA lo rechace). La usa la Edge Function facturar-arca con la
-- sesión del usuario, así que cada familia tiene el suyo.
create table arca_ta (
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  ambiente text not null check (ambiente in ('homologacion','produccion')),
  token text not null,
  sign text not null,
  expira_en timestamptz not null,
  primary key (familia_id, ambiente)
);

-- Reglas de categorización al importar: proveedor -> categoría/subcategoría sugeridas
-- al previsualizar una importación (coincidencia parcial, sin distinguir mayúsculas).
create table reglas_categorizacion (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null default familia_actual() references familias(id) on delete restrict,
  proveedor text not null,
  categoria text not null,
  subcategoria text,
  created_at timestamptz default now()
);

-- Índices por familia_id en las tablas donde no lo cubre ya un unique/PK que empiece por familia_id
-- (centros, categorias, subcategorias, movimientos, familia_config, arca_ta).
create index vencimientos_familia_idx on vencimientos(familia_id);
create index deudas_familia_idx on deudas(familia_id);
create index usdt_movimientos_familia_idx on usdt_movimientos(familia_id);
create index facturas_familia_idx on facturas(familia_id);
create index reglas_categorizacion_familia_idx on reglas_categorizacion(familia_id);
create index miembros_familia_idx on miembros(familia_id);

-- ============================================================
-- SEGURIDAD (RLS)
--
-- - Un miembro lee y escribe solo lo de su familia.
-- - El superadmin lee todas las familias y no escribe datos
--   (no tiene familia: familia_actual() es null).
-- - Un usuario logueado que no es miembro ni superadmin no ve nada.
-- - Sin sesión (anon) no hay ninguna política: no ve nada.
--
-- (select f()) en vez de f(): Postgres lo evalúa una vez por
-- consulta y no una vez por fila.
-- ============================================================

alter table familias enable row level security;
alter table miembros enable row level security;
alter table superadmins enable row level security;
alter table centros enable row level security;
alter table categorias enable row level security;
alter table subcategorias enable row level security;
alter table movimientos enable row level security;
alter table vencimientos enable row level security;
alter table deudas enable row level security;
alter table usdt_movimientos enable row level security;
alter table facturas enable row level security;
alter table config_catalogo enable row level security;
alter table familia_config enable row level security;
alter table arca_ta enable row level security;
alter table reglas_categorizacion enable row level security;

-- familias, miembros, superadmins: solo lectura desde la app (las altas son por script).
create policy leer on familias for select to authenticated
  using (id = (select familia_actual()) or (select es_superadmin()));
create policy leer on miembros for select to authenticated
  using (user_id = (select auth.uid()) or (select es_superadmin()));
create policy leer on superadmins for select to authenticated
  using (user_id = (select auth.uid()));

-- Tablas de datos: las mismas cuatro políticas en cada una.
do $$
declare
  t text;
begin
  foreach t in array array['centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos',
                           'deudas', 'usdt_movimientos', 'facturas', 'reglas_categorizacion']
  loop
    execute format($p$
      create policy leer on %1$I for select to authenticated
        using (familia_id = (select familia_actual()) or (select es_superadmin()));
      create policy insertar on %1$I for insert to authenticated
        with check (familia_id = (select familia_actual()));
      create policy editar on %1$I for update to authenticated
        using (familia_id = (select familia_actual()))
        with check (familia_id = (select familia_actual()));
      create policy borrar on %1$I for delete to authenticated
        using (familia_id = (select familia_actual()));
    $p$, t);
  end loop;
end $$;

-- config_catalogo: la leen todos los logueados; no se escribe desde la app.
create policy leer on config_catalogo for select to authenticated using (true);

-- familia_config: la familia la lee (la app la usa para funcionar aunque no se la muestra, C1);
-- solo el superadmin la escribe, en cualquier familia (S4).
create policy leer on familia_config for select to authenticated
  using (familia_id = (select familia_actual()) or (select es_superadmin()));
create policy insertar on familia_config for insert to authenticated
  with check ((select es_superadmin()));
create policy editar on familia_config for update to authenticated
  using ((select es_superadmin())) with check ((select es_superadmin()));
create policy borrar on familia_config for delete to authenticated
  using ((select es_superadmin()));

-- arca_ta: solo la familia (son credenciales temporales de ARCA; el superadmin no las ve).
create policy todo on arca_ta for all to authenticated
  using (familia_id = (select familia_actual()))
  with check (familia_id = (select familia_actual()));

-- ============================================================
-- FUNCIONES DEL SUPERADMIN (pestaña Administración)
--
-- security definer para poder leer auth.users y escribir pese a
-- RLS, por eso lo primero que hacen es verificar es_superadmin().
-- ============================================================

-- Miembros de todas las familias con su email (la app no puede leer auth.users).
create function admin_miembros()
  returns table (user_id uuid, email text, familia_id uuid, familia text, created_at timestamptz)
  language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo el superadmin puede ver los miembros' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.familia_id, f.nombre, m.created_at
    from public.miembros m
    join auth.users u on u.id = m.user_id
    join public.familias f on f.id = m.familia_id
    order by f.nombre, u.email;
end $$;

-- Restaura los datos de UNA familia desde un backup (versión 3). p_datos trae
-- { familia: {id, nombre}, centros: [...], categorias: [...], ... } con las filas
-- tal cual las guardó el backup. Como la restauración de siempre, no borra nada:
-- agrega lo que falta y actualiza lo que coincide por id.
--
-- Todo o nada: si algo falla (una fila de otra familia, un id que ya es de otra
-- familia, una referencia rota) no se aplica ninguna fila.
create function restaurar_familia(p_familia_id uuid, p_datos jsonb)
  returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  -- En orden de dependencias: primero las que otras referencian.
  tablas text[] := array['centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos', 'deudas',
                         'usdt_movimientos', 'facturas', 'reglas_categorizacion', 'familia_config'];
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
    if t <> 'familia_config' then
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
                   case when t = 'familia_config' then '(familia_id, clave)' else '(id)' end,
                   coalesce('update set ' || actualizar, 'nothing'))
      using filas;
    get diagnostics n = row_count;
    resultado := resultado || jsonb_build_object(t, n);
  end loop;

  return resultado;
end $$;

revoke execute on function admin_miembros() from public, anon;
revoke execute on function restaurar_familia(uuid, jsonb) from public, anon;
grant execute on function admin_miembros() to authenticated;
grant execute on function restaurar_familia(uuid, jsonb) to authenticated;
