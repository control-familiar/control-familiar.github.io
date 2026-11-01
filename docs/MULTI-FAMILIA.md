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
- **Datos**: desde el 2026-10-31 está la **primera familia real** (fase 9). Las familias dummy siguen en la misma
  base para probar (M2). Ver [Familias dummy](#familias-dummy).

## Infraestructura

| | |
|---|---|
| Repo | `control-familiar/control-familiar.github.io` (fork, público), en la organización de GitHub `control-familiar` de Ana. Antes era `anitacasadei/control-economico-familiar`: GitHub redirige la dirección vieja del repo, no la de la app. |
| Deploy | GitHub Pages vía Actions (`.github/workflows/test.yml`): tests → publica solo si pasan. URL: **https://control-familiar.github.io/** (antes `anitacasadei.github.io/control-economico-familiar/`, que ya no anda). Supabase Auth → Site URL y Redirect URLs apuntan a la URL nueva. |
| Base | Proyecto Supabase `control-economico-familiar` (`ssfbamnomyjkuixqzxok`), en la cuenta de Ana. Signup público deshabilitado. |
| Backup diario | Workflow `backup-diario` **desactivado** hasta configurar sus secrets (service role key del proyecto nuevo + carpeta de Drive propia). Con la familia real, Ana decidió activarlo más adelante; mientras tanto, backup manual desde Administración → Descargar backup. |
| Vercel | Se evaluó; por ahora se queda en Pages. Si se pasa: deploy desde Actions con la CLI de Vercel después de los tests (no la integración automática, que publica aunque fallen), publicando solo los archivos de la app. Plan Hobby = uso no comercial. |

Supabase Auth → Site URL = la URL de Pages (para los links de los mails): configurado.

Pruebas (M1): la base real **no se recrea ni se usa para probar**. Los cambios de esquema se prueban con
`npm run test:db` ([`scripts/probar-db.mjs`](../scripts/probar-db.mjs)): en PGlite (Postgres en WebAssembly, sin
Docker) arma la base desde `schema.sql` y la base como está en `origin/main` + las migraciones nuevas, corre los
tests de seguridad en las dos y verifica que tengan la misma estructura. Lo mismo corre en Actions en cada push
(contra el main anterior), además del job `seguridad-db` con un Supabase local. Se descartaron un proyecto de
staging (otro proyecto para mantener) y Supabase local con Docker en la PC. Antes (F5), mientras solo había
familias dummy, se probaba directo en el proyecto.

### Cómo se hace un cambio de esquema (M3)

1. Escribir la migración en `migrations/AAAA-MM-DD_descripcion.sql`, entre `begin;` y `commit;` (todo o nada),
   que no borre datos, y reflejar el mismo cambio en `schema.sql`.
2. `npm run test:db` hasta que dé todo ok (y `npm test` para la app).
3. Correr la migración en el SQL Editor del proyecto y anotar en su encabezado "Aplicada en el proyecto
   Supabase el AAAA-MM-DD".
4. Recién entonces commit y push: el push publica la app, que ya puede necesitar lo nuevo de la base.

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
  `alta_superadmin.sql`; bajas con `baja_miembro.sql`). La pestaña Administración **muestra** familias y miembros (y
  edita configuración e importadores de cada familia). Paso a paso en [GUIA-DE-SOPORTE.md](GUIA-DE-SOPORTE.md).

## Funciones: base común y opcionales (D4)

| Base común (siempre está) | Opcional (se activa por familia) |
|---|---|
| Resumen, Movimientos, Vencimientos, Saldos, Importar, ABM (categorías, centros, reglas) | USDT · Dólares · Flujo de Caja/Deudas · Facturación ARCA · Tarjetas y cuotas · Regla de "sueldo de fin de mes" (configurable en días) |

- **Backup**: no es una función de familia; es exclusivo del superadmin.
- **Gimnasio** (el "bonus track" del original): **no existe en este proyecto** (G1). Se sacaron la tabla, la pestaña y el
  código; los commits del original que lo toquen hay que adaptarlos al hacer cherry-pick.
