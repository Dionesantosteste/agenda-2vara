-- =====================================================================
-- Arquivo: processos físicos arquivados, caixas, prateleiras e fileiras
-- =====================================================================
-- Como usar: cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo quando o arquivo mudar: nada é apagado.
--
-- Só CRIA tabelas novas (todas começam com "arquivo_"). Não mexe em nenhuma tabela que o portal
-- já usa. Acesso: só quem entrou com e-mail e senha (como as outras depois do sql/acesso.sql).
--
-- Depois de rodar, importe a planilha com os arquivos arquivo_importacao_*.sql (veja o LEIA-ME).
-- =====================================================================

-- Caixas. "locais" é a lista de [prateleira, fileira] onde a caixa está anotada: normalmente um só;
-- vazio = planilha não diz; dois = anotada em dois lugares (pendência para conferir).
-- "secretaria" = caixa de uma secretaria (estante "Outra Secretaria"); o nome é o da secretaria.
create table if not exists arquivo_caixas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  locais jsonb not null default '[]'::jsonb,
  secretaria boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists arquivo_caixas_nome_idx on arquivo_caixas (upper(nome), secretaria);

-- Processos. situacao: 0 arquivado, 1 em outra secretaria, 2 para desarquivar, 3 desarquivado (fora),
-- 4 remetido a outra vara. "origem_id" guarda a caixa de onde saiu quando está numa secretaria.
create table if not exists arquivo_processos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  caixa_id uuid not null references arquivo_caixas(id),
  origem_id uuid references arquivo_caixas(id),
  situacao smallint not null default 0 check (situacao between 0 and 4),
  com_quem text not null default '',
  destino text not null default '',
  numero text not null default '',
  classe text not null default '',
  partes text not null default '',
  ano text not null default '',
  obs text not null default '',
  volumes_ok boolean not null default false,     -- conferido: está em mais de uma caixa de propósito
  excluido boolean not null default false,       -- cadastro apagado (fica guardado para desfazer)
  cadastrado_por text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists arquivo_processos_codigo_idx on arquivo_processos (codigo);
create index if not exists arquivo_processos_caixa_idx on arquivo_processos (caixa_id);

-- Histórico (livro de registro): uma linha por alteração, com quem fez
create table if not exists arquivo_movimentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references arquivo_processos(id) on delete set null,
  caixa_id uuid references arquivo_caixas(id) on delete set null,
  texto text not null default '',
  quem text not null default coalesce(auth.jwt() ->> 'email', ''),
  created_at timestamptz not null default now()
);
create index if not exists arquivo_movimentos_data_idx on arquivo_movimentos (created_at desc);
create index if not exists arquivo_movimentos_processo_idx on arquivo_movimentos (processo_id, created_at desc);

-- Anotações da planilha que não deu para entender (tela Conferir)
create table if not exists arquivo_notas (
  celula text primary key,
  texto text not null default '',
  contexto text not null default '',
  resolvida boolean not null default false
);

-- Acesso: só quem está logado
alter table arquivo_caixas enable row level security;
alter table arquivo_processos enable row level security;
alter table arquivo_movimentos enable row level security;
alter table arquivo_notas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['arquivo_caixas', 'arquivo_processos', 'arquivo_movimentos', 'arquivo_notas'] loop
    execute format('drop policy if exists "logado le %1$s" on %1$I', t);
    execute format('drop policy if exists "logado grava %1$s" on %1$I', t);
    execute format('drop policy if exists "logado altera %1$s" on %1$I', t);
    execute format('create policy "logado le %1$s" on %1$I for select to authenticated using (true)', t);
    execute format('create policy "logado grava %1$s" on %1$I for insert to authenticated with check (true)', t);
    execute format('create policy "logado altera %1$s" on %1$I for update to authenticated using (true)', t);
    -- sem "delete": nada do arquivo é apagado pelo site (excluir só marca "excluido")
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- Atualização em tempo real (ignora se já estiver ativada)
do $$
begin
  alter publication supabase_realtime add table arquivo_caixas;
exception when duplicate_object or undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table arquivo_processos;
exception when duplicate_object or undefined_object then null;
end $$;

-- CONFERIR (opcional): as quatro tabelas existem e estão fechadas para quem não está logado
--   select tablename, policyname, roles from pg_policies where tablename like 'arquivo_%';
