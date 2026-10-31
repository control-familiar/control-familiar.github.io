-- ============================================================
-- ESTADO GENERAL (solo lectura: no cambia nada)
--
-- Para ver cómo está todo antes de tocar algo: cada familia con
-- sus miembros, funciones prendidas, importadores ocultos y
-- configuración propia; los superadmins; y los usuarios que no
-- son de ninguna familia (entran y ven el aviso de que no tienen).
--
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- ============================================================

with funciones as (
  -- Valor efectivo de cada función opcional para cada familia: el propio o el default del catálogo.
  select f.id as familia_id, string_agg(replace(c.clave, 'feature.', ''), ', ' order by c.orden) as prendidas
  from public.familias f
  cross join public.config_catalogo c
  left join public.familia_config fc on fc.familia_id = f.id and fc.clave = c.clave
  where c.clave like 'feature.%' and coalesce(fc.valor, c.valor_default) = 'true'
  group by f.id
)
select 'Familia' as tipo,
       f.nombre,
       (select string_agg(m.nombre || ' <' || u.email || '>', ', ' order by m.nombre)
          from public.miembros m join auth.users u on u.id = m.user_id
         where m.familia_id = f.id) as miembros,
       fn.prendidas as funciones_prendidas,
       (select string_agg(o.importador_codigo, ', ' order by o.importador_codigo)
          from public.familia_importadores_ocultos o where o.familia_id = f.id) as importadores_ocultos,
       (select string_agg(fc.clave || ' = ' || fc.valor, ', ' order by fc.clave)
          from public.familia_config fc where fc.familia_id = f.id and fc.clave not like 'feature.%') as otra_configuracion
from public.familias f
left join funciones fn on fn.familia_id = f.id

union all

select 'Superadmin', u.email, null, null, null, null
from public.superadmins s join auth.users u on u.id = s.user_id

union all

select 'Sin familia', u.email, null, null, null, null
from auth.users u
where not exists (select 1 from public.miembros m where m.user_id = u.id)
  and not exists (select 1 from public.superadmins s where s.user_id = u.id)

order by 1, 2;
