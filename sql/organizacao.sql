-- =====================================================================
-- Organização do gestor (mural + tarefas) protegida por senha numérica,
-- com telas para as pessoas da equipe (entram só pelo nome)
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
--   - O site só acessa os dados pelas funções org_*, que conferem quem está
--     pedindo antes de qualquer leitura ou gravação:
--       * com a senha do gestor: a tela do gestor, a de qualquer pessoa e a
--         aba "Tarefas da equipe";
--       * só com o código de uma pessoa ativa (sem senha): apenas o quadro,
--         o mural e os lembretes dessa pessoa.
--   - Cada nota, tarefa, lembrete, etiqueta, coluna e modelo tem um dono
--     (coluna "dono"): vazio = gestor; preenchido = a pessoa da equipe.
--   - A senha fica guardada criptografada (bcrypt), nunca em texto puro.
--   - Após 5 tentativas erradas, o acesso do gestor fica bloqueado por 5 minutos.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas ----------
create table if not exists org_config (
  id int primary key default 1 check (id = 1),
  pin_hash text not null,
  tentativas int not null default 0,
  bloqueado_ate timestamptz
);

-- pessoas da equipe (cadastradas pelo gestor; entram na própria tela pelo nome)
create table if not exists org_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
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

-- tarefa concluída e arquivada (sai do quadro e vai para o histórico)
alter table org_tarefas add column if not exists arquivada_em timestamptz;

-- modelos de cartão: {"titulo", "etiquetas": [...], "checklist": [...], "responsavel", "prioridade"}
create table if not exists org_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  dados jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- prioridade em 4 níveis: baixa, normal, alta, urgente ("urgente" acompanha: true só na urgente)
alter table org_tarefas add column if not exists prioridade text not null default 'normal';
update org_tarefas set prioridade = 'urgente' where urgente and prioridade <> 'urgente';
update org_tarefas set urgente = (prioridade = 'urgente') where urgente <> (prioridade = 'urgente');

-- tarefa mandada pelo gestor para a tela de uma pessoa e o fechamento que ela preencheu
alter table org_tarefas add column if not exists do_gestor boolean not null default false;
-- {"horas", "minutos", "conformidade": sim|parcialmente|nao, "dificuldade", "dificuldade_desc", "precisa_acao", "em"}
alter table org_tarefas add column if not exists conclusao jsonb;

-- dono de cada registro: vazio = gestor; preenchido = pessoa da equipe
alter table org_notas     add column if not exists dono uuid references org_pessoas(id) on delete cascade;
alter table org_tarefas   add column if not exists dono uuid references org_pessoas(id) on delete cascade;
alter table org_lembretes add column if not exists dono uuid references org_pessoas(id) on delete cascade;
alter table org_etiquetas add column if not exists dono uuid references org_pessoas(id) on delete cascade;
alter table org_modelos   add column if not exists dono uuid references org_pessoas(id) on delete cascade;
alter table org_colunas   add column if not exists dono uuid references org_pessoas(id) on delete cascade;
create index if not exists org_notas_dono_idx     on org_notas (dono);
create index if not exists org_tarefas_dono_idx   on org_tarefas (dono);
create index if not exists org_lembretes_dono_idx on org_lembretes (dono);

-- cada dono tem as próprias colunas: a chave deixa de ser única sozinha
alter table org_colunas add column if not exists id uuid not null default gen_random_uuid();
do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'org_colunas'::regclass and contype = 'p'
             and pg_get_constraintdef(oid) like '%(chave)%') then
    alter table org_colunas drop constraint org_colunas_pkey;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'org_colunas'::regclass and contype = 'p') then
    alter table org_colunas add primary key (id);
  end if;
end;
$$;
create unique index if not exists org_colunas_dono_chave_idx
  on org_colunas ((coalesce(dono, '00000000-0000-0000-0000-000000000000'::uuid)), chave);

-- colunas fixas de cada tela (gestor e pessoas já cadastradas)
insert into org_colunas (dono, chave, nome, ordem)
select d.dono, c.chave, c.nome, c.ordem
  from (select null::uuid as dono union all select id from org_pessoas) d
 cross join (values ('afazer', 'A fazer', 0), ('fazendo', 'Fazendo', 10), ('feito', 'Feito', 100000)) as c(chave, nome, ordem)
 where not exists (select 1 from org_colunas x where x.dono is not distinct from d.dono and x.chave = c.chave);

