-- ============================================================
-- "Venta USDT" pasa de ser subcategoría de Sueldo a ser una categoría propia
-- Pegar en Supabase -> SQL Editor -> New query -> Run
-- ============================================================
-- Qué hace (todo en una transacción: o se aplica completo o no se toca nada):
--   1. Crea la categoría "Venta USDT" con tratamiento 'sueldo' (así Resumen y Flujo de Caja
--      se comportan igual que antes) y el mismo color que tenía Sueldo.
--   2. Pasa a esa categoría los movimientos y los registros de USDT que estaban en la
--      subcategoría "Venta USDT" (y les quita la subcategoría).
--   3. Actualiza las reglas de categorización que apuntaban a Sueldo › Venta USDT.
--   4. Borra la subcategoría vieja, ya sin uso.
-- Es seguro correrlo más de una vez. La app acepta las dos formas (categoría o subcategoría),
-- así que no importa si se corre antes o después de publicar la versión nueva.
-- Recomendado: descargar un backup (ABM > Backup) antes de correrlo.
-- ============================================================

begin;

-- 1) Categoría nueva (si no existe ya)
insert into categorias (nombre, tipo, color, color_texto)
select 'Venta USDT', 'sueldo', s.color, s.color_texto
from (select 1) x
left join categorias s on s.tipo = 'sueldo' and s.nombre <> 'Venta USDT'
where not exists (select 1 from categorias where nombre = 'Venta USDT')
limit 1;

-- 2) Movimientos y USDT que estaban en la subcategoría "Venta USDT"
with viejas as (
  select id from subcategorias where trim(nombre) = 'Venta USDT'
), nueva as (
  select id from categorias where nombre = 'Venta USDT' limit 1
)
update movimientos m
   set categoria_id = (select id from nueva), subcategoria_id = null
 where m.subcategoria_id in (select id from viejas);

with viejas as (
  select id from subcategorias where trim(nombre) = 'Venta USDT'
), nueva as (
  select id from categorias where nombre = 'Venta USDT' limit 1
)
update usdt_movimientos u
   set categoria_id = (select id from nueva), subcategoria_id = null
 where u.subcategoria_id in (select id from viejas);

-- 3) Reglas de categorización (guardan los nombres como texto)
update reglas_categorizacion
   set categoria = 'Venta USDT', subcategoria = null
 where trim(subcategoria) = 'Venta USDT';

-- 4) Subcategoría vieja (ya no tiene movimientos que la usen)
delete from subcategorias where trim(nombre) = 'Venta USDT';

commit;

-- Verificación (opcional): debería mostrar la categoría nueva con sus movimientos
-- select c.nombre, c.tipo, count(m.id) as movimientos
--   from categorias c left join movimientos m on m.categoria_id = c.id
--  where c.nombre = 'Venta USDT' group by c.id;
