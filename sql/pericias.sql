-- =====================================================================
-- Perícias: acompanhamento das perícias e do prazo do laudo
-- =====================================================================
-- Como usar: cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo quando o arquivo mudar: nada é apagado.
--
-- Acesso: igual às audiências (aberto para quem usa o site).
-- =====================================================================

create table if not exists pericias (
  id uuid primary key default gen_random_uuid(),
  processo text not null default '',
  perito text not null default '',
  especialidade text not null default '',
  status text not null default 'nao_agendada',   -- nao_agendada, agendada, realizada, laudo_juntado, cancelada
  data_pericia timestamptz,                       -- data e hora marcadas pelo perito
  local text not null default '',
  realizada_em date,                              -- início da contagem dos 30 dias úteis do laudo
  laudo_em date,                                  -- quando o laudo foi juntado
  observacoes text not null default '',
  conferida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pericias_andamentos (
  id uuid primary key default gen_random_uuid(),
  pericia_id uuid not null references pericias(id) on delete cascade,
  texto text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists pericias_data_idx on pericias (data_pericia);
create index if not exists pericias_andamentos_pericia_idx on pericias_andamentos (pericia_id, created_at);

alter table pericias enable row level security;
alter table pericias_andamentos enable row level security;

drop policy if exists "public read pericias" on pericias;
drop policy if exists "public write pericias" on pericias;
drop policy if exists "public update pericias" on pericias;
drop policy if exists "public delete pericias" on pericias;
create policy "public read pericias" on pericias for select using (true);
create policy "public write pericias" on pericias for insert with check (true);
create policy "public update pericias" on pericias for update using (true);
create policy "public delete pericias" on pericias for delete using (true);

drop policy if exists "public read pericias_andamentos" on pericias_andamentos;
drop policy if exists "public write pericias_andamentos" on pericias_andamentos;
drop policy if exists "public update pericias_andamentos" on pericias_andamentos;
drop policy if exists "public delete pericias_andamentos" on pericias_andamentos;
create policy "public read pericias_andamentos" on pericias_andamentos for select using (true);
create policy "public write pericias_andamentos" on pericias_andamentos for insert with check (true);
create policy "public update pericias_andamentos" on pericias_andamentos for update using (true);
create policy "public delete pericias_andamentos" on pericias_andamentos for delete using (true);

-- Atualização em tempo real (ignora se já estiver ativada)
do $$
begin
  alter publication supabase_realtime add table pericias;
exception when duplicate_object or undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table pericias_andamentos;
exception when duplicate_object or undefined_object then null;
end $$;