alter table org_config    enable row level security;
alter table org_pessoas   enable row level security;
alter table org_notas     enable row level security;
alter table org_tarefas   enable row level security;
alter table org_lembretes enable row level security;
alter table org_rotinas   enable row level security;
alter table org_etiquetas enable row level security;
alter table org_colunas   enable row level security;
alter table org_anotacoes enable row level security;
alter table org_modelos   enable row level security;
revoke all on org_config, org_pessoas, org_notas, org_tarefas, org_lembretes, org_rotinas, org_etiquetas, org_colunas, org_anotacoes, org_modelos from anon, authenticated;

-- ---------- senha ----------
insert into org_config (id, pin_hash)
values (1, extensions.crypt('000000', extensions.gen_salt('bf')))   -- <<< SENHA
on conflict (id) do nothing;

-- ---------- versões antigas das funções (sem o parâmetro p_pessoa) ----------
drop function if exists org_listar(text);
drop function if exists org_salvar_nota(text, uuid, text, text, boolean);
drop function if exists org_excluir_nota(text, uuid);
drop function if exists org_salvar_tarefa(text, uuid, text, date, boolean, text, text, timestamptz);
drop function if exists org_salvar_tarefa(text, uuid, text, date, boolean, text, text, timestamptz, text);
drop function if exists org_excluir_tarefa(text, uuid);
drop function if exists org_salvar_lembrete(text, uuid, text, date, time, text, timestamptz);
drop function if exists org_excluir_lembrete(text, uuid);
drop function if exists org_salvar_rotina(text, uuid, text, text, timestamptz);
drop function if exists org_excluir_rotina(text, uuid);
drop function if exists org_salvar_etiqueta(text, uuid, text, text);
drop function if exists org_excluir_etiqueta(text, uuid);
drop function if exists org_etiquetar_tarefa(text, uuid, uuid[]);
drop function if exists org_ordenar_tarefas(text, uuid[]);
drop function if exists org_checklist_tarefa(text, uuid, jsonb);
drop function if exists org_anotar(text, uuid, text);
drop function if exists org_excluir_anotacao(text, uuid);
drop function if exists org_arquivar_tarefas(text, uuid[], boolean);
drop function if exists org_salvar_modelo(text, uuid, text, jsonb);
drop function if exists org_excluir_modelo(text, uuid);
drop function if exists org_salvar_coluna(text, text, text);
drop function if exists org_ordenar_colunas(text, text[]);
drop function if exists org_excluir_coluna(text, text);

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

-- ---------- quem está pedindo e de qual tela (uso interno) ----------
-- Com senha (gestor): o_dono = a tela escolhida (vazio = a do gestor).
-- Sem senha: só a própria tela de uma pessoa ativa.
create or replace function org_acesso(p_pin text, p_pessoa uuid, out o_st text, out o_dono uuid, out o_gestor boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  o_gestor := p_pin is not null;
  o_dono := p_pessoa;
  if o_gestor then
    o_st := org_verifica(p_pin);
    if o_st = 'ok' and p_pessoa is not null and not exists (select 1 from org_pessoas where id = p_pessoa) then
      o_st := 'sem_pessoa';
    end if;
  elsif p_pessoa is null then
    o_st := 'senha';
  elsif exists (select 1 from org_pessoas where id = p_pessoa and ativo) then
    o_st := 'ok';
  else
    o_st := 'sem_pessoa';
  end if;
end;
$$;
revoke all on function org_acesso(text, uuid) from public, anon, authenticated;

-- ---------- funções usadas pelo site ----------
-- Todas devolvem {"status": "ok" | "senha" | "bloqueado" | "sem_config" | "sem_pessoa" | "erro", ...}

-- Nomes das pessoas ativas, para a lista "Entrar na minha tela" (não precisa de senha)
create or replace function org_pessoas_publico()
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object('status', 'ok', 'pessoas', coalesce(
    (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by lower(p.nome)) from org_pessoas p where p.ativo),
    '[]'::jsonb));
$$;

