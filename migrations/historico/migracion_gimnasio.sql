-- ============================================================
-- BONUS TRACK: Gimnasio (Ana vs Franco) — pegar en el SQL Editor
-- de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

create table gimnasio_visitas (
  id uuid primary key default gen_random_uuid(),
  persona text not null check (persona in ('ana','franco')),
  fecha date not null,
  created_at timestamptz default now(),
  unique (persona, fecha) -- no se puede cargar dos veces el mismo día para la misma persona
);

alter table gimnasio_visitas enable row level security;

create policy "logueados_todo_gimnasio_visitas" on gimnasio_visitas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
