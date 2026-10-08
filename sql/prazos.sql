-- =====================================================================
-- Prazos: calendário de feriados e suspensões da equipe
-- =====================================================================
-- Como usar: cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo quando o arquivo mudar: nada é apagado.
--
-- Guarda, numa linha só (chave "calendario"), o que a aba "Feriados e
-- suspensões" da seção Prazos marca: recesso, suspensões do tribunal e
-- feriados da comarca. Vale também para o prazo do laudo em Perícias.
-- Acesso: igual às audiências (aberto para quem usa o site).
-- =====================================================================

create table if not exists prazos_config (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table prazos_config enable row level security;

drop policy if exists "public read prazos_config" on prazos_config;
drop policy if exists "public write prazos_config" on prazos_config;
drop policy if exists "public update prazos_config" on prazos_config;
drop policy if exists "public delete prazos_config" on prazos_config;
create policy "public read prazos_config" on prazos_config for select using (true);
create policy "public write prazos_config" on prazos_config for insert with check (true);
create policy "public update prazos_config" on prazos_config for update using (true);
create policy "public delete prazos_config" on prazos_config for delete using (true);

-- Atualização em tempo real (ignora se já estiver ativada)
do $$
begin
  alter publication supabase_realtime add table prazos_config;
exception when duplicate_object or undefined_object then null;
end $$;
