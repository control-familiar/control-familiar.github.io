-- ============================================================
-- Caché del Token+Sign de WSAA (dura ~12hs; pedir uno nuevo antes
-- de que expire el anterior hace que ARCA lo rechace) — pegar en
-- el SQL Editor de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

create table arca_ta (
  ambiente text primary key check (ambiente in ('homologacion','produccion')),
  token text not null,
  sign text not null,
  expira_en timestamptz not null
);

alter table arca_ta enable row level security;

create policy "logueados_todo_arca_ta" on arca_ta
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
