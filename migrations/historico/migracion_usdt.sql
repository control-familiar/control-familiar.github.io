-- ============================================================
-- Tenencia de USDT (ingresos y ventas) — pegar en el SQL Editor
-- de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

create table usdt_movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('ingreso','venta')),
  cantidad numeric(18,8) not null,              -- USDT (positivo siempre; el signo lo da "tipo")
  monto_ars numeric(14,2),                       -- pesos recibidos, solo en 'venta'
  cotizacion numeric(14,4),                      -- monto_ars / cantidad, solo en 'venta' (informativo)
  centro_id uuid references centros(id) on delete set null,       -- CC destino de los pesos, solo en 'venta'
  categoria_id uuid references categorias(id) on delete set null,
  subcategoria_id uuid references subcategorias(id) on delete set null,
  movimiento_id uuid references movimientos(id) on delete set null, -- ingreso en pesos creado automáticamente por la venta
  detalle text,
  created_at timestamptz default now()
);

alter table usdt_movimientos enable row level security;

create policy "logueados_todo_usdt_movimientos" on usdt_movimientos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
