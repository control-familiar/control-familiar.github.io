# control-familiar

Fork multi-familia de francosantarelli/control-economico (remote `upstream`), llevado por Ana. Repo
`control-familiar/control-familiar.github.io` (organización de GitHub); la app se publica en https://control-familiar.github.io/.

- **Antes de cualquier cambio de diseño, leer [docs/MULTI-FAMILIA.md](docs/MULTI-FAMILIA.md)**: todas las
  decisiones tomadas (D1–D11, N2–N5, S1–S5, F1–F5), el diseño de la base y en qué fase está el trabajo.
  Las decisiones las toma Ana: si algo no está definido ahí, proponer opciones con una recomendación y preguntar.
- Si se cambia una decisión o se completa una fase, actualizar ese documento.
- Los commits van a nombre de Ana (git config local del repo). No usar "Sync fork" de GitHub; los cambios del
  original se traen con `git cherry-pick`.
- La app apunta al proyecto Supabase `ssfbamnomyjkuixqzxok` (no al del original). **Ya hay una familia real**
  (además de las dummy): la base no se recrea ni se usa para probar. Cambios de esquema = migración en
  `migrations/` + `schema.sql`, probados con `npm run test:db`, corridos por Ana en el SQL Editor antes del push
  (M3 en docs/MULTI-FAMILIA.md).
