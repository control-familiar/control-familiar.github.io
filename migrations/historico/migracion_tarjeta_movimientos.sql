-- ============================================================
-- Columna "tarjeta" (boolean) en movimientos — documenta en
-- código una columna que ya existe en producción (se había
-- agregado a mano desde el Table Editor de Supabase, sin migración
-- que quedara registrada acá). Con "if not exists" no rompe nada
-- si ya existe — pegar en el SQL Editor de Supabase igual, para
-- que quede aplicada en cualquier otro ambiente.
-- ============================================================

alter table movimientos add column if not exists tarjeta boolean not null default false;