- Una función opcional apagada **se oculta y no se cargan sus datos**, pero no se borra nada.
- Cada una es una clave booleana del catálogo, grupo "Funciones": `feature.usdt`, `feature.dolares`,
  `feature.flujo_caja`, `feature.facturacion_arca`, `feature.tarjetas`. **Por defecto apagadas** (O1): una
  familia nueva arranca con la base común y el soporte prende lo que necesite en Administración → Configuración.
  En `app.js`, `funcionActiva('usdt')`.
- Qué se oculta con cada una apagada:
  - **USDT**: pestaña, valuación del USDT en Resumen y Saldos, botón "generar movimiento USDT"; no se carga
    `usdt_movimientos` ni se pide la cotización.
  - **Dólares**: pestaña, saldos en USD (Saldos, Resumen, Flujo), campo Moneda del ABM de centros (se conserva
    el valor); los movimientos en USD no se muestran; no se pide el dólar blue.
  - **Flujo de Caja**: pestaña; no se carga `deudas`.
  - **Facturación ARCA**: botón Facturar, comprobantes, tarjeta "Facturado a ARCA"; no se carga `facturas`.
    **Depende de USDT** (O3): sin USDT queda apagada aunque su clave esté prendida.
  - **Tarjetas**: tilde/marca/cuotas del formulario, agrupado por resumen en Movimientos y Vencimientos, filtro
    "Solo tarjeta", campo de la edición masiva, opción "Tarjeta de Crédito" en Importar. Los movimientos de
    tarjeta se ven como comunes y, al editarlos, conservan sus datos de tarjeta.
- **Regla del sueldo de fin de mes** (O2): clave numérica `sueldo_dias_mes_siguiente` (grupo "Reglas"): los
  ingresos de Sueldo de los últimos N días del mes cuentan para el mes siguiente. 0 (default) = regla apagada.
  En el original era fija en 3.
- El superadmin ve cada familia con sus funciones, tal como la ve ella (O5).
- **Facturación ARCA** (D8): por ahora queda resuelta solo para una familia (el certificado vive en los
  secrets de la Edge Function, uno por proyecto). Si una familia la tiene prendida pero le falta el CUIT o la
  razón social, al tocar Facturar ve *"Antes de facturar, el soporte tiene que cargar tus datos de facturación
  (CUIT y razón social)"* y no se intenta facturar; el superadmin ve el mismo aviso en la configuración de la
  familia (O4). Certificado por familia (ej. Supabase Vault) queda para cuando alguna lo pida.

## Configuración por familia (D3)

Toda configuración personal está asociada a la familia y documentada en la propia base:

- `config_catalogo (clave, tipo, descripcion, valor_default, grupo, orden)` — **global**: define cada configuración
  y su documentación. La leen todos los logueados. **Se modifica solo en `schema.sql`** (y con una migración cuando
  haya familias reales), junto con el código que usa la clave; no desde la app (K1).
- `familia_config (familia_id, clave, valor)` — solo lo que cada familia tiene distinto del default. La lee la
  familia (la app la usa) y el superadmin; la escribe solo el superadmin, desde Administración (S4).
- Todo se guarda como texto; `tipo` (`texto`, `numero`, `booleano`) dice cómo leerlo. La pantalla muestra el
  control que corresponde y un trigger en la base rechaza números o booleanos mal escritos (K2).
- Valor efectivo = el de la familia o, si no tiene, el default: `config_valor(clave)` en la base (la usa
  `facturar-arca`) y `configuracionValor(clave)` en `app.js`.
- Catálogo inicial (grupo "Facturación", sin default, K3): `arca_cuit`, `arca_razon_social`,
  `monotributo_limite_categoria_b` (vacío = no se controla el tope). Mismos nombres que en el original.
- El superadmin edita los valores en **Administración → Configuración de _familia elegida_**: vacío o "Usar
  default" borra el valor propio.
- Las funciones activables son claves booleanas del catálogo (`feature.usdt`, `feature.dolares`, …).
- Una configuración nueva aparece en todas las familias con su valor por defecto.
- Reemplaza a la tabla `configuracion` del original (monotributo, CUIT, razón social). Los backups v3 anteriores a
  la fase 4 traen `configuracion`: al restaurarlos esa parte se ignora (K4).
