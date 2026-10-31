-- ============================================================
-- ALTA DE MIEMBRO DE UNA FAMILIA
--
-- 1. Crear el usuario a mano en Supabase: Authentication → Users
--    → Add user (el signup público está deshabilitado).
-- 2. Cambiar el email y la familia de abajo.
-- 3. Pegar todo en el SQL Editor de Supabase y ejecutar.
-- 4. Revisar en la verificación del final que el usuario aparezca
--    en su familia: un usuario que no es miembro entra y ve la app
--    vacía (parece que se perdieron datos).
--
-- Un usuario pertenece a UNA sola familia. Para pasarlo a otra,
-- poner v_cambiar_de_familia := true (lo que cargó queda en la
-- familia anterior).
-- ============================================================

do $$
declare
  v_email   text := 'usuario@ejemplo.com';  -- <-- CAMBIAR
  v_familia text := 'Familia Nueva';        -- <-- CAMBIAR
  v_cambiar_de_familia boolean := false;

  v_user_id    uuid;
  v_familia_id uuid;
  v_actual     text;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(v_email));
  if v_user_id is null then
    raise exception 'No existe el usuario "%". Crearlo primero en Authentication → Users.', v_email;
  end if;

  select id into v_familia_id from public.familias where lower(nombre) = lower(trim(v_familia));
  if v_familia_id is null then
    raise exception 'No existe la familia "%". Darla de alta con alta_familia.sql.', v_familia;
  end if;

  if exists (select 1 from public.superadmins where user_id = v_user_id) then
    raise exception '"%" es superadmin: no puede ser miembro de una familia.', v_email;
  end if;

  select f.nombre into v_actual
  from public.miembros m join public.familias f on f.id = m.familia_id
  where m.user_id = v_user_id;

  if v_actual is null then
    insert into public.miembros (user_id, familia_id) values (v_user_id, v_familia_id);
  elsif lower(v_actual) = lower(trim(v_familia)) then
    raise notice '"%" ya era miembro de "%": no se cambió nada.', v_email, v_actual;
  elsif v_cambiar_de_familia then
    update public.miembros set familia_id = v_familia_id where user_id = v_user_id;
  else
    raise exception '"%" ya es miembro de "%". Para pasarlo a "%", poner v_cambiar_de_familia := true.',
      v_email, v_actual, v_familia;
  end if;
end $$;

-- Verificación: todos los usuarios y a qué familia pertenecen (o si son superadmin).
-- Los que figuran "SIN FAMILIA" entran y no ven nada.
select u.email,
       coalesce(f.nombre, case when s.user_id is not null then '(superadmin)' else 'SIN FAMILIA' end) as familia,
       u.created_at
from auth.users u
left join public.miembros m on m.user_id = u.id
left join public.familias f on f.id = m.familia_id
left join public.superadmins s on s.user_id = u.id
order by familia, u.email;
