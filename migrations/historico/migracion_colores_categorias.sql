-- ============================================================
-- Colores de chip para Categorías (fondo + texto)
-- Pegar en Supabase -> SQL Editor -> New query -> Run
-- ============================================================

-- Si todavía no corriste la migración de color_texto, esto la agrega (no rompe nada si ya existe).
alter table categorias add column if not exists color text;
alter table categorias add column if not exists color_texto text;

-- Grises / neutros
update categorias set color = '#F3F4F6', color_texto = '#4B5563' where lower(nombre) = lower('Saldo Inicio');
update categorias set color = '#E5E7EB', color_texto = '#4B5563' where lower(nombre) = lower('Intereses');
update categorias set color = '#E5E7EB', color_texto = '#374151' where lower(nombre) = lower('P. Préstamo');
update categorias set color = '#E2E8F0', color_texto = '#475569' where lower(nombre) = lower('TEC');
update categorias set color = '#F1F5F9', color_texto = '#475569' where lower(nombre) = lower('Sueldo');
update categorias set color = '#ECEFF3', color_texto = '#475569' where lower(nombre) = lower('Otro');

-- 🩵 Celestes
update categorias set color = '#E0F2FE', color_texto = '#0369A1' where lower(nombre) = lower('Laprida');
update categorias set color = '#DBEAFE', color_texto = '#1D4ED8' where lower(nombre) = lower('Auto');
update categorias set color = '#E6F4FF', color_texto = '#2563EB' where lower(nombre) = lower('Casa');
update categorias set color = '#F0F9FF', color_texto = '#0284C7' where lower(nombre) = lower('Servicios');
update categorias set color = '#E0F7FA', color_texto = '#0F766E' where lower(nombre) = lower('Salud');

-- 🟢 Verdes
update categorias set color = '#DCFCE7', color_texto = '#15803D' where lower(nombre) = lower('Verdulería');
update categorias set color = '#F0FDF4', color_texto = '#16A34A' where lower(nombre) = lower('Super');
update categorias set color = '#ECFDF5', color_texto = '#059669' where lower(nombre) = lower('Comida');
update categorias set color = '#E8F5E9', color_texto = '#2E7D32' where lower(nombre) = lower('Salida');
update categorias set color = '#E6F6EC', color_texto = '#2F855A' where lower(nombre) = lower('Veterinaria');

-- 🟧 Naranjas
update categorias set color = '#FFF7ED', color_texto = '#C2410C' where lower(nombre) = lower('Alq. Campo');
update categorias set color = '#FFEDD5', color_texto = '#EA580C' where lower(nombre) = lower('Nancy');
update categorias set color = '#FEF3C7', color_texto = '#D97706' where lower(nombre) = lower('Guada');

-- 🟨 Amarillos
update categorias set color = '#FEFCE8', color_texto = '#A16207' where lower(nombre) = lower('Autoregalo');
update categorias set color = '#FEF9C3', color_texto = '#A16207' where lower(nombre) = lower('Running');
update categorias set color = '#FFF8DB', color_texto = '#B45309' where lower(nombre) = lower('Regalo');

-- 🟣 Violetas
update categorias set color = '#F3E8FF', color_texto = '#7E22CE' where lower(nombre) = lower('Emma y Juli');

-- Para revisar qué categorías NO matchearon ningún nombre de la lista de arriba
-- (por ejemplo si el nombre real tiene una tilde o espacio distinto), corré esto aparte:
-- select nombre, color, color_texto from categorias
-- where lower(nombre) not in (
--   lower('Saldo Inicio'), lower('Intereses'), lower('P. Préstamo'), lower('TEC'), lower('Sueldo'), lower('Otro'),
--   lower('Laprida'), lower('Auto'), lower('Casa'), lower('Servicios'), lower('Salud'),
--   lower('Verdulería'), lower('Super'), lower('Comida'), lower('Salida'), lower('Veterinaria'),
--   lower('Alq. Campo'), lower('Nancy'), lower('Guada'),
--   lower('Autoregalo'), lower('Running'), lower('Regalo'),
--   lower('Emma y Juli')
-- )
-- order by nombre;

-- Para revisar el resultado general:
-- select nombre, color, color_texto from categorias order by nombre;
