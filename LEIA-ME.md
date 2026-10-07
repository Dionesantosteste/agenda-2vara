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
  status text not null default 'A cumprir',   -- A cumprir, Intimações feitas, Pronto para audiência, Redesignada, Cancelada
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

## Passo 2.1.1 — Tipos de audiência (lista própria)

Para cadastrar novos tipos de audiência pelo site, rode no SQL Editor o arquivo
[`sql/audiencias_tipos.sql`](sql/audiencias_tipos.sql) (copie pelo botão **Raw** do GitHub). Ele cria a lista
com os tipos atuais e os que já estiverem gravados nas audiências. Depois, numa query separada:

```sql
alter publication supabase_realtime add table audiencias_tipos;
```

No site: no cadastro, escolha **"+ Cadastrar novo tipo…"** na lista de tipos; no filtro "Tipo", o botão
**"⚙ tipos"** abre a janela para cadastrar, renomear (atualiza as audiências) ou excluir tipos.

## Passo 2.2 — Coluna "conferida" (para quem já criou a tabela antes)

Se a tabela `audiencias` foi criada antes da opção **Conferir**, rode também:

```sql
alter table audiencias add column if not exists conferida_em timestamptz;
```

## Passo 2.3 — Organização (tarefas, mural, quadro, lembretes, rotinas e equipe) com senha

A seção **Organização** fica protegida por uma senha de 6 números. Quem confere a senha é o
próprio Supabase: sem ela, o banco não entrega nem grava nada da Organização, mesmo para quem
tem o endereço do projeto. A senha fica guardada criptografada e **não aparece no código do site**.

1. Abra o arquivo [`sql/organizacao.sql`](sql/organizacao.sql) no GitHub, clique em **Raw** e copie
   tudo (Ctrl+A, Ctrl+C). Não copie de visualizadores que formatam o texto: eles podem apagar os
   símbolos `$$` e o SQL dá erro. Para conferir, o texto colado deve ter `as $$` 39 vezes.
2. No Supabase, vá em **SQL Editor → New query** e cole.
3. Procure a linha marcada com `<<< SENHA` e troque `000000` pela senha de 6 números.
4. Clique em **Run**. Deve aparecer "Success".
   - Se o Supabase perguntar sobre RLS, escolha **"Run without RLS"**. O próprio arquivo já liga o RLS em todas as tabelas `org_*`.
   - A opção "Run and enable RLS" dá o erro `relation "cfg" does not exist`.

**Atualizar** (quando o arquivo ganhar novidades, como as abas Quadro, Lembretes e Rotinas, ou as etiquetas e colunas do Quadro):
rode o arquivo inteiro de novo do mesmo jeito. Nada é apagado e a senha atual continua valendo;
não precisa mexer na linha `<<< SENHA`.

Detalhes:
- Após **5 tentativas erradas**, a Organização fica bloqueada por **5 minutos**.
- Depois de digitar a senha, o navegador lembra dela até a aba ser fechada. O botão **Trancar** pede a senha de novo.
- A Organização não atualiza sozinha quando outra pessoa altera; recarregue a página.

No **Quadro**:
- **Nova tarefa:** clique em **+ Adicionar tarefa** no fim da coluna (todas, menos Feito). Digite o título e aperte Enter; o campo continua aberto para a próxima.
  - Esc fecha o campo.
  - Se houver modelos, dá para escolher um ali mesmo.
- O **lápis** (editar) e o ícone de **arquivar** ficam no canto superior direito de cada cartão.
  - Arquivar funciona em qualquer coluna e mostra "Desfazer" por alguns segundos.
- Arraste o cartão para outra coluna. No celular, use os botões ← →.
- **Ordem dentro da coluna:** arraste o cartão para cima ou para baixo. Uma linha azul mostra onde ele vai entrar. No celular, use os botões ↑ ↓.
  - A ordem fica salva para todos.
  - Enquanto ninguém mexe na ordem de uma coluna, ela segue por prazo.
  - Cartões novos, ou que chegam pelos botões ← →, entram no fim da coluna.
  - A coluna Feito continua mostrando as mais recentes primeiro.
