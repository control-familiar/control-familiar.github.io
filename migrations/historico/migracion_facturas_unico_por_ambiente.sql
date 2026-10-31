-- ============================================================
-- La restricción original impedía tener una factura "emitida" por movimiento
-- sin importar el ambiente, lo que bloquearía facturar en producción algo que
-- ya se probó (a propósito) en homologación. Pasa a ser única por (movimiento,
-- ambiente): cada ambiente lleva su propia cuenta — pegar en el SQL Editor de
-- Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

drop index facturas_movimiento_emitida_unq;

create unique index facturas_movimiento_emitida_unq on facturas (movimiento_id, ambiente) where estado = 'emitida';
