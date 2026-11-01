-- ============================================================
-- MIGRACIÓN: importador de Galicia (cuenta)
--
-- Aplicada en el proyecto Supabase el 2026-11-01.
--
-- Agrega la fila 'galicia' a importadores, que se conecta con
-- parseGalicia() en app.js. Como se guardan los ocultos, les
-- aparece a todas las familias. No borra nada.
-- ============================================================

insert into importadores (codigo, nombre, orden) values ('galicia', 'Galicia', 6)
on conflict (codigo) do nothing;
