# Instalación y operación — Control Económico Familiar

Guía técnica: levantar una base nueva, publicar, tests, cambios de esquema, backup diario y facturación ARCA. El día a día del soporte (altas de familias y usuarios, configuración, restauración) está en [GUIA-DE-SOPORTE.md](GUIA-DE-SOPORTE.md); el uso de la app, en [GUIA-DE-USO.md](GUIA-DE-USO.md); el diseño y las decisiones, en [MULTI-FAMILIA.md](MULTI-FAMILIA.md).

## Arquitectura

- **Frontend:** `index.html` + `app.js` + `style.css`. JS plano sin build; carga Bootstrap, Supabase JS, ExcelJS y qrcode-generator desde CDN.
- **Backend:** Supabase (Postgres + Auth + Edge Functions), proyecto `ssfbamnomyjkuixqzxok`. La URL y la clave *anon* están al comienzo de `app.js`. Multi-familia: cada fila tiene `familia_id` y RLS separa las familias (ver [MULTI-FAMILIA.md](MULTI-FAMILIA.md#diseño-de-la-base)).
- **Hosting:** GitHub Pages, publicado por GitHub Actions.
- **Extras:** backup diario a Drive (GitHub Actions) y facturación ARCA (Edge Function).

## 1. Base de datos nueva

1. Crear un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor → New query**, pegar todo [`schema.sql`](../schema.sql) y ejecutar. Crea tablas, funciones y políticas de seguridad (RLS) multi-familia, sin datos.
3. Dar de alta familias y usuarios con los scripts de [`scripts/sql/`](../scripts/sql) y correr los tests de [`test/sql/seguridad.sql`](../test/sql/seguridad.sql). Orden completo en [MULTI-FAMILIA.md → Puesta en marcha de la base](MULTI-FAMILIA.md#puesta-en-marcha-de-la-base).
4. Poner la URL y la clave *anon* del proyecto en las primeras líneas de `app.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), y la misma `SUPABASE_URL` en `scripts/backup-a-drive/backup.js`.

## 2. Usuarios y seguridad

- **Deshabilitar el signup público** (Authentication → Settings): los usuarios los crea el soporte. Una cuenta sin familia no ve datos, pero no tiene sentido dejar que cualquiera se cree una.
- **Authentication → URL Configuration → Site URL** = la URL de Pages, para que los links de los mails (recuperar contraseña) lleven a la app.
- Crear la cuenta de soporte y darla de alta con [`alta_superadmin.sql`](../scripts/sql/alta_superadmin.sql).
- Familias y usuarios: ver [GUIA-DE-SOPORTE.md → Alta de una familia nueva](GUIA-DE-SOPORTE.md#2-alta-de-una-familia-nueva).

## 3. Publicación (GitHub Pages)

1. En el repo: **Settings → Pages → Source: “GitHub Actions”** (no “Deploy from a branch”).
2. Cada push a `main` ejecuta `.github/workflows/test.yml`: corre los tests y, solo si pasan, publica. Se publican únicamente `index.html`, `app.js`, `style.css`, favicons y `assets/`.
3. Los pull requests corren los tests pero no publican.

## 4. Desarrollo local y tests

```bash
npm ci
npm test            # una corrida (vitest + jsdom)
npm run test:watch
```

Para ver la app localmente alcanza con servir la carpeta con cualquier servidor estático (todas las rutas son relativas).

**Tests de seguridad de la base** ([`test/sql/seguridad.sql`](../test/sql/seguridad.sql)): verifican el aislamiento entre familias, las FK compuestas, el superadmin, la configuración, los importadores y la restauración. Crean sus propios usuarios y familias y deshacen todo al final, así que se pueden correr:
- en el **SQL Editor** de Supabase, contra el proyecto (devuelve la lista de chequeos en "ok" o corta con "FALLA: ...");
- en **GitHub Actions**, en cada push: el job `seguridad-db` levanta un Supabase local, aplica `schema.sql` y los datos dummy, y los corre. Si fallan, no se publica.

## 5. Cambios de esquema

- Mientras la base tenga solo familias dummy, los cambios se hacen en `schema.sql` (y se aplican con un script puntual en el SQL Editor, o recreando la base).
- **Desde la primera familia real** (fase 9), cada cambio va como **migración nueva en `migrations/`** (para aplicar a la base en uso) **y** reflejado en `schema.sql` (para levantar una base nueva de cero).
- Una clave de configuración nueva = `insert` en `config_catalogo`; un banco nuevo para importar = parser en `app.js` (`PARSERS_IMPORTACION`) + `insert` en `importadores`. Les aparecen a todas las familias.
- `migrations/historico/` son las migraciones del proyecto original (una sola familia): no se aplican acá.

## Backup diario a Google Drive

> **Hoy está desactivado**: se activa cuando se carguen sus secrets (service role key de este proyecto y una carpeta de Drive propia).

El workflow `.github/workflows/backup-diario.yml` corre todos los días a las 06:00 (Argentina) y también a mano desde **Actions → Backup diario a Google Drive → Run workflow**. Lee las tablas de **todas las familias** con la clave *service_role* (que se saltea RLS) y sube un `.json` a una carpeta de Drive. Es el mismo formato que el botón del soporte: se restaura de a una familia desde **Administración** (ver [GUIA-DE-SOPORTE.md](GUIA-DE-SOPORTE.md#5-backups-y-restauración)).

### Secrets del repositorio (Settings → Secrets and variables → Actions)

| Secret | De dónde sale |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (**secreta**, nunca va en el código) |
| `GDRIVE_FOLDER_ID` | ID de la carpeta de Drive destino (último tramo de su URL) |
| `GDRIVE_OAUTH_CLIENT_ID` / `GDRIVE_OAUTH_CLIENT_SECRET` | ID de cliente OAuth tipo “App de escritorio”, creado en Google Cloud con la API de Drive habilitada |
| `GDRIVE_OAUTH_REFRESH_TOKEN` | Se obtiene una vez con `scripts/backup-a-drive/obtener-refresh-token.js` |

Se usa OAuth (con el usuario dueño de la carpeta) y no una cuenta de servicio, porque estas últimas no tienen cuota en un Drive común.

### Obtener el refresh token (una sola vez, en tu compu)

1. En Google Cloud Console → *Pantalla de consentimiento de OAuth*: tipo “Externo”, agregá tu mail como usuario de prueba y después **publicá la app** (“En producción”). Si queda en “Prueba”, Google vence el token a los 7 días y el backup deja de andar.
2. En *Credenciales* creá un *ID de cliente de OAuth* tipo “App de escritorio” y copiá ID y secreto.
3. Ejecutá:
   ```bash
   cd scripts/backup-a-drive
   npm install
   node obtener-refresh-token.js <ID_DE_CLIENTE> <SECRETO>
   ```
4. Se abre el navegador: elegí tu cuenta y aceptá (dirá “Google no verificó esta app”: es la tuya, tocá *Avanzado → Ir a…*). El refresh token se imprime en la terminal; guardalo como secret.

## Facturación ARCA

La Edge Function `supabase/functions/facturar-arca` emite **Factura C a Consumidor Final** para ventas de USDT, valida el tope de Monotributo (12 meses móviles) y guarda el resultado en la tabla `facturas`. Corre con el JWT del usuario logueado (mismas políticas RLS), así que todo queda en su familia.

**Por ahora resuelta para una sola familia** (D8): el certificado y el CUIT viven en los secrets de la función, uno por proyecto. La familia tiene que tener prendidas USDT y Facturación ARCA y cargados el CUIT y la razón social (Administración → Configuración).

- Las tablas necesarias (`facturas`, `familia_config`) ya están en `schema.sql`. El CUIT, la razón social y el tope de Monotributo de cada familia los carga el soporte en **Administración → Configuración** (ver [MULTI-FAMILIA.md](MULTI-FAMILIA.md#configuración-por-familia-d3)).
- Homologación (pruebas) y producción son independientes; se alterna con el secret `ARCA_AMBIENTE`.
- Los secrets se cargan con `npx supabase secrets set NOMBRE=valor`, nunca en el código ni en el chat:

| Secret | Detalle |
|---|---|
| `ARCA_CUIT` | CUIT sin guiones |
| `ARCA_AMBIENTE` | `homologacion` o `produccion` (empezar en homologación) |
| `ARCA_CERT_B64_HOMOLOGACION` / `ARCA_CERT_B64_PRODUCCION` | Certificado emitido por ARCA, en base64 |
| `ARCA_KEY_B64_HOMOLOGACION` / `ARCA_KEY_B64_PRODUCCION` | Clave privada **sin passphrase**, en base64 |
| `ARCA_PUNTO_VENTA_HOMOLOGACION` / `ARCA_PUNTO_VENTA_PRODUCCION` | Punto de venta de tipo Web Services |
| `ARCA_CONCEPTO` | Opcional; `2` (Servicios) por defecto, `1` Productos. Consultarlo con el contador |
| `ARCA_WSAA_URL_*` / `ARCA_WSFE_URL_*` | Opcionales; ya traen el valor correcto por ambiente |

Despliegue: `npx supabase functions deploy facturar-arca`.

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| La app queda en “Cargando datos…” o muestra un error rojo | A la base le falta algo que la app ya usa: aplicar el script o la migración del cambio. Por eso, primero se aplica en la base y después se publica. |
| No se puede iniciar sesión | Usuario inexistente en Supabase Auth. |
| Un usuario entra y ve que no tiene familia | Falta `alta_miembro.sql` (ver [GUIA-DE-SOPORTE.md](GUIA-DE-SOPORTE.md#6-problemas-comunes)). |
| Falla el job `seguridad-db` | Si el error dice "FALLA: ...", se rompió una regla de seguridad: no publicar hasta corregirla. Si es del entorno (Supabase local no levantó), reintentar el job. |
| El deploy no ocurre | Fallan los tests, o Pages no está en “GitHub Actions”. |
| El backup diario falla | Secret faltante o vencido (ver el log en la pestaña Actions); si pasaron 7 días de uso, revisar que la app OAuth esté publicada. |
| La factura ARCA es rechazada | Revisar certificado y punto de venta del ambiente activo, y el mensaje que devuelve ARCA. |
