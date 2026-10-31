-- ============================================================
-- BAJA DE MIEMBRO DE UNA FAMILIA
--
-- Saca a un usuario de su familia:
-- - Lo que cargó queda en la familia (los datos son de la familia).
-- - Los Centros de Costo de los que era titular quedan sin titular.
-- - El usuario sigue existiendo en Authentication → Users: si entra,
--   ve el aviso de que no tiene familia. Para que no pueda entrar
--   más, borrarlo ahí (eso solo ya lo saca de la familia).
--
-- Para pasarlo a OTRA familia no hace falta darlo de baja: usar
-- alta_miembro.sql con v_cambiar_de_familia := true.
--
-- 1. Cambiar el email de abajo.
-- 2. Pegar todo en el SQL Editor de Supabase y ejecutar.
-- ============================================================

do $$
declare
  v_email text := 'usuario@ejemplo.com';  -- <-- CAMBIAR

  v_user_id uuid;
  v_familia text;
  v_centros int;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(v_email));
  if v_user_id is null then
    raise exception 'No existe el usuario "%".', v_email;
  end if;

  select f.nombre into v_familia
  from public.miembros m join public.familias f on f.id = m.familia_id
  where m.user_id = v_user_id;
  if v_familia is null then
    raise exception '"%" no es miembro de ninguna familia: no hay nada que dar de baja.', v_email;
  end if;

  update public.centros set titular_id = null where titular_id = v_user_id;
  get diagnostics v_centros = row_count;
  delete from public.miembros where user_id = v_user_id;

  raise notice '"%" ya no es miembro de "%". Centros que quedaron sin titular: %.', v_email, v_familia, v_centros;
end $$;

-- Verificación: todos los usuarios, su nombre y a qué familia pertenecen (o si son superadmin).
select u.email,
       m.nombre,
       coalesce(f.nombre, case when s.user_id is not null then '(superadmin)' else 'SIN FAMILIA' end) as familia,
       u.created_at
from auth.users u
left join public.miembros m on m.user_id = u.id
left join public.familias f on f.id = m.familia_id
left join public.superadmins s on s.user_id = u.id
order by familia, u.email;
