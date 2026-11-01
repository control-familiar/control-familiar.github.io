-- ============================================================
-- MIGRACIÓN: importador de Tarjeta de Crédito Galicia
--
-- Aplicada en el proyecto Supabase el 2026-11-01.
--
-- Agrega la fila 'tarjeta_galicia' a importadores, que se
-- conecta con parseTarjetaGalicia() en app.js. Como se guardan
-- los ocultos, les aparece a todas las familias (con la función
-- Tarjetas prendida). No borra nada.
-- ============================================================

insert into importadores (codigo, nombre, orden) values ('tarjeta_galicia', 'Galicia', 15)
on conflict (codigo) do nothing;
