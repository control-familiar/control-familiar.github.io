-- ============================================================
-- ALTA DE SUPERADMIN (cuenta de soporte)
--
-- El superadmin es una cuenta aparte, que no pertenece a ninguna
-- familia: ve todas en solo lectura y administra su configuración.
--
-- 1. Crear el usuario a mano en Supabase: Authentication → Users
--    → Add user.
-- 2. Cambiar el email de abajo.
-- 3. Pegar todo en el SQL Editor de Supabase y ejecutar.
-- ============================================================

do $$
declare
  v_email text := 'soporte@ejemplo.com';  -- <-- CAMBIAR

  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(v_email));
  if v_user_id is null then
    raise exception 'No existe el usuario "%". Crearlo primero en Authentication → Users.', v_email;
  end if;

  if exists (select 1 from public.miembros where user_id = v_user_id) then
    raise exception '"%" es miembro de una familia: el superadmin tiene que ser una cuenta aparte.', v_email;
  end if;

  insert into public.superadmins (user_id) values (v_user_id) on conflict (user_id) do nothing;
end $$;

-- Verificación: todos los superadmins.
select u.email, s.created_at
from public.superadmins s
join auth.users u on u.id = s.user_id
order by u.email;