- La familia **no ve** su configuración en el ABM (C1): la ve y la edita solo el superadmin. La app sí la lee
  para funcionar (ej. el CUIT para facturar).

## Titulares de los centros (D5)

- **El titular de cada centro es un usuario de la familia** (no hay tabla `personas`): `centros.titular_id` →
  `miembros`, con FK compuesta `(familia_id, titular_id)`. Reemplaza la convención del original (el titular salía
  de la última letra del código del centro: `…A` = Ana, `…F` = Franco).
- Cada usuario se muestra con `miembros.nombre`, que se carga en `alta_miembro.sql` (T1; vacío = lo que va antes de la
  @). Para cambiarlo, se corre el script de nuevo.
- Cada miembro **ve a los miembros de su familia** (su nombre, no su email), para elegir titular.
- La familia elige el titular en el ABM de centros ("Sin titular" es válido). Saldos (pesos y USD) agrupa por titular
  (por nombre) y al final "Sin titular", con los centros sin titular y lo que no tiene centro.
- Si un usuario deja de ser miembro, sus centros quedan sin titular. Al **cambiarlo de familia**, `alta_miembro.sql` le
  saca primero la titularidad de los centros de la familia anterior (la FK no deja que apunte a otra) y lo avisa.
- Al restaurar un backup, un centro cuyo titular no es miembro de esa familia vuelve sin titular.
- **Centro de efectivo por defecto** (R5): el último que se usó para cargar efectivo en ese dispositivo
  (`localStorage`); antes salía del email.
- Nada de nombres de personas ni emails escritos en el código.

## Reglas que hoy están escritas en el código (D6)

- La lógica que hoy depende del **nombre** de una categoría (`'Venta USDT'`, `'Sueldo'`, …) pasa a depender de
  `categorias.tipo` (que ya existe: `sueldo`, `inversion`, `tec`, `control`; se suma `venta_usdt`, etc.).
- Las reglas con números fijos (ej. "los últimos 3 días del mes el sueldo cuenta para el mes siguiente") pasan
  a configuración de la familia.
- Antes de cambiarlas se hace un **relevamiento completo** de todas estas reglas y se decide una por una.

Relevamiento (fase 6) y lo que se decidió:

| | Regla del original | Decisión |
|---|---|---|
| R1 | "Venta USDT" se reconocía por el nombre de la categoría (o de una subcategoría) | Tipo de categoría `venta_usdt` ("Venta de USDT"), que se ofrece en el ABM solo con USDT prendido. **Una sola por familia** (la base lo impide). Sin compatibilidad con la subcategoría |
| R2 | Todo ingreso de USDT contaba como Sueldo ("el sueldo de Ani") | Cuenta como sueldo solo si su categoría es de tipo Sueldo |
| R3 | "Categoría B" de Monotributo en los textos | Textos genéricos ("el tope de tu categoría de Monotributo"); la clave conserva su nombre |
| R4 | Centro por defecto al importar, por códigos `MPF`/`BSF`/`BNF`/`BPF` | Queda siempre vacío: lo elige quien importa |
| R5 | Centro de efectivo por defecto según el email | El último usado en ese dispositivo (fase 3) |
| R6 | Titular del centro según la última letra del código | Usuario titular (fase 3, D5) |
| R7 | Colores de vencimientos según días que faltan | Queda (diseño) |
| R8 | Ventana de 12 meses del Monotributo | Queda (normativa) |
| R9 | Logo del banco adivinado por el nombre del centro | Queda (genérico) |
| R10 | CUIT de ARCA en los secrets de la Edge Function | Queda (D8) |
| R11 | Los ingresos de proveedor "Gerardo" en Sueldo no contaban como sueldo | Se sacó: esos ingresos van a una categoría que no sea de tipo Sueldo; "Solo control" los deja fuera de los reportes (en una Normal, un ingreso descuenta gasto) |
| — | Los últimos 3 días del mes el sueldo cuenta para el mes siguiente | Configuración `sueldo_dias_mes_siguiente` (fase 5, O2) |

