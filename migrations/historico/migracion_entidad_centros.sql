-- ============================================================
-- Entidad (banco/billetera) de cada Centro de Costo, para mostrar
-- su logo en Saldos.
-- Pegar en Supabase -> SQL Editor -> New query -> Run
-- ============================================================

alter table centros add column if not exists entidad text;

-- Completa automáticamente los centros cuyo nombre ya menciona la entidad.
update centros set entidad = 'santander' where entidad is null and lower(nombre) like '%santander%';
update centros set entidad = 'nacion' where entidad is null and (lower(nombre) like '%nación%' or lower(nombre) like '%nacion%');
update centros set entidad = 'provincia' where entidad is null and lower(nombre) like '%provincia%';
update centros set entidad = 'icbc' where entidad is null and lower(nombre) like '%icbc%';
update centros set entidad = 'mercadopago' where entidad is null and (lower(nombre) like '%mercado pago%' or lower(nombre) like '%mercadopago%');

-- Casos que no se pueden adivinar por el nombre (ajustá el código si difiere del tuyo):
update centros set entidad = 'icbc' where entidad is null and codigo = 'BA';        -- Banco ICBC Ana
update centros set entidad = 'provincia' where entidad is null and codigo = 'CDA';  -- Cuenta DNI Ana (Banco Provincia)

-- Para revisar el resultado (y asignar a mano en ABM > Centros de Costo lo que haga falta):
-- select codigo, nombre, entidad from centros order by codigo;
