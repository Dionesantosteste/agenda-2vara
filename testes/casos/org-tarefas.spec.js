// Organização, parte 1: entrada (gestor pela senha, equipe pelo nome), troca de tela do gestor,
// "Tarefas e mural", Lembretes e Rotinas.
// Os mesmos testes rodam no sistema atual (/#organizacao) e no sistema novo (/novo/organizacao).
const { test, expect, hojeVara } = require('../apoio/teste');
const { ANA, equipe, entrarComoPessoa, entrarComoGestor, abaOrg } = require('../apoio/org');

const VERSOES = [
  { nome: 'sistema atual', endereco: '/#organizacao' },
  { nome: 'sistema novo', endereco: '/novo/organizacao' }
];
function diaMais(n){ return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(Date.now() + n * 86400000)); }
const br = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);

for (const v of VERSOES){
  test.describe(v.nome, () => {
    const gestor = async (page, pin) => { await entrarComoGestor(page, pin, v.endereco); };
    const pessoa = async (page, nome) => { await entrarComoPessoa(page, nome, v.endereco); };
    const tarefa = (page, titulo) => page.locator('#orgTasks .task', { hasText: titulo });
    const grupo = (page, nome) => page.locator('#orgTasks .tgroup-title', { hasText: new RegExp('^' + nome) });

    test.describe('entrada', () => {
      test('a pessoa entra pelo nome e sai', async ({ page, banco }) => {
        equipe(banco);
        await page.goto(v.endereco);
        await expect(page.locator('#orgEntrarLista .pessoa-btn')).toHaveText(['ASAna Souza', 'BLBia Lima']);
        await page.locator('#orgEntrarLista button', { hasText: 'Ana Souza' }).click();
        await expect(page.locator('#orgContent')).toBeVisible();
        await expect(page.locator('#toast')).toHaveText('Olá, Ana!');
        await expect(page.locator('#orgH1')).toHaveText('Olá, Ana!');
        await expect(page.locator('#orgTagline')).toHaveText('Seu quadro, mural e lembretes. Tarefas do gestor chegam na primeira coluna.');
        await expect(page.locator('.org-tab[data-tab="equipe"]')).toBeHidden();
        await expect(page.locator('.org-tab[data-tab="rotinas"]')).toBeHidden();
        await expect(page.locator('#orgLockBtn')).toHaveText('Sair');
        // continua na tela ao recarregar
        await page.reload();
        await expect(page.locator('#orgH1')).toHaveText('Olá, Ana!');
        await page.click('#orgLockBtn');
        await expect(page.locator('#toast')).toHaveText('Você saiu da sua tela');
        await expect(page.locator('#orgLock')).toBeVisible();
        await expect(page.locator('#orgContent')).toBeHidden();
      });

      test('senha do gestor: errada não entra; a certa entra; trancar', async ({ page, banco }) => {
        equipe(banco);
        await gestor(page, '000000');
        await expect(page.locator('#orgContent')).toBeHidden();
        await expect(page.locator('#orgMsg')).toHaveText('Senha incorreta.');
        await page.locator('#orgPin').pressSequentially('123456');
        await expect(page.locator('#orgContent')).toBeVisible();
        await expect(page.locator('#orgH1')).toHaveText('Organização');
        await expect(page.locator('#orgTagline')).toHaveText('Tarefas, mural, lembretes e rotinas da gestão');
        await expect(page.locator('#orgLockBtn')).toHaveText('Trancar');
        await page.click('#orgLockBtn');
        await expect(page.locator('#toast')).toHaveText('Organização trancada');
        await expect(page.locator('#orgContent')).toBeHidden();
        await expect(page.locator('#orgPin')).toHaveValue('');
      });

      test('o gestor abre a tela de alguém da equipe e volta', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Tarefa da Ana' }, { dono: null, titulo: 'Tarefa do gestor' }] });
        await gestor(page);
        await abaOrg(page, 'lista');
        await expect(tarefa(page, 'Tarefa do gestor')).toBeVisible();
        await expect(page.locator('#orgVer option')).toHaveText(['Minha tela (gestor)', 'Tela de Ana Souza', 'Tela de Bia Lima']);
        await page.selectOption('#orgVer', ANA);
        await expect(page.locator('#orgVerAviso')).toBeVisible();
        await expect(page.locator('#orgVerAvisoTxt')).toHaveText('Você está na tela de Ana Souza. O que mudar aqui aparece para essa pessoa.');
        await expect(page.locator('#orgTagline')).toHaveText('Tela de Ana Souza');
        await expect(tarefa(page, 'Tarefa da Ana')).toBeVisible();
        await expect(page.locator('#orgTasks')).not.toContainText('Tarefa do gestor');
        await expect(page.locator('.org-tab[data-tab="rotinas"]')).toBeHidden();
        await page.click('#orgVerVoltar');
        await expect(page.locator('#orgVerAviso')).toBeHidden();
        await expect(tarefa(page, 'Tarefa do gestor')).toBeVisible();
      });
    });

    test.describe('tarefas e mural', () => {
      test('acrescenta tarefa: processo separado do título, correção e grupos por prazo', async ({ page, banco }) => {
        equipe(banco, { tarefas: [
          { dono: null, titulo: 'Atrasada', prazo: diaMais(-2) },
          { dono: null, titulo: 'Para hoje', prazo: diaMais(0) },
          { dono: null, titulo: 'Sem data' }
        ] });
        await gestor(page);
        await abaOrg(page, 'lista');
        await expect(page.locator('#orgTasksInfo')).toHaveText('3 em aberto · clique no título ou no lápis para editar');
        await expect(page.locator('#orgTasks .tgroup-title')).toHaveText(['Atrasadas 1', 'Hoje 1', 'Sem prazo 1']);
        await expect(tarefa(page, 'Atrasada')).toHaveClass(/overdue/);
        await expect(tarefa(page, 'Atrasada').locator('.late')).toHaveText('Atrasada 2 dias (' + br(diaMais(-2)) + ')');
        await expect(tarefa(page, 'Para hoje')).toContainText('Vence hoje');

        await page.fill('#orgTaskTitle', 'expedir intimacao 00012264320178110008');
        await page.fill('#orgTaskDue', diaMais(3));
        await page.selectOption('#orgTaskUrg', 'urgente');
        await page.selectOption('#orgTaskResp', 'Secretaria');
        await page.locator('#orgTaskForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Tarefa adicionada');
        const t = tarefa(page, 'Expedir intimação');
        await expect(t).toBeVisible();
        await expect(t).toHaveClass(/urgent/);
        await expect(t.locator('.proc-copy')).toHaveText('0001226-43.2017.8.11.0008');
        await expect(t.locator('.tag.urg')).toHaveText('Urgente');
        await expect(t.locator('.tag.resp')).toHaveText('Secretaria');
        await expect(t).toContainText('Prazo ' + br(diaMais(3)));
        await expect(grupo(page, 'Próximas')).toHaveText('Próximas 1');
        expect(banco.org.tarefas.find(x => x.titulo === 'Expedir intimação')).toMatchObject({
          dono: null, processo: '0001226-43.2017.8.11.0008', prazo: diaMais(3), prioridade: 'urgente', responsavel: 'Secretaria', etapa: 'afazer' });
        await expect(page.locator('#orgTaskTitle')).toHaveValue('');
        await expect(page.locator('#orgTaskUrg')).toHaveValue('normal');
      });

      test('marca como feita, desfaz, edita pelo lápis e exclui com confirmação', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: null, titulo: 'Certificar decurso' }] });
        await gestor(page);
        await abaOrg(page, 'lista');
        await tarefa(page, 'Certificar decurso').locator('[data-act="feita"]').click();
        await expect(page.locator('#toast')).toContainText('Feita em');
        await expect(grupo(page, 'Concluídas')).toHaveText('Concluídas 1');
        await expect(tarefa(page, 'Certificar decurso')).toHaveClass(/done/);
        await expect(tarefa(page, 'Certificar decurso').locator('.doneat')).toContainText('Feita em');
        expect(banco.org.tarefas[0]).toMatchObject({ etapa: 'feito' });
        expect(banco.org.tarefas[0].feita_em).toBeTruthy();
        await tarefa(page, 'Certificar decurso').locator('[data-act="feita"]').click();
        await expect(grupo(page, 'Sem prazo')).toHaveText('Sem prazo 1');
        await expect.poll(() => banco.org.tarefas[0].feita_em).toBeNull();

        await tarefa(page, 'Certificar decurso').locator('[data-act="editar"]').click();
        await expect(page.locator('#oeTitulo')).toHaveValue('Certificar decurso');
        await page.fill('#oeTitulo', 'certificar decurso de prazo');
        await page.fill('#oePrazo', diaMais(1));
        await page.selectOption('#oeUrg', 'alta');
        await page.selectOption('#oeResp', 'Cartório');
        await page.fill('#oeProc', '00055211420238110008');
        await page.locator('#orgTasks form[data-form="editar"] button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Tarefa atualizada');
        const t = tarefa(page, 'Certificar decurso de prazo');
        await expect(t).toContainText('Vence amanhã');
        await expect(t.locator('.tag.alta')).toHaveText('Alta');
        await expect(t.locator('.proc-copy')).toHaveText('0005521-14.2023.8.11.0008');
        expect(banco.org.tarefas[0]).toMatchObject({ titulo: 'Certificar decurso de prazo', prazo: diaMais(1), prioridade: 'alta', responsavel: 'Cartório', processo: '0005521-14.2023.8.11.0008' });

        await t.locator('[data-act="editar"]').click();
        await page.locator('#orgTasks [data-act="cancelar"]').click();
        await expect(page.locator('#oeTitulo')).toHaveCount(0);
        await t.locator('[data-act="editar"]').click();
        const excluir = page.locator('#orgTasks [data-act="excluir-tarefa"]');
        await excluir.click();
        await expect(excluir).toHaveText('Confirmar exclusão');
        await excluir.click();
        await expect(page.locator('#toast')).toHaveText('Tarefa excluída');
        await expect(page.locator('#orgTasks .org-empty')).toHaveText('Nenhuma tarefa ainda. Escreva acima e clique em "Adicionar".');
        expect(banco.org.tarefas).toHaveLength(0);
      });

      test('edita o título direto no texto, com a correção', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: null, titulo: 'Juntar documento' }] });
        await gestor(page);
        await abaOrg(page, 'lista');
        const el = tarefa(page, 'Juntar documento').locator('[data-edit="tarefa"]');
        await el.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' da peticao');
        await page.keyboard.press('Enter');
        await expect(page.locator('#toast')).toHaveText('Tarefa atualizada');
        await expect.poll(() => banco.org.tarefas[0].titulo).toBe('Juntar documento da petição');
        await expect(tarefa(page, 'Juntar documento da petição')).toBeVisible();
      });

      test('muda a ordem dentro do grupo pela alça (teclado)', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: null, titulo: 'Primeira' }, { dono: null, titulo: 'Segunda' }] });
        await gestor(page);
        await abaOrg(page, 'lista');
        await expect(page.locator('#orgTasks .task .t-title')).toHaveText(['Primeira', 'Segunda']);
        await tarefa(page, 'Primeira').locator('[data-tgrip]').focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('#orgTasks .task .t-title')).toHaveText(['Segunda', 'Primeira']);
        await expect.poll(() => banco.org.tarefas.find(t => t.titulo === 'Segunda').ordem_lista).toBe(10);
        expect(banco.org.tarefas.find(t => t.titulo === 'Primeira').ordem_lista).toBe(20);
      });

      test('muda a ordem arrastando pela alça com o mouse', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: null, titulo: 'Primeira' }, { dono: null, titulo: 'Segunda' }, { dono: null, titulo: 'Terceira' }] });
        await gestor(page);
        await abaOrg(page, 'lista');
        await expect(page.locator('#orgTasks .task .t-title')).toHaveText(['Primeira', 'Segunda', 'Terceira']);
        await tarefa(page, 'Terceira').locator('[data-tgrip]').dragTo(tarefa(page, 'Primeira'), { targetPosition: { x: 20, y: 4 } });
        await expect(page.locator('#orgTasks .task .t-title')).toHaveText(['Terceira', 'Primeira', 'Segunda']);
        await expect.poll(() => banco.org.tarefas.find(t => t.titulo === 'Terceira').ordem_lista).toBe(10);
      });

      test('tarefa mandada pelo gestor aparece marcada e não pode ser excluída pela pessoa', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir mandado', do_gestor: true }] });
        await pessoa(page, 'Ana Souza');
        await abaOrg(page, 'lista');
        await expect(tarefa(page, 'Expedir mandado').locator('.tag.gestor')).toHaveText('Do gestor');
        await tarefa(page, 'Expedir mandado').locator('[data-act="editar"]').click();
        await expect(page.locator('#orgTasks .field-hint')).toHaveText('Mandada pelo gestor: não pode ser excluída.');
        await expect(page.locator('#orgTasks [data-act="excluir-tarefa"]')).toHaveCount(0);
      });

      test('processo que já está com alguém pede confirmação', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Juntar AR', processo: '0001226-43.2017.8.11.0008' }] });
        await gestor(page);
        await abaOrg(page, 'lista');
        await page.fill('#orgTaskTitle', 'Expedir ofício');
        await page.fill('#orgTaskProc', '0001226-43.2017.8.11.0008');
        await page.locator('#orgTaskForm button[type=submit]').click();
        await expect(page.locator('#orgDupDialog')).toBeVisible();
        await expect(page.locator('#orgDupInfo')).toHaveText('Há 1 tarefa em aberto com o processo 0001226-43.2017.8.11.0008:');
        await expect(page.locator('#orgDupLista')).toHaveText('Ana Souza: Juntar AR · A fazer');
        await page.locator('#orgDupDialog button[value="nao"]').click();
        await expect(page.locator('#orgDupDialog')).not.toBeVisible();
        expect(banco.org.tarefas).toHaveLength(1);
        await page.locator('#orgTaskForm button[type=submit]').click();
        await page.locator('#orgDupSim').click();
        await expect(page.locator('#toast')).toHaveText('Tarefa adicionada');
        expect(banco.org.tarefas).toHaveLength(2);
      });

      test('mural: cola nota com cor e título, fixa, edita e remove', async ({ page, banco }) => {
        equipe(banco, { notas: [{ dono: null, texto: 'Nota antiga' }] });
        await gestor(page);
        await abaOrg(page, 'lista');
        await page.locator('#orgSwatches [data-cor="verde"]').click();
        await expect(page.locator('#orgSwatches [data-cor="verde"]')).toHaveAttribute('aria-pressed', 'true');
        await page.fill('#orgNoteTitulo', 'plantao');
        await page.fill('#orgNoteText', 'reuniao na sexta');
        await page.locator('#orgNoteForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Nota colada no mural');
        const nova = page.locator('#orgBoard .note', { hasText: 'Reunião na sexta' });
        await expect(nova).toHaveClass(/c-verde/);
        await expect(nova.locator('.note-titulo')).toHaveText('Plantão');
        expect(banco.org.notas.find(n => n.texto === 'Reunião na sexta')).toMatchObject({ cor: 'verde', titulo: 'Plantão', dono: null });
        await expect(page.locator('#orgNotesInfo')).toHaveText('0 fixadas · 2 notas · clique no texto para editar');

        const antiga = page.locator('#orgBoard .note', { hasText: 'Nota antiga' });
        await antiga.locator('[data-act="fixar"]').click();
        await expect(page.locator('#orgBoard .note').first()).toContainText('Nota antiga');
        await expect(page.locator('#orgBoard .note').first().locator('.pin-badge')).toHaveText('Fixado');
        await expect(page.locator('#orgNotesInfo')).toHaveText('1 fixada · 2 notas · clique no texto para editar');

        await antiga.locator('.note-text').click();
        await page.keyboard.press('End');
        await page.keyboard.type(' de março');
        await antiga.locator('.note-text').blur();
        await expect(page.locator('#toast')).toHaveText('Nota atualizada');
        await expect.poll(() => banco.org.notas.find(n => n.fixada).texto).toBe('Nota antiga de março');

        await page.locator('#orgBoard .note', { hasText: 'Reunião na sexta' }).locator('[data-act="excluir-nota"]').click();
        await expect(page.locator('#toast')).toHaveText('Nota removida');
        await expect(page.locator('#orgBoard .note')).toHaveCount(1);
      });
    });

    test.describe('lembretes', () => {
      test('cria lembrete com a correção automática (maiúscula e acentos da vara)', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page, 'Ana Souza');
        await abaOrg(page, 'lembretes');
        await expect(page.locator('#orgLemData')).toHaveValue(hojeVara());
        await page.fill('#orgLemTexto', 'ligar para o perito sobre a intimacao');
        await page.locator('#orgLemForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Lembrete adicionado');
        await expect(page.locator('#orgLemList')).toContainText('Ligar para o perito sobre a intimação');
        expect(banco.org.lembretes[0]).toMatchObject({ dono: ANA, texto: 'Ligar para o perito sobre a intimação', data: hojeVara() });
      });

      test('atrasados, hoje e próximos dias; concluir, desfazer, editar e excluir', async ({ page, banco }) => {
        equipe(banco, { lembretes: [
          { dono: null, texto: 'Atrasado', data: diaMais(-3) },
          { dono: null, texto: 'Hoje sem hora', data: diaMais(0) },
          { dono: null, texto: 'Daqui a dois dias', data: diaMais(2) },
          { dono: null, texto: 'Amanhã', data: diaMais(1) }
        ] });
        await gestor(page);
        await abaOrg(page, 'lembretes');
        await expect(page.locator('.org-tab[data-tab="lembretes"] .org-tab-n')).toHaveText('2');
        await expect(page.locator('#orgLemStats .ostat b')).toHaveText(['1', '1', '2']);
        await expect(page.locator('#orgLemList .tgroup-title').nth(0)).toHaveText('Atrasados 1');
        await expect(page.locator('#orgLemList .tgroup-title').nth(2)).toHaveText('Próximos dias 2');
        const atr = page.locator('#orgLemList .rem', { hasText: 'Atrasado' });
        await expect(atr).toHaveClass(/late/);
        await expect(atr.locator('.late')).toHaveText('Atrasado 3 dias');
        await expect(atr.locator('time')).toHaveText(br(diaMais(-3)));
        await expect(page.locator('#orgLemList .rem').nth(2)).toContainText('Amanhã');
        await expect(page.locator('#orgLemList .rem').nth(3)).toContainText('Em 2 dias');
        const hoje = page.locator('#orgLemList .rem', { hasText: 'Hoje sem hora' });
        await expect(hoje.locator('time')).toHaveText('sem hora');
        await hoje.locator('[data-act="lem-feito"]').click();
        await expect(hoje).toHaveClass(/done/);
        await expect(hoje.locator('[data-act="lem-feito"]')).toHaveText('Desfazer');
        expect(banco.org.lembretes.find(l => l.texto === 'Hoje sem hora').feito_em).toBeTruthy();
        await hoje.locator('[data-act="lem-feito"]').click();
        await expect(hoje.locator('[data-act="lem-feito"]')).toHaveText('Concluir');

        await hoje.locator('[data-edit="lembrete"]').click();
        await page.keyboard.press('End');
        await page.keyboard.type(' (audiencia)');
        await page.keyboard.press('Enter');
        await expect(page.locator('#toast')).toHaveText('Lembrete atualizado');
        await expect.poll(() => banco.org.lembretes.find(l => l.data === diaMais(0)).texto).toBe('Hoje sem hora (audiência)');

        await atr.locator('[data-act="lem-excluir"]').click();
        await expect(page.locator('#toast')).toHaveText('Lembrete excluído');
        await expect(page.locator('#orgLemList .rem')).toHaveCount(3);
      });
    });

    test.describe('rotinas', () => {
      test('o gestor cadastra, marca como feita e exclui com confirmação', async ({ page, banco }) => {
        equipe(banco, { rotinas: [{ titulo: 'Estatística ao CNJ', frequencia: 'mensal' }] });
        await gestor(page);
        await abaOrg(page, 'rotinas');
        await expect(page.locator('.org-tab[data-tab="rotinas"] .org-tab-n')).toHaveText('1');
        await expect(page.locator('#orgRotList .task')).toContainText('Pendente neste mês');
        await page.fill('#orgRotTitulo', 'conferir a pauta da semana');
        await page.selectOption('#orgRotFreq', 'semanal');
        await page.locator('#orgRotForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Rotina adicionada');
        await expect(page.locator('#orgRotList .task .editable')).toHaveText(['Conferir a pauta da semana', 'Estatística ao CNJ']);
        await expect(page.locator('#orgRotList .freq')).toHaveText(['Semanal', 'Mensal']);
        expect(banco.org.rotinas.find(r => r.titulo === 'Conferir a pauta da semana')).toMatchObject({ frequencia: 'semanal' });

        const cnj = page.locator('#orgRotList .task', { hasText: 'Estatística ao CNJ' });
        await cnj.locator('[data-act="rot-feita"]').click();
        await expect(page.locator('#toast')).toContainText('Rotina feita em');
        await expect(page.locator('#orgRotList .task', { hasText: 'Estatística ao CNJ' })).toHaveClass(/rot-done/);
        await expect(page.locator('#orgRotInfo')).toHaveText('1 de 2 feitas no período · clique no título para editar');
        await expect(page.locator('#orgRotProg')).toHaveAttribute('aria-valuenow', '50');

        const excluir = page.locator('#orgRotList .task', { hasText: 'Conferir a pauta' }).locator('[data-act="rot-excluir"]');
        await excluir.click();
        await expect(excluir).toContainText('Excluir?');
        await excluir.click();
        await expect(page.locator('#toast')).toHaveText('Rotina excluída');
        expect(banco.org.rotinas).toHaveLength(1);
      });
    });
  });
}

// Só no sistema novo: as abas que ainda não passaram para cá abrem no sistema atual, com a mesma entrada
test('sistema novo: aba que ainda está no sistema atual abre lá, já com a pessoa que entrou', async ({ page, banco }) => {
  equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Tarefa da Ana' }] });
  await entrarComoPessoa(page, 'Ana Souza', '/novo/organizacao');
  await expect(page.locator('.org-tab[data-tab="quadro"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#orgPaneQuadro')).toContainText('Esta parte da Organização ainda está no sistema atual.');
  await page.locator('#orgPaneQuadro button', { hasText: 'Abrir Quadro no sistema atual' }).click();
  await expect(page).toHaveURL(/\/#organizacao$/);
  await expect(page.locator('#orgH1')).toHaveText('Olá, Ana!');
  await expect(page.locator('#orgKanban .kcard', { hasText: 'Tarefa da Ana' })).toBeVisible();
});