## Importadores (D7)

En la base, no en el código:

- `importadores (codigo, nombre, activo, orden)` — **global**. La leen todos los logueados. Se modifica solo en
  `schema.sql` (y con una migración cuando haya familias reales), junto con el parser: no desde la app (I2, como K1).
- `familia_importadores_ocultos (familia_id, importador_codigo)` — lista **restrictiva** de qué importadores
  no ve cada familia. Se guarda lo que se **oculta** (no lo que se ve), así un importador nuevo les aparece a
  todas automáticamente.
- El parser de cada banco sigue siendo JavaScript en `app.js`; se conecta con la fila por `codigo`
  (`'santander'` → `parseSantander`). Agregar un banco = parser en el código + migración que inserta la fila.
- Casos borde: fila sin parser en el código → no se muestra (y se avisa en consola); parser sin fila → no aparece.
- **Una fila por cada forma de importar** (I1): `mp`, `santander`, `nacion`, `provincia`, `macro`, los resúmenes de tarjeta
  `tarjeta_nacion`, `tarjeta_santander`, `tarjeta_provincia`, `tarjeta_mercadopago` y `excel` (Excel histórico, I4).
  En Importar los de tarjeta (prefijo `tarjeta_`) se eligen como "Tarjeta de Crédito" + banco; esa opción aparece si
  hay alguno visible y la función Tarjetas está prendida. En `app.js`: `PARSERS_IMPORTACION` e `importadoresVisibles()`.
- El superadmin oculta o muestra importadores en **Administración → Importadores de _familia elegida_**, con un tilde
  por importador (tildado = visible) (I3). La lista de ocultos entra en el backup y la restauración (los que ya no
  existen se descartan al restaurar).
- Si una familia no tiene ningún importador visible, Importar le dice que se lo pida al soporte.
- Dummy (I5): Familia Demo ve todos; Familia Prueba tiene ocultos `excel` y `provincia`.

## Vencimientos recurrentes (V1–V6)

Algo que se paga todos los meses (ej. Patín) se carga una vez como **plantilla** y cada mes aparece solo como un
vencimiento más, que se marca pagado, salteado o se deja pendiente. No es parte del original.

- **Plantilla** (V1): tabla `vencimientos_recurrentes` — concepto, monto, día del mes, centro, categoría y
  subcategoría, mes `desde` y mes `hasta` opcional (los meses se guardan como día 1). Si el mes no tiene ese día
  (31 en febrero), vence el último día del mes. Se carga y edita en la pestaña Vencimientos, sección "Vencimientos
  recurrentes". Para que termine se pone `hasta` o se borra (lo ya generado queda como vencimiento suelto).
- **Generación al abrir la app** (V1): `cargarTodo()` llama a la función `generar_vencimientos_recurrentes(p_hoy)`
  con la fecha local (el mes cambia a la medianoche de Argentina, no en UTC), y también después de guardar una
  plantilla. Es `security invoker`, así que corre con RLS y solo genera lo de la familia del usuario; el
  superadmin (solo lectura) no la llama, y si la llamara no generaría nada. Se descartó una tarea programada
  (pg_cron): necesitaría correr sin usuario, saltear RLS y pasar `familia_id` a mano. Si nadie abre la app en
  el mes no se genera nada, pero tampoco hay nadie para verlo; se genera al abrirla.
- **Meses atrasados** (V3): se generan todos los que falten desde `desde` (o desde el último generado), aunque
  ya hayan pasado: quedan pendientes para marcarlos pagados o salteados.
- **Sin duplicados**: `vencimientos.recurrente_id` + `periodo` (el mes que cubre) con `unique (recurrente_id,
  periodo)`, y `select ... for update` sobre las plantillas, para dos miembros abriendo la app a la vez.
  `vencimientos_recurrentes.generado_hasta` guarda el último mes generado: un vencimiento generado que se borra
  **no vuelve** (para "este mes no se paga" está *saltear*, que deja registro).
- **Cambios en la plantilla**: valen para los meses que todavía no se generaron. Los ya generados se editan uno por
  uno, como cualquier vencimiento.
