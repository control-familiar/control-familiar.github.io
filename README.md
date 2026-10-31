# Control Economico

App de control de ingresos/egresos, movimientos, vencimientos y resumen, conectada a Supabase.

## Documentación
- [Guía de uso](docs/GUIA-DE-USO.md) - cómo usar cada pestaña de la app (para quien la usa a diario).
- [Instalación y operación](docs/INSTALACION-Y-OPERACION.md) - levantar la base, usuarios, deploy, backup diario a Drive, facturación ARCA y tests (para quien la administra).

## Archivos
- `index.html` - estructura de la página (login + contenedor de la app). Se publica directo con GitHub Pages.
- `style.css` - estilos de toda la app.
- `app.js` - lógica de la app (estado, parsers de importación, render, acciones). Sin build ni dependencias: JS plano cargado directo por el navegador.
- `assets/` - logos de entidades (Saldos) y otros assets estáticos que sí se publican.
- `schema.sql` - esquema completo multi-familia para Supabase (tablas, funciones, seguridad RLS), sin datos. Para levantar una base nueva de cero, correr este archivo una vez en el SQL Editor de Supabase. Ver [docs/MULTI-FAMILIA.md](docs/MULTI-FAMILIA.md).
- `scripts/sql/` - scripts de alta (familia, miembro, superadmin) y datos de las familias dummy.
- `migrations/historico/` - migraciones del proyecto original (una sola familia), solo como registro.
- `test/` - tests (vitest + jsdom, corren contra el `index.html`/`app.js` reales).
- `scripts/backup-a-drive/` - script del backup diario a Google Drive (ver `.github/workflows/backup-diario.yml`).
- `supabase/functions/` - Edge Functions (Deno) para la facturación electrónica vía ARCA.

## Deploy
Este repo está conectado a GitHub Pages vía Actions (`.github/workflows/test.yml`): cada push a `main` corre los tests primero, y solo si pasan se publica automáticamente. Publica únicamente `index.html`, `app.js`, `style.css`, los favicons y `assets/` — no el repo entero (antes, con "Deploy from a branch", se servía la raíz completa tal cual, `schema.sql` y `migrations/` incluidos).

Para que esto funcione hace falta que en el repo, en **Settings → Pages → Source**, esté elegido **"GitHub Actions"** (no "Deploy from a branch").

## Seguridad
Las políticas de RLS de Supabase dan acceso total a cualquier cuenta `authenticated` del proyecto, no a una lista puntual de emails — así que la app depende de que el signup público esté deshabilitado en **Authentication → Settings** de Supabase. Sin eso, cualquiera que se cree una cuenta tendría acceso a todos los datos.
