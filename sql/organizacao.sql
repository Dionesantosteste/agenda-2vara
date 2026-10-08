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

-- conferência: a pessoa envia a tarefa para o gestor conferir (enviada, aprovada, devolvida)
-- conf_hist: [{"a": "enviada|aprovada|devolvida|cancelada", "em": data, "t": recado ou motivo}, ...]
alter table org_tarefas add column if not exists conferencia text;
alter table org_tarefas add column if not exists conf_hist jsonb not null default '[]';

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

-- ordem que a pessoa escolheu arrastando na lista "Tarefas e mural" (separada da ordem do Quadro)
alter table org_tarefas add column if not exists ordem_lista int;

-- título opcional da nota do mural (post-it)
alter table org_notas add column if not exists titulo text not null default '';

-- tarefa agendada pelo gestor: só aparece na tela da pessoa a partir deste dia (vazio = aparece já)
alter table org_tarefas add column if not exists aparece_em date;

-- ---------- modelos de texto (uma biblioteca para todos; qualquer tela edita) ----------
create table if not exists org_txt_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists org_txt_categorias_nome_idx on org_txt_categorias (lower(nome));

create table if not exists org_txt_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  categoria text not null default '',
  texto text not null default '',          -- campos entre chaves: {{processo}}, {{autor}}, {{data}}...
  usos int not null default 0,
  alterado_por text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- assinatura (nome, cargo, cidade) e modelos favoritos de cada tela (dono vazio = gestor)
create table if not exists org_txt_meus (
  id uuid primary key default gen_random_uuid(),
  dono uuid references org_pessoas(id) on delete cascade,
  nome text not null default '',
  cargo text not null default '',
  cidade text not null default '',
  favoritos uuid[] not null default '{}'
);
create unique index if not exists org_txt_meus_dono_idx
  on org_txt_meus ((coalesce(dono, '00000000-0000-0000-0000-000000000000'::uuid)));

alter table org_config add column if not exists txt_semeado boolean not null default false;

-- modelo de texto ligado à tarefa (botão "Abrir modelo" no cartão)
alter table org_tarefas add column if not exists modelo_texto uuid references org_txt_modelos(id) on delete set null;
-- cidade dos documentos: uma só, cadastrada pelo gestor
alter table org_config add column if not exists txt_cidade text not null default '';

alter table org_txt_categorias enable row level security;
alter table org_txt_modelos    enable row level security;
alter table org_txt_meus       enable row level security;
revoke all on org_txt_categorias, org_txt_modelos, org_txt_meus from anon, authenticated;

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

-- ---------- aniversariantes (cadastro do gestor; a barra do site mostra os do mês) ----------
-- Só dia e mês (sem ano). obs: um complemento curto, como "Juiz" ou "estagiária".
create table if not exists org_aniversarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  dia int not null check (dia between 1 and 31),
  mes int not null check (mes between 1 and 12),
  obs text not null default '',
  created_at timestamptz not null default now()
);
alter table org_aniversarios enable row level security;
revoke all on org_aniversarios from anon, authenticated;

-- ---------- senha ----------
insert into org_config (id, pin_hash)
values (1, extensions.crypt('000000', extensions.gen_salt('bf')))   -- <<< SENHA
on conflict (id) do nothing;