- **Categoría** (V4): la plantilla y también `vencimientos` (sueltos incluidos) tienen `categoria_id` y
  `subcategoria_id`; al *pagar y cargar como movimiento*, el movimiento sale categorizado (antes salía sin categoría).
- **Estado `salteado`** (V5): además de `pendiente` y `pagado` (con `check`). Sale de la lista y del aviso de
  próximos, no genera movimiento y se ve en el historial "Vencimientos pagados y salteados", desde donde se puede
  volver a pendiente.
  Saltear afecta solo a ese vencimiento (ese mes): la plantilla sigue generando los meses siguientes.
- **Aviso de movimiento ya cargado** (V6): si un vencimiento pendiente con categoría tiene, en su mismo mes, un egreso
  de esa categoría (y de esa subcategoría, si el vencimiento tiene), la lista muestra "Ya tenés un movimiento de
  esta categoría el dd/mm/aaaa por $X (contraparte). ¿Marcar pagado?", que lo marca pagado sin crear otro
  movimiento; el modal de pagar avisa que cargarlo lo duplicaría. Es solo un aviso calculado en la app: no
  vincula el movimiento con el vencimiento ni cambia la base. Vale para vencimientos sueltos y recurrentes.
- **Base común** (V2), no una función opcional: es parte de la pestaña Vencimientos y no molesta si no se usa.
- Backup y restauración: `vencimientos_recurrentes` entra en las dos, antes de `vencimientos` (que la referencia).
- Dummy: Familia Demo tiene "Patín" (desde el mes pasado, sin categoría) y "Expensas" (desde este mes, en Casa).

## Auditoría de movimientos (A1)

- Cada movimiento guarda **quién lo cargó y cuándo**: `movimientos.creado_por` (miembro de la familia, FK compuesta a
  `miembros`, `on delete set null`) y `created_at`. Solo movimientos, solo el alta: no se registran cambios ni borrados.
- Lo completa la base con el trigger `movimientos_auditar` (`auditar_movimiento()`): en el insert pone `auth.uid()` y
  `now()` aunque la app mande otra cosa; en el update conserva los valores de antes. La app no los manda.
- El superadmin no carga movimientos; al restaurar un backup se conserva lo que trae, y si quien lo cargó ya no es
  miembro de la familia, el movimiento vuelve sin ese dato (como el titular de un centro).
- Los movimientos anteriores quedan sin `creado_por`. En la app, al editar un movimiento (en pesos o en dólares) se ve
  "Cargado por _nombre_ el dd/mm/aaaa a las hh:mm" (sin "por" si no se sabe quién). Lo cargado en la sesión lo
  muestra recién al volver a entrar.
- Migración: `migrations/2026-11-01_auditoria_movimientos.sql`.

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
  nombre text not null,                 -- cómo se lo muestra (titular de centros, D5)
  created_at timestamptz default now(),
  unique (familia_id, user_id)          -- para la FK compuesta de centros.titular_id
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

En `centros`, `categorias`, `subcategorias`, `movimientos`, `vencimientos_recurrentes`, `vencimientos`, `deudas`,
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

- `familias`: cada uno lee la suya; `miembros`: cada uno lee los de su familia (para elegir titular, D5). El
  superadmin lee todo. Nadie escribe desde la app (altas por script).
- `superadmins`: cada uno lee solo su fila (para que la app sepa si es superadmin).
- Tablas globales (`config_catalogo`, `importadores`): leen todos los logueados. `config_catalogo` no se escribe
  desde la app (K1).
- `familia_config`, `familia_importadores_ocultos`: lee la familia y el superadmin; escribe **solo** el superadmin (S4).
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

Siguen en la base real junto a la familia real (M2): sirven para probar la app publicada con un usuario de
prueba sin tocar datos reales. RLS las aísla; el superadmin las ve en el selector.

Se cargan con [`scripts/sql/datos_dummy.sql`](../scripts/sql/datos_dummy.sql) (fechas relativas al mes actual).
Usuarios: `anitacasadei+demo@gmail.com` y `anitacasadei+prueba@gmail.com` (alias de Gmail de Ana), creados a mano
y asignados con `alta_miembro.sql`.

