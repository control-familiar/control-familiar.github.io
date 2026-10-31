# Multi-familia: decisiones y diseño

Este repo es un fork de [francosantarelli/control-economico](https://github.com/francosantarelli/control-economico)
(la app que usan Franco y Ana) para que la misma app la puedan usar **varias familias**, cada una con
sus propios usuarios, categorías, centros de costo y movimientos, en **una sola base** y con **un único deploy**.

Este documento junta todas las decisiones que se tomaron (con su porqué) y el diseño acordado. Si una
decisión cambia, se actualiza acá.

---

## Contexto del fork

- **El proyecto original sigue andando y evolucionando** (F2). La familia Santarelli sigue usándolo; **no se
  migra a este proyecto por ahora** (F1 — se verá más adelante).
- **Este proyecto arranca vacío**, con una base nueva diseñada multi-familia desde cero (no hay migración
  de datos existentes).
- **Traer cambios del original**: el original está como remote `upstream`. Los arreglos/mejoras que sirvan
  se traen con `git cherry-pick` de commits puntuales. **No usar el botón "Sync fork" de GitHub**: intenta
  mergear todo el original y, con el código ya multi-familia, genera conflictos por todos lados.
- **Datos de prueba**: solo familias dummy, nada de datos reales (F3). Ver [Familias dummy](#familias-dummy).

## Infraestructura

| | |
|---|---|
| Repo | `anitacasadei/control-economico-familiar` (fork, público) |
| Deploy | GitHub Pages vía Actions (`.github/workflows/test.yml`): tests → publica solo si pasan. URL: https://anitacasadei.github.io/control-economico-familiar/ |
| Base | Proyecto Supabase `control-economico-familiar` (`ssfbamnomyjkuixqzxok`), en la cuenta de Ana. Signup público deshabilitado. |
| Backup diario | Workflow `backup-diario` **desactivado** hasta configurar sus secrets (service role key del proyecto nuevo + carpeta de Drive propia). |
| Vercel | Se evaluó; por ahora se queda en Pages. Si se pasa: deploy desde Actions con la CLI de Vercel después de los tests (no la integración automática, que publica aunque fallen), publicando solo los archivos de la app. Plan Hobby = uso no comercial. |

Supabase Auth → Site URL = la URL de Pages (para los links de los mails): configurado.

Pruebas: **directo contra el proyecto Supabase nuevo** mientras solo haya familias dummy (F5). Cuando entre
la primera familia real, pasar a probar en local (`supabase start`, requiere Docker Desktop) o en un staging.

---

## Modelo de usuarios

- **Familia**: dueña de todos los datos (movimientos, categorías, centros, vencimientos, etc.). Los datos son
  de la familia, no de la persona que los cargó.
- **Miembro**: un usuario pertenece a **una sola familia** (D1). La base lo impide (`miembros.user_id` es PK).
  Al loguearse no hay selector: la base sabe sola cuál es su familia. Cambiar a alguien de familia = cambiar
  su fila en `miembros`; lo que cargó queda en la familia anterior.
- **Superadmin** (N2): una **cuenta aparte, específica para soporte**, que **no pertenece a ninguna familia**.
  - **Ve todas las familias en solo lectura** (S1): no puede cargar/editar/borrar movimientos, categorías, etc.
  - **Sí administra la configuración** de cada familia (funciones activables, importadores ocultos, datos de
    facturación) — es el **único** que la modifica (S4).
  - Usa **la misma app** con un **selector de familia** arriba y una pestaña extra "Administración"
    (familias, miembros, configuración, backup) (S2).
  - Es el único que ve el **botón de backup**, que descarga **todas** las familias (N4). Restaurar es **por
    familia** (se elige qué familia del archivo restaurar, para no pisar las demás).
  - Sin MFA ni protección extra: el uso sigue siendo familiar (S5).
  - La cuenta es **`anitacasadei+soporte@gmail.com`** (alias de Gmail de Ana), así `anitacasadei@gmail.com`
    queda libre por si algún día Ana es miembro de una familia en este proyecto (F1).
- **Altas por script** (N3, S3): el usuario se crea a mano en Supabase (Authentication → Users) y se lo asigna
  a una familia / como superadmin con scripts SQL versionados (`alta_familia.sql`, `alta_miembro.sql`,
  `alta_superadmin.sql`). La pestaña Administración por ahora solo **muestra** familias y miembros.

## Funciones: base común y opcionales (D4)

| Base común (siempre está) | Opcional (se activa por familia) |
|---|---|
| Resumen, Movimientos, Vencimientos, Saldos, Importar, ABM (categorías, centros, reglas) | USDT · Dólares · Flujo de Caja/Deudas · Facturación ARCA · Tarjetas y cuotas · Regla de "sueldo de fin de mes" |

- **Backup**: no es una función de familia; es exclusivo del superadmin.
- **Gimnasio** (el "bonus track" del original): **no existe en este proyecto** (G1). Se sacaron la tabla, la pestaña y el
  código; los commits del original que lo toquen hay que adaptarlos al hacer cherry-pick.
- Una función opcional apagada **se oculta y no se cargan sus datos**, pero no se borra nada.
- **Facturación ARCA** (D8): por ahora queda resuelta solo para una familia (el certificado vive en los
  secrets de la Edge Function, uno por proyecto). Si una familia la tiene activada pero le faltan CUIT /
  razón social / certificado, ve un mensaje del tipo *"Antes de facturar tenés que configurar tus datos de
  facturación"* y no se intenta facturar. Certificado por familia (ej. Supabase Vault) queda para cuando
  alguna lo pida.

## Configuración por familia (D3)

Toda configuración personal está asociada a la familia y documentada en la propia base:

- `config_catalogo (clave, tipo, descripcion, valor_default, grupo)` — **global**: define cada configuración
  y su documentación. La leen todos; la modifica solo el superadmin.
- `familia_config (familia_id, clave, valor)` — solo lo que cada familia tiene distinto del default.
- Las funciones activables son claves booleanas del catálogo (`feature.usdt`, `feature.dolares`, …).
- Una configuración nueva aparece en todas las familias con su valor por defecto.
- Reemplaza a la tabla `configuracion` del original (monotributo, CUIT, razón social).
- La familia **no ve** su configuración en el ABM (C1): la ve y la edita solo el superadmin. La app sí la lee
  para funcionar (ej. el CUIT para facturar).

## Personas y titulares (D5)

- `personas (familia_id, nombre, user_id opcional)`.
- `centros.titular_id` → `personas`. Reemplaza la convención del original (el titular salía de la última letra
  del código del centro: `…A` = Ana, `…F` = Franco).
- Nada de nombres de personas escritos en el código.

## Reglas que hoy están escritas en el código (D6)

- La lógica que hoy depende del **nombre** de una categoría (`'Venta USDT'`, `'Sueldo'`, …) pasa a depender de
  `categorias.tipo` (que ya existe: `sueldo`, `inversion`, `tec`, `control`; se suma `venta_usdt`, etc.).
- Las reglas con números fijos (ej. "los últimos 3 días del mes el sueldo cuenta para el mes siguiente") pasan
  a configuración de la familia.
- Antes de cambiarlas se hace un **relevamiento completo** de todas estas reglas y se decide una por una.

## Importadores (D7)

En la base, no en el código:

- `importadores (codigo, nombre, activo, orden)` — **global**. La leen todos; la modifica el superadmin.
- `familia_importadores_ocultos (familia_id, importador_codigo)` — lista **restrictiva** de qué importadores
  no ve cada familia. Se guarda lo que se **oculta** (no lo que se ve), así un importador nuevo les aparece a
  todas automáticamente.
- El parser de cada banco sigue siendo JavaScript en `app.js`; se conecta con la fila por `codigo`
  (`'santander'` → `parseSantander`). Agregar un banco = parser en el código + migración que inserta la fila.
- Casos borde: fila sin parser en el código → no se muestra (y se avisa en consola); parser sin fila → no aparece.

## Backup (D9)

- El backup diario a Drive es **global** (toda la base, con la service role key), y solo existe a nivel
  superadmin. Incluye también `familias` y `miembros`.
- Implica que el administrador tiene acceso a los datos de todas las familias: las familias tienen que saberlo.

---

## Diseño de la base

### Tablas nuevas

```sql
create table familias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz default now()
);

-- Un usuario pertenece a UNA sola familia
create table miembros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  familia_id uuid not null references familias(id) on delete restrict,
  created_at timestamptz default now()
);

-- Cuentas de soporte: no pertenecen a ninguna familia
create table superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
```

Un trigger impide que un usuario esté a la vez en `miembros` y en `superadmins`.

### Funciones

```sql
create function familia_actual() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select familia_id from public.miembros where user_id = auth.uid() $$;

create function es_superadmin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists(select 1 from public.superadmins where user_id = auth.uid()) $$;
```

### `familia_id` en todas las tablas de datos (D2)

En `centros`, `categorias`, `subcategorias`, `movimientos`, `vencimientos`, `deudas`,
`usdt_movimientos`, `facturas`, `arca_ta`, `reglas_categorizacion` (y las nuevas: `personas`, `familia_config`,
`familia_importadores_ocultos`):

```sql
familia_id uuid not null default familia_actual() references familias(id) on delete restrict
```

más un índice por `familia_id`. La base completa sola la familia: **la app no manda `familia_id`** en los
insert ni filtra por familia en los select (para usuarios de familia). El superadmin, que ve todas, sí filtra
por la familia elegida en el selector (en la capa de acceso a datos de `app.js`).

### Claves foráneas compuestas (N5)

Para que una fila de una familia no pueda apuntar a una fila de otra:

- Las tablas referenciadas (`centros`, `categorias`, `subcategorias`, `movimientos`) tienen `unique (familia_id, id)`.
- Todas las FK son compuestas, ej.:
  `foreign key (familia_id, centro_id) references centros(familia_id, id) on delete set null (centro_id)`
  (`set null (columna)` existe desde Postgres 15; sin la lista de columnas intentaría vaciar también `familia_id`).

### Claves únicas por familia

- `arca_ta`: PK `(familia_id, ambiente)` → la Edge Function hace `upsert(..., {onConflict:'familia_id,ambiente'})`.
- `facturas`: el índice único por `(movimiento_id, ambiente)` sigue sirviendo (el movimiento ya es de una familia).

### Políticas de seguridad (RLS)

```sql
-- leer: tu familia, o todas si sos superadmin
create policy leer on <tabla> for select
  using (familia_id = (select familia_actual()) or (select es_superadmin()));
-- escribir: solo tu familia (el superadmin no tiene familia => no escribe datos)
create policy insertar on <tabla> for insert with check (familia_id = (select familia_actual()));
create policy editar  on <tabla> for update using (familia_id = (select familia_actual()))
                                          with check (familia_id = (select familia_actual()));
create policy borrar  on <tabla> for delete using (familia_id = (select familia_actual()));
```

- `familias`, `miembros`: cada uno lee lo suyo; el superadmin todo. Nadie escribe desde la app (altas por script).
- `superadmins`: cada uno lee solo su fila (para que la app sepa si es superadmin).
- Tablas globales (`config_catalogo`, `importadores`): leen todos los logueados; escribe el superadmin.
- `familia_config`, `familia_importadores_ocultos`: lee la familia y el superadmin; escribe **solo** el superadmin (S4).
  Hasta la fase 4 lo mismo vale para la tabla `configuracion` del original, que sigue con `familia_id` (P1).
- `arca_ta`: solo la familia; el superadmin **no** la ve (son credenciales temporales de ARCA) (P3).
- Usuario sin familia y que no es superadmin: no ve nada.

### Peligros conocidos y cómo se cubren

1. **La service role key se saltea RLS** (backup diario, Edge Functions que la usen): ve todas las familias.
   Regla: lo que actúa en nombre de un usuario usa su sesión (como ya hace `facturar-arca`).
2. **Funciones `security definer`**: siempre con `set search_path = ''` y nombres calificados (`public.miembros`).
3. **Referencias cruzadas entre familias**: cubiertas con las FK compuestas.
4. **Rendimiento**: `(select familia_actual())` en las políticas (se evalúa una vez, no por fila) + índices.
5. **Restaurar un backup**: las filas traen su `familia_id`; restaurar otra familia la rechaza RLS → la
   restauración tiene que validar la familia y avisarlo claro, no fallar a medias. Cubierto con
   `restaurar_familia()` (Q3).
6. **Un usuario que no está en `miembros`** entra y ve la app vacía (parece que se perdieron datos): verificarlo
   en cada alta. La app además le muestra un aviso en vez de la app vacía (Q4).

### Tests de seguridad

[`test/sql/seguridad.sql`](../test/sql/seguridad.sql) (P6): SQL plano que se pega en el SQL Editor, como se
aplicaba todo en el original. Crea sus propios usuarios y familias, cambia de usuario con `set local role
authenticated` + `request.jwt.claims` (como la API de Supabase) y deshace todo al final, así que se puede correr
contra el proyecto con las familias dummy cargadas. Devuelve la lista de chequeos en "ok" o corta con
"FALLA: ...". Verifica, con dos familias, un superadmin, un usuario sin familia y anon:
- un miembro de A no ve / crea / edita / borra nada de B;
- no se puede insertar con el `familia_id` de otra familia;
- un movimiento de A no puede apuntar a categoría/centro de B;
- el superadmin ve todo y no puede escribir datos;
- un usuario sin familia no ve nada;
- `admin_miembros()` y `restaurar_familia()` solo las usa el superadmin, y la restauración rechaza filas o ids
  de otra familia y es todo o nada.

## Superadmin en la app (fase 2)

- **Perfil al entrar** (`cargarPerfil` en `app.js`): lee `superadmins` (cada uno ve solo su fila) y `familias`.
  Superadmin → solo lectura + selector; miembro → su familia; ninguna de las dos → aviso "no está asignado a
  ninguna familia" y botón de cerrar sesión (Q4).
- **Selector de familia** arriba a la derecha. `dbFetchAll` le agrega `familia_id = <elegida>` a las tablas de
  datos (`TABLAS_DE_FAMILIA`). Recuerda la última elegida en ese navegador; la primera vez, la primera por
  orden alfabético (Q5).
- **Solo lectura** (Q1): lista central `ACCIONES_LECTURA` en `app.js`. `handleAction` ignora cualquier otra;
  después de cada render `aplicarSoloLectura()` saca sus botones, oculta las tarjetas de alta y deshabilita la
  edición en línea de Movimientos; y `dbInsert`/`dbUpdate`/`dbDelete`/`dbUpsert` cortan si igual llegara
  algo. **Una acción nueva que solo mire datos hay que sumarla a `ACCIONES_LECTURA`**, si no el superadmin no
  la ve. La pestaña Importar no se le muestra.
- **Administración** (solo superadmin): familias (con cantidad de miembros), miembros con su email
  (`admin_miembros()`, Q2), descargar backup y restaurar una familia. El backup salió del ABM de las familias (N4).
- **Backup versión 3**: `familias`, `miembros` y las tablas de datos de **todas** las familias, con `familia_id`.
  El backup diario a Drive usa las mismas tablas (un test lo verifica).
- **Restauración** (Q3): se elige el archivo y la familia; la app manda solo las filas de esa familia a
  `restaurar_familia()` (`security definer`), que verifica que quien llama sea superadmin, que todas las filas
  sean de esa familia y que ningún id sea ya de otra, y aplica todo en una transacción (todo o nada). No borra:
  agrega y actualiza por id. Si la familia ya no existe, la vuelve a crear con el mismo id y nombre. Los
  `miembros` del archivo no se restauran (dependen de los usuarios de Auth: se dan de alta por script). Solo
  acepta backups versión 3 (no los del proyecto original).

## Familias dummy

- **"Familia Demo"**: movimientos, categorías y centros inventados, para ver la app funcionando.
- **"Familia Prueba"**: casi vacía, para probar el aislamiento entre familias.

Se cargan con [`scripts/sql/datos_dummy.sql`](../scripts/sql/datos_dummy.sql) (fechas relativas al mes actual).
Usuarios: `anitacasadei+demo@gmail.com` y `anitacasadei+prueba@gmail.com` (alias de Gmail de Ana), creados a mano
y asignados con `alta_miembro.sql`.

## Puesta en marcha de la base

En el SQL Editor del proyecto, en este orden:

1. [`schema.sql`](../schema.sql) (base vacía).
2. [`scripts/sql/datos_dummy.sql`](../scripts/sql/datos_dummy.sql).
3. Crear los usuarios en Authentication → Users y correr
   [`alta_miembro.sql`](../scripts/sql/alta_miembro.sql) por cada uno
   ([`alta_familia.sql`](../scripts/sql/alta_familia.sql) y
   [`alta_superadmin.sql`](../scripts/sql/alta_superadmin.sql) para familias nuevas y soporte).
4. [`test/sql/seguridad.sql`](../test/sql/seguridad.sql).

Los scripts de alta tienen las variables arriba de todo (bloque `DO`), validan (usuario inexistente, familia
inexistente, ya es miembro de otra, es superadmin) y terminan con una consulta de verificación (P4, P5).

Mientras haya solo familias dummy, los cambios de esquema se hacen en `schema.sql` y la base se recrea. Desde la
fase 9, cada cambio va como migración nueva en `migrations/` **y** en `schema.sql`, como en el original (P7).
`migrations/historico/` son las del original, solo como registro.

Los datos iniciales del original (centros, reglas de categorización, CUIT/razón social de Ana) **no** van en
`schema.sql` de este proyecto.

---

## Fases

| # | Contenido | Estado |
|---|---|---|
| 0 | Fork, Pages, Supabase nuevo, apuntar la app al proyecto nuevo y rutas relativas | ✅ hecho |
| 1 | `schema.sql` multi-familia desde cero (tablas, funciones, `familia_id`, FK compuestas, RLS); `migrations/` del original → `migrations/historico/`; scripts de alta; familias dummy; tests de seguridad | ✅ hecho |
| 2 | Superadmin: selector de familia, solo lectura, pestaña Administración, backup global y restauración por familia | ✅ hecho |
| 3 | Personas y titulares (D5) | pendiente |
| 4 | Catálogo de configuración + valores por familia (D3) | pendiente |
| 5 | Funciones activables (D4) | pendiente |
| 6 | Relevamiento y paso a configuración de las reglas escritas en el código (D6) | pendiente |
| 7 | Importadores en la base + ocultos por familia (D7) | pendiente |
| 8 | Documentación (README, guías) y scripts de alta definitivos | pendiente |
| 9 | Alta de la primera familia real | pendiente |

Las fases 3–7 son bastante independientes entre sí; la 1 va primero para que todo nazca con `familia_id`.

## Pendientes de definir

- **Tests de seguridad en GitHub Actions** además de a mano en el SQL Editor (propuesta: sí, levantando Supabase
  local en el runner, que tiene Docker; agrega ~2–3 min por push).

## Glosario de decisiones

| Id | Tema | Decisión |
|---|---|---|
| D1 | Familias por usuario | Una sola |
| D2 | Cómo se completa `familia_id` | Default `familia_actual()` + RLS; la app no lo manda |
| D3 | Dónde vive la configuración | Catálogo documentado + valores por familia |
| D4 | Base común vs opcional | Ver tabla de funciones; backup solo superadmin |
| D5 | Titular de cada cuenta | Tabla `personas` + `centros.titular_id` |
| D6 | Lógica por nombre de categoría / reglas fijas | Por `categorias.tipo` y configuración; relevamiento previo |
| D7 | Importadores | Tablas en la base + lista restrictiva de ocultos por familia |
| D8 | ARCA | Solo una familia por ahora; mensaje si faltan datos de facturación |
| D9 | Backup | Global, solo superadmin |
| D10/F5 | Dónde se prueba | Contra el proyecto nuevo mientras sea solo dummy |
| D11 | Alta de familias y miembros | Scripts SQL; categorías y centros por los ABM existentes |
| N2 | Superadmin | Cuenta aparte, sin familia, ve todas |
| N3 | Creación de usuarios | A mano en Supabase + script de asignación |
| N4 | Botón de backup | Solo superadmin, descarga todas |
| N5 | FK compuestas | Sí |
| P1 | Tabla `configuracion` en la fase 1 | Se queda con `familia_id`, PK `(familia_id, clave)`; la escribe solo el superadmin; la reemplaza la fase 4 |
| P2 | `gimnasio_visitas.persona` | ~~Queda como en el original~~ — reemplazada por G1 |
| P3 | `arca_ta` | El superadmin no la ve |
| P4 | Parámetros de los scripts de alta | Bloque `DO` con variables arriba, validaciones y verificación final |
| P5 | Cómo se identifican en los scripts | Usuario por email, familia por nombre (`familias.nombre` único) |
| P6 | Tests de seguridad | SQL plano para el SQL Editor (como en el original), no pgTAP |
| P7 | Migraciones | Solo `schema.sql` mientras sea dummy; migraciones desde la fase 9 |
| P8 | Tablas de fases posteriores (`personas`, `familia_config`, …) | Se crean en su fase |
| Q1 | Solo lectura del superadmin | Lista central de acciones de lectura + se ocultan las demás + corte en la capa de datos |
| Q2 | Emails de los miembros | Función `admin_miembros()` (solo superadmin) |
| Q3 | Restauración por familia | Función `restaurar_familia()`: valida familia, todo o nada, recrea la familia si no existe; solo backups v3 |
| Q4 | Usuario sin familia | Aviso en vez de la app vacía |
| Q5 | Selector de familia | Recuerda la última elegida; si no, la primera alfabética |
| G1 | Gimnasio | No existe en este proyecto: se sacó tabla, pestaña y código |
| C1 | ¿La familia ve su configuración? | No: solo el superadmin (la app la lee igual para funcionar) |
| S1 | Superadmin sobre datos | Solo lectura (sí edita configuración) |
| S2 | Interfaz del superadmin | Misma app + selector + pestaña Administración |
| S3 | Pantalla de familias/miembros | Solo muestra; altas por script |
| S4 | Quién edita la configuración | Solo el superadmin |
| S5 | Protección extra superadmin | No |
| F1 | ¿Se migra la familia Santarelli? | No por ahora |
| F2 | ¿El original sigue evolucionando? | Sí; se traen cambios con cherry-pick |
| F3 | Datos de prueba | Solo familias dummy |
| F4 | Cómo se creó el repo | Fork en la cuenta de Ana |
