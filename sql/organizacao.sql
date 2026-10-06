-- =====================================================================
-- Organização do gestor (mural + tarefas) protegida por senha numérica
-- =====================================================================
-- Como usar:
--   1. Troque 000000 na linha marcada com  <<< SENHA  pela senha de 6 dígitos.
--   2. Cole tudo no SQL Editor do Supabase e clique em Run.
--
-- Atualizar (quando o arquivo ganhar novidades): rode o arquivo inteiro de novo.
--   Nada é apagado e a senha que já existe é mantida (a linha <<< SENHA só vale
--   na primeira instalação; para trocar a senha use o comando no fim do arquivo).
--
-- Como funciona:
--   - As tabelas org_* ficam TRANCADAS (RLS ligado e sem políticas): a chave
--     pública do site não consegue ler nem gravar nelas diretamente.
--   - O site só acessa os dados pelas funções org_*, que conferem a senha
--     antes de qualquer leitura ou gravação.
--   - A senha fica guardada criptografada (bcrypt), nunca em texto puro.
--   - Após 5 tentativas erradas, o acesso fica bloqueado por 5 minutos.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas ----------
create table if not exists org_config (
  id int primary key default 1 check (id = 1),
  pin_hash text not null,
  tentativas int not null default 0,
  bloqueado_ate timestamptz
);

create table if not exists org_notas (
  id uuid primary key default gen_random_uuid(),
  texto text not null default '',
  cor text not null default 'amarelo',          -- amarelo, verde, rosa, azul
  fixada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists org_tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  prazo date,
  urgente boolean not null default false,
  responsavel text not null default '',
  processo text not null default '',
  feita_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- etapa da tarefa no quadro: afazer, fazendo, feito
alter table org_tarefas add column if not exists etapa text not null default 'afazer';
update org_tarefas set etapa = 'feito' where feita_em is not null and etapa <> 'feito';

create table if not exists org_lembretes (
  id uuid primary key default gen_random_uuid(),
  texto text not null default '',
  data date not null default current_date,
  hora time,
  processo text not null default '',
  feito_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists org_rotinas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  frequencia text not null default 'mensal',     -- semanal, mensal, trimestral
  feita_em timestamptz,                           -- última vez que foi feita
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- etiquetas e colunas do quadro (cadastráveis pelo site)
create table if not exists org_etiquetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  cor text not null default 'azul',             -- vermelho, laranja, amarelo, verde, azul, roxo, rosa, cinza
  created_at timestamptz not null default now()
);

create table if not exists org_colunas (
  chave text primary key,                       -- afazer, fazendo e feito são fixas (podem ser renomeadas)
  nome text not null default '',
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
insert into org_colunas (chave, nome, ordem)
values ('afazer', 'A fazer', 0), ('fazendo', 'Fazendo', 10), ('feito', 'Feito', 100000)
on conflict (chave) do nothing;

alter table org_tarefas add column if not exists etiquetas uuid[] not null default '{}';

-- posição do cartão dentro da coluna (vazio = ordem automática por prazo)
alter table org_tarefas add column if not exists posicao int;

-- checklist do cartão: [{"t": "texto do item", "ok": true/false}, ...]
alter table org_tarefas add column if not exists checklist jsonb not null default '[]';

-- anotações com data dentro do cartão
create table if not exists org_anotacoes (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references org_tarefas(id) on delete cascade,
  texto text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists org_anotacoes_tarefa_idx on org_anotacoes (tarefa_id, created_at);

alter table org_config    enable row level security;
alter table org_notas     enable row level security;
alter table org_tarefas   enable row level security;
alter table org_lembretes enable row level security;
alter table org_rotinas   enable row level security;
alter table org_etiquetas enable row level security;
alter table org_colunas   enable row level security;
alter table org_anotacoes enable row level security;
revoke all on org_config, org_notas, org_tarefas, org_lembretes, org_rotinas, org_etiquetas, org_colunas, org_anotacoes from anon, authenticated;

-- ---------- senha ----------
insert into org_config (id, pin_hash)
values (1, extensions.crypt('000000', extensions.gen_salt('bf')))   -- <<< SENHA
on conflict (id) do nothing;

-- ---------- conferência da senha (uso interno) ----------
create or replace function org_verifica(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg org_config%rowtype;
begin
  select * into cfg from org_config where id = 1 for update;
  if not found then
    return 'sem_config';
  end if;
  if cfg.bloqueado_ate is not null and cfg.bloqueado_ate > now() then
    return 'bloqueado';
  end if;
  if p_pin is not null and crypt(p_pin, cfg.pin_hash) = cfg.pin_hash then
    update org_config set tentativas = 0, bloqueado_ate = null where id = 1;
    return 'ok';
  end if;
  if cfg.tentativas + 1 >= 5 then
    update org_config set tentativas = 0, bloqueado_ate = now() + interval '5 minutes' where id = 1;
    return 'bloqueado';
  end if;
  update org_config set tentativas = cfg.tentativas + 1 where id = 1;
  return 'senha';
end;
$$;
revoke all on function org_verifica(text) from public, anon, authenticated;

-- ---------- funções usadas pelo site ----------
-- Todas devolvem {"status": "ok" | "senha" | "bloqueado" | "sem_config", ...}

create or replace function org_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'notas', coalesce((select jsonb_agg(to_jsonb(n) order by n.fixada desc, n.created_at desc) from org_notas n), '[]'::jsonb),
    'tarefas', coalesce((select jsonb_agg(to_jsonb(t) order by t.prazo nulls last, t.created_at) from org_tarefas t), '[]'::jsonb),
    'lembretes', coalesce((select jsonb_agg(to_jsonb(l) order by l.data, l.hora nulls first) from org_lembretes l), '[]'::jsonb),
    'rotinas', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from org_rotinas r), '[]'::jsonb),
    'etiquetas', coalesce((select jsonb_agg(to_jsonb(e) order by e.nome) from org_etiquetas e), '[]'::jsonb),
    'colunas', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem, c.created_at) from org_colunas c), '[]'::jsonb),
    'anotacoes', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from org_anotacoes a), '[]'::jsonb),
    'ordem', true,
    'checklist', true
  );