- Clique no cartão para abrir a janela da tarefa: título, etapa, prazo, prioridade, responsável e processo.
- Filtros no topo: texto ou nº do processo, responsável, Atrasadas, Vence hoje, Próximos 7 dias, Urgentes e Paradas.
- Selos de prazo: vermelho (atrasada), laranja (vence hoje) e amarelo (vence em até 2 dias úteis).
- Cartão sem mudança há 7 dias ou mais fica esmaecido, com "Parada há X dias".
- Mais de 8 tarefas em Fazendo deixa a coluna vermelha. Os números ficam em `ORG_LIMITE_FAZENDO` e `ORG_DIAS_PARADO`, no `index.html`.
- **Etiquetas:** o botão **Etiquetas** cria, renomeia, troca a cor e exclui etiquetas. Elas são marcadas na janela da tarefa e podem ser usadas no filtro.
- **Colunas:** o botão **Colunas** cria colunas com qualquer nome, renomeia e muda a ordem com ← →. Também dá para renomear com **dois cliques no nome da coluna**.
  - A primeira coluna (A fazer) e a última (Feito) são fixas: não mudam de lugar nem de nome.
  - Feito continua marcando a tarefa como feita.
  - Excluir uma coluna devolve as tarefas dela para a primeira.
- **Checklist e anotações** ficam na janela da tarefa e são salvos na hora, sem precisar clicar em Salvar.
  - O cartão mostra o progresso do checklist (ex.: 2/5) e quantas anotações tem.
  - Cada anotação fica registrada com data e hora.
- **Arquivar concluídas:** o botão "Arquivar" na coluna Feito tira todas as tarefas concluídas do quadro de uma vez.
  - Elas ficam no **Histórico**, onde dá para buscar, abrir ou devolver ao quadro.
- **Modelos:** abra uma tarefa já preenchida (etiquetas, checklist, responsável, prioridade) e clique em **Salvar como modelo**.
  - Para usar, abra **+ Adicionar tarefa**, escolha o modelo e clique em Adicionar. A tarefa nasce preenchida e já abre para completar processo e prazo.
  - O botão **Modelos** renomeia ou exclui.
- **Calendário:** o botão Quadro / Calendário mostra as tarefas pelo prazo, mês a mês.
  - Os filtros também valem no calendário.
  - No celular, vira uma lista por dia.
- **Mesmo processo:** se a tarefa tem nº de processo com perícia ou audiência cadastrada, o cartão mostra "Perícia" e/ou "Audiência".
  - A janela da tarefa lista as datas, e "Ver" leva direto para a perícia ou audiência.
- Etiquetas, colunas, ordem dos cartões, checklist, anotações, arquivo e modelos precisam do `sql/organizacao.sql` atualizado: rode o arquivo inteiro de novo (veja **Atualizar** acima). Sem isso, o Quadro funciona com as 3 colunas de sempre, sem etiquetas e em ordem de prazo.

**Telas da equipe** (precisa do `sql/organizacao.sql` atualizado: rode o arquivo inteiro de novo):
- **Cadastrar pessoas:** na Organização do gestor, clique em **Pessoas** e digite o nome. Cada pessoa ganha a própria tela, com quadro, mural e lembretes. As colunas, etiquetas e modelos são só dela.
- **Como a pessoa entra:** na tela de senha da Organização aparece "É da equipe? Entre na sua tela" com os nomes. Ela clica no nome e entra, **sem senha**.
  - O navegador lembra da pessoa até ela clicar em **Sair**.
  - Rotinas e a aba da equipe não aparecem para ela.
