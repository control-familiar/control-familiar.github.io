-- ============================================================
-- ALTA DE FAMILIA
--
-- 1. Cambiar el nombre de abajo.
-- 2. Pegar todo en el SQL Editor de Supabase y ejecutar.
-- 3. Después dar de alta sus miembros con alta_miembro.sql.
--    Las categorías y centros los carga la familia desde los ABM.
-- ============================================================

do $$
declare
  v_nombre text := 'Familia Nueva';  -- <-- CAMBIAR
begin
  if exists (select 1 from public.familias where lower(nombre) = lower(trim(v_nombre))) then
    raise exception 'Ya existe una familia llamada "%"', v_nombre;
  end if;
  insert into public.familias (nombre) values (trim(v_nombre));
end $$;

-- Verificación: todas las familias con su cantidad de miembros.
select f.nombre as familia, f.id, count(m.user_id) as miembros, f.created_at
from public.familias f
left join public.miembros m on m.familia_id = f.id
group by f.id
order by f.created_at;
