-- ============================================================
-- Módulo Dólares: moneda en Centros de Costo y en Movimientos.
-- Pegar en Supabase -> SQL Editor -> New query -> Run
-- (correrla ANTES de publicar la versión de la app que trae la pestaña Dólares)
-- ============================================================

-- Moneda de cada Centro de Costo: 'ARS' (solo pesos), 'USD' (solo dólares) o 'AMBAS'
-- (la misma cuenta tiene caja en pesos y en dólares, con un saldo para cada una).
alter table centros add column if not exists moneda text not null default 'ARS'
  check (moneda in ('ARS','USD','AMBAS'));

-- Moneda de cada movimiento. Todos los existentes quedan en pesos.
alter table movimientos add column if not exists moneda text not null default 'ARS'
  check (moneda in ('ARS','USD'));

-- Une las dos patas de una compra/venta de dólares (el movimiento en USD y el de pesos).
alter table movimientos add column if not exists cambio_id uuid;
create index if not exists movimientos_cambio_id_idx on movimientos(cambio_id);

-- Después, en ABM > Centros de Costo: marcá como "Pesos y dólares" los CC de Franco que
-- tengan caja en USD, y creá los CC en dólares de Ana (código terminado en A) con moneda "Dólares".
