-- ============================================================
-- Campo "Cuotas" propio para movimientos de tarjeta (texto libre,
-- ej. "5/6") — pegar en el SQL Editor de Supabase (Project → SQL
-- Editor → New query → Run)
-- ============================================================

alter table movimientos add column cuotas text;
