-- ============================================================
-- TESTS DE SEGURIDAD MULTI-FAMILIA (RLS, FK compuestas, superadmin)
--
-- Pegar todo en el SQL Editor de Supabase y ejecutar. No deja
-- nada en la base: crea sus propios usuarios y familias de prueba
-- y al final deshace todo (aunque pase), así que se puede correr
-- contra el proyecto aunque ya tenga las familias dummy.
--
-- - Si todo anda: devuelve una tabla con cada chequeo en "ok".
-- - Si algo falla: el editor muestra un error "FALLA: ..." con el
--   chequeo que no se cumplió.
--
-- Cómo funciona: se cambia de usuario con "set local role
-- authenticated" + request.jwt.claims (lo mismo que hace la API
-- de Supabase con cada request), así RLS se aplica como en la app.
-- ============================================================

drop table if exists pg_temp.resultado_tests;
create temp table resultado_tests (n serial, chequeo text, resultado text default 'ok');

do $tests$
declare
  -- Tablas de datos de cada familia (todas con familia_id)
  tablas text[] := array['centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos',
                         'deudas', 'usdt_movimientos', 'facturas',
                         'configuracion', 'arca_ta', 'reglas_categorizacion'];
  t text;
  n int;
  ok text[] := '{}';

  ua uuid := gen_random_uuid();  -- miembro de A
  ub uuid := gen_random_uuid();  -- miembro de B
  us uuid := gen_random_uuid();  -- superadmin
  un uuid := gen_random_uuid();  -- logueado sin familia
  fa uuid; fb uuid;
  cen_a uuid; cat_a uuid; sub_a uuid; mov_a uuid;
  cen_b uuid; cat_b uuid; sub_b uuid; mov_b uuid;
  nuevo uuid;
  fc uuid := gen_random_uuid();  -- familia que no existe (restaurar una familia borrada)
  resultado jsonb;
