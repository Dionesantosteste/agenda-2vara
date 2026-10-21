// Organização: entrada e Quadro (criar, mover, ordenar, filtrar, abrir a tarefa, checklist, anotações, fechamento).
// Os mesmos testes rodam no sistema atual (/#organizacao) e no sistema novo (/novo/organizacao).
const { test, expect, hojeVara } = require('../apoio/teste');
const { ANA, BIA, equipe, entrarComoPessoa, entrarComoGestor, abaOrg, cartao, coluna } = require('../apoio/org');

const VERSOES = [
  { nome: 'sistema atual', endereco: '/#organizacao' },
  { nome: 'sistema novo', endereco: '/novo/organizacao' }
];
const diaMais = n => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(Date.now() + n * 86400000));
const tarefa = (banco, titulo) => banco.org.tarefas.find(t => t.titulo === titulo);

for (const v of VERSOES){
  test.describe(v.nome, () => {
    const pessoa = (page, nome = 'Ana Souza') => entrarComoPessoa(page, nome, v.endereco);
    const gestor = async (page, pin) => { await entrarComoGestor(page, pin, v.endereco); };
    const quadroDoGestor = async page => { await gestor(page); await expect(page.locator('#orgContent')).toBeVisible(); await abaOrg(page, 'quadro'); };

    test.describe('entrada', () => {
      test('a pessoa entra pelo nome e vê só o quadro dela', async ({ page, banco }) => {
        equipe(banco, { tarefas: [
          { dono: ANA, titulo: 'Expedir intimação da Ana' }, { dono: BIA, titulo: 'Tarefa da Bia' }, { dono: null, titulo: 'Tarefa do gestor' }
        ] });
        await pessoa(page);
        await expect(page.locator('#orgH1')).toContainText('Ana');
        await expect(cartao(page, 'Expedir intimação da Ana')).toBeVisible();
        await expect(page.locator('#orgKanban')).not.toContainText('Tarefa da Bia');
        await expect(page.locator('#orgKanban')).not.toContainText('Tarefa do gestor');
        await expect(page.locator('.org-tab[data-tab="equipe"]')).toBeHidden();
        await expect(page.locator('.org-tab[data-tab="rotinas"]')).toBeHidden();
      });

      test('senha errada do gestor não entra; a certa entra', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: null, titulo: 'Tarefa do gestor' }] });
        await gestor(page, '000000');
        await expect(page.locator('#orgContent')).toBeHidden();
        await expect(page.locator('#orgMsg')).toHaveText('Senha incorreta.');
        await page.locator('#orgPin').pressSequentially('123456');
        await expect(page.locator('#orgContent')).toBeVisible();
        await abaOrg(page, 'quadro');
        await expect(cartao(page, 'Tarefa do gestor')).toBeVisible();
      });

      test('o acesso fica lembrado ao recarregar e o botão Sair/Trancar volta à entrada', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Tarefa da Ana' }] });
        await pessoa(page);
        await page.reload();
        await expect(page.locator('#orgH1')).toContainText('Ana');
        await expect(page.locator('#orgLockBtn')).toHaveText('Sair');
        await page.locator('#orgLockBtn').click();
        await expect(page.locator('#orgContent')).toBeHidden();
        await expect(page.locator('#orgEntrarLista button', { hasText: 'Ana Souza' })).toBeVisible();
        await page.reload();
        await expect(page.locator('#orgContent')).toBeHidden();
      });

      test('o gestor vê a tela de uma pessoa e volta para a dele', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Tarefa da Ana' }, { dono: null, titulo: 'Tarefa do gestor' }] });
        await quadroDoGestor(page);
        await page.selectOption('#orgVer', { label: 'Tela de Ana Souza' });
        await expect(cartao(page, 'Tarefa da Ana')).toBeVisible();
        await expect(page.locator('#orgKanban')).not.toContainText('Tarefa do gestor');
        await expect(page.locator('#orgVerAviso')).toBeVisible();
        await page.click('#orgVerVoltar');
        await expect(cartao(page, 'Tarefa do gestor')).toBeVisible();
        await expect(page.locator('#orgVerAviso')).toBeHidden();
      });
    });

    test.describe('quadro', () => {
      test('o quadro começa com A fazer e Feito', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await expect(page.locator('#orgKanban .col h3 .col-nome')).toHaveText(['A fazer', 'Feito']);
      });

      test('cria tarefa na coluna A fazer e grava no banco', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await coluna(page, 'afazer').locator('[data-act="kadd"]').click();
        await coluna(page, 'afazer').locator('.kadd-in').fill('Juntar ofício do INSS');
        await coluna(page, 'afazer').locator('.kadd-in').press('Enter');
        await expect(cartao(page, 'Juntar ofício do INSS')).toBeVisible();
        expect(tarefa(banco, 'Juntar ofício do INSS')).toMatchObject({ dono: ANA, etapa: 'afazer', do_gestor: false });
      });

      test('o número do processo escrito na tarefa vai para o campo do processo', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await coluna(page, 'afazer').locator('[data-act="kadd"]').click();
        await coluna(page, 'afazer').locator('.kadd-in').fill('0001234-56.2026.8.11.0001 juntar AR');
        await coluna(page, 'afazer').locator('.kadd-in').press('Enter');
        await expect(cartao(page, 'Juntar AR')).toContainText('0001234-56.2026.8.11.0001');
        expect(tarefa(banco, 'Juntar AR')).toMatchObject({ processo: '0001234-56.2026.8.11.0001' });
      });

      test('a correção automática põe maiúscula e acento ao salvar', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await coluna(page, 'afazer').locator('[data-act="kadd"]').click();
        await coluna(page, 'afazer').locator('.kadd-in').fill('fazer a intimacao do perito');
        await coluna(page, 'afazer').locator('.kadd-in').press('Enter');
        await expect(cartao(page, 'Fazer a intimação do perito')).toBeVisible();
      });

      test('Esc fecha o campo de adicionar sem criar nada', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await coluna(page, 'afazer').locator('[data-act="kadd"]').click();
        await coluna(page, 'afazer').locator('.kadd-in').fill('Não vale');
        await coluna(page, 'afazer').locator('.kadd-in').press('Escape');
        await expect(coluna(page, 'afazer').locator('.kadd-in')).toHaveCount(0);
        expect(banco.org.tarefas).toHaveLength(0);
      });

      test('move a tarefa com os botões e grava a etapa', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Certificar decurso de prazo' }] });
        await pessoa(page);
        await cartao(page, 'Certificar decurso de prazo').locator('[data-act="mover"][data-dir="1"]').click();
        await expect(coluna(page, 'feito')).toContainText('Certificar decurso de prazo');
        const t = tarefa(banco, 'Certificar decurso de prazo');
        expect(t.etapa).toBe('feito');
        expect(t.feita_em && t.feita_em.length).toBeTruthy();
        await cartao(page, 'Certificar decurso de prazo').locator('[data-act="mover"][data-dir="-1"]').click();
        await expect(coluna(page, 'afazer')).toContainText('Certificar decurso de prazo');
        expect(tarefa(banco, 'Certificar decurso de prazo')).toMatchObject({ etapa: 'afazer', feita_em: null });
      });

      test('mostra o selo do prazo, a prioridade e o cartão da tarefa do gestor', async ({ page, banco }) => {
        equipe(banco, { tarefas: [
          { dono: ANA, titulo: 'Atrasada', prazo: diaMais(-3) }, { dono: ANA, titulo: 'De hoje', prazo: hojeVara() },
          { dono: ANA, titulo: 'Urgente', prioridade: 'urgente', urgente: true }, { dono: ANA, titulo: 'Do chefe', do_gestor: true }
        ] });
        await pessoa(page);
        await expect(cartao(page, 'Atrasada')).toContainText('Atrasada ·');
        await expect(cartao(page, 'De hoje')).toContainText('Vence hoje');
        await expect(cartao(page, 'Urgente')).toContainText('Urgente');
        await expect(cartao(page, 'Do chefe')).toContainText('Do gestor');
      });

      test('a coluna Fazendo passa do limite de 8 e avisa', async ({ page, banco }) => {
        equipe(banco, { colunas: [{ chave: 'fazendo', nome: 'Fazendo', ordem: 10, dono: ANA }], tarefas: Array.from({ length: 9 }, (_, i) => ({ dono: ANA, titulo: 'Em andamento ' + (i + 1), etapa: 'fazendo' })) });
        await pessoa(page);
        await expect(coluna(page, 'fazendo')).toContainText('9 / 8');
        await expect(coluna(page, 'fazendo').locator('.wip-aviso')).toBeVisible();
      });

      test('a coluna do meio é renomeada com dois cliques', async ({ page, banco }) => {
        equipe(banco, { colunas: [{ chave: 'c1', nome: 'Aguardando', ordem: 10, dono: null }], tarefas: [{ dono: null, titulo: 'Tarefa do gestor' }] });
        await quadroDoGestor(page);
        await expect(page.locator('#orgKanban .col h3 .col-nome')).toHaveText(['A fazer', 'Aguardando', 'Feito']);
        await coluna(page, 'c1').locator('.col-nome').dblclick();
        await coluna(page, 'c1').locator('.col-nome-in').fill('Esperando o perito');
        await coluna(page, 'c1').locator('.col-nome-in').press('Enter');
        await expect(page.locator('#orgKanban .col h3 .col-nome')).toHaveText(['A fazer', 'Esperando o perito', 'Feito']);
        expect(banco.org.colunas.find(c => c.chave === 'c1').nome).toBe('Esperando o perito');
      });
    });

    // no computador a ordem é por arrastar; os botões ↑ ↓ são do celular
    test.describe('no celular', () => {
      test.use({ viewport: { width: 600, height: 900 }, isMobile: true, hasTouch: true });
      test('sobe e desce o cartão dentro da coluna', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Primeira', prazo: diaMais(3) }, { dono: ANA, titulo: 'Segunda', prazo: diaMais(5) }] });
        await pessoa(page);
        await expect(coluna(page, 'afazer').locator('.ktitle')).toHaveText(['Primeira', 'Segunda']);
        await cartao(page, 'Primeira').locator('[data-act="descer"]').click();
        await expect(coluna(page, 'afazer').locator('.ktitle')).toHaveText(['Segunda', 'Primeira']);
        await expect.poll(() => tarefa(banco, 'Segunda').posicao < tarefa(banco, 'Primeira').posicao).toBe(true);
        await cartao(page, 'Primeira').locator('[data-act="subir"]').click();
        await expect(coluna(page, 'afazer').locator('.ktitle')).toHaveText(['Primeira', 'Segunda']);
      });
    });

    test.describe('filtros', () => {
      const tarefas = () => [
        { dono: ANA, titulo: 'Expedir mandado', processo: '0001226-43.2017.8.11.0008', prazo: diaMais(-2) },
        { dono: ANA, titulo: 'Juntar laudo', responsavel: 'Cartório' },
        { dono: ANA, titulo: 'Intimar perito', prioridade: 'urgente', urgente: true }
      ];
      test('busca por título ou número do processo', async ({ page, banco }) => {
        equipe(banco, { tarefas: tarefas() });
        await pessoa(page);
        await page.fill('#orgKBusca', 'laudo');
        await expect(page.locator('#orgKanban .kcard')).toHaveCount(1);
        await expect(cartao(page, 'Juntar laudo')).toBeVisible();
        await expect(page.locator('#orgKLimpar')).toBeVisible();
        await page.fill('#orgKBusca', '000122643');
        await expect(page.locator('#orgKanban .kcard')).toHaveCount(1);
        await expect(cartao(page, 'Expedir mandado')).toBeVisible();
        await expect(coluna(page, 'afazer')).toContainText('1 de 3');
        await page.click('#orgKLimpar');
        await expect(page.locator('#orgKanban .kcard')).toHaveCount(3);
        await expect(page.locator('#orgKBusca')).toHaveValue('');
      });

      test('filtros por prazo e por responsável', async ({ page, banco }) => {
        equipe(banco, { tarefas: tarefas() });
        await entrarComoGestor(page, undefined, v.endereco);
        await abaOrg(page, 'quadro');
        banco.org.tarefas.forEach(t => { t.dono = null; });
        await page.reload();
        await abaOrg(page, 'quadro');
        await page.locator('#orgKChips [data-kprazo="atrasadas"]').click();
        await expect(page.locator('#orgKanban .kcard')).toHaveCount(1);
        await expect(cartao(page, 'Expedir mandado')).toBeVisible();
        await page.locator('#orgKChips [data-kprazo="urgentes"]').click();
        await expect(cartao(page, 'Intimar perito')).toBeVisible();
        await page.locator('#orgKChips [data-kprazo="urgentes"]').click();
        await page.selectOption('#orgKResp', 'Cartório');
        await expect(page.locator('#orgKanban .kcard')).toHaveCount(1);
        await expect(cartao(page, 'Juntar laudo')).toBeVisible();
        await page.selectOption('#orgKResp', '-');
        await expect(page.locator('#orgKanban .kcard')).toHaveCount(2);
      });

      test('etiquetas aparecem no cartão e filtram', async ({ page, banco }) => {
        const etq = '00000000-0000-4000-8000-0000000000e1';
        equipe(banco, { etiquetas: [{ id: etq, nome: 'Urgente do juiz', cor: 'vermelho', dono: ANA }],
          tarefas: [{ dono: ANA, titulo: 'Com etiqueta', etiquetas: [etq] }, { dono: ANA, titulo: 'Sem etiqueta' }] });
        await pessoa(page);
        await expect(cartao(page, 'Com etiqueta').locator('.klabel')).toHaveText('Urgente do juiz');
        await page.selectOption('#orgKEtq', { label: 'Urgente do juiz' });
        await expect(page.locator('#orgKanban .kcard')).toHaveCount(1);
        await expect(cartao(page, 'Com etiqueta')).toBeVisible();
      });
    });

    test.describe('janela da tarefa', () => {
      test('edita prazo, prioridade, processo e etapa e grava', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Minuta de despacho' }] });
        await pessoa(page);
        await cartao(page, 'Minuta de despacho').locator('.ktitle').click();
        await expect(page.locator('#orgCardDialog')).toBeVisible();
        await page.fill('#ocTitulo', 'Minuta de despacho revisada');
        await page.fill('#ocPrazo', diaMais(4));
        await page.selectOption('#ocUrg', 'alta');
        await page.fill('#ocProc', '00012264320178110008');
        await expect(page.locator('#ocProc')).toHaveValue('0001226-43.2017.8.11.0008');
        await page.selectOption('#ocEtapa', 'feito');
        await page.locator('#orgCardForm button[type=submit]').click();
        await expect(page.locator('#orgCardDialog')).toBeHidden();
        await expect(coluna(page, 'feito')).toContainText('Minuta de despacho revisada');
        expect(banco.org.tarefas[0]).toMatchObject({ titulo: 'Minuta de despacho revisada', prazo: diaMais(4), prioridade: 'alta', processo: '0001226-43.2017.8.11.0008', etapa: 'feito' });
      });

      test('o gestor escolhe o responsável; a pessoa não vê esse campo', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: null, titulo: 'Tarefa do gestor' }] });
        await quadroDoGestor(page);
        await cartao(page, 'Tarefa do gestor').locator('.ktitle').click();
        await expect(page.locator('#ocResp')).toBeVisible();
        await page.selectOption('#ocResp', 'Cartório');
        await page.locator('#orgCardForm button[type=submit]').click();
        await expect(cartao(page, 'Tarefa do gestor')).toContainText('Cartório');
        expect(banco.org.tarefas[0].responsavel).toBe('Cartório');
      });

      test('checklist e anotações são gravados na hora', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir ofício' }] });
        await pessoa(page);
        await cartao(page, 'Expedir ofício').locator('.ktitle').click();
        await page.fill('#ocCheckNovo', 'Conferir endereço');
        await page.click('#ocCheckAdd');
        await page.fill('#ocCheckNovo', 'Assinar');
        await page.locator('#ocCheckNovo').press('Enter');
        await expect(page.locator('#ocCheckList .ck-row')).toHaveCount(2);
        expect(banco.org.tarefas[0].checklist).toEqual([{ t: 'Conferir endereço', ok: false }, { t: 'Assinar', ok: false }]);
        await page.locator('#ocCheckList .ck-row').first().locator('.check').click();
        await expect(page.locator('#ocCheckN')).toHaveText('1/2');
        await expect.poll(() => banco.org.tarefas[0].checklist[0].ok).toBe(true);
        await page.locator('#ocCheckList .ck-row').nth(1).locator('[aria-label^="Remover"]').click();
        await expect(page.locator('#ocCheckList .ck-row')).toHaveCount(1);

        await page.fill('#ocNotaTxt', 'Ofício enviado por malote');
        await page.click('#ocNotaAdd');
        await expect(page.locator('#ocNotasList')).toContainText('Ofício enviado por malote');
        expect(banco.org.anotacoes[0]).toMatchObject({ tarefa_id: banco.org.tarefas[0].id, texto: 'Ofício enviado por malote' });

        await page.click('#ocCancelar');
        await expect(cartao(page, 'Expedir ofício')).toContainText('1/1');
        await expect(cartao(page, 'Expedir ofício').locator('.knotas')).toContainText('1');
      });

      test('texto deixado em Anotações é salvo junto com a tarefa', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir ofício' }] });
        await pessoa(page);
        await cartao(page, 'Expedir ofício').locator('.ktitle').click();
        await page.fill('#ocNotaTxt', 'Anotação solta');
        await page.locator('#orgCardForm button[type=submit]').click();
        await expect(page.locator('#orgCardDialog')).toBeHidden();
        expect(banco.org.anotacoes.map(n => n.texto)).toEqual(['Anotação solta']);
      });

      test('excluir pede confirmação; tarefa do gestor não pode ser excluída pela pessoa', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Para apagar' }, { dono: ANA, titulo: 'Do gestor', do_gestor: true }] });
        await pessoa(page);
        await cartao(page, 'Do gestor').locator('.ktitle').click();
        await expect(page.locator('#ocExcluir')).toBeHidden();
        await page.click('#ocCancelar');
        await cartao(page, 'Para apagar').locator('.ktitle').click();
        await page.click('#ocExcluir');
        await expect(page.locator('#ocExcluir')).toHaveText('Confirmar exclusão');
        expect(tarefa(banco, 'Para apagar')).toBeTruthy();
        await page.click('#ocExcluir');
        await expect(cartao(page, 'Para apagar')).toHaveCount(0);
        expect(tarefa(banco, 'Para apagar')).toBeUndefined();
      });

      test('avisa quando o processo já está em uso e deixa seguir ou cancelar', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Minuta de despacho' }] });
        // o simulador não conhece processos repetidos; ensina esta resposta só neste teste
        await page.route('**/rest/v1/rpc/org_processo_em_uso', route => route.fulfill({ json: { status: 'ok', tarefas: [
          { id: '00000000-0000-4000-8000-0000000000f1', dono: BIA, dono_nome: 'Bia Lima', titulo: 'Outra tarefa', etapa: 'afazer', prazo: null }] } }));
        await pessoa(page);
        await cartao(page, 'Minuta de despacho').locator('.ktitle').click();
        await page.fill('#ocProc', '00012264320178110008');
        await page.locator('#orgCardForm button[type=submit]').click();
        await expect(page.locator('#orgDupDialog')).toBeVisible();
        await expect(page.locator('#orgDupLista')).toContainText('Bia Lima');
        await page.locator('#orgDupDialog button[value="nao"]').click();
        await expect(page.locator('#orgCardDialog')).toBeVisible();
        expect(banco.org.tarefas[0].processo).toBe('');
        await page.locator('#orgCardForm button[type=submit]').click();
        await page.locator('#orgDupSim').click();
        await expect(page.locator('#orgCardDialog')).toBeHidden();
        expect(banco.org.tarefas[0].processo).toBe('0001226-43.2017.8.11.0008');
      });
    });

    test.describe('fechamento', () => {
      test('a pessoa conclui tarefa do gestor respondendo o fechamento', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir mandado', do_gestor: true }] });
        await pessoa(page);
        await cartao(page, 'Expedir mandado').locator('[data-act="mover"][data-dir="1"]').click();
        await expect(page.locator('#orgFechDialog')).toBeVisible();
        await page.check('input[name=ofDif][value=sim]');
        await page.click('#ofConcluir');
        await expect(page.locator('#toast')).toHaveText('Conte rapidamente qual foi a dificuldade.');
        await page.fill('#ofDifDesc', 'Faltou o endereço');
        await page.fill('#ofHoras', '1');
        await page.fill('#ofMinutos', '30');
        await page.check('input[name=ofAcao][value=sim]');
        await page.click('#ofConcluir');
        await expect(page.locator('#orgFechDialog')).toBeHidden();
        await expect(coluna(page, 'feito')).toContainText('Expedir mandado');
        expect(banco.org.tarefas[0]).toMatchObject({ etapa: 'feito',
          conclusao: { horas: 1, minutos: 30, conformidade: 'sim', dificuldade: true, dificuldade_desc: 'Faltou o endereço', precisa_acao: true } });
        await cartao(page, 'Expedir mandado').locator('.ktitle').click();
        await expect(page.locator('#ocFech')).toContainText('Tempo levado');
        await expect(page.locator('#ocFech')).toContainText('1h 30min');
      });

      test('salvar a tarefa do gestor com Feito na janela também pede o fechamento', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir mandado', do_gestor: true }] });
        await pessoa(page);
        await cartao(page, 'Expedir mandado').locator('.ktitle').click();
        await page.selectOption('#ocEtapa', 'feito');
        await page.locator('#orgCardForm button[type=submit]').click();
        await expect(page.locator('#orgFechDialog')).toBeVisible();
        expect(banco.org.tarefas[0].etapa).toBe('afazer');
        await page.click('#ofConcluir');
        await expect(page.locator('#orgFechDialog')).toBeHidden();
        expect(banco.org.tarefas[0].etapa).toBe('feito');
      });
    });

    test('tarefa em conferência fica travada para a pessoa', async ({ page, banco }) => {
      equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Minuta de sentença', etapa: 'fazendo', conferencia: 'enviada' }] });
      await pessoa(page);
      await expect(cartao(page, 'Minuta de sentença')).toContainText('Em conferência');
      await expect(cartao(page, 'Minuta de sentença')).toContainText('Aguardando o gestor conferir');
      await expect(cartao(page, 'Minuta de sentença').locator('[data-act="mover"]')).toHaveCount(0);
    });
  });
}

test.describe('sistema novo: abas que ainda estão no sistema atual', () => {
  test('mostram o caminho para o sistema atual e o menu continua apontando para ele', async ({ page, banco }) => {
    equipe(banco);
    await entrarComoGestor(page, undefined, '/novo/organizacao');
    await expect(page.locator('#orgContent')).toBeVisible();
    await expect(page.locator('#orgTabs .org-tab')).toHaveText(['Tarefas da equipe', 'Tarefas e mural', 'Quadro', 'Lembretes', 'Modelos de texto', 'Rotinas', 'Aniversariantes']);
    await abaOrg(page, 'lembretes');
    await expect(page.locator('#orgPaneAindaAtual')).toContainText('ainda está no sistema atual');
    await expect(page.locator('#orgPaneAindaAtual a')).toHaveAttribute('href', '/#organizacao');
    await expect(page.locator('.nav .nav-item').nth(4)).toHaveAttribute('href', '/#organizacao');
  });
});
