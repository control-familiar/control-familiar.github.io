# Instalación y operación — Control Económico

Guía para quien administra la app: levantar una base nueva, publicar, dar usuarios, backups, facturación y tests. Para el uso diario ver [GUIA-DE-USO.md](GUIA-DE-USO.md).

## Arquitectura

- **Frontend:** `index.html` + `app.js` + `style.css`. JS plano sin build; carga Bootstrap, Supabase JS, ExcelJS y qrcode-generator desde CDN.
- **Backend:** Supabase (Postgres + Auth + Edge Functions). La URL y la clave *anon* están al comienzo de `app.js`.
- **Hosting:** GitHub Pages, publicado por GitHub Actions.
- **Extras:** backup diario a Drive (GitHub Actions) y facturación ARCA (Edge Function).

## 1. Base de datos nueva

1. Crear un proyecto en [Supabase](https://supabase.com).
2. En **SQL Editor → New query**, pegar todo [`schema.sql`](../schema.sql) y ejecutar. Crea tablas, funciones y políticas de seguridad (RLS) multi-familia, sin datos.
3. Dar de alta familias y usuarios con los scripts de [`scripts/sql/`](../scripts/sql) y correr los tests de [`test/sql/seguridad.sql`](../test/sql/seguridad.sql). Orden completo en [MULTI-FAMILIA.md → Puesta en marcha de la base](MULTI-FAMILIA.md#puesta-en-marcha-de-la-base).
4. Poner la URL y la clave *anon* del proyecto en las primeras líneas de `app.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), y la misma `SUPABASE_URL` en `scripts/backup-a-drive/backup.js`.

## 2. Usuarios y seguridad

- En Supabase: **Authentication → Users → Add user** (email y contraseña) para cada persona.
- Asignar cada usuario a su familia con [`scripts/sql/alta_miembro.sql`](../scripts/sql/alta_miembro.sql): un usuario que no es miembro de ninguna familia entra y no ve nada.
- **Deshabilitar el signup público** (Authentication → Settings). Una cuenta sin familia no ve datos, pero no tiene sentido dejar que cualquiera se cree una.
- El CC de efectivo por defecto se resuelve por email (`codigoCentroPorUsuario` en `app.js`); para usuarios nuevos hay que agregarlos ahí (pasa a la base en la fase 3, ver [MULTI-FAMILIA.md](MULTI-FAMILIA.md)).

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

## Backup diario a Google Drive

El workflow `.github/workflows/backup-diario.yml` corre todos los días a las 06:00 (Argentina) y también a mano desde **Actions → Backup diario a Google Drive → Run workflow**. Lee todas las tablas con la clave *service_role* y sube un `.json` a una carpeta de Drive. Ese archivo se restaura desde la app (ABM › Backup).

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

La Edge Function `supabase/functions/facturar-arca` emite **Factura C a Consumidor Final** para ventas de USDT, valida el tope de Monotributo (12 meses móviles) y guarda el resultado en la tabla `facturas`. Corre con el JWT del usuario logueado (mismas políticas RLS).

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
| La app queda en “Cargando datos…” o muestra un error rojo | Falta alguna tabla o columna: aplicar las migraciones pendientes. |
| No se puede iniciar sesión | Usuario inexistente en Supabase Auth. |
| El deploy no ocurre | Fallan los tests, o Pages no está en “GitHub Actions”. |
| El backup diario falla | Secret faltante o vencido (ver el log en la pestaña Actions); si pasaron 7 días de uso, revisar que la app OAuth esté publicada. |
| La factura ARCA es rechazada | Revisar certificado y punto de venta del ambiente activo, y el mensaje que devuelve ARCA. |