- **Atenção:** como não há senha, qualquer pessoa com o link do site pode escolher um nome e abrir a tela dessa pessoa. A tela do gestor continua protegida pela senha.
- **Desativar** tira o nome da lista de entrada sem apagar nada. **Excluir** apaga a tela inteira da pessoa: quadro, mural, lembretes, etiquetas, colunas e modelos.
- **Ver a tela de alguém:** no alto da Organização do gestor, escolha "Tela de …". Uma faixa amarela avisa de quem é a tela aberta. O que o gestor mudar ali aparece para a pessoa.
- **Aba Tarefas da equipe** (só para o gestor):
  - **Mandar tarefa:** escreva como numa mensagem, separando por vírgula. Exemplo: `Fazer intimação, 0001226-43.2017.8.11.0008, urgente, Ana, amanhã`.
    - O site reconhece o nº do processo (20 números), a prioridade (baixa, normal, alta, urgente), o nome da pessoa e o prazo (hoje, amanhã, um dia da semana ou uma data como 15/10).
    - O resto vira o título. Confira na linha de prévia e ajuste Para, Prazo e Prioridade se precisar.
    - A tarefa entra na primeira coluna da pessoa, com o selo "Do gestor".
  - **Modelo de texto e passo a passo (opcionais):** ao mandar a tarefa, escolha o modelo de texto que a pessoa deve usar e/ou um passo a passo.
    - Com modelo de texto, o cartão da pessoa ganha o botão **Modelo**, que abre a aba Modelos de texto com o modelo escolhido e o nº do processo já preenchido. Na janela da tarefa dá para trocar ou tirar o modelo.
    - O passo a passo vem dos modelos de cartão do quadro do gestor (botão **Modelos**): a tarefa chega com o checklist do modelo.
  - **Painel da equipe** (entre "Mandar tarefa" e a tabela; precisa do `sql/organizacao.sql` atualizado, sem ele o painel não aparece):
    - Conta **todas** as tarefas do quadro de cada pessoa, inclusive as que ela mesma criou. A tabela abaixo continua mostrando só as que o gestor mandou.
    - **Números do topo:** em aberto, atrasadas, vencem hoje, esperando conferência e concluídas no período. Clicar em "em aberto", "atrasadas" ou "esperando conferência" aplica o mesmo filtro na tabela.
    - **Carga por pessoa:** barra com A fazer, Em andamento (qualquer coluna entre A fazer e Feito) e Para conferir, mais atrasadas, urgentes e próximo prazo. Marca "sobrecarregada" quem tem 1,5 vez a média da equipe (e pelo menos 3 a mais) e "livre" quem não tem nada em aberto. Clicar na pessoa filtra a tabela.
    - **Atenção:** quem tem tarefa atrasada, quem está acima da média, quantas esperam conferência e quem está com menos tarefas.
    - **Paradas:** tarefas em aberto sem nenhuma mudança há 7 dias ou mais (até 15).
    - **Prazos dos próximos 7 dias:** quantas tarefas vencem em cada dia, por pessoa.
    - **Desempenho** (7 ou 30 dias): concluídas, % entregue no prazo (entre as que tinham prazo), tempo médio entre criar e concluir, devolvidas na conferência e as concluídas de cada uma das últimas 8 semanas.
    - Na lista **Para**, ao lado de cada nome, aparece quantas tarefas a pessoa tem em A fazer e quantas atrasadas.
    - "Hoje" segue o horário de Cuiabá.
  - **Editar e excluir:** clique na linha da tarefa e use **Editar** (título, prazo, prioridade, processo e modelo de texto) ou **Excluir**, sem precisar abrir o quadro da pessoa.
  - **Tabela:** mostra tarefa, responsável, prazo, prioridade e situação (o nome da coluna em que a tarefa está no quadro da pessoa, ou "Concluída").
    - Filtros: por pessoa, Em aberto, Atrasadas, Pedem ação do gestor, Concluídas e Todas.
    - A tabela mostra 100 linhas por vez (botão **Mostrar mais**). Os totais do topo e os filtros valem para todas.
    - A lista é buscada quando a aba é aberta. Vêm as tarefas em aberto e as concluídas nos últimos 30 dias; em **Concluídas** ou **Todas**, o botão "Mostrar também as concluídas há mais de 30 dias" busca as antigas. Nada é apagado.
    - Clique na linha para ver os detalhes e o fechamento. "Abrir no quadro" leva para a tela da pessoa com a tarefa aberta.
- **Mandar uma tarefa que já está no quadro do gestor:** abra a tarefa, escolha a pessoa em "Mandar para a tela de" e clique em Salvar. A tarefa sai do quadro do gestor e vai para a primeira coluna da pessoa (as etiquetas ficam para trás).
- **Fechamento:** quando a pessoa move para a última coluna (Feito) uma tarefa que veio do gestor, abre a janela **Concluir tarefa**. Ela responde:
  - quanto tempo levou;
  - se concluiu conforme o pedido (sim, parcialmente ou não);
  - se teve dificuldade, e qual;
  - se precisa de ação do gestor.
  - As respostas aparecem para o gestor no detalhe da tarefa e na janela da tarefa. As tarefas que a própria pessoa cria vão para Feito sem perguntas.
- **Conferência:** qualquer tarefa da tela de uma pessoa pode ir para o gestor conferir.
  - A pessoa clica no ícone de prancheta do cartão (ou em **Enviar para conferência**, na janela da tarefa) e pode deixar um recado.
  - Enquanto espera, a tarefa fica parada na coluna em que está, com o selo "Em conferência". A pessoa pode **Cancelar envio** na janela da tarefa.
  - O gestor vê o número de tarefas para conferir na aba **Tarefas da equipe** e no menu. O filtro **Para conferir** lista essas tarefas.
  - No detalhe da tarefa, o gestor clica em **Aprovar** ou em **Devolver** (precisa escrever o motivo). Nos dois casos a tarefa continua na coluna da pessoa em que estava quando foi enviada: a aprovada com o selo "Conferida ✓", a devolvida com o selo "Devolvida" e o motivo. Quem leva para Feito é a própria pessoa.
  - Cada envio, cancelamento, aprovação e devolução fica registrado com data e hora na janela da tarefa.
