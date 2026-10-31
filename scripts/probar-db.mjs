// ============================================================
// PRUEBA DE LA BASE ANTES DE TOCAR LA DE VERDAD (npm run test:db)
//
// Con una familia real, los cambios de esquema van como migración
// en migrations/ Y en schema.sql (P7), y se prueban acá antes de
// correrlos en Supabase (M1). Corre en PGlite (Postgres en
// WebAssembly, sin Docker), con un reemplazo mínimo de lo que trae
// Supabase (esquema auth, roles anon/authenticated).
//
// 1. Base nueva: schema.sql + datos_dummy.sql + tests de seguridad.
// 2. Base publicada + migraciones: schema.sql y datos_dummy.sql de
//    <ref> (por defecto origin/main, lo que ya está aplicado), más
//    las migraciones de migrations/ que <ref> no tiene, en orden
//    por nombre; y los tests de seguridad.
// 3. Compara la estructura de las dos bases (tablas, columnas,
//    restricciones, índices, políticas, funciones, triggers y los
//    datos de las tablas globales): si difieren, schema.sql y las
//    migraciones no dicen lo mismo.
//
// Uso: npm run test:db              (contra origin/main)
//      npm run test:db -- HEAD~1    (contra otro commit)
// ============================================================
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2] || 'origin/main';

// Siempre con LF: en Windows la copia de trabajo puede tener CRLF y git no, y el cuerpo de las funciones
// quedaría distinto.
const lf = s => s.replace(/\r\n/g, '\n');
const leer = f => lf(readFileSync(path.join(ROOT, f), 'utf8'));
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 1e8 });
const leerEnRef = f => lf(git('show', ref + ':' + f));

// Lo que Supabase ya trae y schema.sql da por sentado.
const SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, aud text, role text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

// Estructura comparable: sin nombres generados ni orden de columnas (una migración agrega columnas al final).
const ESTRUCTURA = {
  columnas: `select table_name || '.' || column_name || ' ' || data_type || ' null=' || is_nullable || ' default=' || coalesce(column_default, '')
             from information_schema.columns where table_schema = 'public'`,
  restricciones: `select conrelid::regclass::text || ' ' || contype::text || ' ' || pg_get_constraintdef(oid)
                  from pg_constraint where connamespace = 'public'::regnamespace`,
  indices: `select regexp_replace(indexdef, 'INDEX \\S+ ON', 'INDEX ON') from pg_indexes where schemaname = 'public'`,
  rls: `select relname || ' rls=' || relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
  politicas: `select tablename || ' ' || policyname || ' ' || cmd || ' ' || roles::text || ' using=' || coalesce(qual, '') || ' check=' || coalesce(with_check, '')
              from pg_policies where schemaname = 'public'`,
  funciones: `select pg_get_functiondef(p.oid) || ' acl=' || coalesce(p.proacl::text, '')
              from pg_proc p where p.pronamespace = 'public'::regnamespace`,
  triggers: `select pg_get_triggerdef(oid) from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'auth.%'`,
  config_catalogo: `select row_to_json(c)::text from config_catalogo c`,
  importadores: `select row_to_json(i)::text from importadores i`
};

async function baseNueva(pasos) {
  const db = new PGlite();
  await db.exec(SUPABASE);
  for (const [nombre, sql] of pasos) {
    try { await db.exec(sql); }
    catch (e) { throw new Error(nombre + ': ' + e.message); }
  }
  return db;
}

async function seguridad(db) {
  const res = await db.exec(leer('test/sql/seguridad.sql'));
  const filas = res.at(-1).rows;
  if (!filas.length || filas.some(f => f.resultado !== 'ok')) throw new Error('tests de seguridad: ' + JSON.stringify(filas));
  return filas.length;
}

async function estructura(db) {
  const r = {};
  for (const [nombre, sql] of Object.entries(ESTRUCTURA)) {
    r[nombre] = (await db.query(sql, [], { rowMode: 'array' })).rows.map(f => f[0]).sort();
  }
  return r;
}

function migracionesPendientes() {
  const enRef = new Set(git('ls-tree', '--name-only', ref, 'migrations/').split('\n').filter(Boolean).map(f => path.basename(f)));
  return readdirSync(path.join(ROOT, 'migrations')).filter(f => f.endsWith('.sql') && !enRef.has(f)).sort();
}

let fallo = false;
try {
  const nueva = await baseNueva([['schema.sql', leer('schema.sql')], ['datos_dummy.sql', leer('scripts/sql/datos_dummy.sql')]]);
  console.log('1. Base nueva (schema.sql): ok, seguridad ' + await seguridad(nueva) + ' chequeos ok');

  const pendientes = migracionesPendientes();
  const migrada = await baseNueva([
    ['schema.sql de ' + ref, leerEnRef('schema.sql')],
    ['datos_dummy.sql de ' + ref, leerEnRef('scripts/sql/datos_dummy.sql')],
    ...pendientes.map(f => ['migrations/' + f, leer('migrations/' + f)])
  ]);
  console.log('2. Base de ' + ref + ' + ' + (pendientes.length ? pendientes.join(', ') : 'ninguna migración pendiente') +
    ': ok, seguridad ' + await seguridad(migrada) + ' chequeos ok');

  const [a, b] = [await estructura(nueva), await estructura(migrada)];
  const diferencias = [];
  for (const nombre of Object.keys(ESTRUCTURA)) {
    const sa = new Set(a[nombre]), sb = new Set(b[nombre]);
    a[nombre].filter(x => !sb.has(x)).forEach(x => diferencias.push('  [' + nombre + '] solo en schema.sql:   ' + x));
    b[nombre].filter(x => !sa.has(x)).forEach(x => diferencias.push('  [' + nombre + '] solo con migraciones: ' + x));
  }
  if (diferencias.length) {
    fallo = true;
    console.log('3. FALLA: schema.sql y ' + ref + ' + migraciones no tienen la misma estructura:\n' + diferencias.join('\n'));
  } else {
    console.log('3. schema.sql y ' + ref + ' + migraciones tienen la misma estructura');
  }
} catch (e) {
  fallo = true;
  console.log('FALLA: ' + e.message);
}
process.exit(fallo ? 1 : 0);
