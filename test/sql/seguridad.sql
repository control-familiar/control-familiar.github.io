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
  tablas text[] := array['centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos_recurrentes',
                         'vencimientos', 'deudas', 'usdt_movimientos', 'facturas',
                         'familia_config', 'familia_importadores_ocultos', 'arca_ta', 'reglas_categorizacion'];
  t text;
  n int;
  ok text[] := '{}';

  ua uuid := gen_random_uuid();  -- miembro de A
  ua2 uuid := gen_random_uuid(); -- otro miembro de A
  ub uuid := gen_random_uuid();  -- miembro de B
  us uuid := gen_random_uuid();  -- superadmin
  un uuid := gen_random_uuid();  -- logueado sin familia
  fa uuid; fb uuid;
  cen_a uuid; cat_a uuid; sub_a uuid; mov_a uuid;
  cen_b uuid; cat_b uuid; sub_b uuid; mov_b uuid;
  rec_a uuid; rec_b uuid;
  hace2 date := (date_trunc('month', current_date) - interval '2 months')::date;  -- mes de hace dos meses (día 1)
  nuevo uuid;
  mov_audit uuid;
  fc uuid := gen_random_uuid();  -- familia que no existe (restaurar una familia borrada)
  resultado jsonb;
begin
  begin  -- todo lo de adentro se deshace al final (ver "__tests_ok__")

    -- ---------- Datos de prueba (como postgres) ----------
    insert into auth.users (id, email, aud, role) values
      (ua, 'test-a@tests.invalid',  'authenticated', 'authenticated'),
      (ua2, 'test-a2@tests.invalid', 'authenticated', 'authenticated'),
      (ub, 'test-b@tests.invalid',  'authenticated', 'authenticated'),
      (us, 'test-sa@tests.invalid', 'authenticated', 'authenticated'),
      (un, 'test-sf@tests.invalid', 'authenticated', 'authenticated');

    insert into public.familias (nombre) values ('__test A__') returning id into fa;
    insert into public.familias (nombre) values ('__test B__') returning id into fb;
    insert into public.miembros (user_id, familia_id, nombre) values (ua, fa, 'A uno'), (ua2, fa, 'A dos'), (ub, fb, 'B uno');
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
    -- Recurrentes: el de A vence el 31 (en los meses más cortos, el último día) desde hace dos meses.
    insert into public.vencimientos_recurrentes (familia_id, concepto, dia, desde, centro_id, categoria_id)
      values (fa, 'Rec A', 31, hace2, cen_a, cat_a) returning id into rec_a;
    insert into public.vencimientos_recurrentes (familia_id, concepto, dia, desde, centro_id)
      values (fb, 'Rec B', 10, hace2, cen_b) returning id into rec_b;
    insert into public.vencimientos (familia_id, concepto, fecha, centro_id) values
      (fa, 'Venc A', current_date, cen_a), (fb, 'Venc B', current_date, cen_b);
    insert into public.deudas (familia_id, concepto, centro_id) values
      (fa, 'Deuda A', cen_a), (fb, 'Deuda B', cen_b);
    insert into public.usdt_movimientos (familia_id, fecha, tipo, cantidad, movimiento_id) values
      (fa, current_date, 'venta', 1, mov_a), (fb, current_date, 'venta', 1, mov_b);
    insert into public.facturas (familia_id, movimiento_id, fecha, punto_venta, importe) values
      (fa, mov_a, current_date, 1, 100), (fb, mov_b, current_date, 1, 200);
    -- una clave de prueba con default, para ver config_valor() con y sin valor propio
    insert into public.config_catalogo (clave, tipo, descripcion, valor_default, grupo)
      values ('__test_numero', 'numero', 'Clave de prueba', '5', 'Tests');
    insert into public.familia_config (familia_id, clave, valor) values (fb, '__test_numero', '7');
    insert into public.familia_config (familia_id, clave, valor) values
      (fa, 'arca_cuit', '20000000001'), (fb, 'arca_cuit', '20000000002');
    insert into public.arca_ta (familia_id, ambiente, token, sign, expira_en) values
      (fa, 'homologacion', 'token A', 'sign A', now() + interval '1 hour'),
      (fb, 'homologacion', 'token B', 'sign B', now() + interval '1 hour');
    insert into public.familia_importadores_ocultos (familia_id, importador_codigo) values (fa, 'excel'), (fb, 'excel');
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
      insert into public.miembros (user_id, familia_id, nombre) values (us, fa, 'Soporte');
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
    select count(*) into n from public.miembros where familia_id = fa;
    if n <> 2 then raise exception 'FALLA: A ve % miembros de su familia (debería ver 2)', n; end if;
    select count(*) into n from public.miembros where familia_id <> fa;
    if n <> 0 then raise exception 'FALLA: A ve % miembros de otra familia', n; end if;
    select count(*) into n from public.superadmins;
    if n <> 0 then raise exception 'FALLA: A ve superadmins'; end if;
    ok := array_append(ok, 'A: ve solo su familia, sus miembros y ningún superadmin');

    -- Titular de un centro (D5): solo un miembro de la misma familia
    update public.centros set titular_id = ua2 where id = cen_a;
    begin
      update public.centros set titular_id = ub where id = cen_a;
      raise exception 'FALLA: un centro de A tiene como titular a un miembro de B';
    exception when foreign_key_violation then null;
    end;
    begin
      update public.centros set titular_id = un where id = cen_a;
      raise exception 'FALLA: un centro de A tiene como titular a alguien sin familia';
    exception when foreign_key_violation then null;
    end;
    ok := array_append(ok, 'A: el titular de un centro es un miembro de su familia, nunca de otra');

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

    -- auditoría (A1): quién y cuándo lo pone la base, aunque la app mande otra cosa, y no se cambia al editar
    insert into public.movimientos (fecha, egreso, creado_por, created_at)
      values (current_date, 10, ua2, '2020-01-01') returning id into mov_audit;
    if (select creado_por from public.movimientos where id = mov_audit) is distinct from ua
       or (select created_at from public.movimientos where id = mov_audit) < now() - interval '1 minute' then
      raise exception 'FALLA: el movimiento no quedó cargado por A, ahora';
    end if;
    update public.movimientos set creado_por = ua2, created_at = '2020-01-01', egreso = 11 where id = mov_audit;
    if (select creado_por from public.movimientos where id = mov_audit) is distinct from ua
       or (select created_at from public.movimientos where id = mov_audit) < now() - interval '1 minute'
       or (select egreso from public.movimientos where id = mov_audit) <> 11 then
      raise exception 'FALLA: al editar un movimiento se pudo cambiar quién o cuándo lo cargó';
    end if;
    ok := array_append(ok, 'A: quién y cuándo cargó un movimiento lo pone la base y no se cambia al editar');

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
    begin
      insert into public.vencimientos_recurrentes (concepto, dia, desde, categoria_id) values ('X', 1, hace2, cat_b);
      raise exception 'FALLA: recurrente de A apuntando a categoría de B';
    exception when foreign_key_violation then null;
    end;
    begin
      insert into public.vencimientos (concepto, fecha, recurrente_id, periodo) values ('X', current_date, rec_b, hace2);
      raise exception 'FALLA: vencimiento de A apuntando a recurrente de B';
    exception when foreign_key_violation then null;
    end;
    ok := array_append(ok, 'A: FK compuestas impiden apuntar a centro/categoría/subcategoría/movimiento/recurrente de B');

    -- Vencimientos recurrentes (V1): generar_vencimientos_recurrentes() crea los meses que faltan, solo de A.
    -- Uno con "hasta" = "desde" genera un solo mes.
    insert into public.vencimientos_recurrentes (concepto, dia, desde, hasta) values ('Rec A corto', 5, hace2, hace2);
    n := public.generar_vencimientos_recurrentes();
    if n <> 4 then raise exception 'FALLA: generar_vencimientos_recurrentes() creó % vencimientos (deberían ser 3 + 1)', n; end if;
    select count(*) into n from public.vencimientos
      where recurrente_id = rec_a and familia_id = fa and estado = 'pendiente' and categoria_id = cat_a and centro_id = cen_a
        and fecha = (periodo + interval '1 month - 1 day')::date;
    if n <> 3 then raise exception 'FALLA: los vencimientos del recurrente de A no quedaron bien (% de 3)', n; end if;
    if (select generado_hasta from public.vencimientos_recurrentes where id = rec_a) <> date_trunc('month', current_date)::date then
      raise exception 'FALLA: generado_hasta no quedó en el mes actual';
    end if;
    if public.generar_vencimientos_recurrentes() <> 0 then raise exception 'FALLA: la segunda llamada volvió a generar'; end if;
    delete from public.vencimientos where recurrente_id = rec_a and periodo = hace2;
    if public.generar_vencimientos_recurrentes() <> 0 then raise exception 'FALLA: un vencimiento generado y borrado volvió'; end if;
    begin
      insert into public.vencimientos (concepto, fecha, recurrente_id, periodo)
        values ('Doble', current_date, rec_a, date_trunc('month', current_date)::date);
      raise exception 'FALLA: un recurrente tiene dos vencimientos en el mismo mes';
    exception when unique_violation then null;
    end;
    begin
      update public.vencimientos set estado = 'otro' where recurrente_id = rec_a;
      raise exception 'FALLA: se guardó un estado de vencimiento inválido';
    exception when check_violation then null;
    end;
    ok := array_append(ok, 'A: genera sus vencimientos recurrentes una sola vez por mes (último día si el mes es corto; respeta "hasta")');

    -- Con p_hoy en el mes siguiente genera uno más (el corto ya terminó).
    if public.generar_vencimientos_recurrentes((current_date + interval '1 month')::date) <> 1 then
      raise exception 'FALLA: al pasar al mes siguiente no generó el vencimiento nuevo';
    end if;
    ok := array_append(ok, 'A: al cambiar de mes se genera el del mes nuevo');

    -- familia_config: la familia la lee pero no la escribe
    begin
      insert into public.familia_config (clave, valor) values ('arca_razon_social', 'X');
      raise exception 'FALLA: A insertó configuración';
    exception when insufficient_privilege then null;
    end;
    update public.familia_config set valor = 'X' where familia_id = fa;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A editó su configuración'; end if;
    delete from public.familia_config where familia_id = fa;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A borró su configuración'; end if;
    ok := array_append(ok, 'A: lee su configuración pero no la escribe');

    -- config_catalogo: lo lee, no lo escribe
    select count(*) into n from public.config_catalogo where clave in ('arca_cuit', 'arca_razon_social', 'monotributo_limite_categoria_b');
    if n <> 3 then raise exception 'FALLA: A no ve el catálogo de configuración'; end if;
    begin
      insert into public.config_catalogo (clave, tipo, descripcion, grupo) values ('__intrusa', 'texto', 'X', 'X');
      raise exception 'FALLA: A agregó una clave al catálogo';
    exception when insufficient_privilege then null;
    end;
    update public.config_catalogo set valor_default = '1' where clave = '__test_numero';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A cambió un default del catálogo'; end if;
    ok := array_append(ok, 'A: lee el catálogo de configuración pero no lo escribe');

    -- Importadores (D7): A lee la tabla global y su lista de ocultos, pero no escribe ninguna
    select count(*) into n from public.importadores;
    if n < 9 then raise exception 'FALLA: A no ve los importadores'; end if;
    begin
      insert into public.importadores (codigo, nombre) values ('__intruso', 'X');
      raise exception 'FALLA: A agregó un importador';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.familia_importadores_ocultos (importador_codigo) values ('mp');
      raise exception 'FALLA: A ocultó un importador de su familia';
    exception when insufficient_privilege then null;
    end;
    delete from public.familia_importadores_ocultos where familia_id = fa;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: A volvió a mostrar un importador oculto'; end if;
    ok := array_append(ok, 'A: lee los importadores y sus ocultos, pero no los cambia');

    -- config_valor(): el valor propio o, si no tiene, el default
    if public.config_valor('arca_cuit') is distinct from '20000000001' then
      raise exception 'FALLA: config_valor() no devuelve el valor propio de A';
    end if;
    if public.config_valor('__test_numero') is distinct from '5' then
      raise exception 'FALLA: config_valor() no devuelve el default para A (B tiene otro valor)';
    end if;
    if public.config_valor('arca_razon_social') is not null then
      raise exception 'FALLA: config_valor() inventa un valor sin default ni valor propio';
    end if;
    ok := array_append(ok, 'A: config_valor() da su valor o el default, nunca el de otra familia');

    -- Una sola categoría de Venta de USDT por familia (B puede tener la suya)
    insert into public.categorias (nombre, tipo) values ('Venta A', 'venta_usdt');
    begin
      insert into public.categorias (nombre, tipo) values ('Otra venta A', 'venta_usdt');
      raise exception 'FALLA: A tiene dos categorías de Venta de USDT';
    exception when unique_violation then null;
    end;
    ok := array_append(ok, 'A: una sola categoría de Venta de USDT por familia');

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
      insert into public.miembros (user_id, familia_id, nombre) values (un, fa, 'Intruso');
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
    if public.config_valor('__test_numero') is distinct from '7' then
      raise exception 'FALLA: config_valor() no devuelve el valor propio de B';
    end if;
    -- Lo que generó A no tocó a B: B genera los suyos recién ahora.
    if exists (select 1 from public.vencimientos where recurrente_id = rec_b) then
      raise exception 'FALLA: la generación de A creó vencimientos de B';
    end if;
    if public.generar_vencimientos_recurrentes() <> 3 then raise exception 'FALLA: B no generó sus 3 vencimientos'; end if;
    ok := array_append(ok, 'B: no ve nada de A y genera solo sus recurrentes');

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
      continue when t in ('familia_config', 'familia_importadores_ocultos');
      execute format('update public.%I set familia_id = familia_id where familia_id in ($1, $2)', t) using fa, fb;
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FALLA: el superadmin editó % filas en %', n, t; end if;
      execute format('delete from public.%I where familia_id in ($1, $2)', t) using fa, fb;
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FALLA: el superadmin borró % filas en %', n, t; end if;
    end loop;
    if public.generar_vencimientos_recurrentes((current_date + interval '6 months')::date) <> 0 then
      raise exception 'FALLA: el superadmin generó vencimientos recurrentes';
    end if;
    ok := array_append(ok, 'superadmin: no inserta, edita ni borra datos de las familias (ni genera recurrentes)');

    insert into public.familia_config (familia_id, clave, valor) values (fa, 'arca_razon_social', 'Razón A');
    update public.familia_config set valor = '20000000009' where familia_id = fb and clave = 'arca_cuit';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'FALLA: el superadmin no pudo editar la configuración de B'; end if;
    ok := array_append(ok, 'superadmin: escribe la configuración de cualquier familia');

    begin
      insert into public.familia_config (familia_id, clave, valor) values (fa, 'monotributo_limite_categoria_b', '1.400.000');
      raise exception 'FALLA: se guardó un número mal escrito';
    exception when check_violation then null;
    end;
    begin
      insert into public.familia_config (familia_id, clave, valor) values (fa, '__no_existe', 'x');
      raise exception 'FALLA: se guardó una clave que no está en el catálogo';
    exception when foreign_key_violation then null;
    end;
    begin
      update public.config_catalogo set valor_default = 'x' where clave = '__test_numero';
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'FALLA: el superadmin cambió el catálogo desde la app'; end if;
    end;
    ok := array_append(ok, 'superadmin: la configuración se valida por tipo y contra el catálogo, que no se edita desde la app');

    insert into public.familia_importadores_ocultos (familia_id, importador_codigo) values (fb, 'mp');
    delete from public.familia_importadores_ocultos where familia_id = fa and importador_codigo = 'excel';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'FALLA: el superadmin no pudo mostrar un importador de A'; end if;
    begin
      insert into public.familia_importadores_ocultos (familia_id, importador_codigo) values (fa, '__no_existe');
      raise exception 'FALLA: se ocultó un importador que no existe';
    exception when foreign_key_violation then null;
    end;
    update public.importadores set activo = false where codigo = 'mp';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FALLA: el superadmin cambió la tabla de importadores desde la app'; end if;
    ok := array_append(ok, 'superadmin: oculta y muestra importadores de cualquier familia; la tabla global no se edita desde la app');

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
        'centro_id', cen_a, 'egreso', 100, 'detalle', 'restaurado', 'creado_por', ua2, 'created_at', '2020-01-01')),
      'familia_config', jsonb_build_array(jsonb_build_object('familia_id', fa, 'clave', 'arca_cuit', 'valor', '20111111111'))));
    if resultado <> '{"centros": 1, "movimientos": 1, "familia_config": 1}'::jsonb then
      raise exception 'FALLA: restaurar_familia() devolvió %', resultado;
    end if;
    if (select detalle from public.movimientos where id = mov_a) is distinct from 'restaurado'
       or (select tarjeta from public.movimientos where id = mov_a) is distinct from false
       or (select creado_por from public.movimientos where id = mov_a) is distinct from ua2
       or (select created_at from public.movimientos where id = mov_a) <> '2020-01-01'
       or not exists (select 1 from public.centros where id = nuevo and familia_id = fa)
       or (select valor from public.familia_config where familia_id = fa and clave = 'arca_cuit') <> '20111111111' then
      raise exception 'FALLA: restaurar_familia() no aplicó bien los cambios';
    end if;
    ok := array_append(ok, 'superadmin: restaurar_familia() agrega y actualiza por id');

    -- familia borrada: la vuelve a crear con el mismo id y nombre
    perform public.restaurar_familia(fc, jsonb_build_object(
      'familia', jsonb_build_object('id', fc, 'nombre', '__test C__'),
      'categorias', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'familia_id', fc, 'nombre', 'Cat C')),
      -- un importador oculto que ya no existe se descarta
      'familia_importadores_ocultos', jsonb_build_array(
        jsonb_build_object('familia_id', fc, 'importador_codigo', 'excel'),
        jsonb_build_object('familia_id', fc, 'importador_codigo', '__ya_no_existe')),
      -- su titular no es miembro de C: el centro vuelve sin titular en vez de fallar
      'centros', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'familia_id', fc, 'codigo', 'C1', 'nombre', 'Centro C', 'titular_id', ua)),
      -- quien lo cargó tampoco es miembro de C: el movimiento vuelve sin ese dato
      'movimientos', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'familia_id', fc, 'fecha', current_date, 'egreso', 5, 'creado_por', ua))));
    if not exists (select 1 from public.familias where id = fc and nombre = '__test C__')
       or not exists (select 1 from public.categorias where familia_id = fc) then
      raise exception 'FALLA: restaurar_familia() no recreó la familia borrada';
    end if;
    if (select count(*) from public.familia_importadores_ocultos where familia_id = fc) <> 1 then
      raise exception 'FALLA: restaurar_familia() no descartó el importador oculto que ya no existe';
    end if;
    if not exists (select 1 from public.centros where familia_id = fc and codigo = 'C1' and titular_id is null) then
      raise exception 'FALLA: restaurar_familia() no dejó sin titular un centro cuyo titular no es de la familia';
    end if;
    if not exists (select 1 from public.movimientos where familia_id = fc and egreso = 5 and creado_por is null) then
      raise exception 'FALLA: restaurar_familia() no dejó sin "cargado por" un movimiento de alguien que no es de la familia';
    end if;
    ok := array_append(ok, 'superadmin: restaurar_familia() recrea una familia que ya no existe (centros sin titular si el titular no es miembro)');

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
