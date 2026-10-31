-- ============================================================
-- Deudas (para la pestaña "Flujo de Caja") — pegar en el SQL
-- Editor de Supabase (Project → SQL Editor → New query → Run)
-- ============================================================

create table deudas (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  saldo_pendiente numeric(14,2) default 0,   -- lo que falta pagar hoy
  cuota_mensual numeric(14,2) default 0,
  centro_id uuid references centros(id) on delete set null,  -- de dónde sale la cuota (opcional)
  estado text default 'activa', -- 'activa' | 'cancelada'
  created_at timestamptz default now()
);

alter table deudas enable row level security;

create policy "logueados_todo_deudas" on deudas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
