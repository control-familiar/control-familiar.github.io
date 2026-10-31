-- ============================================================
-- DATOS DE PRUEBA: dos familias dummy (nada de datos reales)
--
-- - "Familia Demo": centros, categorías y movimientos inventados
--   de los últimos tres meses, para ver la app funcionando.
-- - "Familia Prueba": casi vacía, para probar el aislamiento.
--
-- Pegar todo en el SQL Editor de Supabase y ejecutar, una sola vez,
-- después de schema.sql. Las fechas se calculan desde el mes actual.
-- Después dar de alta los usuarios de cada familia con
-- alta_miembro.sql (anitacasadei+demo@gmail.com y
-- anitacasadei+prueba@gmail.com).
--
-- Se corre como postgres (sin usuario logueado), así que acá
-- familia_id se pone explícito en cada insert.
-- ============================================================

insert into familias (nombre) values ('Familia Demo'), ('Familia Prueba');

-- ---------- Familia Demo ----------

insert into centros (familia_id, codigo, nombre, color, entidad, moneda)
select f.id, c.codigo, c.nombre, c.color, c.entidad, c.moneda
from familias f, (values
  ('MPD', 'Mercado Pago',    '#00B1EA', 'mercadopago', 'ARS'),
  ('BSD', 'Banco Santander', '#EC0000', 'santander',   'AMBAS'),
  ('BND', 'Banco Nación',    '#1F6DB5', 'nacion',      'ARS'),
  ('EFD', 'Efectivo',        '#4E9D77', null,          'ARS')
) as c(codigo, nombre, color, entidad, moneda)
where f.nombre = 'Familia Demo';

insert into categorias (familia_id, nombre, tipo, color)
select f.id, c.nombre, c.tipo, c.color
from familias f, (values
  ('Sueldo',      'sueldo',    '#4E9D77'),
  ('Super',       null,        '#D97B6C'),
  ('Comida',      null,        '#E3A857'),
  ('Servicios',   null,        '#7A8FD1'),
  ('Casa',        null,        '#A57FC2'),
  ('Auto',        null,        '#5FA8A8'),
  ('Salida',      null,        '#E07FA8'),
  ('Inversiones', 'inversion', '#8C8C8C')
) as c(nombre, tipo, color)
where f.nombre = 'Familia Demo';

insert into subcategorias (familia_id, categoria_id, nombre)
select f.id, cat.id, s.nombre
from familias f
join (values
  ('Comida',    'Verdulería'),
  ('Comida',    'Carnicería'),
  ('Comida',    'Panadería'),
  ('Servicios', 'Luz'),
  ('Servicios', 'Gas'),
  ('Servicios', 'Internet'),
  ('Servicios', 'Celular'),
  ('Casa',      'Limpieza'),
  ('Casa',      'Mantenimiento'),
  ('Auto',      'Combustible'),
  ('Auto',      'Seguro'),
  ('Salida',    'Restaurante'),
  ('Salida',    'Cine')
) as s(categoria, nombre) on true
join categorias cat on cat.familia_id = f.id and cat.nombre = s.categoria
where f.nombre = 'Familia Demo';

-- Movimientos: (mes relativo al actual, día, centro, categoría, subcategoría, proveedor, detalle, ingreso, egreso)
insert into movimientos (familia_id, fecha, centro_id, categoria_id, subcategoria_id, proveedor, detalle, ingreso, egreso)
select f.id,
       (date_trunc('month', current_date) + make_interval(months => m.mes) + make_interval(days => m.dia - 1))::date,
       cen.id, cat.id, sub.id, m.proveedor, m.detalle, m.ingreso, m.egreso