## Puesta en marcha de la base

Para una familia real, el paso a paso está en [GUIA-DE-SOPORTE.md](GUIA-DE-SOPORTE.md#2-alta-de-una-familia-nueva).
Con la familia real cargada, **la base del proyecto no se recrea**: esto es para levantar una base nueva (otro
proyecto, o si hubiera que rehacerla) desde cero:

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

Desde la fase 9 (ya), cada cambio de esquema va como migración nueva en `migrations/` **y** en `schema.sql`,
como en el original (P7), siguiendo [los pasos de M3](#cómo-se-hace-un-cambio-de-esquema-m3). Mientras hubo solo
familias dummy se cambiaba solo `schema.sql` y la base se recreaba. `migrations/historico/` son las del
original, solo como registro.

Los datos iniciales del original (centros, reglas de categorización, CUIT/razón social de Ana) **no** van en
`schema.sql` de este proyecto.

---

## Fases

| # | Contenido | Estado |
|---|---|---|
| 0 | Fork, Pages, Supabase nuevo, apuntar la app al proyecto nuevo y rutas relativas | ✅ hecho |
| 1 | `schema.sql` multi-familia desde cero (tablas, funciones, `familia_id`, FK compuestas, RLS); `migrations/` del original → `migrations/historico/`; scripts de alta; familias dummy; tests de seguridad | ✅ hecho |
| 2 | Superadmin: selector de familia, solo lectura, pestaña Administración, backup global y restauración por familia | ✅ hecho |
| 3 | Titulares de los centros (D5) | ✅ hecho |
| 4 | Catálogo de configuración + valores por familia (D3) | ✅ hecho |
| 5 | Funciones activables (D4) | ✅ hecho |
| 6 | Relevamiento y paso a configuración de las reglas escritas en el código (D6) | ✅ hecho |
| 7 | Importadores en la base + ocultos por familia (D7) | ✅ hecho |
| 8 | Documentación (README, guías) y scripts de alta definitivos | ✅ hecho |
| 9 | Alta de la primera familia real; cambios de base por migración (P7, M1–M3) | ✅ hecho (2026-10-31) |

Las fases 3–7 son bastante independientes entre sí; la 1 va primero para que todo nazca con `familia_id`.

Fuera de las fases: **vencimientos recurrentes** (V1–V6) ✅ hecho.

## Pendientes de definir


## Glosario de decisiones

| Id | Tema | Decisión |
|---|---|---|
| D1 | Familias por usuario | Una sola |
| D2 | Cómo se completa `familia_id` | Default `familia_actual()` + RLS; la app no lo manda |
| D3 | Dónde vive la configuración | Catálogo documentado + valores por familia |
| D4 | Base común vs opcional | Ver tabla de funciones; backup solo superadmin |
| D5 | Titular de cada cuenta | ~~Tabla `personas`~~ → un usuario de la familia: `centros.titular_id` → `miembros` |
| D6 | Lógica por nombre de categoría / reglas fijas | Por `categorias.tipo` y configuración; relevamiento previo |
| D7 | Importadores | Tablas en la base + lista restrictiva de ocultos por familia |
| D8 | ARCA | Solo una familia por ahora; mensaje si faltan datos de facturación |
| D9 | Backup | Global, solo superadmin |
| D10/F5 | Dónde se prueba | ~~Contra el proyecto nuevo mientras sea solo dummy~~ → M1 desde la familia real |
| D11 | Alta de familias y miembros | Scripts SQL; categorías y centros por los ABM existentes |
| N2 | Superadmin | Cuenta aparte, sin familia, ve todas |
| N3 | Creación de usuarios | A mano en Supabase + script de asignación |
| N4 | Botón de backup | Solo superadmin, descarga todas |
| N5 | FK compuestas | Sí |
| P1 | Tabla `configuracion` en la fase 1 | ~~Se queda con `familia_id`~~ — reemplazada en la fase 4 por `config_catalogo` + `familia_config` |
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
| K1 | Quién agrega claves al catálogo | Solo `schema.sql` / migraciones; desde la app solo se editan valores |
| K2 | Tipos de configuración | Texto con `tipo`; control según tipo en la pantalla + trigger que valida en la base |
| K3 | Catálogo inicial | Las 3 claves del original, mismos nombres, sin default |
| K4 | Backups con la tabla vieja `configuracion` | Esa parte se ignora al restaurar |
| O1 | Default de las funciones opcionales | Apagadas; Familia Demo con todas prendidas, Familia Prueba con ninguna |
| O2 | Regla del sueldo de fin de mes | Una clave numérica `sueldo_dias_mes_siguiente`; 0 = apagada |
| O3 | Facturación sin USDT | Queda apagada (factura ventas de USDT) |
| O4 | Aviso de D8 | A la familia al tocar Facturar; al superadmin en la configuración |
| O5 | Qué ve el superadmin | Cada familia con sus funciones, como la ve ella |
| T1 | Nombre de cada usuario | `miembros.nombre`, cargado con `alta_miembro.sql` (vacío = lo que va antes de la @) |
| R1–R11 | Reglas escritas en el código | Ver la tabla del relevamiento en D6 |
| I1 | Filas de importadores | Una por forma de importar (cada banco de tarjeta aparte) |
| I2 | Quién cambia `importadores` | Solo `schema.sql` / migraciones, junto con el parser |
| I3 | Dónde oculta el superadmin | Administración, un tilde por importador |
| I4 | Excel histórico | Un importador más, que se puede ocultar |
| I5 | Dummy | Prueba con `excel` y `provincia` ocultos |
| E1 | Documentación | README + Guía de uso (familias) + Guía de soporte (superadmin, nueva) + Instalación y operación (técnica) + este documento (decisiones) |
| E2 | Scripts definitivos | Se suman `baja_miembro.sql` y `estado.sql`. Borrar una familia entera: sin script por ahora (irreversible; con backup antes, cuando haga falta) |
| E3 | Tests de seguridad en GitHub Actions | Sí: job `seguridad-db` con Supabase local; bloquea la publicación si falla |
| V1 | Vencimientos recurrentes | Plantilla (`vencimientos_recurrentes`) + generación al abrir la app con `generar_vencimientos_recurrentes()`; no pg_cron |
| V2 | ¿Base común u opcional? | Base común |
| V3 | Meses que quedaron atrás | Se generan todos los que falten, pendientes |
| V4 | Categoría en vencimientos | Sí, en la plantilla y en cada vencimiento; el movimiento al pagar sale categorizado |
| V5 | "Este mes no se paga" | Estado `salteado`, solo para ese mes (se puede volver a pendiente) |
| V6 | Movimiento ya cargado | Aviso en la lista y en el modal de pagar (mismo mes + categoría/subcategoría, egreso); sin vincular |
| A1 | Auditoría | Solo movimientos: quién y cuándo se cargó (lo pone un trigger); sin historial de cambios ni borrados |
| S1 | Superadmin sobre datos | Solo lectura (sí edita configuración) |
| S2 | Interfaz del superadmin | Misma app + selector + pestaña Administración |
| S3 | Pantalla de familias/miembros | Solo muestra; altas por script |
| S4 | Quién edita la configuración | Solo el superadmin |
| S5 | Protección extra superadmin | No |
| F1 | ¿Se migra la familia Santarelli? | No por ahora |
| F2 | ¿El original sigue evolucionando? | Sí; se traen cambios con cherry-pick |
| F3 | Datos de prueba | ~~Solo familias dummy~~ → desde la fase 9 hay una familia real; las dummy quedan (M2) |
| M1 | Dónde se prueban los cambios de base con la familia real | `npm run test:db` (PGlite) en la PC + lo mismo y `seguridad-db` en Actions; no staging ni Docker |
| M2 | Familias dummy con la familia real | Se quedan en la base, para probar |
| M3 | Cómo se hace un cambio de esquema | `migrations/AAAA-MM-DD_descripcion.sql` + `schema.sql` → `test:db` → correrla en el proyecto → push |
| F4 | Cómo se creó el repo | Fork en la cuenta de Ana |