create or replace function org_listar(p_pin text, p_pessoa uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  res jsonb;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  res := jsonb_build_object(
    'status', 'ok',
    'gestor', ac.o_gestor,
    'pessoa', (select jsonb_build_object('id', p.id, 'nome', p.nome) from org_pessoas p where p.id = ac.o_dono),
    'notas', coalesce((select jsonb_agg(to_jsonb(n) order by n.fixada desc, n.created_at desc) from org_notas n where n.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'tarefas', coalesce((select jsonb_agg(to_jsonb(t) order by t.prazo nulls last, t.created_at) from org_tarefas t where t.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'lembretes', coalesce((select jsonb_agg(to_jsonb(l) order by l.data, l.hora nulls first) from org_lembretes l where l.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'rotinas', case when ac.o_gestor then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from org_rotinas r), '[]'::jsonb) else '[]'::jsonb end,
    'etiquetas', coalesce((select jsonb_agg(to_jsonb(e) order by e.nome) from org_etiquetas e where e.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'colunas', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem, c.created_at) from org_colunas c where c.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'anotacoes', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from org_anotacoes x join org_tarefas t on t.id = x.tarefa_id where t.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(to_jsonb(m) order by m.nome) from org_modelos m where m.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'ordem', true,
    'checklist', true,
    'arquivar_livre', true,
    'equipe', true
  );
  if ac.o_gestor then
    res := res || jsonb_build_object(
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'ativo', p.ativo) order by lower(p.nome)) from org_pessoas p), '[]'::jsonb),
      'equipe_tarefas', coalesce((select jsonb_agg(to_jsonb(t) order by t.prazo nulls last, t.created_at) from org_tarefas t
                                   where t.dono is not null and t.do_gestor and t.arquivada_em is null), '[]'::jsonb),
      'equipe_colunas', coalesce((select jsonb_agg(jsonb_build_object('dono', c.dono, 'chave', c.chave, 'nome', c.nome)) from org_colunas c where c.dono is not null), '[]'::jsonb)
    );
  end if;
  return res;
end;
$$;

create or replace function org_salvar_nota(p_pin text, p_pessoa uuid, p_id uuid, p_texto text, p_cor text, p_fixada boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if p_id is null then
    insert into org_notas (dono, texto, cor, fixada)
    values (ac.o_dono, coalesce(p_texto, ''), coalesce(p_cor, 'amarelo'), coalesce(p_fixada, false))
    returning id into novo;
  else
    update org_notas
       set texto = coalesce(p_texto, texto), cor = coalesce(p_cor, cor),
           fixada = coalesce(p_fixada, fixada), updated_at = now()
     where id = p_id and dono is not distinct from ac.o_dono
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_nota(p_pin text, p_pessoa uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  delete from org_notas where id = p_id and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_salvar_tarefa(
  p_pin text, p_pessoa uuid, p_id uuid, p_titulo text, p_prazo date, p_prioridade text,
  p_responsavel text, p_processo text, p_feita_em timestamptz, p_etapa text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  pr text := case when p_prioridade in ('baixa', 'normal', 'alta', 'urgente') then p_prioridade end;
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if p_id is null then
    insert into org_tarefas (dono, do_gestor, titulo, prazo, prioridade, urgente, responsavel, processo, feita_em, etapa)
    values (ac.o_dono, ac.o_gestor and ac.o_dono is not null, coalesce(p_titulo, ''), p_prazo,
            coalesce(pr, 'normal'), coalesce(pr, 'normal') = 'urgente',
            coalesce(p_responsavel, ''), coalesce(p_processo, ''), p_feita_em, coalesce(p_etapa, 'afazer'))
    returning id into novo;
  else
    update org_tarefas
       set titulo = coalesce(p_titulo, titulo), prazo = p_prazo,
           prioridade = coalesce(pr, prioridade), urgente = coalesce(pr, prioridade) = 'urgente',
           responsavel = coalesce(p_responsavel, responsavel), processo = coalesce(p_processo, processo),
           feita_em = p_feita_em, etapa = coalesce(p_etapa, etapa), updated_at = now(),
           posicao = case when p_etapa is not null and p_etapa <> etapa then null else posicao end
     where id = p_id and dono is not distinct from ac.o_dono
    returning id into novo;
    if novo is null then
      return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não existe mais.');
    end if;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

-- A pessoa conclui a tarefa que o gestor mandou e responde o fechamento
create or replace function org_concluir_tarefa(p_pin text, p_pessoa uuid, p_id uuid, p_conclusao jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  c jsonb := case when jsonb_typeof(p_conclusao) = 'object' then p_conclusao else '{}'::jsonb end;
  n int;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  update org_tarefas
     set etapa = 'feito', feita_em = coalesce(feita_em, now()), posicao = null, updated_at = now(),
         conclusao = jsonb_build_object(
           'horas', case when c->>'horas' ~ '^\d{1,3}$' then (c->>'horas')::int else 0 end,
           'minutos', case when c->>'minutos' ~ '^\d{1,2}$' then least((c->>'minutos')::int, 59) else 0 end,
           'conformidade', case when c->>'conformidade' in ('sim', 'parcialmente', 'nao') then c->>'conformidade' else 'sim' end,
           'dificuldade', coalesce(c->>'dificuldade', 'false') = 'true',
           'dificuldade_desc', left(btrim(coalesce(c->>'dificuldade_desc', '')), 1000),
           'precisa_acao', coalesce(c->>'precisa_acao', 'false') = 'true',
           'em', now())
   where id = p_id and dono is not distinct from ac.o_dono;
  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não existe mais.');
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_excluir_tarefa(p_pin text, p_pessoa uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  delete from org_tarefas where id = p_id and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- O gestor manda uma tarefa do quadro dele para a tela de uma pessoa
-- (volta para a primeira coluna; as etiquetas saem porque cada tela tem as suas)
create or replace function org_enviar_tarefa(p_pin text, p_pessoa uuid, p_id uuid, p_destino uuid)
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
  if not exists (select 1 from org_pessoas where id = p_destino) then
    return jsonb_build_object('status', 'erro', 'message', 'Esta pessoa não está mais cadastrada.');
  end if;
  update org_tarefas
     set dono = p_destino, do_gestor = true, etapa = 'afazer', feita_em = null, posicao = null,
         etiquetas = '{}', conclusao = null, updated_at = now()
   where id = p_id and dono is null;
  get diagnostics n = row_count;
  return jsonb_build_object('status', 'ok', 'n', n);
end;
$$;

create or replace function org_salvar_lembrete(
  p_pin text, p_pessoa uuid, p_id uuid, p_texto text, p_data date, p_hora time, p_processo text, p_feito_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if p_id is null then
    insert into org_lembretes (dono, texto, data, hora, processo, feito_em)
    values (ac.o_dono, coalesce(p_texto, ''), coalesce(p_data, current_date), p_hora, coalesce(p_processo, ''), p_feito_em)
    returning id into novo;
  else
    update org_lembretes
       set texto = coalesce(p_texto, texto), data = coalesce(p_data, data), hora = p_hora,
           processo = coalesce(p_processo, processo), feito_em = p_feito_em, updated_at = now()
     where id = p_id and dono is not distinct from ac.o_dono
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_lembrete(p_pin text, p_pessoa uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  delete from org_lembretes where id = p_id and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------- rotinas (só do gestor) ----------
create or replace function org_salvar_rotina(
  p_pin text, p_pessoa uuid, p_id uuid, p_titulo text, p_frequencia text, p_feita_em timestamptz
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

create or replace function org_excluir_rotina(p_pin text, p_pessoa uuid, p_id uuid)
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
create or replace function org_salvar_etiqueta(p_pin text, p_pessoa uuid, p_id uuid, p_nome text, p_cor text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  nome_ok text := left(btrim(coalesce(p_nome, '')), 40);
  cor_ok text := case when p_cor in ('vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'cinza') then p_cor else 'azul' end;
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um nome à etiqueta.');
  end if;
  if p_id is null then
    insert into org_etiquetas (dono, nome, cor) values (ac.o_dono, nome_ok, cor_ok) returning id into novo;
  else
    update org_etiquetas set nome = nome_ok, cor = cor_ok
     where id = p_id and dono is not distinct from ac.o_dono returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_etiqueta(p_pin text, p_pessoa uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not exists (select 1 from org_etiquetas where id = p_id and dono is not distinct from ac.o_dono) then
    return jsonb_build_object('status', 'ok');
  end if;
  update org_tarefas set etiquetas = array_remove(etiquetas, p_id) where p_id = any(etiquetas);
  delete from org_etiquetas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_etiquetar_tarefa(p_pin text, p_pessoa uuid, p_id uuid, p_etiquetas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  update org_tarefas
     set etiquetas = coalesce((select array_agg(e.id) from org_etiquetas e
                                where e.id = any(p_etiquetas) and e.dono is not distinct from ac.o_dono), '{}'),
         updated_at = now()
   where id = p_id and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Recebe os cartões de uma coluna na ordem em que devem aparecer
create or replace function org_ordenar_tarefas(p_pin text, p_pessoa uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  update org_tarefas t
     set posicao = x.i * 10
    from unnest(p_ids) with ordinality as x(id, i)
   where t.id = x.id and t.dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Grava o checklist inteiro do cartão (até 100 itens, 200 letras cada)
create or replace function org_checklist_tarefa(p_pin text, p_pessoa uuid, p_id uuid, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  update org_tarefas
     set checklist = coalesce((
           select jsonb_agg(jsonb_build_object('t', left(btrim(e.x->>'t'), 200), 'ok', coalesce(e.x->>'ok', 'false') = 'true') order by e.i)
             from jsonb_array_elements(case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end) with ordinality as e(x, i)
            where e.i <= 100 and btrim(coalesce(e.x->>'t', '')) <> ''
         ), '[]'::jsonb),
         updated_at = now()
   where id = p_id and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_anotar(p_pin text, p_pessoa uuid, p_tarefa uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  txt text := left(btrim(coalesce(p_texto, '')), 2000);
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if txt = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Escreva a anotação.');
  end if;
  if not exists (select 1 from org_tarefas where id = p_tarefa and dono is not distinct from ac.o_dono) then
    return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não existe mais.');
  end if;
  insert into org_anotacoes (tarefa_id, texto) values (p_tarefa, txt) returning id into novo;
  update org_tarefas set updated_at = now() where id = p_tarefa;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_anotacao(p_pin text, p_pessoa uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  delete from org_anotacoes x
   using org_tarefas t
   where x.id = p_id and t.id = x.tarefa_id and t.dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Arquiva (p_arquivar = true) ou devolve ao quadro as tarefas indicadas (de qualquer coluna)
create or replace function org_arquivar_tarefas(p_pin text, p_pessoa uuid, p_ids uuid[], p_arquivar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  n int;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if coalesce(p_arquivar, true) then
    update org_tarefas set arquivada_em = now()
     where id = any(p_ids) and arquivada_em is null and dono is not distinct from ac.o_dono;
  else
    update org_tarefas set arquivada_em = null
     where id = any(p_ids) and dono is not distinct from ac.o_dono;
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('status', 'ok', 'n', n);
end;
$$;

-- ---------- modelos de cartão ----------
create or replace function org_salvar_modelo(p_pin text, p_pessoa uuid, p_id uuid, p_nome text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  nome_ok text := left(btrim(coalesce(p_nome, '')), 60);
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um nome ao modelo.');
  end if;
  if p_id is null then
    insert into org_modelos (dono, nome, dados)
    values (ac.o_dono, nome_ok, case when jsonb_typeof(p_dados) = 'object' then p_dados else '{}'::jsonb end)
    returning id into novo;
  else
    update org_modelos
       set nome = nome_ok, dados = case when jsonb_typeof(p_dados) = 'object' then p_dados else dados end
     where id = p_id and dono is not distinct from ac.o_dono
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_modelo(p_pin text, p_pessoa uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  delete from org_modelos where id = p_id and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------- colunas do quadro (cada tela tem as suas) ----------
create or replace function org_salvar_coluna(p_pin text, p_pessoa uuid, p_chave text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  nome_ok text := left(btrim(coalesce(p_nome, '')), 40);
  chave_ok text := p_chave;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um nome à coluna.');
  end if;
  if chave_ok is null then
    chave_ok := 'c' || replace(gen_random_uuid()::text, '-', '');
    insert into org_colunas (dono, chave, nome, ordem)
    values (ac.o_dono, chave_ok, nome_ok,
            (select coalesce(max(ordem), 0) + 10 from org_colunas where chave <> 'feito' and dono is not distinct from ac.o_dono));
  else
    update org_colunas set nome = nome_ok where chave = chave_ok and dono is not distinct from ac.o_dono;
  end if;
  return jsonb_build_object('status', 'ok', 'chave', chave_ok);
end;
$$;

-- Recebe as colunas do meio (entre A fazer e Feito) na nova ordem
create or replace function org_ordenar_colunas(p_pin text, p_pessoa uuid, p_chaves text[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  update org_colunas c
     set ordem = x.i * 10
    from unnest(p_chaves) with ordinality as x(chave, i)
   where c.chave = x.chave and c.chave not in ('afazer', 'feito') and c.dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Exclui uma coluna criada no site; as tarefas dela voltam para A fazer
create or replace function org_excluir_coluna(p_pin text, p_pessoa uuid, p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  n int;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if p_chave in ('afazer', 'fazendo', 'feito') then
    return jsonb_build_object('status', 'erro', 'message', 'Esta coluna é fixa: pode ser renomeada, mas não excluída.');
  end if;
  update org_tarefas set etapa = 'afazer', updated_at = now()
   where etapa = p_chave and dono is not distinct from ac.o_dono;
  get diagnostics n = row_count;
  delete from org_colunas where chave = p_chave and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok', 'movidas', n);
end;
$$;

-- ---------- pessoas da equipe (só o gestor cadastra) ----------
create or replace function org_salvar_pessoa(p_pin text, p_pessoa uuid, p_id uuid, p_nome text, p_ativo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  nome_ok text := left(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), 60);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Digite o nome da pessoa.');
  end if;
  if exists (select 1 from org_pessoas where lower(nome) = lower(nome_ok) and id is distinct from p_id) then
    return jsonb_build_object('status', 'erro', 'message', 'Já existe alguém cadastrado com esse nome.');
  end if;
  if p_id is null then
    insert into org_pessoas (nome, ativo) values (nome_ok, coalesce(p_ativo, true)) returning id into novo;
    insert into org_colunas (dono, chave, nome, ordem)
    values (novo, 'afazer', 'A fazer', 0), (novo, 'fazendo', 'Fazendo', 10), (novo, 'feito', 'Feito', 100000);
  else
    update org_pessoas set nome = nome_ok, ativo = coalesce(p_ativo, ativo) where id = p_id returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

-- Exclui a pessoa e TUDO da tela dela (quadro, mural, lembretes, etiquetas, colunas e modelos)
create or replace function org_excluir_pessoa(p_pin text, p_pessoa uuid, p_id uuid)
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
  delete from org_pessoas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function org_pessoas_publico() to anon, authenticated;
grant execute on function org_listar(text, uuid) to anon, authenticated;
grant execute on function org_salvar_nota(text, uuid, uuid, text, text, boolean) to anon, authenticated;
grant execute on function org_excluir_nota(text, uuid, uuid) to anon, authenticated;
grant execute on function org_salvar_tarefa(text, uuid, uuid, text, date, text, text, text, timestamptz, text) to anon, authenticated;
grant execute on function org_concluir_tarefa(text, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function org_excluir_tarefa(text, uuid, uuid) to anon, authenticated;
grant execute on function org_enviar_tarefa(text, uuid, uuid, uuid) to anon, authenticated;
grant execute on function org_salvar_lembrete(text, uuid, uuid, text, date, time, text, timestamptz) to anon, authenticated;
grant execute on function org_excluir_lembrete(text, uuid, uuid) to anon, authenticated;
grant execute on function org_salvar_rotina(text, uuid, uuid, text, text, timestamptz) to anon, authenticated;
grant execute on function org_excluir_rotina(text, uuid, uuid) to anon, authenticated;
grant execute on function org_salvar_etiqueta(text, uuid, uuid, text, text) to anon, authenticated;
grant execute on function org_excluir_etiqueta(text, uuid, uuid) to anon, authenticated;
grant execute on function org_etiquetar_tarefa(text, uuid, uuid, uuid[]) to anon, authenticated;
grant execute on function org_ordenar_tarefas(text, uuid, uuid[]) to anon, authenticated;
grant execute on function org_checklist_tarefa(text, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function org_anotar(text, uuid, uuid, text) to anon, authenticated;
grant execute on function org_excluir_anotacao(text, uuid, uuid) to anon, authenticated;
grant execute on function org_arquivar_tarefas(text, uuid, uuid[], boolean) to anon, authenticated;
grant execute on function org_salvar_modelo(text, uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function org_excluir_modelo(text, uuid, uuid) to anon, authenticated;
grant execute on function org_salvar_coluna(text, uuid, text, text) to anon, authenticated;
grant execute on function org_ordenar_colunas(text, uuid, text[]) to anon, authenticated;
grant execute on function org_excluir_coluna(text, uuid, text) to anon, authenticated;
grant execute on function org_salvar_pessoa(text, uuid, uuid, text, boolean) to anon, authenticated;
grant execute on function org_excluir_pessoa(text, uuid, uuid) to anon, authenticated;

-- =====================================================================
-- TROCAR A SENHA (ou criar uma nova se esquecer): rode só a linha abaixo,
-- trocando 000000 pela nova senha.
--
-- update org_config set pin_hash = extensions.crypt('000000', extensions.gen_salt('bf')), tentativas = 0, bloqueado_ate = null where id = 1;
-- =====================================================================
