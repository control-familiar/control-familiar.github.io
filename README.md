# Control Económico Familiar

App web de control económico (ingresos y egresos, movimientos, vencimientos, saldos, resumen y, opcionalmente, USDT, dólares, flujo de caja, tarjetas y facturación ARCA) para **varias familias en una sola base y un único deploy**. Cada familia ve solo sus datos; una cuenta de soporte las administra.

Es un fork de [francosantarelli/control-economico](https://github.com/francosantarelli/control-economico) (una sola familia). Los cambios del original se traen con `git cherry-pick`, no con "Sync fork".

## Documentación
- [Guía de uso](docs/GUIA-DE-USO.md) — cómo usar cada pestaña (para las familias).
- [Guía de soporte](docs/GUIA-DE-SOPORTE.md) — alta de familias y usuarios, configuración, importadores, backups (para la cuenta superadmin).
- [Instalación y operación](docs/INSTALACION-Y-OPERACION.md) — levantar la base, deploy, tests, backup diario, facturación ARCA (para quien instala y mantiene).
- [Multi-familia: decisiones y diseño](docs/MULTI-FAMILIA.md) — todas las decisiones tomadas, el diseño de la base y el estado de cada fase.

## Archivos
- `index.html`, `style.css`, `app.js` — la app. JS plano sin build ni dependencias, cargado directo por el navegador.
- `assets/` — logos de entidades y otros archivos estáticos que se publican.
- `schema.sql` — esquema completo para Supabase: tablas, funciones, seguridad (RLS) y los catálogos globales (configuración, importadores). Sin datos de familias.
- `scripts/sql/` — scripts para el SQL Editor: altas y bajas (familia, miembro, superadmin), `estado.sql` (ver cómo está todo) y `datos_dummy.sql` (familias de prueba).
- `test/` — tests de la app (vitest + jsdom, contra el `index.html`/`app.js` reales); `test/sql/seguridad.sql`, tests de seguridad de la base.
- `migrations/historico/` — migraciones del proyecto original, solo como registro.
- `scripts/backup-a-drive/` — backup diario a Google Drive (ver `.github/workflows/backup-diario.yml`).
- `supabase/functions/` — Edge Functions (Deno) para la facturación electrónica ARCA.

## Deploy
GitHub Pages vía Actions (`.github/workflows/test.yml`): cada push a `main` corre los tests de la app y los de seguridad de la base (en un Supabase local), y solo si pasan todos publica. Se publican únicamente `index.html`, `app.js`, `style.css`, los favicons y `assets/`. Requiere **Settings → Pages → Source: "GitHub Actions"**.

## Seguridad
- Cada fila de datos tiene su `familia_id`, que completa la base sola; las políticas RLS dejan a cada usuario leer y escribir **solo lo de su familia**. Las claves foráneas compuestas impiden que una fila apunte a datos de otra familia.
- La cuenta de soporte (superadmin) ve todas las familias en **solo lectura** y edita solo su configuración e importadores.
- Un usuario que no es miembro de ninguna familia no ve nada. Igual, el registro público está deshabilitado en Supabase (**Authentication → Settings**): los usuarios los crea el soporte.
- `test/sql/seguridad.sql` verifica todo esto y corre en cada push.