- **Modelos de texto** (aba da Organização, para o gestor e para a equipe):
  - Uma biblioteca só, que todos usam e qualquer pessoa pode editar. Cada modelo mostra quem fez a última alteração.
  - Nos lugares que mudam a cada caso, o texto tem campos entre chaves, como `{{autor}}`, `{{data}}` e `{{hora}}`. Qualquer nome entre chaves vira campo, por exemplo `{{numero_do_mandado}}`.
  - Para usar: escolha o modelo, digite o nº do processo e preencha o que faltar. Os campos vazios ficam em amarelo e os preenchidos em verde. Depois clique em **Copiar texto** e cole no PJe.
  - **Preencher direto no texto:** clique num campo amarelo ou verde e digite ali mesmo (Enter confirma, Esc desfaz). A coluna "Preencher" acompanha.
  - **Nº do processo é opcional:** se ficar vazio, a linha "Processo nº …" sai do texto copiado. Na tela ela aparece esmaecida.
  - Com o nº do processo, o portal já completa o que sabe: a data, a hora e o tipo da audiência, e o autor, o perito e a especialidade da perícia. As datas saem por extenso.
  - **Minha assinatura:** cada pessoa preenche uma vez o nome e o cargo, que entram no fim do texto. A data de hoje entra sozinha.
  - **Cidade:** é uma só para todos os documentos. O gestor cadastra em "Minha assinatura", na tela dele.
  - **Favoritos:** cada pessoa marca os seus, que ficam no topo da lista. A lista também mostra quantas vezes cada modelo foi usado.
  - **Categorias:** começam com Intimação, Citação, Mandado, Ofício e Certidão. Em **+ Categorias** dá para criar, renomear ou excluir; só sai a categoria que não tem modelos.
  - O site começa com 6 modelos de exemplo, que valem a pena conferir e ajustar ao padrão de redação da vara.
  - Só os modelos ficam guardados. Os dados preenchidos de cada processo não são gravados.
- **Prioridade:** agora tem 4 níveis, Baixa, Normal, Alta e Urgente, em todos os quadros. As tarefas que eram urgentes continuam urgentes; as demais viram Normal.

**Correção ao salvar:** títulos de tarefas, notas do mural, lembretes e rotinas começam sempre com letra maiúscula, e as palavras comuns da vara ganham acento sozinhas (ex.: "intimacao" vira "intimação", "audiencia" vira "audiência", "certidao" vira "certidão"). A lista fica em `ORG_ACENTOS`, no `index.html`; para acrescentar uma palavra, ponha `"sem acento": "com acento"`. Só entram palavras que sem acento não existem, para não "corrigir" o que estava certo. O corretor do navegador (sublinhado vermelho) continua valendo para o resto. Os modelos de texto não são alterados.

**Trocar a senha (ou criar uma nova se esquecer)** — rode no SQL Editor, trocando `000000`:

```sql
update org_config set pin_hash = extensions.crypt('000000', extensions.gen_salt('bf')), tentativas = 0, bloqueado_ate = null where id = 1;
```

Os dados do mural e das tarefas não são apagados ao trocar a senha.

## Passo 2.4 — Perícias

A seção **Perícias** acompanha cada perícia da nomeação até o laudo juntado:
**Não agendada → Agendada → Intimações feitas → Pronta para perícia → Realizada → Laudo juntado** (ou **Cancelada**).

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
- **Cores das situações:**
  - Não agendada: âmbar.
  - Agendada: vermelho (falta intimar).
  - Intimações feitas: amarelo.
  - Pronta para perícia: verde.
  - Realizada: azul.
  - Laudo juntado: roxo.
  - Cancelada: cinza.
- "Intimações feitas" e "Pronta para perícia" mantêm a data marcada. Na alteração em lote, as perícias ainda sem data
  ficam de fora até serem agendadas.
- **Imprimir:** o botão **Imprimir** (em Perícias e em Audiências) gera uma folha A4 em retrato com a lista que está na
  tela, respeitando a busca e os filtros. O cabeçalho traz o filtro usado e a data de emissão. Na janela de impressão,
  dá para escolher "Salvar como PDF".
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

- **Busca geral:** o campo de busca da seção **Perícias** (entre o título e o formulário de cadastro)
  procura de uma vez em perícias (em andamento e concluídas), audiências, contatos da Agenda e, com a Organização
  destrancada, nas tarefas. Aceita o número do processo com ou sem pontuação, ou só um pedaço dele, e nomes.
  Atalho em Perícias: **Ctrl+K** ou **/**. Agenda e Audiências usam a busca própria de cada uma.
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