-- ---------- modelos de texto iniciais (só na primeira vez; depois a equipe ajusta pelo site) ----------
do $$
begin
  if exists (select 1 from org_config where id = 1 and not txt_semeado) then
    insert into org_txt_categorias (nome, ordem)
    values ('Intimação', 10), ('Citação', 20), ('Mandado', 30), ('Ofício', 40), ('Certidão', 50)
    on conflict do nothing;
    insert into org_txt_modelos (nome, categoria, texto) values
    ('Intimação para audiência', 'Intimação',
'INTIMAÇÃO

Processo nº {{processo}}
Autor(a): {{autor}}
Réu/Ré: {{reu}}

De ordem do(a) MM. Juiz(a) de Direito, fica Vossa Senhoria INTIMADO(A) para comparecer à audiência de {{tipo_audiencia}} designada para o dia {{data}}, às {{hora}}, a realizar-se {{local}}.

Adverte-se que o não comparecimento poderá acarretar as consequências previstas em lei.

{{cidade}}, {{hoje}}.

{{servidor}}
{{cargo}}'),
    ('Intimação do perito (aceite do encargo)', 'Intimação',
'INTIMAÇÃO

Processo nº {{processo}}
Autor(a): {{autor}}

Ilmo(a). Sr(a). {{perito}},

Fica Vossa Senhoria INTIMADO(A) da nomeação como perito(a) ({{especialidade}}) nos autos em epígrafe, para que, no prazo de {{prazo}} dias, manifeste se aceita o encargo e, em caso positivo, informe data, horário e local para a realização da perícia.

{{cidade}}, {{hoje}}.

{{servidor}}
{{cargo}}'),
    ('Citação — procedimento comum', 'Citação',
'CITAÇÃO

Processo nº {{processo}}
Autor(a): {{autor}}

Destinatário(a): {{destinatario}}
Endereço: {{endereco}}

Fica Vossa Senhoria CITADO(A) dos termos da ação em epígrafe para, querendo, apresentar contestação no prazo de {{prazo}} dias, sob pena de revelia.

{{cidade}}, {{hoje}}.

{{servidor}}
{{cargo}}'),
    ('Mandado de busca e apreensão', 'Mandado',
'MANDADO DE BUSCA E APREENSÃO

Processo nº {{processo}}
Autor(a): {{autor}}
Réu/Ré: {{reu}}

O(A) Oficial(a) de Justiça a quem este for apresentado, em cumprimento à decisão proferida nos autos, proceda à BUSCA E APREENSÃO de: {{bem}}, no endereço {{endereco}}, depositando-o em mãos do(a) autor(a) ou de quem este(a) indicar, lavrando-se o respectivo auto.

{{cidade}}, {{hoje}}.

{{servidor}}
{{cargo}}'),
    ('Ofício — requisição de informações', 'Ofício',
'OFÍCIO

{{cidade}}, {{hoje}}.

Ao(À) {{orgao}}

Assunto: {{assunto}}
Processo nº {{processo}}

Senhor(a),

De ordem do(a) MM. Juiz(a) de Direito, solicito a Vossa Senhoria que, no prazo de {{prazo}} dias, encaminhe a este Juízo as informações referentes ao processo em epígrafe.

Atenciosamente,

{{servidor}}
{{cargo}}'),
    ('Certidão de decurso de prazo', 'Certidão',
'CERTIDÃO

Processo nº {{processo}}

Certifico que decorreu o prazo de {{prazo}} dias sem manifestação da parte {{destinatario}}.

{{cidade}}, {{hoje}}.

{{servidor}}
{{cargo}}');
    update org_config set txt_semeado = true where id = 1;
  end if;
end;
$$;

-- quem já tinha posto a cidade na assinatura do gestor: ela passa a valer para todos
update org_config
   set txt_cidade = coalesce((select cidade from org_txt_meus where dono is null and cidade <> '' limit 1), '')
 where id = 1 and txt_cidade = '';

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

-- "Hoje" no horário da vara. O banco trabalha em UTC: sem isto, depois das 20h já seria o dia seguinte.
create or replace function org_hoje()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Cuiaba')::date;
$$;

-- Painel da equipe (só o gestor; chamado por org_carregar): totais por pessoa contando TODAS as
-- tarefas do quadro de cada uma, não só as mandadas pelo gestor. Devolve números, não as tarefas.
create or replace function org_painel_equipe()
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  with todas_abertas as (
    select t.*, coalesce(t.aparece_em > org_hoje(), false) as agendada from org_tarefas t
     where t.dono is not null and t.arquivada_em is null and t.etapa <> 'feito'
  ), abertas as (
    select * from todas_abertas where not agendada
  ), feitas as (
    select t.*, (t.feita_em at time zone 'America/Cuiaba')::date as dia_feita from org_tarefas t
     where t.dono is not null and t.feita_em >= now() - interval '56 days'
  )
  select jsonb_build_object(
    'hoje', org_hoje(),
    -- em aberto: a fazer, em andamento (qualquer coluna do meio), esperando conferência
    'abertas', coalesce((select jsonb_agg(x) from (
        select a.dono,
               count(*) filter (where a.conferencia is distinct from 'enviada' and a.etapa = 'afazer') as afazer,
               count(*) filter (where a.conferencia is distinct from 'enviada' and a.etapa <> 'afazer') as andamento,
               count(*) filter (where a.conferencia = 'enviada') as conferir,
               count(*) filter (where a.prazo < org_hoje()) as atrasadas,
               count(*) filter (where a.prazo = org_hoje()) as hoje,
               count(*) filter (where a.prioridade = 'urgente') as urgentes,
               min(a.prazo) filter (where a.prazo >= org_hoje()) as prox_prazo
          from abertas a group by a.dono) x), '[]'::jsonb),
    -- agendadas: ainda não aparecem na tela da pessoa
    'agendadas', coalesce((select jsonb_agg(x) from (
        select a.dono, count(*) as n, min(a.aparece_em) as proxima from todas_abertas a where a.agendada group by a.dono) x), '[]'::jsonb),
    -- prazos dos próximos 7 dias (hoje + 6), por pessoa e dia
    'prazos', coalesce((select jsonb_agg(x) from (
        select a.dono, a.prazo as dia, count(*) as n from abertas a
         where a.prazo between org_hoje() and org_hoje() + 6 group by a.dono, a.prazo) x), '[]'::jsonb),
    -- paradas: em aberto, fora da conferência e sem mudança há 7 dias ou mais (igual a ORG_DIAS_PARADO no site)
    'paradas', coalesce((select jsonb_agg(x order by x.desde) from (
        select a.id, a.dono, a.titulo, a.etapa, a.processo, greatest(a.updated_at, a.aparece_em::timestamptz) as desde from abertas a
         where a.conferencia is distinct from 'enviada' and greatest(a.updated_at, a.aparece_em::timestamptz) < now() - interval '7 days'
         order by 6 limit 15) x), '[]'::jsonb),
    -- desempenho: concluídas nos últimos 7 e 30 dias, no prazo, tempo médio e devolvidas na conferência
    'feitas', coalesce((select jsonb_agg(x) from (
        select f.dono,
               count(*) filter (where f.dia_feita = org_hoje()) as hoje,
               count(*) filter (where f.feita_em >= now() - interval '7 days') as n7,
               count(*) filter (where f.feita_em >= now() - interval '30 days') as n30,
               count(*) filter (where f.feita_em >= now() - interval '7 days' and f.prazo is not null) as cp7,
               count(*) filter (where f.feita_em >= now() - interval '30 days' and f.prazo is not null) as cp30,
               count(*) filter (where f.feita_em >= now() - interval '7 days' and f.dia_feita <= f.prazo) as np7,
               count(*) filter (where f.feita_em >= now() - interval '30 days' and f.dia_feita <= f.prazo) as np30,
               round((avg(extract(epoch from f.feita_em - f.created_at)) filter (where f.feita_em >= now() - interval '7 days') / 86400)::numeric, 1) as dias7,
               round((avg(extract(epoch from f.feita_em - f.created_at)) filter (where f.feita_em >= now() - interval '30 days') / 86400)::numeric, 1) as dias30,
               count(*) filter (where f.feita_em >= now() - interval '7 days' and f.conf_hist @> '[{"a": "devolvida"}]') as dev7,
               count(*) filter (where f.feita_em >= now() - interval '30 days' and f.conf_hist @> '[{"a": "devolvida"}]') as dev30
          from feitas f group by f.dono) x), '[]'::jsonb),
    -- concluídas por semana nas últimas 8 semanas (s = 0 é a semana mais recente)
    'semanas', coalesce((select jsonb_agg(x) from (
        select f.dono, floor(extract(epoch from now() - f.feita_em) / 604800)::int as s, count(*) as n
          from feitas f group by 1, 2) x), '[]'::jsonb)
  );
$$;
revoke all on function org_painel_equipe() from public, anon, authenticated;

-- "Assinatura" das tarefas de uma tela: muda quando alguma tarefa visível é criada, alterada ou excluída,
-- quando uma nota do mural muda e na virada do dia (tarefas agendadas aparecem). O gestor acompanha todas.
create or replace function org_assinatura(p_dono uuid, p_gestor boolean)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select (select count(*)::text || '|' || coalesce(max(t.updated_at)::text, '') from org_tarefas t
           where p_gestor or (t.dono is not distinct from p_dono and (t.aparece_em is null or t.aparece_em <= org_hoje())))
         || '|' || (select count(*)::text || '|' || coalesce(max(n.updated_at)::text, '') from org_notas n where n.dono is not distinct from p_dono)
         || '|' || org_hoje()::text;
$$;
revoke all on function org_assinatura(uuid, boolean) from public, anon, authenticated;

-- Carrega a tela. p_equipe (só para o gestor) diz quanto da aba "Tarefas da equipe" vem junto:
--   0 = nada (só o número de tarefas esperando conferência), 1 = em aberto + concluídas nos últimos 30 dias, 2 = todas
create or replace function org_carregar(p_pin text, p_pessoa uuid, p_equipe int)
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
    'tarefas', coalesce((select jsonb_agg(to_jsonb(t) order by t.prazo nulls last, t.created_at) from org_tarefas t where t.dono is not distinct from ac.o_dono
                           and (ac.o_gestor or t.aparece_em is null or t.aparece_em <= org_hoje())), '[]'::jsonb),
    'lembretes', coalesce((select jsonb_agg(to_jsonb(l) order by l.data, l.hora nulls first) from org_lembretes l where l.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'rotinas', case when ac.o_gestor then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from org_rotinas r), '[]'::jsonb) else '[]'::jsonb end,
    'etiquetas', coalesce((select jsonb_agg(to_jsonb(e) order by e.nome) from org_etiquetas e where e.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'colunas', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem, c.created_at) from org_colunas c where c.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'anotacoes', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from org_anotacoes x join org_tarefas t on t.id = x.tarefa_id where t.dono is not distinct from ac.o_dono
                             and (ac.o_gestor or t.aparece_em is null or t.aparece_em <= org_hoje())), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(to_jsonb(m) order by m.nome) from org_modelos m where m.dono is not distinct from ac.o_dono), '[]'::jsonb),
    'ordem', true,
    'checklist', true,
    'arquivar_livre', true,
    'equipe', true,
    'conferencia', true,
    'agenda', true,
    'nota_titulo', true,
    'ordem_lista', true,
    'lote', true,
    'aniversarios', case when ac.o_gestor then coalesce((select jsonb_agg(to_jsonb(a) order by a.mes, a.dia, lower(a.nome)) from org_aniversarios a), '[]'::jsonb) end,
    'assinatura', org_assinatura(ac.o_dono, ac.o_gestor),
    'txt_modelos', coalesce((select jsonb_agg(to_jsonb(m) order by lower(m.nome)) from org_txt_modelos m), '[]'::jsonb),
    'txt_categorias', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem, lower(c.nome)) from org_txt_categorias c), '[]'::jsonb),
    'txt_meus', (select to_jsonb(x) from org_txt_meus x where x.dono is not distinct from ac.o_dono),
    'txt_cidade', (select txt_cidade from org_config where id = 1)
  );
  if ac.o_gestor then
    res := res || jsonb_build_object(
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'ativo', p.ativo) order by lower(p.nome)) from org_pessoas p), '[]'::jsonb),
      'equipe_conferir', (select count(*) from org_tarefas t where t.dono is not null and t.conferencia = 'enviada' and t.arquivada_em is null)
    );
  end if;
  if ac.o_gestor and coalesce(p_equipe, 2) > 0 then
    res := res || jsonb_build_object(
      'equipe_completa', coalesce(p_equipe, 2) >= 2,
      'equipe_tarefas', coalesce((select jsonb_agg(to_jsonb(t) order by t.prazo nulls last, t.created_at) from org_tarefas t
                                   where t.dono is not null and (t.do_gestor or t.conferencia is not null) and t.arquivada_em is null
                                     and (coalesce(p_equipe, 2) >= 2 or t.etapa <> 'feito' or t.conferencia = 'enviada'
                                          or coalesce(t.feita_em, t.updated_at) >= now() - interval '30 days')), '[]'::jsonb),
      'equipe_colunas', coalesce((select jsonb_agg(jsonb_build_object('dono', c.dono, 'chave', c.chave, 'nome', c.nome)) from org_colunas c where c.dono is not null), '[]'::jsonb),
      -- modelos de cartão do próprio gestor, para o "passo a passo" ao mandar tarefa
      'equipe_modelos', coalesce((select jsonb_agg(to_jsonb(m) order by m.nome) from org_modelos m where m.dono is null), '[]'::jsonb),
      'equipe_painel', org_painel_equipe()
    );
  end if;
  return res;