from familias f
join (values
  (-2,  1, 'BSD', 'Sueldo',      null,           'Empresa Ficticia SA',   'Sueldo',              950000, 0),
  (-2,  3, 'MPD', 'Super',       null,           'Supermercado El Sol',   null,                  0, 85400),
  (-2,  5, 'BSD', 'Servicios',   'Luz',          'Eléctrica del Sur',     null,                  0, 32100),
  (-2,  6, 'BSD', 'Servicios',   'Internet',     'Fibra Total',           null,                  0, 21900),
  (-2,  8, 'EFD', 'Comida',      'Verdulería',   'Verdulería Don Pepe',   null,                  0, 12300),
  (-2, 10, 'MPD', 'Auto',        'Combustible',  'Estación Ruta 2',       null,                  0, 45000),
  (-2, 14, 'MPD', 'Salida',      'Restaurante',  'Parrilla La Esquina',   null,                  0, 38700),
  (-2, 18, 'BND', 'Servicios',   'Gas',          'Gas Pampeano',          null,                  0, 15800),
  (-2, 20, 'MPD', 'Super',       null,           'Supermercado El Sol',   null,                  0, 92650),
  (-2, 25, 'BSD', 'Inversiones', null,           'Plazo fijo',            'Plazo fijo 30 días',  0, 200000),
  (-1,  1, 'BSD', 'Sueldo',      null,           'Empresa Ficticia SA',   'Sueldo',              950000, 0),
  (-1,  2, 'MPD', 'Super',       null,           'Supermercado El Sol',   null,                  0, 78300),
  (-1,  4, 'EFD', 'Comida',      'Carnicería',   'Carnicería Los Toros',  null,                  0, 27500),
  (-1,  5, 'BSD', 'Servicios',   'Luz',          'Eléctrica del Sur',     null,                  0, 29800),
  (-1,  6, 'BSD', 'Servicios',   'Internet',     'Fibra Total',           null,                  0, 21900),
  (-1,  7, 'MPD', 'Servicios',   'Celular',      'Telefonía Móvil',       null,                  0, 18500),
  (-1, 11, 'MPD', 'Casa',        'Limpieza',     'Limpieza Total',        null,                  0, 14200),
  (-1, 15, 'MPD', 'Auto',        'Seguro',       'Seguros del Plata',     null,                  0, 52000),
  (-1, 19, 'MPD', 'Salida',      'Cine',         'Cine Centro',           null,                  0, 16000),
  (-1, 22, 'EFD', 'Comida',      'Panadería',    'Panadería La Espiga',   null,                  0, 6800),
  (-1, 25, 'BSD', 'Inversiones', null,           'Plazo fijo',            'Rendimiento',         8200, 0),
  ( 0,  1, 'BSD', 'Sueldo',      null,           'Empresa Ficticia SA',   'Sueldo',              1020000, 0),
  ( 0,  2, 'MPD', 'Super',       null,           'Supermercado El Sol',   null,                  0, 81200),
  ( 0,  3, 'EFD', 'Comida',      'Verdulería',   'Verdulería Don Pepe',   null,                  0, 13900),
  ( 0,  5, 'BSD', 'Servicios',   'Luz',          'Eléctrica del Sur',     null,                  0, 30500),
  ( 0,  6, 'BSD', 'Servicios',   'Internet',     'Fibra Total',           null,                  0, 23400),
  ( 0,  8, 'MPD', 'Casa',        'Mantenimiento','Ferretería El Tornillo', null,                 0, 19750)
) as m(mes, dia, centro, categoria, subcategoria, proveedor, detalle, ingreso, egreso) on true
join centros cen on cen.familia_id = f.id and cen.codigo = m.centro
join categorias cat on cat.familia_id = f.id and cat.nombre = m.categoria
left join subcategorias sub on sub.familia_id = f.id and sub.categoria_id = cat.id and sub.nombre = m.subcategoria
where f.nombre = 'Familia Demo';

insert into vencimientos (familia_id, concepto, fecha, monto, centro_id, estado)
select f.id, v.concepto,
       (date_trunc('month', current_date) + make_interval(months => v.mes) + make_interval(days => v.dia - 1))::date,
       v.monto, cen.id, v.estado
from familias f
join (values
  (0, 10, 'Gas',              16500, 'BND', 'pendiente'),
  (0, 15, 'Seguro del auto',  52000, 'MPD', 'pendiente'),
  (0, 20, 'Celular',          18500, 'MPD', 'pendiente'),
  (1,  5, 'Luz',              31000, 'BSD', 'pendiente')
) as v(mes, dia, concepto, monto, centro, estado) on true
join centros cen on cen.familia_id = f.id and cen.codigo = v.centro
where f.nombre = 'Familia Demo';

insert into reglas_categorizacion (familia_id, proveedor, categoria, subcategoria)
select f.id, r.proveedor, r.categoria, r.subcategoria
from familias f, (values
  ('Supermercado El Sol', 'Super',     null),
  ('Fibra Total',         'Servicios', 'Internet'),
  ('Eléctrica del Sur',   'Servicios', 'Luz'),
  ('Estación Ruta 2',     'Auto',      'Combustible')
) as r(proveedor, categoria, subcategoria)
where f.nombre = 'Familia Demo';

-- Familia Demo con todas las funciones opcionales prendidas, para ver la app completa
-- (Familia Prueba queda con todo apagado, el default).
insert into familia_config (familia_id, clave, valor)
select f.id, c.clave, 'true'
from familias f, config_catalogo c
where f.nombre = 'Familia Demo' and c.clave like 'feature.%';

-- ---------- Familia Prueba (casi vacía) ----------

insert into centros (familia_id, codigo, nombre, entidad)
select id, 'MPP', 'Mercado Pago', 'mercadopago' from familias where nombre = 'Familia Prueba';

insert into categorias (familia_id, nombre)
select id, 'Varios' from familias where nombre = 'Familia Prueba';

insert into movimientos (familia_id, fecha, centro_id, categoria_id, proveedor, egreso)
select f.id, current_date, cen.id, cat.id, 'Movimiento de prueba', 1000
from familias f
join centros cen on cen.familia_id = f.id and cen.codigo = 'MPP'
join categorias cat on cat.familia_id = f.id and cat.nombre = 'Varios'
where f.nombre = 'Familia Prueba';

-- Verificación: cuántas filas quedaron en cada familia.
select f.nombre as familia,
       (select count(*) from centros where familia_id = f.id)       as centros,
       (select count(*) from categorias where familia_id = f.id)    as categorias,
       (select count(*) from subcategorias where familia_id = f.id) as subcategorias,
       (select count(*) from movimientos where familia_id = f.id)   as movimientos,
       (select count(*) from vencimientos where familia_id = f.id)  as vencimientos
from familias f
order by f.nombre;
