// Perícias: lista, cadastro (uma ou várias), situação, prazo do laudo, andamentos, conclusão, edição,
// alteração em lote, peritos e impressão.
// Os mesmos testes rodam no sistema atual (/#pericias) e no sistema novo (/novo/pericias).
const { test, expect, hojeVara } = require('../apoio/teste');

const VERSOES = [
  { nome: 'sistema atual', endereco: '/#pericias' },
  { nome: 'sistema novo', endereco: '/novo/pericias' }
];

function diaMais(n){ return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(Date.now() + n * 86400000)); }
const ISO = (dia, hora) => new Date(dia + 'T' + hora + ':00-04:00').toISOString();

const PERITOS = [
  { nome: 'Dra. Paula Andrade', especialidade: 'Médica', telefone: '(65) 99900-1122' },
  { nome: 'Dr. Ricardo Mendes', especialidade: 'Contábil' }
];
const MARIA = { processo: '1002345-67.2026.8.11.0041', autor: 'Maria Aparecida dos Santos', perito: 'Dra. Paula Andrade', especialidade: 'Médica',
  status: 'agendada', data_pericia: ISO(diaMais(5), '08:00'), local: 'Consultório central' };
const JOSE = { processo: '1002346-50.2026.8.11.0041', autor: 'José Carlos Ferreira', perito: 'Dr. Ricardo Mendes', especialidade: 'Contábil', status: 'nao_agendada' };

