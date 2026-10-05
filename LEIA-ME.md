# Agenda 2ª Vara — versão para hospedar você mesmo (Supabase + Vercel/GitHub Pages)

Esta versão do arquivo (`agenda_supabase.html`) usa o [Supabase](https://supabase.com) como
banco de dados, para que **qualquer pessoa com o link** possa acessar — sem precisar estar
logada na sua conta do Claude.

## Passo 1 — Criar o projeto no Supabase (gratuito)

1. Acesse https://supabase.com e crie uma conta (dá para usar login do Google/GitHub).
2. Clique em **New project**, escolha um nome (ex: `agenda-2vara`) e uma senha de banco
   (guarde essa senha em lugar seguro, mas você não vai precisar dela para o site).
3. Aguarde ~2 minutos enquanto o projeto é criado.

## Passo 2 — Criar as tabelas

1. No painel do projeto, vá em **SQL Editor** (ícone no menu lateral).
2. Clique em **New query**, cole o código abaixo e clique em **Run**:

```sql
create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text default '',
  phones jsonb default '[]'::jsonb,
  emails jsonb default '[]'::jsonb,
  category text default '',
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

-- Libera acesso público de leitura e escrita (qualquer pessoa com o link do site)
alter table contacts enable row level security;
alter table categories enable row level security;

create policy "public read contacts" on contacts for select using (true);
create policy "public write contacts" on contacts for insert with check (true);
create policy "public update contacts" on contacts for update using (true);
create policy "public delete contacts" on contacts for delete using (true);

create policy "public read categories" on categories for select using (true);
create policy "public write categories" on categories for insert with check (true);
create policy "public update categories" on categories for update using (true);
create policy "public delete categories" on categories for delete using (true);

-- Ativa atualização em tempo real (para todo mundo ver as mudanças na hora)
alter publication supabase_realtime add table contacts;
alter publication supabase_realtime add table categories;
```

> ⚠️ **Atenção de segurança:** essas políticas deixam o banco **totalmente aberto** — qualquer
> pessoa que descobrir a URL do seu projeto Supabase (não só o link do site) pode ler, criar,
> editar e apagar contatos, mesmo sem abrir o site. Isso é intencional, porque você pediu acesso
> livre para qualquer pessoa. Se depois quiser restringir (por exemplo, exigir login), me avise
> que eu ajusto o código para usar autenticação do Supabase.

## Passo 2.1 — Tabela de Audiências (portal)

O site agora é um **portal** com menu lateral: **Agenda** (contatos) e **Audiências**.
Para a seção de Audiências funcionar, rode também este SQL no **SQL Editor** do Supabase
(só precisa rodar uma vez):

```sql
create table audiencias (
  id uuid primary key default gen_random_uuid(),
  processo text not null default '',
  data_hora timestamptz not null,
  tipo text default '',
  status text not null default 'A cumprir',   -- A cumprir, Cumprida, Redesignada, Cancelada
  observacoes text default '',
  conferida_em timestamptz,                  -- data/hora em que foi marcada como conferida
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index audiencias_data_hora_idx on audiencias (data_hora);

alter table audiencias enable row level security;

create policy "public read audiencias" on audiencias for select using (true);
create policy "public write audiencias" on audiencias for insert with check (true);
create policy "public update audiencias" on audiencias for update using (true);
create policy "public delete audiencias" on audiencias for delete using (true);

alter publication supabase_realtime add table audiencias;
```

> ⚠️ Assim como os contatos, essas políticas deixam as audiências **abertas para qualquer
> pessoa** que tenha a URL do Supabase. Como a pauta traz números de processo, considere
> ativar login (Supabase Auth) — é só pedir que o código é ajustado.

Se a tabela ainda não existir, a tela de Audiências mostra um aviso pedindo para rodar este SQL.

Para mudar a lista de status, edite `STATUSES` no `index.html` (o primeiro da lista é o padrão de uma audiência nova).

## Passo 2.2 — Coluna "conferida" (para quem já criou a tabela antes)

Se a tabela `audiencias` foi criada antes da opção **Conferir**, rode também:

```sql
alter table audiencias add column if not exists conferida_em timestamptz;
```

## Passo 2.3 — Organização (tarefas, mural, quadro, lembretes e rotinas) com senha

A seção **Organização** fica protegida por uma senha de 6 números. Quem confere a senha é o
próprio Supabase: sem ela, o banco não entrega nem grava nada da Organização, mesmo para quem
tem o endereço do projeto. A senha fica guardada criptografada e **não aparece no código do site**.

1. Abra o arquivo [`sql/organizacao.sql`](sql/organizacao.sql) no GitHub, clique em **Raw** e copie
   tudo (Ctrl+A, Ctrl+C). Não copie de visualizadores que formatam o texto: eles podem apagar os
   símbolos `$$` e o SQL dá erro. Para conferir, o texto colado deve ter `as $$` 10 vezes.
2. No Supabase, vá em **SQL Editor → New query** e cole.
3. Procure a linha marcada com `<<< SENHA` e troque `000000` pela senha de 6 números.
4. Clique em **Run**. Deve aparecer "Success".

**Atualizar** (quando o arquivo ganhar novidades, como as abas Quadro, Lembretes e Rotinas):
rode o arquivo inteiro de novo do mesmo jeito. Nada é apagado e a senha atual continua valendo;
não precisa mexer na linha `<<< SENHA`.

Detalhes:
- Após **5 tentativas erradas**, a Organização fica bloqueada por **5 minutos**.
- Depois de digitar a senha, o navegador lembra dela até a aba ser fechada. O botão **Trancar** pede a senha de novo.
- A Organização não atualiza sozinha quando outra pessoa altera; recarregue a página.

**Trocar a senha (ou criar uma nova se esquecer)** — rode no SQL Editor, trocando `000000`:

```sql
update org_config set pin_hash = extensions.crypt('000000', extensions.gen_salt('bf')), tentativas = 0, bloqueado_ate = null where id = 1;
```

Os dados do mural e das tarefas não são apagados ao trocar a senha.

## Passo 2.4 — Perícias

A seção **Perícias** acompanha cada perícia da nomeação até o laudo juntado:
**Não agendada → Agendada → Realizada → Laudo juntado** (ou **Cancelada**).

1. No GitHub, abra [`sql/pericias.sql`](sql/pericias.sql), clique em **Raw** e copie tudo (Ctrl+A, Ctrl+C).
2. No Supabase, vá em **SQL Editor → New query**, cole e clique em **Run**.

Pode rodar de novo sem perder nada. O acesso é igual ao das audiências (aberto para quem usa o site).

Como funciona:
- Ao marcar como **Realizada**, o site calcula o **prazo do laudo: 30 dias úteis** a partir do dia
  seguinte à realização. Não contam sábados, domingos, feriados nacionais (inclusive Carnaval,
  Sexta-feira Santa e Corpus Christi) e o recesso forense de 20/12 a 20/01.
- Feriados estaduais ou municipais podem ser acrescentados na lista `FERIADOS_EXTRAS` do
  `index.html` (formato `"MM-DD"`, por exemplo `"11-08"`).
- Cada mudança de situação entra sozinha no **Andamento** da perícia; também dá para registrar
  andamentos à mão.
- **Peritos:** a aba **Peritos** (dentro de Perícias) tem o cadastro próprio de peritos, separado da Agenda: nome,
  especialidade, telefone, e-mail e observações. No cadastro da perícia, o perito é escolhido numa lista (ou cadastrado
  ali mesmo em "+ Cadastrar novo perito…"), e a especialidade é preenchida sozinha. Ao renomear um perito, as perícias
  dele passam a usar o nome novo. O SQL traz para o cadastro os peritos já usados nas perícias.
- Cada perícia tem o **Nome do autor** em destaque e o perito logo abaixo. Se a tabela foi criada antes desse
  campo, rode no SQL Editor: `alter table pericias add column if not exists autor text not null default '';`
- Ao marcar **Laudo juntado** (pela situação, pela alteração em lote ou pelo atalho "Laudo juntado (concluir)" do
  andamento), a perícia vai para a aba **Concluídas**, um histórico agrupado por mês. As canceladas também ficam lá.
- **Cadastrar várias de uma vez:** no formulário, escolha "Várias de uma vez", informe o perito, a data, a hora da
  primeira e o intervalo (10 minutos por padrão) e cole os processos, um por linha (nº do processo, nome do autor e,
  se quiser, a hora). A prévia mostra o horário de cada uma e avisa linhas com problema.
- **Processo repetido:** se o processo já tiver perícia em andamento, o site avisa antes de cadastrar (no cadastro
  individual pede confirmação; no lote a linha fica de fora, a menos que você marque "cadastrar mesmo assim").
- **Alterar em lote:** marque as caixinhas das perícias (ou use "Selecionar" no título de cada dia), escolha a
  nova situação e a data na barra que aparece embaixo e clique em **Aplicar**. Cada perícia recebe o andamento
  e, se for "Realizada", o prazo do laudo calculado a partir da data informada.
  Ao reagendar em lote, informe a hora da primeira e o intervalo: as perícias recebem horários em sequência.

## Busca e número do processo

- **Busca geral:** o campo "Buscar processo ou nome", no topo do menu lateral (no celular, a lupa no topo da tela),
  procura de uma vez em perícias (em andamento e concluídas), audiências, contatos da Agenda e, com a Organização
  destrancada, nas tarefas. Aceita o número do processo com ou sem pontuação, ou só um pedaço dele, e nomes.
  Atalho: **Ctrl+K** ou **/**.
- **Número do processo:** nos campos de processo, os pontos e o traço entram sozinhos enquanto se digita
  (padrão CNJ `0000000-00.0000.0.00.0000`), também ao colar.

### Como adicionar novas seções ao portal depois

No `index.html`, cada seção tem três partes (Agenda, Audiências e Organização seguem esse padrão):
1. um link no menu lateral (`<a class="nav-item" href="#nome" data-route="nome">`);
2. um bloco `<section id="view-nome" hidden>` com o conteúdo;
3. uma entrada em `ROUTES` no script.

## Passo 3 — Pegar a URL e a chave do projeto

1. No painel, vá em **Settings → API**.
2. Copie o valor de **Project URL** (algo como `https://xxxxxxxx.supabase.co`).
3. Copie o valor de **anon public** (uma chave longa, começa geralmente com `eyJ...`).

## Passo 4 — Configurar o arquivo

1. Abra `agenda_supabase.html` num editor de texto (Bloco de Notas, VS Code, etc.).
2. Procure por `SUPABASE_URL` e `SUPABASE_ANON_KEY` perto do final do arquivo.
3. Cole os valores que você copiou no passo anterior, entre aspas:

```js
var SUPABASE_URL = "https://xxxxxxxx.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJI...";
```

4. Salve o arquivo.

## Passo 5 — Publicar (Vercel — mais simples)

1. Crie uma conta grátis em https://vercel.com (pode usar login do GitHub).
2. Clique em **Add New → Project**.
3. Escolha **"Deploy without Git"** (ou arraste a pasta) e envie o arquivo
   `agenda_supabase.html` renomeado para `index.html`.
4. A Vercel te dará um link público (ex: `agenda-2vara.vercel.app`) — é esse que você compartilha
   com quem precisar acessar.

### Alternativa — GitHub Pages

1. Crie um repositório novo no GitHub.
2. Suba o arquivo renomeado para `index.html`.
3. Vá em **Settings → Pages**, escolha a branch `main` e salve.
4. O GitHub te dará o link público em alguns minutos.

## Depois de publicado

- Qualquer pessoa com o link poderá ver e editar os contatos (ler o aviso de segurança acima).
- Se quiser trocar as categorias iniciais, edite a lista `DEFAULT_CATEGORIES` no arquivo antes
  de publicar, ou simplesmente use o botão "⚙ categorias" depois de publicado.
- Para atualizar o site depois (ex: mudar uma cor, adicionar um campo), me peça a alteração,
  eu atualizo o arquivo e você só precisa subir a nova versão no Vercel/GitHub no lugar da antiga.
