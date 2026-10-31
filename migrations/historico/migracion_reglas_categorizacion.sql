-- ============================================================
-- Reglas de categorización al importar — pegar en el SQL Editor
-- de Supabase (Project → SQL Editor → New query → Run)
--
-- Reemplaza el localStorage por el que se guardaban antes (ver
-- git log de app.js si hace falta la versión vieja). El INSERT de
-- abajo es la migración de las reglas que ya tenías: una sola vez.
-- ============================================================

create table reglas_categorizacion (
  id uuid primary key default gen_random_uuid(),
  proveedor text not null,
  categoria text not null,
  subcategoria text,
  created_at timestamptz default now()
);

alter table reglas_categorizacion enable row level security;

create policy "logueados_todo_reglas_categorizacion" on reglas_categorizacion
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Semilla: las reglas que antes vivían hardcodeadas en app.js (REGLAS_DEFAULT).
-- Corré este INSERT una sola vez, junto con el CREATE TABLE de arriba.
insert into reglas_categorizacion (proveedor, categoria, subcategoria) values
  ('Barrientos', 'Casa', 'Limpieza'),
  ('Zuvilivia', 'Comida', 'Carnicería'),
  ('Melina', 'Comida', 'Verdulería'),
  ('Rocio Jaqueline Oderda', 'Comida', 'Panadería'),
  ('Kiosco las flores', 'Salida', 'Kiosco'),
  ('Rendimientos', 'Intereses', 'Rendimientos'),
  ('Nahir Aldana Kastelan', 'Emma y Juli', 'Librería'),
  ('Carina Ines', 'Emma y Juli', 'Pañalera'),
  ('Macarena', 'Emma y Juli', 'Niñera'),
  ('Boqon', 'Salida', null),
  ('Casa oriental', 'Casa', null),
  ('Claudio Gabriel Valerio', 'Super', null),
  ('Luis Alberto Aguero', 'Obra', 'Albañil'),
  ('Francisco Mira', 'Comida', 'Dietética'),
  ('Mariano Del Valle', 'Comida', 'Pollería'),
  ('Gustavo Canale', 'Obra', null),
  ('PEMASYS S. A.', 'Sueldo', 'Maslow'),
  ('Rendimiento', 'Intereses', null),
  ('LA ANóNIMA SUC 100', 'Super', null),
  ('APPYPF 03008 COMBUST', 'Auto', null),
  ('Spotify', 'Servicios', 'Spotify'),
  ('IMPUESTO DE SELLOS', 'Servicios', 'Gastos Bancarios'),
  ('IIBB PERCEP-BSAS 2,00%( 5499,00)', 'Servicios', 'Gastos Bancarios'),
  ('IVA RG 4240 21%( 5499,00)', 'Servicios', 'Gastos Bancarios'),
  ('DB.RG 5617 30% ( 5499,00 )', 'Servicios', 'Gastos Bancarios');
