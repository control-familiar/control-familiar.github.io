-- ============================================================
-- Colores de chip para Centros de Costo, según propietario
-- (misma convención que ya usa la app: último caracter del
-- código -> 'F' = Franco, 'A' = Ana)
-- Pegar en Supabase -> SQL Editor -> New query -> Run
-- ============================================================

-- Si todavía no corriste la migración de color/color_texto, esto la agrega (no rompe nada si ya existen).
alter table centros add column if not exists color text;
alter table centros add column if not exists color_texto text;

-- Franco: termina en "F"
update centros
set color = '#DBEAFE', color_texto = '#1D4ED8'
where upper(right(codigo, 1)) = 'F';

-- Ana: termina en "A"
update centros
set color = '#EDE9FE', color_texto = '#7C3AED'
where upper(right(codigo, 1)) = 'A';

-- Para revisar el resultado:
-- select codigo, nombre, color, color_texto from centros order by codigo;