end;
$$;

create or replace function org_salvar_nota(p_pin text, p_id uuid, p_texto text, p_cor text, p_fixada boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_notas (texto, cor, fixada)
    values (coalesce(p_texto, ''), coalesce(p_cor, 'amarelo'), coalesce(p_fixada, false))
    returning id into novo;
  else
    update org_notas
       set texto = coalesce(p_texto, texto), cor = coalesce(p_cor, cor),
           fixada = coalesce(p_fixada, fixada), updated_at = now()
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_nota(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_notas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- versão antiga (sem etapa) é substituída pela de baixo
drop function if exists org_salvar_tarefa(text, uuid, text, date, boolean, text, text, timestamptz);

create or replace function org_salvar_tarefa(
  p_pin text, p_id uuid, p_titulo text, p_prazo date, p_urgente boolean,
  p_responsavel text, p_processo text, p_feita_em timestamptz, p_etapa text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_tarefas (titulo, prazo, urgente, responsavel, processo, feita_em, etapa)
    values (coalesce(p_titulo, ''), p_prazo, coalesce(p_urgente, false),
            coalesce(p_responsavel, ''), coalesce(p_processo, ''), p_feita_em, coalesce(p_etapa, 'afazer'))
    returning id into novo;
  else
    update org_tarefas
       set titulo = coalesce(p_titulo, titulo), prazo = p_prazo, urgente = coalesce(p_urgente, urgente),
           responsavel = coalesce(p_responsavel, responsavel), processo = coalesce(p_processo, processo),
           feita_em = p_feita_em, etapa = coalesce(p_etapa, etapa), updated_at = now(),
           posicao = case when p_etapa is not null and p_etapa <> etapa then null else posicao end
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_tarefa(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_tarefas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_salvar_lembrete(
  p_pin text, p_id uuid, p_texto text, p_data date, p_hora time, p_processo text, p_feito_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_lembretes (texto, data, hora, processo, feito_em)
    values (coalesce(p_texto, ''), coalesce(p_data, current_date), p_hora, coalesce(p_processo, ''), p_feito_em)
    returning id into novo;
  else
    update org_lembretes
       set texto = coalesce(p_texto, texto), data = coalesce(p_data, data), hora = p_hora,
           processo = coalesce(p_processo, processo), feito_em = p_feito_em, updated_at = now()
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_lembrete(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_lembretes where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_salvar_rotina(
  p_pin text, p_id uuid, p_titulo text, p_frequencia text, p_feita_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_rotinas (titulo, frequencia, feita_em)
    values (coalesce(p_titulo, ''), coalesce(p_frequencia, 'mensal'), p_feita_em)
    returning id into novo;
  else
    update org_rotinas
       set titulo = coalesce(p_titulo, titulo), frequencia = coalesce(p_frequencia, frequencia),
           feita_em = p_feita_em, updated_at = now()
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_rotina(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_rotinas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------- etiquetas do quadro ----------
create or replace function org_salvar_etiqueta(p_pin text, p_id uuid, p_nome text, p_cor text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  nome_ok text := left(btrim(coalesce(p_nome, '')), 40);
  cor_ok text := case when p_cor in ('vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'cinza') then p_cor else 'azul' end;
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um nome à etiqueta.');
  end if;
  if p_id is null then
    insert into org_etiquetas (nome, cor) values (nome_ok, cor_ok) returning id into novo;
  else
    update org_etiquetas set nome = nome_ok, cor = cor_ok where id = p_id returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_etiqueta(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  update org_tarefas set etiquetas = array_remove(etiquetas, p_id) where p_id = any(etiquetas);
  delete from org_etiquetas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_etiquetar_tarefa(p_pin text, p_id uuid, p_etiquetas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  update org_tarefas
     set etiquetas = coalesce((select array_agg(e.id) from org_etiquetas e where e.id = any(p_etiquetas)), '{}'),
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Recebe os cartões de uma coluna na ordem em que devem aparecer
create or replace function org_ordenar_tarefas(p_pin text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  update org_tarefas t
     set posicao = x.i * 10
    from unnest(p_ids) with ordinality as x(id, i)
   where t.id = x.id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Grava o checklist inteiro do cartão (até 100 itens, 200 letras cada)
create or replace function org_checklist_tarefa(p_pin text, p_id uuid, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  update org_tarefas
     set checklist = coalesce((
           select jsonb_agg(jsonb_build_object('t', left(btrim(e.x->>'t'), 200), 'ok', coalesce(e.x->>'ok', 'false') = 'true') order by e.i)
             from jsonb_array_elements(case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end) with ordinality as e(x, i)
            where e.i <= 100 and btrim(coalesce(e.x->>'t', '')) <> ''
         ), '[]'::jsonb),
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_anotar(p_pin text, p_tarefa uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  txt text := left(btrim(coalesce(p_texto, '')), 2000);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if txt = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Escreva a anotação.');
  end if;
  if not exists (select 1 from org_tarefas where id = p_tarefa) then
    return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não existe mais.');
  end if;
  insert into org_anotacoes (tarefa_id, texto) values (p_tarefa, txt) returning id into novo;
  update org_tarefas set updated_at = now() where id = p_tarefa;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_anotacao(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_anotacoes where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------- colunas do quadro ----------
create or replace function org_salvar_coluna(p_pin text, p_chave text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  nome_ok text := left(btrim(coalesce(p_nome, '')), 40);
  chave_ok text := p_chave;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um nome à coluna.');
  end if;
  if chave_ok is null then
    chave_ok := 'c' || replace(gen_random_uuid()::text, '-', '');
    insert into org_colunas (chave, nome, ordem)
    values (chave_ok, nome_ok, (select coalesce(max(ordem), 0) + 10 from org_colunas where chave <> 'feito'));
  else
    update org_colunas set nome = nome_ok where chave = chave_ok;
  end if;
  return jsonb_build_object('status', 'ok', 'chave', chave_ok);
end;
$$;

-- Recebe as colunas do meio (entre A fazer e Feito) na nova ordem
create or replace function org_ordenar_colunas(p_pin text, p_chaves text[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  update org_colunas c
     set ordem = x.i * 10
    from unnest(p_chaves) with ordinality as x(chave, i)
   where c.chave = x.chave and c.chave not in ('afazer', 'feito');
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Exclui uma coluna criada no site; as tarefas dela voltam para A fazer
create or replace function org_excluir_coluna(p_pin text, p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  n int;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_chave in ('afazer', 'fazendo', 'feito') then
    return jsonb_build_object('status', 'erro', 'message', 'Esta coluna é fixa: pode ser renomeada, mas não excluída.');
  end if;
  update org_tarefas set etapa = 'afazer', updated_at = now() where etapa = p_chave;
  get diagnostics n = row_count;
  delete from org_colunas where chave = p_chave;
  return jsonb_build_object('status', 'ok', 'movidas', n);
end;
$$;

grant execute on function org_listar(text) to anon, authenticated;
grant execute on function org_salvar_nota(text, uuid, text, text, boolean) to anon, authenticated;
grant execute on function org_excluir_nota(text, uuid) to anon, authenticated;
grant execute on function org_salvar_tarefa(text, uuid, text, date, boolean, text, text, timestamptz, text) to anon, authenticated;
grant execute on function org_excluir_tarefa(text, uuid) to anon, authenticated;
grant execute on function org_salvar_lembrete(text, uuid, text, date, time, text, timestamptz) to anon, authenticated;
grant execute on function org_excluir_lembrete(text, uuid) to anon, authenticated;
grant execute on function org_salvar_rotina(text, uuid, text, text, timestamptz) to anon, authenticated;
grant execute on function org_excluir_rotina(text, uuid) to anon, authenticated;
grant execute on function org_salvar_etiqueta(text, uuid, text, text) to anon, authenticated;
grant execute on function org_excluir_etiqueta(text, uuid) to anon, authenticated;
grant execute on function org_etiquetar_tarefa(text, uuid, uuid[]) to anon, authenticated;
grant execute on function org_ordenar_tarefas(text, uuid[]) to anon, authenticated;
grant execute on function org_checklist_tarefa(text, uuid, jsonb) to anon, authenticated;
grant execute on function org_anotar(text, uuid, text) to anon, authenticated;
grant execute on function org_excluir_anotacao(text, uuid) to anon, authenticated;
grant execute on function org_salvar_coluna(text, text, text) to anon, authenticated;
grant execute on function org_ordenar_colunas(text, text[]) to anon, authenticated;
grant execute on function org_excluir_coluna(text, text) to anon, authenticated;

-- =====================================================================
-- TROCAR A SENHA (ou criar uma nova se esquecer): rode só a linha abaixo,
-- trocando 000000 pela nova senha.
--
-- update org_config set pin_hash = extensions.crypt('000000', extensions.gen_salt('bf')), tentativas = 0, bloqueado_ate = null where id = 1;
-- =====================================================================