begin
  begin  -- todo lo de adentro se deshace al final (ver "__tests_ok__")

    -- ---------- Datos de prueba (como postgres) ----------
    insert into auth.users (id, email, aud, role) values
      (ua, 'test-a@tests.invalid',  'authenticated', 'authenticated'),
      (ub, 'test-b@tests.invalid',  'authenticated', 'authenticated'),
      (us, 'test-sa@tests.invalid', 'authenticated', 'authenticated'),
      (un, 'test-sf@tests.invalid', 'authenticated', 'authenticated');

    insert into public.familias (nombre) values ('__test A__') returning id into fa;
    insert into public.familias (nombre) values ('__test B__') returning id into fb;
    insert into public.miembros (user_id, familia_id) values (ua, fa), (ub, fb);
    insert into public.superadmins (user_id) values (us);

    insert into public.centros (familia_id, codigo, nombre) values (fa, 'A1', 'Centro A') returning id into cen_a;
    insert into public.centros (familia_id, codigo, nombre) values (fb, 'B1', 'Centro B') returning id into cen_b;
    insert into public.categorias (familia_id, nombre) values (fa, 'Cat A') returning id into cat_a;
    insert into public.categorias (familia_id, nombre) values (fb, 'Cat B') returning id into cat_b;
    insert into public.subcategorias (familia_id, categoria_id, nombre) values (fa, cat_a, 'Sub A') returning id into sub_a;
    insert into public.subcategorias (familia_id, categoria_id, nombre) values (fb, cat_b, 'Sub B') returning id into sub_b;
    insert into public.movimientos (familia_id, fecha, centro_id, categoria_id, subcategoria_id, egreso)
      values (fa, current_date, cen_a, cat_a, sub_a, 100) returning id into mov_a;
    insert into public.movimientos (familia_id, fecha, centro_id, categoria_id, subcategoria_id, egreso)
      values (fb, current_date, cen_b, cat_b, sub_b, 200) returning id into mov_b;
    insert into public.vencimientos (familia_id, concepto, fecha, centro_id) values
      (fa, 'Venc A', current_date, cen_a), (fb, 'Venc B', current_date, cen_b);
    insert into public.deudas (familia_id, concepto, centro_id) values
      (fa, 'Deuda A', cen_a), (fb, 'Deuda B', cen_b);
    insert into public.usdt_movimientos (familia_id, fecha, tipo, cantidad, movimiento_id) values
      (fa, current_date, 'venta', 1, mov_a), (fb, current_date, 'venta', 1, mov_b);
    insert into public.facturas (familia_id, movimiento_id, fecha, punto_venta, importe) values
      (fa, mov_a, current_date, 1, 100), (fb, mov_b, current_date, 1, 200);
    insert into public.configuracion (familia_id, clave, valor) values
      (fa, 'arca_cuit', '20000000001'), (fb, 'arca_cuit', '20000000002');
    insert into public.arca_ta (familia_id, ambiente, token, sign, expira_en) values
      (fa, 'homologacion', 'token A', 'sign A', now() + interval '1 hour'),
      (fb, 'homologacion', 'token B', 'sign B', now() + interval '1 hour');
    insert into public.reglas_categorizacion (familia_id, proveedor, categoria) values
      (fa, 'Prov A', 'Cat A'), (fb, 'Prov B', 'Cat B');

    -- ---------- Trigger: miembro y superadmin a la vez ----------
    begin
      insert into public.superadmins (user_id) values (ua);
      raise exception 'FALLA: un miembro pudo ser superadmin';
    exception when raise_exception then
      if sqlerrm like 'FALLA%' then raise; end if;
    end;
    begin
      insert into public.miembros (user_id, familia_id) values (us, fa);
      raise exception 'FALLA: un superadmin pudo ser miembro';
    exception when raise_exception then
      if sqlerrm like 'FALLA%' then raise; end if;
    end;
    ok := array_append(ok, 'trigger: nadie es miembro y superadmin a la vez');

    -- ================== MIEMBRO DE A ==================
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    set local role authenticated;

    if public.familia_actual() is distinct from fa then raise exception 'FALLA: familia_actual() de A no es A'; end if;
    if public.es_superadmin() then raise exception 'FALLA: A figura como superadmin'; end if;
    ok := array_append(ok, 'A: familia_actual() y es_superadmin()');

    foreach t in array tablas loop
      execute format('select count(*) from public.%I where familia_id <> $1', t) using fa into n;
      if n <> 0 then raise exception 'FALLA: A ve % filas de otra familia en %', n, t; end if;
      execute format('select count(*) from public.%I where familia_id = $1', t) using fa into n;
      if n = 0 then raise exception 'FALLA: A no ve sus propias filas en %', t; end if;
    end loop;
    ok := array_append(ok, 'A: ve sus filas y ninguna de otra familia (todas las tablas)');

    select count(*) into n from public.familias;
    if n <> 1 then raise exception 'FALLA: A ve % familias (debería ver 1)', n; end if;
    select count(*) into n from public.miembros;
    if n <> 1 then raise exception 'FALLA: A ve % filas de miembros (debería ver la suya)', n; end if;
    select count(*) into n from public.superadmins;
    if n <> 0 then raise exception 'FALLA: A ve superadmins'; end if;
    ok := array_append(ok, 'A: ve solo su familia, su fila de miembros y ningún superadmin');

    foreach t in array tablas loop
      execute format('update public.%I set familia_id = familia_id where familia_id = $1', t) using fb;
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FALLA: A editó % filas de B en %', n, t; end if;
      execute format('delete from public.%I where familia_id = $1', t) using fb;
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FALLA: A borró % filas de B en %', n, t; end if;
    end loop;
    ok := array_append(ok, 'A: no edita ni borra nada de B (todas las tablas)');

    -- insert sin familia_id: la base completa la familia sola
    insert into public.centros (codigo, nombre) values ('A2', 'Centro A nuevo') returning id into nuevo;
    if (select familia_id from public.centros where id = nuevo) is distinct from fa then
      raise exception 'FALLA: el insert sin familia_id no quedó en la familia de A';
    end if;
    ok := array_append(ok, 'A: insert sin familia_id queda en su familia');

    begin
      insert into public.centros (familia_id, codigo, nombre) values (fb, 'X', 'Intruso');
      raise exception 'FALLA: A insertó un centro con el familia_id de B';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.movimientos (familia_id, fecha, egreso) values (fb, current_date, 1);
      raise exception 'FALLA: A insertó un movimiento con el familia_id de B';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.centros set familia_id = fb where id = nuevo;
      raise exception 'FALLA: A pasó un centro suyo a la familia B';
    exception when insufficient_privilege then null;
    end;
    ok := array_append(ok, 'A: no inserta ni mueve filas con el familia_id de B');

    -- FK compuestas: nada de A puede apuntar a algo de B
    begin
      insert into public.movimientos (fecha, centro_id, egreso) values (current_date, cen_b, 1);
      raise exception 'FALLA: movimiento de A apuntando a centro de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.movimientos (fecha, categoria_id, egreso) values (current_date, cat_b, 1);
      raise exception 'FALLA: movimiento de A apuntando a categoría de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.movimientos (fecha, subcategoria_id, egreso) values (current_date, sub_b, 1);
      raise exception 'FALLA: movimiento de A apuntando a subcategoría de B';
    exception when foreign_key_violation then null;
    end;
    begin
      update public.movimientos set categoria_id = cat_b where id = mov_a;
      raise exception 'FALLA: A cambió su movimiento a una categoría de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.subcategorias (categoria_id, nombre) values (cat_b, 'Intrusa');
      raise exception 'FALLA: subcategoría de A colgando de categoría de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.vencimientos (concepto, fecha, centro_id) values ('X', current_date, cen_b);
      raise exception 'FALLA: vencimiento de A apuntando a centro de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.deudas (concepto, centro_id) values ('X', cen_b);
      raise exception 'FALLA: deuda de A apuntando a centro de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.usdt_movimientos (fecha, tipo, cantidad, movimiento_id) values (current_date, 'venta', 1, mov_b);
      raise exception 'FALLA: venta USDT de A apuntando a movimiento de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.facturas (movimiento_id, fecha, punto_venta, importe) values (mov_b, current_date, 1, 1);
      raise exception 'FALLA: factura de A apuntando a movimiento de B';
    exception when foreign_key_violation then null;
    end;
    ok := array_append(ok, 'A: FK compuestas impiden apuntar a centro/categoría/subcategoría/movimiento de B');

    -- configuracion: la familia la lee pero no la escribe
    begin
      insert into public.configuracion (clave, valor) values ('arca_razon_social', 'X');
      raise exception 'FALLA: A insertó configuración';
    exception when insufficient_privilege then null;
    end;
    update public.configuracion set valor = 'X' where familia_id = fa;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A editó su configuración'; end if;
    delete from public.configuracion where familia_id = fa;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A borró su configuración'; end if;
    ok := array_append(ok, 'A: lee su configuración pero no la escribe');

    -- arca_ta: upsert como la Edge Function (sin mandar familia_id)
    insert into public.arca_ta (ambiente, token, sign, expira_en)
      values ('homologacion', 'token A2', 'sign A2', now() + interval '2 hours')
      on conflict (familia_id, ambiente) do update
        set token = excluded.token, sign = excluded.sign, expira_en = excluded.expira_en;
    if (select token from public.arca_ta where ambiente = 'homologacion') <> 'token A2' then
      raise exception 'FALLA: el upsert de arca_ta de A no actualizó su token';
    end if;
    ok := array_append(ok, 'A: upsert de arca_ta sobre su propia fila');

    -- familias / miembros / superadmins: nadie escribe desde la app
    begin
      insert into public.miembros (user_id, familia_id) values (un, fa);
      raise exception 'FALLA: A agregó un miembro a su familia';
    exception when insufficient_privilege then null;
    end;
    begin
      -- (con un usuario sin familia: si A se pusiera a sí mismo, lo frena antes el trigger)
      insert into public.superadmins (user_id) values (un);
      raise exception 'FALLA: A hizo superadmin a otro usuario';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.familias (nombre) values ('__test intrusa__');
      raise exception 'FALLA: A creó una familia';
    exception when insufficient_privilege then null;
    end;
    update public.miembros set familia_id = fb where user_id = ua;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A se cambió de familia'; end if;
    update public.familias set nombre = 'X' where id = fa;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A renombró su familia'; end if;
    ok := array_append(ok, 'A: no escribe familias, miembros ni superadmins');

    -- Funciones del superadmin: un miembro no las puede usar
    begin
      perform * from public.admin_miembros();
      raise exception 'FALLA: A pudo listar los miembros de todas las familias';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.restaurar_familia(fa, jsonb_build_object('centros', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid(), 'familia_id', fa, 'codigo', 'R', 'nombre', 'Restaurado'))));
      raise exception 'FALLA: A pudo restaurar un backup';
    exception when insufficient_privilege then null;
    end;
    ok := array_append(ok, 'A: no puede usar admin_miembros() ni restaurar_familia()');

    reset role;

    -- El token de B quedó intacto
    if (select token from public.arca_ta where familia_id = fb) <> 'token B' then
      raise exception 'FALLA: el upsert de A tocó el arca_ta de B';
    end if;

    -- ================== MIEMBRO DE B ==================
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    set local role authenticated;

    foreach t in array tablas loop
      execute format('select count(*) from public.%I where familia_id <> $1', t) using fb into n;
      if n <> 0 then raise exception 'FALLA: B ve % filas de otra familia en %', n, t; end if;
    end loop;
    if exists (select 1 from public.centros where id = nuevo) then
      raise exception 'FALLA: B ve el centro que creó A';
    end if;
    ok := array_append(ok, 'B: no ve nada de A');

    reset role;

    -- ================== SUPERADMIN ==================
    perform set_config('request.jwt.claims', json_build_object('sub', us, 'role', 'authenticated')::text, true);
    set local role authenticated;

    if not public.es_superadmin() then raise exception 'FALLA: es_superadmin() da false para el superadmin'; end if;
    if public.familia_actual() is not null then raise exception 'FALLA: el superadmin tiene familia'; end if;

    foreach t in array tablas loop
      continue when t = 'arca_ta';
      execute format('select count(distinct familia_id) from public.%I where familia_id in ($1, $2)', t) using fa, fb into n;
      if n <> 2 then raise exception 'FALLA: el superadmin no ve las dos familias en %', t; end if;
    end loop;
    select count(*) into n from public.familias where id in (fa, fb);
    if n <> 2 then raise exception 'FALLA: el superadmin no ve las dos familias'; end if;
    select count(*) into n from public.miembros where user_id in (ua, ub);
    if n <> 2 then raise exception 'FALLA: el superadmin no ve los miembros de las dos familias'; end if;
    select count(*) into n from public.superadmins;
    if n <> 1 then raise exception 'FALLA: el superadmin ve % filas de superadmins (debería ver la suya)', n; end if;
    ok := array_append(ok, 'superadmin: ve todas las familias, sus datos y sus miembros');

    select count(*) into n from public.arca_ta;
    if n <> 0 then raise exception 'FALLA: el superadmin ve tokens de ARCA'; end if;
    ok := array_append(ok, 'superadmin: no ve arca_ta');

    begin
      insert into public.centros (codigo, nombre) values ('S', 'Del superadmin');
      raise exception 'FALLA: el superadmin insertó un centro sin familia';
    exception when not_null_violation or insufficient_privilege then null;
    end;
    begin
      insert into public.movimientos (familia_id, fecha, egreso) values (fa, current_date, 1);
      raise exception 'FALLA: el superadmin insertó un movimiento en A';
    exception when insufficient_privilege then null;
    end;
    foreach t in array tablas loop
      continue when t = 'configuracion';
      execute format('update public.%I set familia_id = familia_id where familia_id in ($1, $2)', t) using fa, fb;
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FALLA: el superadmin editó % filas en %', n, t; end if;
      execute format('delete from public.%I where familia_id in ($1, $2)', t) using fa, fb;
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FALLA: el superadmin borró % filas en %', n, t; end if;
    end loop;
    ok := array_append(ok, 'superadmin: no inserta, edita ni borra datos de las familias');

    insert into public.configuracion (familia_id, clave, valor) values (fa, 'arca_razon_social', 'Razón A');
    update public.configuracion set valor = '20000000009' where familia_id = fb and clave = 'arca_cuit';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'FALLA: el superadmin no pudo editar la configuración de B'; end if;
    ok := array_append(ok, 'superadmin: escribe la configuración de cualquier familia');

    -- admin_miembros(): ve los emails de los miembros de todas las familias
    select count(*) into n from public.admin_miembros()
      where email in ('test-a@tests.invalid', 'test-b@tests.invalid');
    if n <> 2 then raise exception 'FALLA: admin_miembros() no devuelve los miembros de las dos familias'; end if;
    ok := array_append(ok, 'superadmin: admin_miembros() lista los miembros con su email');

    -- restaurar_familia(): rechaza filas de otra familia
    begin
      perform public.restaurar_familia(fa, jsonb_build_object('centros', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid(), 'familia_id', fb, 'codigo', 'R', 'nombre', 'De B'))));
      raise exception 'FALLA: se restauraron en A filas de B';
    exception when raise_exception then
      if sqlerrm like 'FALLA%' then raise; end if;
    end;
    -- rechaza un id que ya es de otra familia (no se lo "roba")
    begin
      perform public.restaurar_familia(fa, jsonb_build_object('centros', jsonb_build_array(
        jsonb_build_object('id', cen_b, 'familia_id', fa, 'codigo', 'R', 'nombre', 'Robado'))));
      raise exception 'FALLA: la restauración de A pisó un centro de B';
    exception when raise_exception then
      if sqlerrm like 'FALLA%' then raise; end if;
    end;
    -- todo o nada: un centro válido + un movimiento que apunta a una categoría de B => no entra ninguno
    nuevo := gen_random_uuid();
    begin
      perform public.restaurar_familia(fa, jsonb_build_object(
        'centros', jsonb_build_array(jsonb_build_object('id', nuevo, 'familia_id', fa, 'codigo', 'R', 'nombre', 'Restaurado')),
        'movimientos', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'familia_id', fa,
          'fecha', current_date, 'categoria_id', cat_b, 'egreso', 1))));
      raise exception 'FALLA: se restauró un movimiento que apunta a una categoría de B';
    exception when foreign_key_violation then null;
    end;
    if exists (select 1 from public.centros where id = nuevo) then
      raise exception 'FALLA: la restauración fallida dejó filas a medias';
    end if;
    ok := array_append(ok, 'superadmin: restaurar_familia() rechaza filas o ids de otra familia y es todo o nada');

    -- restauración válida: actualiza lo que coincide por id y agrega lo que falta
    resultado := public.restaurar_familia(fa, jsonb_build_object(
      'centros', jsonb_build_array(jsonb_build_object('id', nuevo, 'familia_id', fa, 'codigo', 'R', 'nombre', 'Restaurado')),
      'movimientos', jsonb_build_array(jsonb_build_object('id', mov_a, 'familia_id', fa, 'fecha', current_date,
        'centro_id', cen_a, 'egreso', 100, 'detalle', 'restaurado')),
      'configuracion', jsonb_build_array(jsonb_build_object('familia_id', fa, 'clave', 'arca_cuit', 'valor', '20111111111'))));
    if resultado <> '{"centros": 1, "movimientos": 1, "configuracion": 1}'::jsonb then
      raise exception 'FALLA: restaurar_familia() devolvió %', resultado;
    end if;
    if (select detalle from public.movimientos where id = mov_a) is distinct from 'restaurado'
       or (select tarjeta from public.movimientos where id = mov_a) is distinct from false
       or not exists (select 1 from public.centros where id = nuevo and familia_id = fa)
       or (select valor from public.configuracion where familia_id = fa and clave = 'arca_cuit') <> '20111111111' then
      raise exception 'FALLA: restaurar_familia() no aplicó bien los cambios';
    end if;
    ok := array_append(ok, 'superadmin: restaurar_familia() agrega y actualiza por id');

    -- familia borrada: la vuelve a crear con el mismo id y nombre
    perform public.restaurar_familia(fc, jsonb_build_object(
      'familia', jsonb_build_object('id', fc, 'nombre', '__test C__'),
      'categorias', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'familia_id', fc, 'nombre', 'Cat C'))));
    if not exists (select 1 from public.familias where id = fc and nombre = '__test C__')
       or not exists (select 1 from public.categorias where familia_id = fc) then
      raise exception 'FALLA: restaurar_familia() no recreó la familia borrada';
    end if;
    ok := array_append(ok, 'superadmin: restaurar_familia() recrea una familia que ya no existe');

    reset role;

    -- ================== LOGUEADO SIN FAMILIA ==================
    perform set_config('request.jwt.claims', json_build_object('sub', un, 'role', 'authenticated')::text, true);
    set local role authenticated;

    foreach t in array tablas || array['familias', 'miembros', 'superadmins'] loop
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'FALLA: un usuario sin familia ve % filas en %', n, t; end if;
    end loop;
    begin
      insert into public.centros (codigo, nombre) values ('X', 'Sin familia');
      raise exception 'FALLA: un usuario sin familia insertó un centro';
    exception when not_null_violation or insufficient_privilege then null;
    end;
    ok := array_append(ok, 'sin familia: no ve nada y no puede insertar');

    reset role;

    -- ================== SIN SESIÓN (anon) ==================
    perform set_config('request.jwt.claims', '', true);
    set local role anon;

    foreach t in array tablas || array['familias', 'miembros', 'superadmins'] loop
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'FALLA: anon ve % filas en %', n, t; end if;
    end loop;
    ok := array_append(ok, 'anon: no ve nada');

    reset role;

    raise exception '__tests_ok__';
  exception when others then
    if sqlerrm <> '__tests_ok__' then raise; end if;
  end;

  insert into resultado_tests (chequeo) select unnest(ok);
end $tests$;

select * from resultado_tests order by n;
