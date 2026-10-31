-- ============================================================
-- Facturación ARCA de ventas de USDT — pegar en el SQL Editor
-- de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

create table facturas (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid references movimientos(id) on delete set null,
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
  created_at timestamptz default now()
);

-- Evita facturar dos veces el mismo movimiento (una vez que una factura quedó emitida).
create unique index facturas_movimiento_emitida_unq on facturas (movimiento_id) where estado = 'emitida';

alter table facturas enable row level security;

create policy "logueados_todo_facturas" on facturas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Configuración editable de a pares clave/valor: para datos que cambian por normativa
-- (ej. el tope de facturación de la categoría de Monotributo), no por deploy.
create table configuracion (
  clave text primary key,
  valor text not null
);

alter table configuracion enable row level security;

create policy "logueados_todo_configuracion" on configuracion
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into configuracion (clave, valor) values
  ('monotributo_limite_categoria_b', '1400000');