for (const v of VERSOES){
  test.describe(v.nome, () => {
    const abrir = async (page, txt = '2 perícias') => {
      await page.goto(v.endereco);
      await expect(page.locator('#perCount')).toHaveText(txt);
    };
    const cartao = (page, txt) => page.locator('.pcard', { hasText: txt });
    const chip = (page, txt) => page.locator('#perSituacao .chip', { hasText: new RegExp('^' + txt + '$') });

    test.describe('com duas perícias', () => {
      test.beforeEach(async ({ banco }) => {
        banco.semear('peritos', PERITOS);
        banco.semear('pericias', [MARIA, JOSE]);
      });

      test('mostra as perícias em andamento', async ({ page }) => {
        await abrir(page);
        await expect(page.locator('#perGroups')).toContainText('Maria Aparecida dos Santos');
        await expect(page.locator('#perGroups')).toContainText('Consultório central');
        // o telefone do perito cadastrado aparece no cartão
        await expect(cartao(page, 'Maria Aparecida')).toContainText('(65) 99900-1122');
        await expect(cartao(page, 'Maria Aparecida').locator('.pwhen')).toContainText('08:00');
        await expect(cartao(page, 'Maria Aparecida').locator('.stepper i.on')).toHaveCount(2);
        await expect(page.locator('#perGroups .day-label .d').last()).toHaveText('Aguardando data do perito');
        await expect(page.locator('#perAbaAnd')).toHaveText('2');
        await expect(page.locator('#perAbaPeritos')).toHaveText('2');
        await expect(page.locator('#perSummary .stat[data-sit="agendada"] .stat-num')).toHaveText('1');
        await expect(page.locator('#perSummary .stat[data-sit="nao_agendada"] .stat-num')).toHaveText('1');
      });

      test('cadastra uma perícia com data e registra o andamento automático', async ({ page, banco }) => {
        await abrir(page);
        await page.fill('#pProcesso', '10023471220268110041');
        await page.fill('#pAutor', 'Ana Beatriz Lima');
        await page.selectOption('#pPerito', 'Dr. Ricardo Mendes');
        await expect(page.locator('#pEsp')).toHaveValue('Contábil');
        await page.fill('#pData', diaMais(7));
        await page.fill('#pHora', '10:30');
        await page.locator('#perForm button[type=submit]').first().click();
        await expect(page.locator('#toast')).toHaveText('Perícia cadastrada como Agendada');
        await expect(page.locator('#perCount')).toHaveText('3 perícias');
        const nova = banco.tabelas.pericias.find(p => p.autor === 'Ana Beatriz Lima');
        expect(nova).toMatchObject({ processo: '1002347-12.2026.8.11.0041', perito: 'Dr. Ricardo Mendes', especialidade: 'Contábil', status: 'agendada' });
        expect(new Date(nova.data_pericia).toISOString()).toBe(ISO(diaMais(7), '10:30'));
        expect(banco.tabelas.pericias_andamentos.filter(a => a.pericia_id === nova.id).map(a => a.texto).join(' ')).toMatch(/^Perícia cadastrada\. Perícia agendada para /);
        await expect(page.locator('#pProcesso')).toHaveValue('');
        await expect(page.locator('#pAutor')).toHaveValue('');
      });

      test('não cadastra sem autor', async ({ page, banco }) => {
        await abrir(page);
        await page.fill('#pProcesso', '1002999-00.2026.8.11.0041');
        await page.selectOption('#pPerito', 'Dr. Ricardo Mendes');
        await page.locator('#perForm button[type=submit]').first().click();
        await page.waitForTimeout(300);
        expect(banco.tabelas.pericias).toHaveLength(2);
      });

      test('cadastra com perito novo, que entra no cadastro de peritos', async ({ page, banco }) => {
        await abrir(page);
        await page.fill('#pProcesso', '1002348-00.2026.8.11.0041');
        await page.fill('#pAutor', 'Carla Nunes');
        await page.selectOption('#pPerito', '__novo__');
        await expect(page.locator('#pNovoPerito')).toBeVisible();
        await page.fill('#pNovoPerito', 'Dr. Felipe Rocha');
        await page.selectOption('#pEsp', 'Engenharia');
        await page.locator('#perForm button[type=submit]').first().click();
        await expect(page.locator('#toast')).toHaveText('Perícia cadastrada como Não agendada');
        expect(banco.tabelas.peritos.find(p => p.nome === 'Dr. Felipe Rocha')).toMatchObject({ especialidade: 'Engenharia' });
        expect(banco.tabelas.pericias.find(p => p.autor === 'Carla Nunes')).toMatchObject({ perito: 'Dr. Felipe Rocha', status: 'nao_agendada' });
        await expect(page.locator('#pNovoPerito')).toBeHidden();
      });

      test('processo que já tem perícia em andamento pede confirmação', async ({ page, banco }) => {
        await abrir(page);
        await page.fill('#pProcesso', '1002345-67.2026.8.11.0041');
        await page.fill('#pAutor', 'Maria Aparecida dos Santos');
        await expect(page.locator('#perDupAviso')).toContainText('o processo 1002345-67.2026.8.11.0041 já tem perícia agendada para');
        await page.selectOption('#pPerito', 'Dr. Ricardo Mendes');
        await page.locator('#perForm button[type=submit]').first().click();
        await expect(page.locator('#perDupAviso [data-dup="confirmar"]')).toBeVisible();
        expect(banco.tabelas.pericias).toHaveLength(2);
        await page.click('#perDupAviso [data-dup="confirmar"]');
        await expect(page.locator('#perCount')).toHaveText('3 perícias');
        await expect(page.locator('#perDupAviso')).toBeHidden();
      });

      test('marcar como realizada começa a contar o prazo do laudo', async ({ page, banco }) => {
        await abrir(page);
        await cartao(page, 'Maria Aparecida').locator('select[data-pst]').selectOption('realizada');
        await expect(page.locator('#toast')).toContainText('Realizada. Laudo até');
        const p = banco.tabelas.pericias.find(x => x.autor === 'Maria Aparecida dos Santos');
        expect(p.status).toBe('realizada');
        expect(p.realizada_em).toBe(hojeVara());
        await expect(cartao(page, 'Maria Aparecida')).toContainText('para o laudo');
        expect(banco.tabelas.pericias_andamentos.map(a => a.texto).join('|')).toMatch(/Perícia realizada em .*Prazo do laudo: .* \(30 dias úteis\)/);
      });

      test('situação com data marcada, sem data, abre a edição', async ({ page, banco }) => {
        await abrir(page);
        await cartao(page, 'José Carlos').locator('select[data-pst]').selectOption('agendada');
        await expect(page.locator('#toast')).toHaveText('Informe a data da perícia');
        await expect(page.locator('#perDialog')).toBeVisible();
        await expect(page.locator('#peStatus')).toHaveValue('agendada');
        await page.fill('#peData', diaMais(10));
        await page.fill('#peHora', '14:00');
        await page.locator('#perEditForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Perícia atualizada');
        const p = banco.tabelas.pericias.find(x => x.autor === 'José Carlos Ferreira');
        expect(p).toMatchObject({ status: 'agendada', data_pericia: ISO(diaMais(10), '14:00') });
        expect(banco.tabelas.pericias_andamentos.map(a => a.texto)).toContain('Perícia agendada para ' + diaMais(10).split('-').reverse().join('/') + ' às 14:00');
      });

      test('edita a data, registra o andamento e exclui com confirmação', async ({ page, banco }) => {
        await abrir(page);
        await cartao(page, 'Maria Aparecida').locator('[data-pact="editar"]').click();
        await expect(page.locator('#peProcesso')).toHaveValue(MARIA.processo);
        await expect(page.locator('#peAutor')).toHaveValue(MARIA.autor);
        await expect(page.locator('#pePerito')).toHaveValue('Dra. Paula Andrade');
        await expect(page.locator('#peHora')).toHaveValue('08:00');
        await expect(page.locator('#pePrazoInfo')).toContainText('começa a contar quando a perícia é marcada como realizada');
        await page.fill('#peHora', '09:30');
        await page.locator('#perEditForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Perícia atualizada');
        expect(banco.tabelas.pericias_andamentos.map(a => a.texto)).toContain('Data da perícia alterada para ' + diaMais(5).split('-').reverse().join('/') + ' às 09:30');
        await cartao(page, 'Maria Aparecida').locator('[data-pact="editar"]').click();
        await page.click('#peDelete');
        await expect(page.locator('#peDelete')).toHaveText('Confirmar exclusão');
        await page.click('#peDelete');
        await expect(page.locator('#toast')).toHaveText('Perícia excluída');
        await expect(page.locator('#perCount')).toHaveText('1 perícia');
      });

      test('registra andamento, usa atalho, apaga e conclui com o laudo juntado', async ({ page, banco }) => {
        await abrir(page);
        const c = cartao(page, 'José Carlos');
        await c.locator('[data-pact="andamento"]').click();
        await expect(c.locator('.timeline-empty')).toHaveText('Nenhum andamento registrado ainda.');
        await c.locator('form[data-pform="andamento"] input').fill('Perito intimado por e-mail');
        await c.locator('form[data-pform="andamento"] button[type=submit]').click();
        await expect(c.locator('.timeline')).toContainText('Perito intimado por e-mail');
        expect(banco.tabelas.pericias_andamentos.map(a => a.texto)).toContain('Perito intimado por e-mail');
        await c.locator('[data-pact="atalho"]', { hasText: 'Perito aceitou' }).click();
        await expect(page.locator('#toast')).toHaveText('Andamento registrado');
        await expect(c.locator('.timeline li')).toHaveCount(2);
        await expect(c.locator('.and-btn .n')).toHaveText('2');
        const apagar = c.locator('.timeline li', { hasText: 'Perito aceitou' }).locator('[data-pact="and-excluir"]');
        await apagar.click();
        await expect(apagar).toContainText('Apagar?');
        await apagar.click();
        await expect(page.locator('#toast')).toHaveText('Andamento apagado');
        await expect(c.locator('.timeline li')).toHaveCount(1);

        await c.locator('[data-pact="concluir"]').click();
        await expect(page.locator('#toast')).toHaveText('Perícia concluída e movida para Concluídas');
        await expect(page.locator('#perCount')).toHaveText('1 perícia');
        expect(banco.tabelas.pericias.find(p => p.autor === 'José Carlos Ferreira')).toMatchObject({ status: 'laudo_juntado', laudo_em: hojeVara() });
        await page.click('#perAbas [data-aba="concluidas"]');
        await expect(page.locator('#perGroups')).toContainText('José Carlos Ferreira');
        await expect(cartao(page, 'José Carlos')).toHaveClass(/closed/);
        await expect(cartao(page, 'José Carlos').locator('.pmeta .good')).toContainText('Laudo juntado em');
      });

      test('marca e desmarca a conferência', async ({ page, banco }) => {
        await abrir(page);
        const c = cartao(page, 'Maria Aparecida');
        await c.locator('[data-pact="conferir"]').click();
        await expect(page.locator('#toast')).toContainText('Conferida em');
        await expect(cartao(page, 'Maria Aparecida').locator('.conf-btn')).toHaveClass(/done/);
        expect(banco.tabelas.pericias.find(p => p.autor === MARIA.autor).conferida_em).toBeTruthy();
        await cartao(page, 'Maria Aparecida').locator('[data-pact="conferir"]').click();
        await expect(page.locator('#toast')).toHaveText('Conferência desmarcada');
        expect(banco.tabelas.pericias.find(p => p.autor === MARIA.autor).conferida_em).toBeNull();
      });

      test('filtros: situação, resumo, perito e busca', async ({ page }) => {
        await abrir(page);
        await chip(page, 'Não agendadas').click();
        await expect(page.locator('#perCount')).toHaveText('1 perícia');
        await expect(page.locator('#perGroups')).toContainText('José Carlos');
        await chip(page, 'Todas em andamento').click();
        await page.locator('#perSummary .stat[data-sit="agendada"]').click();
        await expect(page.locator('#perCount')).toHaveText('1 perícia');
        await expect(chip(page, 'Agendadas')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#perSummary .stat[data-sit="agendada"]').click();
        await expect(page.locator('#perCount')).toHaveText('2 perícias');
        await page.selectOption('#perFiltroPerito', { label: 'Dr. Ricardo Mendes' });
        await expect(page.locator('#perCount')).toHaveText('1 perícia');
        await page.selectOption('#perFiltroPerito', { label: 'Todos os peritos' });
        await page.fill('#perSearch', '100234650');
        await expect(page.locator('#perCount')).toHaveText('1 perícia');
        await page.fill('#perSearch', 'consultorio');
        await expect(page.locator('#perGroups')).toContainText('Maria Aparecida');
        await page.click('#perClearSearch');
        await expect(page.locator('#perCount')).toHaveText('2 perícias');
        await chip(page, 'Laudo atrasado').click();
        await expect(page.locator('#perEmpty')).toHaveText('Nenhuma perícia nesta situação.');
      });

      test('alteração em lote: marca as selecionadas como realizadas', async ({ page, banco }) => {
        await abrir(page);
        await expect(page.locator('#perBatch')).toBeHidden();
        await cartao(page, 'Maria Aparecida').locator('[data-psel]').check();
        await expect(page.locator('#perBatchN')).toHaveText('1 perícia selecionada');
        await cartao(page, 'José Carlos').locator('[data-psel]').check();
        await expect(page.locator('#perBatchN')).toHaveText('2 perícias selecionadas');
        await expect(page.locator('#perBatchSt')).toHaveValue('realizada');
        await expect(page.locator('#perBatchData')).toHaveValue(hojeVara());
        await page.fill('#perBatchAnd', 'mutirão de perícias');
        await page.click('#perBatchApply');
        await expect(page.locator('#toast')).toContainText('2 perícias alteradas: Realizada em');
        await expect(page.locator('#perBatch')).toBeHidden();
        for (const autor of [MARIA.autor, JOSE.autor]) expect(banco.tabelas.pericias.find(p => p.autor === autor)).toMatchObject({ status: 'realizada', realizada_em: hojeVara() });
        expect(banco.tabelas.pericias_andamentos.filter(a => a.texto === 'mutirão de perícias')).toHaveLength(2);
        await expect(page.locator('#perSummary .stat[data-sit="realizada"] .stat-num')).toHaveText('2');
      });

      test('alteração em lote: agenda em sequência e "selecionar as" do grupo', async ({ page, banco }) => {
        banco.semear('pericias', [{ processo: '1002350-00.2026.8.11.0041', autor: 'Pedro Alves', perito: 'Dr. Ricardo Mendes', status: 'nao_agendada' }]);
        await abrir(page, '3 perícias');
        const grupo = page.locator('#perGroups .day', { hasText: 'Aguardando data do perito' });
        await grupo.locator('.day-sel').click();
        await expect(page.locator('#perBatchN')).toHaveText('2 perícias selecionadas');
        await expect(grupo.locator('.day-sel')).toHaveText('Desmarcar as 2');
        await page.selectOption('#perBatchSt', 'agendada');
        await expect(page.locator('#perBatchDataLbl')).toHaveText('Data da perícia');
        await page.fill('#perBatchData', diaMais(9));
        await page.fill('#perBatchHora', '13:00');
        await page.fill('#perBatchInt', '20');
        await page.click('#perBatchApply');
        await expect(page.locator('#toast')).toHaveText('2 perícias alteradas: Agendada');
        // sem data: na ordem do processo
        expect(banco.tabelas.pericias.find(p => p.autor === JOSE.autor).data_pericia).toBe(ISO(diaMais(9), '13:00'));
        expect(banco.tabelas.pericias.find(p => p.autor === 'Pedro Alves').data_pericia).toBe(ISO(diaMais(9), '13:20'));
      });

      test('imprime a lista da tela com os filtros', async ({ page }) => {
        await abrir(page);
        await page.evaluate(() => { window.print = () => { window.__impresso = document.getElementById('printArea').innerText; }; });
        await chip(page, 'Agendadas').click();
        await page.click('#perPrint');
        const txt = await page.evaluate(() => window.__impresso);
        expect(txt).toContain('Perícias');
        expect(txt).toContain('Em andamento: Agendadas');
        expect(txt).toContain('1 perícia');
        expect(txt).toContain('Maria Aparecida dos Santos');
        expect(txt).not.toContain('José Carlos');
        await page.click('#perAbas [data-aba="peritos"]');
        await page.click('#perPrint');
        await expect(page.locator('#toast')).toHaveText('Abra "Em andamento" ou "Concluídas" para imprimir a lista de perícias.');
      });

      test('peritos: cadastra, edita (as perícias acompanham o nome), completa e exclui', async ({ page, banco }) => {
        banco.semear('pericias', [{ processo: '1002351-00.2026.8.11.0041', autor: 'Lúcia Prado', perito: 'Dra. Sem Cadastro', especialidade: 'Social', status: 'nao_agendada' }]);
        await abrir(page, '3 perícias');
        await page.click('#perAbas [data-aba="peritos"]');
        await expect(page.locator('#perCount')).toHaveText('3 peritos');
        await expect(page.locator('#perPeritosView')).toBeVisible();
        await expect(page.locator('#perGroups .pcard')).toHaveCount(0);

        await page.fill('#ptNome', 'Dr. Felipe Rocha');
        await page.selectOption('#ptEsp', 'Engenharia');
        await page.fill('#ptEmail', 'felipe@pericia.com');
        await page.click('#ptSalvar');
        await expect(page.locator('#toast')).toHaveText('Perito cadastrado');
        await expect(page.locator('#perCount')).toHaveText('4 peritos');
        expect(banco.tabelas.peritos.find(p => p.nome === 'Dr. Felipe Rocha')).toMatchObject({ especialidade: 'Engenharia', email: 'felipe@pericia.com' });

        const ricardo = page.locator('.ptcard', { hasText: 'Dr. Ricardo Mendes' });
        await expect(ricardo.locator('.ptnums')).toContainText('1em andamento');
        await ricardo.locator('[data-ptact="editar"]').click();
        await expect(page.locator('#peritoFormTitle')).toHaveText('Editar perito');
        await expect(page.locator('#ptNome')).toHaveValue('Dr. Ricardo Mendes');
        await page.fill('#ptNome', 'Dr. Ricardo Mendes Filho');
        await page.click('#ptSalvar');
        await expect(page.locator('#toast')).toHaveText('Perito atualizado');
        await expect.poll(() => banco.tabelas.pericias.find(p => p.autor === JOSE.autor).perito).toBe('Dr. Ricardo Mendes Filho');

        const sem = page.locator('.ptcard', { hasText: 'Dra. Sem Cadastro' });
        await expect(sem).toContainText('Usado em perícias, mas ainda sem cadastro.');
        await sem.locator('[data-ptact="cadastrar"]').click();
        await expect(page.locator('#ptNome')).toHaveValue('Dra. Sem Cadastro');
        await expect(page.locator('#ptEsp')).toHaveValue('Social');

        const felipe = page.locator('.ptcard', { hasText: 'Dr. Felipe Rocha' });
        await felipe.locator('[data-ptact="excluir"]').click();
        await expect(felipe.locator('[data-ptact="excluir"]')).toHaveText('Confirmar exclusão');
        await felipe.locator('[data-ptact="excluir"]').click();
        await expect(page.locator('#toast')).toHaveText('Perito excluído do cadastro');
        expect(banco.tabelas.peritos.map(p => p.nome)).not.toContain('Dr. Felipe Rocha');

        await page.locator('.ptcard', { hasText: 'Dra. Paula Andrade' }).locator('[data-ptact="ver"]').click();
        await expect(page.locator('#perCount')).toHaveText('1 perícia');
        await expect(page.locator('#perGroups')).toContainText('Maria Aparecida');
      });
    });

    test('várias de uma vez: prévia, horários em sequência e repetidas', async ({ page, banco }) => {
      banco.semear('peritos', PERITOS);
      banco.semear('pericias', [MARIA]);
      await abrir(page, '1 perícia');
      await page.locator('.per-modo[data-modo="varias"]').click();
      await expect(page.locator('#perModoVarias')).toBeVisible();
      await expect(page.locator('#perModoUma')).toBeHidden();
      await page.selectOption('#lPerito', 'Dra. Paula Andrade');
      await expect(page.locator('#lEsp')).toHaveValue('Médica');
      await page.fill('#lData', diaMais(12));
      await page.fill('#lHora', '08:00');
      await page.fill('#lIntervalo', '15');
      await page.fill('#lTexto', [
        '1002360-11.2026.8.11.0041; Ana Souza',
        '10023612220268110041 Bruno Lima 10h00',
        'Carlos sem processo',
        '1002362-33.2026.8.11.0041; Dora Reis',
        '1002345-67.2026.8.11.0041; Maria Aparecida dos Santos'
      ].join('\n'));
      const linhas = page.locator('#lPrevia .lrow');
      await expect(linhas).toHaveCount(5);
      await expect(linhas.nth(0).locator('.hora')).toHaveText('08:00');
      await expect(linhas.nth(1).locator('.hora')).toHaveText('10:00');
      await expect(linhas.nth(1).locator('.autor')).toHaveText('Bruno Lima');
      await expect(linhas.nth(2).locator('.st')).toHaveText('Nº do processo não reconhecido');
      await expect(linhas.nth(3).locator('.hora')).toHaveText('10:15');
      await expect(linhas.nth(4).locator('.st')).toContainText('Já tem perícia agendada para');
      await expect(page.locator('#lResumo')).toHaveText('3 prontas · 1 repetida (não será cadastrada) · 1 com problema');
      await expect(page.locator('#lCadastrar')).toHaveText('Cadastrar 3 perícias');
      await page.click('#lCadastrar');
      await expect(page.locator('#toast')).toHaveText('3 perícias cadastradas · 2 linhas ficaram na caixa (repetidas ou com problema)');
      await expect(page.locator('#perCount')).toHaveText('4 perícias');
      expect(banco.tabelas.pericias.find(p => p.autor === 'Bruno Lima')).toMatchObject({ processo: '1002361-22.2026.8.11.0041', perito: 'Dra. Paula Andrade', especialidade: 'Médica', status: 'agendada', data_pericia: ISO(diaMais(12), '10:00') });
      await expect(page.locator('#lTexto')).toHaveValue('Carlos sem processo\n1002345-67.2026.8.11.0041; Maria Aparecida dos Santos');
    });

    test('prazo do laudo em 30 dias úteis, com feriados, e laudo atrasado', async ({ page, banco }) => {
      banco.semear('peritos', PERITOS);
      banco.semear('pericias', [
        { processo: '1002370-00.2026.8.11.0041', autor: 'Laudo no prazo', perito: 'Dr. Ricardo Mendes', status: 'realizada', realizada_em: '2026-03-02' },
        { processo: '1002371-00.2026.8.11.0041', autor: 'Laudo atrasado', perito: 'Dr. Ricardo Mendes', status: 'realizada', realizada_em: '2026-01-21' }
      ]);
      await page.clock.setFixedTime(new Date('2026-03-10T10:00:00-04:00'));
      await abrir(page);
      // 30 dias úteis depois de 02/03/2026, sem a Sexta-feira Santa (03/04): 14/04/2026
      await expect(cartao(page, 'Laudo no prazo').locator('.pwhen')).toContainText('14/04');
      await expect(cartao(page, 'Laudo no prazo')).toContainText('Faltam 24 dias úteis para o laudo (até 14/04/2026)');
      const atr = cartao(page, 'Laudo atrasado');
      await expect(atr).toHaveClass(/late/);
      await expect(atr.locator('.pflag')).toHaveText('Cobrar laudo do perito');
      await expect(atr).toContainText('Laudo atrasado 2 dias úteis (venceu 06/03/2026)');
      await expect(page.locator('#perGroups .day-label .d').first()).toHaveText('Laudos atrasados');
      await expect(page.locator('#perSummary .stat[data-sit="atrasado"]')).toHaveClass(/danger/);
      await page.locator('#perSummary .stat[data-sit="atrasado"]').click();
      await expect(page.locator('#perCount')).toHaveText('1 perícia');
    });

    test('sem perícias', async ({ page }) => {
      await abrir(page, '0 perícias');
      await expect(page.locator('#perEmpty')).toHaveText('Nenhuma perícia cadastrada ainda. Use o formulário acima para cadastrar a primeira.');
      await page.click('#perAbas [data-aba="peritos"]');
      await expect(page.locator('#peritosEmpty')).toHaveText('Nenhum perito cadastrado ainda. Use o formulário acima.');
    });
  });
}
