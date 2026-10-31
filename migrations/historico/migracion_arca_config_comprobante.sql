-- ============================================================
-- Datos del emisor para armar el comprobante imprimible (no son
-- secretos: van impresos en cualquier factura) — pegar en el SQL
-- Editor de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

insert into configuracion (clave, valor) values
  ('arca_cuit', '27357665278'),
  ('arca_razon_social', 'Ana Laura Casadei');