end;
$$;

-- Processo repetido: antes de mandar uma tarefa, o gestor vê se o processo já está com alguém.
-- Compara só os números (com ou sem pontos e traço) e devolve as tarefas não concluídas e não arquivadas,
-- de qualquer tela (dono vazio = o próprio gestor), com o nome da coluna em que estão.
create or replace function org_processo_em_uso(p_pin text, p_pessoa uuid, p_processo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  dig text := regexp_replace(coalesce(p_processo, ''), '\D', '', 'g');
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  -- Gestor e equipe: avisa quando o processo já tem tarefa em aberto com alguém
  if length(dig) <> 20 then
    return jsonb_build_object('status', 'ok', 'tarefas', '[]'::jsonb);
  end if;
  return jsonb_build_object('status', 'ok', 'tarefas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'dono', t.dono, 'dono_nome', pe.nome, 'titulo', t.titulo, 'etapa', t.etapa, 'prazo', t.prazo,
             'conferencia', t.conferencia, 'coluna', c.nome, 'created_at', t.created_at, 'aparece_em', t.aparece_em)
           order by t.created_at)
      from org_tarefas t
      left join org_colunas c on c.dono is not distinct from t.dono and c.chave = t.etapa
      left join org_pessoas pe on pe.id = t.dono
     where t.etapa <> 'feito' and t.arquivada_em is null
       and t.processo <> '' and regexp_replace(t.processo, '\D', '', 'g') = dig), '[]'::jsonb));
