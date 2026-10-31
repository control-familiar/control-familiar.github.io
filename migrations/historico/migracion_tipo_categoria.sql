-- ============================================================
-- Tratamiento de categorías en reportes (campo "tipo")
-- Pegar en Supabase -> SQL Editor -> New query -> Run
-- ============================================================
-- Antes, Resumen y Flujo de caja reconocían "Obra" y "Sueldo" por el nombre de la categoría.
-- Ahora lo hacen por el campo tipo, que se elige en el ABM de Categorías:
--   null        → Normal
--   'tec'       → TEC (transferencia entre cuentas, no cuenta en ningún reporte)
--   'inversion' → Inversión (se muestra aparte y no se resta de la capacidad de ahorro)
--   'sueldo'    → Sueldo (ingreso base de Resumen y de la capacidad de ahorro)
-- Correr ANTES de publicar la versión nueva de la app: hasta que no se corra, Obra y Sueldo
-- se tratan como categorías normales.

-- Valores viejos que la app nunca usó ('ingreso', 'egreso', 'ahorro'): pasan a Normal.
update categorias set tipo = null where tipo is not null and tipo not in ('tec', 'inversion', 'sueldo');

update categorias set tipo = 'inversion' where lower(trim(nombre)) = 'obra';
update categorias set tipo = 'sueldo' where lower(trim(nombre)) = 'sueldo';

-- Control: debería mostrar Obra como 'inversion' y Sueldo como 'sueldo'
select nombre, tipo from categorias where tipo is not null order by tipo, nombre;
