// Organização: abas Tarefas e mural, Lembretes e Rotinas.
// Os mesmos testes rodam no sistema atual (/#organizacao) e no sistema novo (/novo/organizacao).
const { test, expect, hojeVara } = require('../apoio/teste');
const { ANA, BIA, equipe, entrarComoPessoa, entrarComoGestor, abaOrg } = require('../apoio/org');

const VERSOES = [
  { nome: 'sistema atual', endereco: '/#organizacao' },
  { nome: 'sistema novo', endereco: '/novo/organizacao' }
];
const diaMais = n => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(Date.now() + n * 86400000));
const tarefa = (banco, titulo) => banco.org.tarefas.find(t => t.titulo === titulo);
const linha = (page, texto) => page.locator('#orgTasks .task', { hasText: texto });
const grupo = (page, nome) => page.locator('#orgTasks .tgroup-itens[data-grupo="' + nome + '"]');
const editarTexto = async (loc, texto) => { await loc.click(); await loc.fill(texto); await loc.press('Enter'); };

for (const v of VERSOES){
  test.describe(v.nome, () => {
    const pessoa = async (page, aba = 'lista') => { await entrarComoPessoa(page, 'Ana Souza', v.endereco); await abaOrg(page, aba); };
    const gestor = async (page, aba) => { await entrarComoGestor(page, undefined, v.endereco); await expect(page.locator('#orgContent')).toBeVisible(); await abaOrg(page, aba); };

    test.describe('tarefas', () => {
      test('cria tarefa com prazo e prioridade, que cai no grupo certo', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await expect(page.locator('#orgTasks')).toContainText('Nenhuma tarefa ainda');
        await page.fill('#orgTaskTitle', 'fazer intimacao do perito');
        await page.fill('#orgTaskDue', hojeVara());
        await page.selectOption('#orgTaskUrg', 'urgente');
        await page.locator('#orgTaskForm button[type=submit]').click();
        await expect(grupo(page, 'Hoje')).toContainText('Fazer intimação do perito');
        await expect(linha(page, 'Fazer intimação do perito')).toContainText('Urgente');
        await expect(linha(page, 'Fazer intimação do perito')).toContainText('Vence hoje');
        await expect(page.locator('#orgTaskTitle')).toHaveValue('');
        expect(tarefa(banco, 'Fazer intimação do perito')).toMatchObject({ dono: ANA, prazo: hojeVara(), prioridade: 'urgente', etapa: 'afazer' });
        await expect(page.locator('#orgTasksInfo')).toContainText('1 em aberto');
      });

      test('o número do processo escrito no título vai para o campo do processo', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await page.fill('#orgTaskTitle', '0001234-56.2026.8.11.0001 juntar AR');
        await page.locator('#orgTaskForm button[type=submit]').click();
        await expect(linha(page, 'Juntar AR')).toContainText('0001234-56.2026.8.11.0001');
        expect(tarefa(banco, 'Juntar AR').processo).toBe('0001234-56.2026.8.11.0001');
      });

      test('separa as tarefas em Atrasadas, Hoje, Próximas, Sem prazo e Concluídas', async ({ page, banco }) => {
        equipe(banco, { tarefas: [
          { dono: ANA, titulo: 'Velha', prazo: diaMais(-3) }, { dono: ANA, titulo: 'De hoje', prazo: hojeVara() },
          { dono: ANA, titulo: 'Amanhã', prazo: diaMais(1) }, { dono: ANA, titulo: 'Solta' },
          { dono: ANA, titulo: 'Pronta', etapa: 'feito', feita_em: new Date().toISOString() }
        ] });
        await pessoa(page);
        await expect(page.locator('#orgTasks .tgroup-title')).toHaveText(['Atrasadas 1', 'Hoje 1', 'Próximas 1', 'Sem prazo 1', 'Concluídas 1']);
        await expect(linha(page, 'Velha')).toContainText('Atrasada 3 dias');
        await expect(linha(page, 'Amanhã')).toContainText('Vence amanhã');
        await expect(page.locator('#orgTasksInfo')).toContainText('4 em aberto');
      });

      test('marcar como feita move para Concluídas e desmarcar volta', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Certificar decurso' }] });
        await pessoa(page);
        await linha(page, 'Certificar decurso').locator('[data-act="feita"]').click();
        await expect(grupo(page, 'Concluídas')).toContainText('Certificar decurso');
        expect(tarefa(banco, 'Certificar decurso')).toMatchObject({ etapa: 'feito' });
        expect(tarefa(banco, 'Certificar decurso').feita_em).toBeTruthy();
        await linha(page, 'Certificar decurso').locator('[data-act="feita"]').click();
        await expect(grupo(page, 'Sem prazo')).toContainText('Certificar decurso');
        expect(tarefa(banco, 'Certificar decurso')).toMatchObject({ etapa: 'afazer', feita_em: null });
      });

      test('o texto da tarefa se edita clicando nele (Enter salva, Esc desfaz)', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir oficio' }] });
        await pessoa(page);
        const campo = page.locator('#orgTasks .editable[data-edit="tarefa"]');
        await campo.click();
        await campo.fill('Mudei de ideia');
        await campo.press('Escape');
        await expect(campo).toHaveText('Expedir oficio');
        expect(banco.org.tarefas[0].titulo).toBe('Expedir oficio');
        await editarTexto(campo, 'expedir certidao de transito');
        await expect(campo).toHaveText('Expedir certidão de trânsito');
        await expect.poll(() => banco.org.tarefas[0].titulo).toBe('Expedir certidão de trânsito');
      });

      test('o lápis abre a edição na linha; salvar grava e excluir pede confirmação', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Minuta de despacho' }, { dono: ANA, titulo: 'Do gestor', do_gestor: true }] });
        await pessoa(page);
        await linha(page, 'Do gestor').locator('[data-act="editar"]').click();
        await expect(page.locator('[data-act="excluir-tarefa"]')).toHaveCount(0);
        await page.locator('[data-act="cancelar"]').click();
        await linha(page, 'Minuta de despacho').locator('[data-act="editar"]').click();
        await page.fill('#oeTitulo', 'Minuta revisada');
        await page.fill('#oePrazo', diaMais(4));
        await page.selectOption('#oeUrg', 'alta');
        await page.fill('#oeProc', '00012264320178110008');
        await page.locator('form[data-form="editar"] button[type=submit]').click();
        await expect(grupo(page, 'Próximas')).toContainText('Minuta revisada');
        await expect(linha(page, 'Minuta revisada')).toContainText('Alta');
        expect(tarefa(banco, 'Minuta revisada')).toMatchObject({ prazo: diaMais(4), prioridade: 'alta', processo: '0001226-43.2017.8.11.0008' });
        await linha(page, 'Minuta revisada').locator('[data-act="editar"]').click();
        await page.locator('[data-act="excluir-tarefa"]').click();
        await expect(page.locator('[data-act="excluir-tarefa"]')).toHaveText('Confirmar exclusão');
        expect(tarefa(banco, 'Minuta revisada')).toBeTruthy();
        await page.locator('[data-act="excluir-tarefa"]').click();
        await expect(linha(page, 'Minuta revisada')).toHaveCount(0);
        expect(tarefa(banco, 'Minuta revisada')).toBeUndefined();
      });

      test('tarefa do gestor pede o fechamento ao ser marcada como feita', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir mandado', do_gestor: true }] });
        await pessoa(page);
        await linha(page, 'Expedir mandado').locator('[data-act="feita"]').click();
        await expect(page.locator('#orgFechDialog')).toBeVisible();
        await page.fill('#ofHoras', '2');
        await page.click('#ofConcluir');
        await expect(grupo(page, 'Concluídas')).toContainText('Expedir mandado');
        expect(banco.org.tarefas[0]).toMatchObject({ etapa: 'feito', conclusao: { horas: 2, conformidade: 'sim' } });
      });

      test('a alça muda a ordem dentro do grupo com as setas', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Primeira', prazo: diaMais(3) }, { dono: ANA, titulo: 'Segunda', prazo: diaMais(5) }] });
        await pessoa(page);
        await expect(grupo(page, 'Próximas').locator('.editable')).toHaveText(['Primeira', 'Segunda']);
        await linha(page, 'Primeira').locator('[data-tgrip]').focus();
        await page.keyboard.press('ArrowDown');
        await expect(grupo(page, 'Próximas').locator('.editable')).toHaveText(['Segunda', 'Primeira']);
        await expect.poll(() => tarefa(banco, 'Segunda').ordem_lista < tarefa(banco, 'Primeira').ordem_lista).toBe(true);
        await page.keyboard.press('ArrowUp');
        await expect(grupo(page, 'Próximas').locator('.editable')).toHaveText(['Primeira', 'Segunda']);
      });

      test('só vê as tarefas da tela aberta e o gestor vê a de cada pessoa', async ({ page, banco }) => {
        equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Da Ana' }, { dono: BIA, titulo: 'Da Bia' }, { dono: null, titulo: 'Do gestor' }] });
        await gestor(page, 'lista');
        await expect(linha(page, 'Do gestor')).toBeVisible();
        await expect(page.locator('#orgTasks')).not.toContainText('Da Ana');
        await page.selectOption('#orgVer', { label: 'Tela de Bia Lima' });
        await expect(linha(page, 'Da Bia')).toBeVisible();
        await expect(page.locator('#orgTasks')).not.toContainText('Do gestor');
      });
    });

    test.describe('mural', () => {
      test('cola uma nota com título e cor, fixa, edita e remove', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page);
        await expect(page.locator('#orgBoard')).toContainText('Nenhuma nota ainda');
        await page.fill('#orgNoteTitulo', 'Malote');
        await page.fill('#orgNoteText', 'sai as 15h');
        await page.locator('#orgSwatches [data-cor="verde"]').click();
        await page.locator('#orgNoteForm button[type=submit]').click();
        const nota = page.locator('#orgBoard .note');
        await expect(nota).toHaveClass(/c-verde/);
        await expect(nota.locator('.note-titulo')).toHaveText('Malote');
        await expect(nota.locator('.note-text')).toHaveText('Sai as 15h');
        expect(banco.org.notas[0]).toMatchObject({ dono: ANA, texto: 'Sai as 15h', titulo: 'Malote', cor: 'verde', fixada: false });

        await nota.locator('[data-act="fixar"]').click();
        await expect(nota).toHaveClass(/pinned/);
        await expect(nota.locator('.pin-badge')).toHaveText('Fixado');
        await expect(page.locator('#orgNotesInfo')).toContainText('1 fixada');

        await nota.locator('.note-text').click();
        await nota.locator('.note-text').fill('sai as 16h na audiencia');
        await nota.locator('.note-titulo').click();   // sair do campo salva
        await expect(page.locator('#toast')).toHaveText('Nota atualizada');
        expect(banco.org.notas[0].texto).toBe('Sai as 16h na audiência');

        await nota.locator('.note-titulo').fill('');
        await nota.locator('.note-text').click();
        await expect.poll(() => banco.org.notas[0].titulo).toBe('');

        await nota.locator('[data-act="excluir-nota"]').click();
        await expect(page.locator('#orgBoard .note')).toHaveCount(0);
        expect(banco.org.notas).toHaveLength(0);
      });

      test('as notas fixadas ficam no topo', async ({ page, banco }) => {
        equipe(banco, { notas: [
          { dono: ANA, texto: 'Velha fixada', fixada: true, created_at: '2026-01-01T10:00:00Z' },
          { dono: ANA, texto: 'Nova', created_at: '2026-02-01T10:00:00Z' },
          { dono: ANA, texto: 'Meio', created_at: '2026-01-15T10:00:00Z' }
        ] });
        await pessoa(page);
        await expect(page.locator('#orgBoard .note-text')).toHaveText(['Velha fixada', 'Nova', 'Meio']);
      });
    });

    test.describe('lembretes', () => {
      test('cria lembrete com a correção automática e conclui, desfaz e exclui', async ({ page, banco }) => {
        equipe(banco);
        await pessoa(page, 'lembretes');
        await expect(page.locator('#orgLemList')).toContainText('Nenhum lembrete para hoje');
        await page.fill('#orgLemTexto', 'ligar para o perito sobre a intimacao');
        await page.locator('#orgLemForm button[type=submit]').click();
        const l = page.locator('#orgLemList .rem', { hasText: 'Ligar para o perito sobre a intimação' });
        await expect(l).toBeVisible();
        expect(banco.org.lembretes[0]).toMatchObject({ dono: ANA, texto: 'Ligar para o perito sobre a intimação', data: hojeVara() });
        await expect(page.locator('#orgLemStats .ostat').first()).toContainText('1');
        await expect(page.locator('.org-tab[data-tab="lembretes"] .org-tab-n')).toHaveText('1');
        await l.locator('[data-act="lem-feito"]').click();
        await expect(l).toHaveClass(/done/);
        await expect(l.locator('.doneat')).toContainText('Feito às');
        expect(banco.org.lembretes[0].feito_em).toBeTruthy();
        await expect(l.locator('[data-act="lem-feito"]')).toHaveText('Desfazer');
        await l.locator('[data-act="lem-feito"]').click();
        await expect(l).not.toHaveClass(/done/);
        expect(banco.org.lembretes[0].feito_em).toBeNull();
        await l.locator('[data-act="lem-excluir"]').click();
        await expect(page.locator('#orgLemList .rem')).toHaveCount(0);
        expect(banco.org.lembretes).toHaveLength(0);
      });

      test('separa atrasados, hoje e próximos dias', async ({ page, banco }) => {
        equipe(banco, { lembretes: [
          { dono: ANA, texto: 'Atrasado', data: diaMais(-2) }, { dono: ANA, texto: 'De hoje', data: hojeVara() },
          { dono: ANA, texto: 'Amanhã', data: diaMais(1) }, { dono: ANA, texto: 'Mais pra frente', data: diaMais(5) }
        ] });
        await pessoa(page, 'lembretes');
        await expect(page.locator('#orgLemList .tgroup-title')).toContainText(['Atrasados 1', 'Hoje', 'Próximos dias 2']);
        await expect(page.locator('#orgLemList .rem', { hasText: 'Atrasado' })).toContainText('Atrasado 2 dias');
        await expect(page.locator('#orgLemList .rem', { hasText: 'Amanhã' })).toContainText('Amanhã');
        await expect(page.locator('#orgLemList .rem', { hasText: 'Mais pra frente' })).toContainText('Em 5 dias');
        await expect(page.locator('#orgLemStats .ostat')).toHaveText([/1\s*para hoje/, /1\s*horário passou/, /2\s*próximos dias/]);
      });

      test('o texto do lembrete se edita clicando nele', async ({ page, banco }) => {
        equipe(banco, { lembretes: [{ dono: ANA, texto: 'Pedir certidao', data: hojeVara() }] });
        await pessoa(page, 'lembretes');
        const campo = page.locator('#orgLemList .editable[data-edit="lembrete"]');
        await editarTexto(campo, 'Pedir certidao ao cartorio');
        await expect(campo).toHaveText('Pedir certidão ao cartório');
        await expect.poll(() => banco.org.lembretes[0].texto).toBe('Pedir certidão ao cartório');
      });

      test('a hora aparece no lembrete e o que já passou é avisado', async ({ page, banco }) => {
        equipe(banco, { lembretes: [{ dono: ANA, texto: 'Cedinho', data: hojeVara(), hora: '00:00:00' }] });
        await pessoa(page, 'lembretes');
        await expect(page.locator('#orgLemList .rem time')).toContainText('00:00');
        await expect(page.locator('#orgLemList .rem')).toContainText('Horário passou');
      });
    });

    test.describe('rotinas', () => {
      test('o gestor cria, marca como feita, edita e exclui a rotina', async ({ page, banco }) => {
        equipe(banco);
        await gestor(page, 'rotinas');
        await expect(page.locator('#orgRotList')).toContainText('Nenhuma rotina ainda');
        await page.fill('#orgRotTitulo', 'estatistica mensal ao CNJ');
        await page.selectOption('#orgRotFreq', 'mensal');
        await page.locator('#orgRotForm button[type=submit]').click();
        const r = page.locator('#orgRotList .task', { hasText: 'Estatística mensal ao CNJ' });
        await expect(r).toBeVisible();
        await expect(r).toContainText('Pendente neste mês');
        await expect(r.locator('.freq')).toHaveText('Mensal');
        expect(banco.org.rotinas[0]).toMatchObject({ titulo: 'Estatística mensal ao CNJ', frequencia: 'mensal', feita_em: null });
        await expect(page.locator('#orgRotInfo')).toContainText('0 de 1 feitas');
        await expect(page.locator('.org-tab[data-tab="rotinas"] .org-tab-n')).toHaveText('1');

        await r.locator('[data-act="rot-feita"]').click();
        await expect(r).toHaveClass(/rot-done/);
        await expect(r).toContainText('Feita em');
        await expect(page.locator('#orgRotInfo')).toContainText('1 de 1 feitas');
        await expect(page.locator('#orgRotProg')).toHaveAttribute('aria-valuenow', '100');
        expect(banco.org.rotinas[0].feita_em).toBeTruthy();
        await r.locator('[data-act="rot-feita"]').click();
        await expect(r).not.toHaveClass(/rot-done/);
        expect(banco.org.rotinas[0].feita_em).toBeNull();

        await editarTexto(page.locator('#orgRotList .editable'), 'relatorio semanal');   // (o texto muda, então não dá para achar a linha por ele)
        await expect.poll(() => banco.org.rotinas[0].titulo).toBe('Relatório semanal');

        const del = page.locator('#orgRotList .task').locator('[data-act="rot-excluir"]');
        await del.click();
        await expect(del).toContainText('Excluir?');
        expect(banco.org.rotinas).toHaveLength(1);
        await del.click();
        await expect(page.locator('#orgRotList .task')).toHaveCount(0);
        expect(banco.org.rotinas).toHaveLength(0);
      });

      test('as pendentes vêm primeiro e as mais frequentes antes', async ({ page, banco }) => {
        equipe(banco, { rotinas: [
          { titulo: 'Trimestral', frequencia: 'trimestral' }, { titulo: 'Mensal feita', frequencia: 'mensal', feita_em: new Date().toISOString() },
          { titulo: 'Semanal', frequencia: 'semanal' }, { titulo: 'Mensal', frequencia: 'mensal' }
        ] });
        await gestor(page, 'rotinas');
        await expect(page.locator('#orgRotList .task .editable')).toHaveText(['Semanal', 'Mensal', 'Trimestral', 'Mensal feita']);
      });

      test('a pessoa da equipe não tem a aba Rotinas', async ({ page, banco }) => {
        equipe(banco);
        await entrarComoPessoa(page, 'Ana Souza', v.endereco);
        await expect(page.locator('.org-tab[data-tab="rotinas"]')).toBeHidden();
      });
    });
  });
}

test('sistema novo: as abas que faltam continuam levando ao sistema atual', async ({ page, banco }) => {
  equipe(banco);
  await entrarComoGestor(page, undefined, '/novo/organizacao');
  await expect(page.locator('#orgContent')).toBeVisible();
  for (const aba of ['equipe', 'modelos', 'aniver']){
    await abaOrg(page, aba);
    await expect(page.locator('#orgPaneAindaAtual')).toContainText('ainda está no sistema atual');
  }
  for (const aba of ['lista', 'quadro', 'lembretes', 'rotinas']){
    await abaOrg(page, aba);
    await expect(page.locator('#orgPaneAindaAtual')).toHaveCount(0);
  }
});
