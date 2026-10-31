-- ============================================================
-- MIGRACIÓN: importador de Macro (cuenta)
--
-- Aplicada en el proyecto Supabase el 2026-10-31.
--
-- Agrega la fila 'macro' a importadores, que se conecta con
-- parseMacro() en app.js. Como se guardan los ocultos, les
-- aparece a todas las familias. No borra nada.
-- ============================================================

insert into importadores (codigo, nombre, orden) values ('macro', 'Macro', 5)
on conflict (codigo) do nothing;