end;
$$;

-- Consulta leve que o site faz a cada minuto: devolve só a assinatura da tela, as tarefas urgentes
-- em aberto que o gestor mandou e, para o gestor, as que esperam conferência (para tocar o aviso
-- quando chega uma nova). Nada mais é lido.
create or replace function org_novidades(p_pin text, p_pessoa uuid)
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
  return jsonb_build_object(
    'status', 'ok',
    'assinatura', org_assinatura(ac.o_dono, ac.o_gestor),
    'urgentes', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo)) from org_tarefas t
                           where t.dono is not distinct from ac.o_dono and t.do_gestor and t.prioridade = 'urgente'
                             and t.etapa <> 'feito' and t.arquivada_em is null
                             and (t.aparece_em is null or t.aparece_em <= org_hoje())), '[]'::jsonb),
    -- gestor: tarefas da equipe esperando a conferência dele (para tocar o aviso quando chega uma nova)
    'conferir', case when ac.o_gestor then coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'dono', t.dono)) from org_tarefas t
                           where t.dono is not null and t.conferencia = 'enviada' and t.arquivada_em is null), '[]'::jsonb) end);
end;
$$;

-- Título do post-it (vazio = sem título). A nota é salva como sempre por org_salvar_nota.
create or replace function org_titulo_nota(p_pin text, p_pessoa uuid, p_id uuid, p_titulo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  achou uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  update org_notas set titulo = left(btrim(coalesce(p_titulo, '')), 80), updated_at = now()
   where id = p_id and dono is not distinct from ac.o_dono
  returning id into achou;
  if achou is null then
    return jsonb_build_object('status', 'erro', 'message', 'Esta nota não existe mais.');
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Lista "Tarefas e mural": recebe as tarefas de um grupo na nova ordem (não mexe na ordem do Quadro)
create or replace function org_ordenar_lista(p_pin text, p_pessoa uuid, p_ids uuid[])
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
  update org_tarefas t set ordem_lista = x.pos * 10
    from unnest(p_ids) with ordinality as x(id, pos)
   where t.id = x.id and t.dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------- tarefas em lote (só o gestor) ----------
-- Manda várias tarefas de uma vez, numa operação só: ou entram todas, ou nenhuma.
-- p_itens: [{"titulo", "processo", "prazo" (aaaa-mm-dd), "prioridade", "para" (id da pessoa), "aparece" (aaaa-mm-dd)}, ...]
-- p_checklist (passo a passo) e p_modelo (modelo de texto) valem para todas.
create or replace function org_mandar_lote(p_pin text, p_pessoa uuid, p_itens jsonb, p_checklist jsonb, p_modelo uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  it jsonb;
  pr text;
  ap date;
  n int := 0;
  ck jsonb := case when jsonb_typeof(p_checklist) = 'array' then p_checklist else '[]'::jsonb end;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor manda tarefas para a equipe.');
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    return jsonb_build_object('status', 'erro', 'message', 'Nenhuma tarefa para mandar.');
  end if;
  if jsonb_array_length(p_itens) > 100 then
    return jsonb_build_object('status', 'erro', 'message', 'Mande no máximo 100 tarefas por vez.');
  end if;
  -- confere tudo antes de gravar qualquer coisa
  for it in select * from jsonb_array_elements(p_itens) loop
    if btrim(coalesce(it->>'titulo', '')) = '' then
      return jsonb_build_object('status', 'erro', 'message', 'Há uma linha sem tarefa.');
    end if;
    if not exists (select 1 from org_pessoas where id::text = it->>'para' and ativo) then
      return jsonb_build_object('status', 'erro', 'message', 'A tarefa "' || left(it->>'titulo', 60) || '" está para uma pessoa que não está ativa.');
    end if;
  end loop;
  for it in select * from jsonb_array_elements(p_itens) loop
    pr := case when it->>'prioridade' in ('baixa', 'normal', 'alta', 'urgente') then it->>'prioridade' else 'normal' end;
    ap := nullif(it->>'aparece', '')::date;
    insert into org_tarefas (dono, do_gestor, titulo, prazo, prioridade, urgente, responsavel, processo, etapa, aparece_em, checklist, modelo_texto)
    values ((it->>'para')::uuid, true, left(btrim(it->>'titulo'), 160), nullif(it->>'prazo', '')::date, pr, pr = 'urgente', '',
            left(coalesce(it->>'processo', ''), 40), 'afazer', case when ap > org_hoje() then ap end, ck,
            case when exists (select 1 from org_txt_modelos m where m.id = p_modelo) then p_modelo end);
    n := n + 1;
  end loop;
  return jsonb_build_object('status', 'ok', 'n', n);
end;
$$;

-- Processo repetido para uma lista inteira: devolve, para cada número que já está numa tarefa não concluída, com quem está
create or replace function org_processos_em_uso(p_pin text, p_pessoa uuid, p_processos text[])
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
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor confere processos repetidos.');
  end if;
  return jsonb_build_object('status', 'ok', 'tarefas', coalesce((
    select jsonb_agg(jsonb_build_object('processo', regexp_replace(t.processo, '\D', '', 'g'), 'dono', t.dono, 'titulo', t.titulo,
                                        'coluna', c.nome, 'conferencia', t.conferencia, 'aparece_em', t.aparece_em) order by t.created_at)
      from org_tarefas t
      left join org_colunas c on c.dono is not distinct from t.dono and c.chave = t.etapa
     where t.etapa <> 'feito' and t.arquivada_em is null and t.processo <> ''
       and regexp_replace(t.processo, '\D', '', 'g') = any (select regexp_replace(x, '\D', '', 'g') from unnest(p_processos) x)), '[]'::jsonb));
end;
$$;

-- Passa tarefas (em aberto) de uma pessoa para outra: entram em "A fazer" da nova pessoa, sem as etiquetas
-- (cada tela tem as suas); checklist e anotações vão junto; se estavam em conferência, a conferência é cancelada.
create or replace function org_passar_tarefas(p_pin text, p_pessoa uuid, p_ids uuid[], p_destino uuid)
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
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor passa tarefas de uma pessoa para outra.');
  end if;
  if not exists (select 1 from org_pessoas where id = p_destino and ativo) then
    return jsonb_build_object('status', 'erro', 'message', 'Escolha uma pessoa ativa para receber as tarefas.');
  end if;
  update org_tarefas
     set conf_hist = case when conferencia = 'enviada'
                          then coalesce(conf_hist, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('a', 'cancelada', 'em', now(), 't', 'Tarefa passada para outra pessoa'))
                          else conf_hist end,
         conferencia = case when conferencia = 'enviada' then null else conferencia end,
         dono = p_destino, do_gestor = true, etapa = 'afazer', posicao = null, ordem_lista = null, etiquetas = '{}', updated_at = now()
   where id = any (p_ids) and dono is not null and dono <> p_destino and etapa <> 'feito' and arquivada_em is null;
  get diagnostics n = row_count;
  return jsonb_build_object('status', 'ok', 'n', n);
end;
$$;

-- Muda prazo e/ou prioridade de várias tarefas da equipe. p_mudar_prazo = true aplica p_prazo (vazio tira o prazo).
create or replace function org_alterar_lote(p_pin text, p_pessoa uuid, p_ids uuid[], p_mudar_prazo boolean, p_prazo date, p_prioridade text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  pr text := case when p_prioridade in ('baixa', 'normal', 'alta', 'urgente') then p_prioridade end;
  n int;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor altera tarefas em lote.');
  end if;
  update org_tarefas
     set prazo = case when coalesce(p_mudar_prazo, false) then p_prazo else prazo end,
         prioridade = coalesce(pr, prioridade), urgente = coalesce(pr, prioridade) = 'urgente', updated_at = now()
   where id = any (p_ids) and dono is not null and etapa <> 'feito' and arquivada_em is null;
  get diagnostics n = row_count;
  return jsonb_build_object('status', 'ok', 'n', n);
end;
$$;

-- Exclui várias tarefas da equipe (as anotações vão junto)
create or replace function org_excluir_lote(p_pin text, p_pessoa uuid, p_ids uuid[])
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
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor exclui tarefas em lote.');
  end if;
  delete from org_tarefas where id = any (p_ids) and dono is not null;
  get diagnostics n = row_count;
  return jsonb_build_object('status', 'ok', 'n', n);
end;
$$;

-- Aniversariantes: o gestor cadastra, muda e exclui
create or replace function org_salvar_aniversario(p_pin text, p_pessoa uuid, p_id uuid, p_nome text, p_dia int, p_mes int, p_obs text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  nome_ok text := left(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), 80);
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor cadastra aniversariantes.');
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Escreva o nome.');
  end if;
  -- confere o dia do mês (29/02 vale)
  if p_mes is null or p_dia is null or p_mes not between 1 and 12 or p_dia < 1
     or p_dia > extract(day from (make_date(2024, p_mes, 1) + interval '1 month - 1 day')) then
    return jsonb_build_object('status', 'erro', 'message', 'Data inválida. Use dia e mês, por exemplo 15/10.');
  end if;
  if p_id is null then
    insert into org_aniversarios (nome, dia, mes, obs) values (nome_ok, p_dia, p_mes, left(btrim(coalesce(p_obs, '')), 60))
    returning id into novo;
  else
    update org_aniversarios set nome = nome_ok, dia = p_dia, mes = p_mes, obs = left(btrim(coalesce(p_obs, '')), 60)
     where id = p_id returning id into novo;
    if novo is null then
      return jsonb_build_object('status', 'erro', 'message', 'Este aniversariante não existe mais.');
    end if;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_aniversario(p_pin text, p_pessoa uuid, p_id uuid)
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
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor exclui aniversariantes.');
  end if;
  delete from org_aniversarios where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Barra do site (sem senha): só os aniversariantes do mês atual, no horário de Cuiabá
create or replace function org_aniversariantes_mes()
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object('status', 'ok', 'hoje', org_hoje(), 'lista', coalesce(
    (select jsonb_agg(jsonb_build_object('nome', a.nome, 'dia', a.dia, 'obs', a.obs) order by a.dia, lower(a.nome))
       from org_aniversarios a where a.mes = extract(month from org_hoje())::int), '[]'::jsonb));
$$;

-- O gestor manda uma tarefa agendada: grava já com a data em que ela aparece para a pessoa
-- (numa operação só, para a tarefa nunca aparecer antes da hora). Data de hoje ou passada = aparece já.
create or replace function org_mandar_tarefa(
  p_pin text, p_pessoa uuid, p_titulo text, p_prazo date, p_prioridade text, p_processo text, p_aparece_em date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  pr text := case when p_prioridade in ('baixa', 'normal', 'alta', 'urgente') then p_prioridade else 'normal' end;
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not ac.o_gestor or ac.o_dono is null then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor manda tarefas para a equipe.');
  end if;
  insert into org_tarefas (dono, do_gestor, titulo, prazo, prioridade, urgente, responsavel, processo, etapa, aparece_em)
  values (ac.o_dono, true, coalesce(p_titulo, ''), p_prazo, pr, pr = 'urgente', '', coalesce(p_processo, ''), 'afazer',
          case when p_aparece_em > org_hoje() then p_aparece_em end)
  returning id into novo;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

-- Muda (ou tira, com p_aparece_em vazio) a data em que a tarefa aparece para a pessoa. Só o gestor.
create or replace function org_agendar_tarefa(p_pin text, p_pessoa uuid, p_id uuid, p_aparece_em date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  achou uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor agenda tarefas.');
  end if;
  update org_tarefas
     set aparece_em = case when p_aparece_em > org_hoje() then p_aparece_em end, updated_at = now()
   where id = p_id and dono is not distinct from ac.o_dono
  returning id into achou;
  if achou is null then
    return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não existe mais.');
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Versão de antes (o site antigo ainda chama esta): tela + aba da equipe completa
create or replace function org_listar(p_pin text, p_pessoa uuid)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select org_carregar(p_pin, p_pessoa, 2);
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
    if not ac.o_gestor and p_etapa is not null and exists (
         select 1 from org_tarefas where id = p_id and dono is not distinct from ac.o_dono and conferencia = 'enviada' and etapa <> p_etapa) then
      return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.');
    end if;
    update org_tarefas
       set titulo = coalesce(p_titulo, titulo), prazo = p_prazo,
           prioridade = coalesce(pr, prioridade), urgente = coalesce(pr, prioridade) = 'urgente',
           -- o gestor levou para Feito uma tarefa que esperava conferência: conta como aprovada
           conferencia = case when conferencia = 'enviada' and coalesce(p_etapa, etapa) = 'feito' then 'aprovada' else conferencia end,
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
  if not ac.o_gestor and exists (select 1 from org_tarefas where id = p_id and conferencia = 'enviada') then
    return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.');
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

-- Conferência da tarefa de uma pessoa:
--   enviar / cancelar: a pessoa (ou o gestor na tela dela) manda para conferir ou desiste do envio
--   aprovar / devolver: só o gestor; nos dois casos a tarefa continua na coluna em que estava
--   (aprovada ganha o selo "Conferida"; devolvida leva o motivo)
create or replace function org_conferencia(p_pin text, p_pessoa uuid, p_id uuid, p_acao text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  t org_tarefas%rowtype;
  txt text := left(btrim(coalesce(p_texto, '')), 1000);
  novo text;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  select * into t from org_tarefas where id = p_id and ac.o_dono is not null and dono = ac.o_dono for update;
  if not found then
    return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não existe mais.');
  end if;
  if p_acao = 'enviar' then
    if t.conferencia = 'enviada' then
      return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa já está em conferência.');
    end if;
    if t.etapa = 'feito' or t.arquivada_em is not null then
      return jsonb_build_object('status', 'erro', 'message', 'Tarefa concluída ou arquivada não vai para conferência.');
    end if;
    novo := 'enviada';
  elsif p_acao = 'cancelar' then
    if t.conferencia is distinct from 'enviada' then
      return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não está em conferência.');
    end if;
    novo := null;
  elsif p_acao in ('aprovar', 'devolver') then
    if not ac.o_gestor then
      return jsonb_build_object('status', 'erro', 'message', 'Só o gestor confere as tarefas.');
    end if;
    if t.conferencia is distinct from 'enviada' then
      return jsonb_build_object('status', 'erro', 'message', 'Esta tarefa não está esperando conferência.');
    end if;
    if p_acao = 'devolver' and txt = '' then
      return jsonb_build_object('status', 'erro', 'message', 'Escreva o motivo da devolução.');
    end if;
    novo := case p_acao when 'aprovar' then 'aprovada' else 'devolvida' end;
  else
    return jsonb_build_object('status', 'erro', 'message', 'Ação desconhecida.');
  end if;
  update org_tarefas
     set conferencia = novo,
         conf_hist = coalesce(conf_hist, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('a', coalesce(novo, 'cancelada'), 'em', now(), 't', txt)),
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('status', 'ok', 'conferencia', novo);
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

-- ---------- modelos de texto ----------
create or replace function org_txt_salvar_modelo(p_pin text, p_pessoa uuid, p_id uuid, p_nome text, p_categoria text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  nome_ok text := left(btrim(coalesce(p_nome, '')), 80);
  quem text;
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um nome ao modelo.');
  end if;
  quem := case when ac.o_gestor then 'Gestor' else coalesce((select nome from org_pessoas where id = ac.o_dono), '') end;
  if p_id is null then
    insert into org_txt_modelos (nome, categoria, texto, alterado_por)
    values (nome_ok, left(btrim(coalesce(p_categoria, '')), 40), left(coalesce(p_texto, ''), 20000), quem)
    returning id into novo;
  else
    update org_txt_modelos
       set nome = nome_ok, categoria = left(btrim(coalesce(p_categoria, categoria)), 40),
           texto = left(coalesce(p_texto, texto), 20000), alterado_por = quem, updated_at = now()
     where id = p_id
    returning id into novo;
    if novo is null then
      return jsonb_build_object('status', 'erro', 'message', 'Este modelo não existe mais.');
    end if;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_txt_excluir_modelo(p_pin text, p_pessoa uuid, p_id uuid)
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
  delete from org_txt_modelos where id = p_id;
  update org_txt_meus set favoritos = array_remove(favoritos, p_id) where p_id = any(favoritos);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Conta mais um uso (ao copiar o texto)
create or replace function org_txt_usar(p_pin text, p_pessoa uuid, p_id uuid)
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
  update org_txt_modelos set usos = usos + 1 where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Assinatura e favoritos da tela em uso (cria a linha na primeira vez)
create or replace function org_txt_meus_dados(p_pin text, p_pessoa uuid, p_nome text, p_cargo text, p_cidade text, p_favorito uuid, p_fav boolean)
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
  insert into org_txt_meus (dono)
  select ac.o_dono where not exists (select 1 from org_txt_meus where dono is not distinct from ac.o_dono);
  update org_txt_meus
     set nome = coalesce(left(btrim(p_nome), 80), nome),
         cargo = coalesce(left(btrim(p_cargo), 120), cargo),
         cidade = coalesce(left(btrim(p_cidade), 60), cidade),
         favoritos = case when p_favorito is null then favoritos
                          when coalesce(p_fav, true) then array_append(array_remove(favoritos, p_favorito), p_favorito)
                          else array_remove(favoritos, p_favorito) end
   where dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Liga (ou desliga, com p_modelo vazio) um modelo de texto à tarefa
create or replace function org_tarefa_modelo_texto(p_pin text, p_pessoa uuid, p_id uuid, p_modelo uuid)
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
  if p_modelo is not null and not exists (select 1 from org_txt_modelos where id = p_modelo) then
    return jsonb_build_object('status', 'erro', 'message', 'Este modelo de texto não existe mais.');
  end if;
  update org_tarefas set modelo_texto = p_modelo, updated_at = now()
   where id = p_id and dono is not distinct from ac.o_dono;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Cidade que vai em todos os documentos (só o gestor muda)
create or replace function org_txt_cidade(p_pin text, p_pessoa uuid, p_cidade text)
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
  update org_config set txt_cidade = left(btrim(coalesce(p_cidade, '')), 60) where id = 1;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Cria (p_id vazio) ou renomeia uma categoria; renomear leva os modelos junto
create or replace function org_txt_salvar_categoria(p_pin text, p_pessoa uuid, p_id uuid, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  nome_ok text := left(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), 40);
  antigo text;
  novo uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if nome_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um nome à categoria.');
  end if;
  if exists (select 1 from org_txt_categorias where lower(nome) = lower(nome_ok) and id is distinct from p_id) then
    return jsonb_build_object('status', 'erro', 'message', 'Já existe uma categoria com esse nome.');
  end if;
  if p_id is null then
    insert into org_txt_categorias (nome, ordem)
    values (nome_ok, (select coalesce(max(ordem), 0) + 10 from org_txt_categorias))
    returning id into novo;
  else
    select nome into antigo from org_txt_categorias where id = p_id;
    update org_txt_categorias set nome = nome_ok where id = p_id returning id into novo;
    if antigo is not null then
      update org_txt_modelos set categoria = nome_ok where categoria = antigo;
    end if;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_txt_excluir_categoria(p_pin text, p_pessoa uuid, p_id uuid)
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
  select count(*) into n from org_txt_modelos m join org_txt_categorias c on c.nome = m.categoria where c.id = p_id;
  if n > 0 then
    return jsonb_build_object('status', 'erro', 'message', 'Há ' || n || case when n = 1 then ' modelo' else ' modelos' end || ' nesta categoria. Mude a categoria deles antes de excluir.');
  end if;
  delete from org_txt_categorias where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function org_txt_salvar_modelo(text, uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function org_txt_excluir_modelo(text, uuid, uuid) to anon, authenticated;
grant execute on function org_txt_usar(text, uuid, uuid) to anon, authenticated;
grant execute on function org_txt_meus_dados(text, uuid, text, text, text, uuid, boolean) to anon, authenticated;
grant execute on function org_txt_cidade(text, uuid, text) to anon, authenticated;
grant execute on function org_tarefa_modelo_texto(text, uuid, uuid, uuid) to anon, authenticated;
grant execute on function org_txt_salvar_categoria(text, uuid, uuid, text) to anon, authenticated;
grant execute on function org_txt_excluir_categoria(text, uuid, uuid) to anon, authenticated;
grant execute on function org_pessoas_publico() to anon, authenticated;
grant execute on function org_listar(text, uuid) to anon, authenticated;
grant execute on function org_carregar(text, uuid, int) to anon, authenticated;
grant execute on function org_processo_em_uso(text, uuid, text) to anon, authenticated;
grant execute on function org_novidades(text, uuid) to anon, authenticated;
grant execute on function org_titulo_nota(text, uuid, uuid, text) to anon, authenticated;
grant execute on function org_ordenar_lista(text, uuid, uuid[]) to anon, authenticated;
grant execute on function org_mandar_lote(text, uuid, jsonb, jsonb, uuid) to anon, authenticated;
grant execute on function org_processos_em_uso(text, uuid, text[]) to anon, authenticated;
grant execute on function org_passar_tarefas(text, uuid, uuid[], uuid) to anon, authenticated;
grant execute on function org_alterar_lote(text, uuid, uuid[], boolean, date, text) to anon, authenticated;
grant execute on function org_excluir_lote(text, uuid, uuid[]) to anon, authenticated;
grant execute on function org_salvar_aniversario(text, uuid, uuid, text, int, int, text) to anon, authenticated;
grant execute on function org_excluir_aniversario(text, uuid, uuid) to anon, authenticated;
grant execute on function org_aniversariantes_mes() to anon, authenticated;
grant execute on function org_mandar_tarefa(text, uuid, text, date, text, text, date) to anon, authenticated;
grant execute on function org_agendar_tarefa(text, uuid, uuid, date) to anon, authenticated;
grant execute on function org_salvar_nota(text, uuid, uuid, text, text, boolean) to anon, authenticated;
grant execute on function org_excluir_nota(text, uuid, uuid) to anon, authenticated;
grant execute on function org_salvar_tarefa(text, uuid, uuid, text, date, text, text, text, timestamptz, text) to anon, authenticated;
grant execute on function org_concluir_tarefa(text, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function org_excluir_tarefa(text, uuid, uuid) to anon, authenticated;
grant execute on function org_conferencia(text, uuid, uuid, text, text) to anon, authenticated;
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
