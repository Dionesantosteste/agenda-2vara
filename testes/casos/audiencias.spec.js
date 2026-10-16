// Audiências: pauta, cadastro rápido, filtros, resumo, status, conferência, edição, exclusão, tipos e impressão.
// Os mesmos testes rodam no sistema atual (/#audiencias) e no sistema novo (/novo/audiencias).
const { test, expect } = require('../apoio/teste');

const VERSOES = [
  { nome: 'sistema atual', endereco: '/#audiencias' },
  { nome: 'sistema novo', endereco: '/novo/audiencias' }
];

// data/hora daqui a N dias, às HH:MM no horário da vara (Cuiabá, UTC-4)
function emDias(n, hhmm){
  const d = new Date(Date.now() + n * 86400000);
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(d);
  return { dia, iso: new Date(dia + 'T' + hhmm + ':00-04:00').toISOString() };
}

const A1 = { processo: '1002345-67.2026.8.11.0041', data_hora: emDias(2, '08:00').iso, tipo: 'Conciliação', observacoes: 'intimar testemunhas' };
const A2 = { processo: '1002346-50.2026.8.11.0041', data_hora: emDias(3, '14:30').iso, tipo: 'Instrução e julgamento', status: 'Intimações feitas' };

for (const v of VERSOES){
  test.describe(v.nome, () => {
    const abrir = async (page, n = 2) => {
      await page.goto(v.endereco);
      await expect(page.locator('#audCount')).toHaveText(n + (n === 1 ? ' audiência' : ' audiências'));
    };
    const chip = (page, grupo, texto) => page.locator('#' + grupo + ' .chip', { hasText: new RegExp('^' + texto + '$') });

    test.describe('com duas audiências', () => {
      test.beforeEach(async ({ banco }) => {
        banco.semear('audiencias_tipos', [{ nome: 'Conciliação' }, { nome: 'Instrução e julgamento' }]);
        banco.semear('audiencias', [A1, A2]);
      });

      test('mostra as próximas audiências', async ({ page }) => {
        await abrir(page);
        await expect(page.locator('#audGroups')).toContainText('1002345-67.2026.8.11.0041');
        await expect(page.locator('#audGroups')).toContainText('intimar testemunhas');
        await expect(page.locator('#audGroups .hcard').first().locator('.htime')).toHaveText('08:00');
        await expect(page.locator('#audGroups .day')).toHaveCount(2);
        await expect(page.locator('#audGroups .hcard').nth(1).locator('.status-pill select')).toHaveValue('Intimações feitas');
        await expect(page.locator('#statSemana')).toHaveText('2');
      });

      test('cadastro rápido grava no banco e formata o número CNJ', async ({ page, banco }) => {
        await abrir(page);
        const amanha = emDias(1, '09:15');
        await page.fill('#qProcesso', '10023471220268110041');
        await expect(page.locator('#qProcesso')).toHaveValue('1002347-12.2026.8.11.0041');
        await page.fill('#qData', amanha.dia);
        await page.fill('#qHora', '09:15');
        await page.selectOption('#qTipo', 'Conciliação');
        await page.fill('#qObs', 'por videoconferência');
        await page.locator('#quickForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Audiência cadastrada');
        await expect(page.locator('#audCount')).toHaveText('3 audiências');
        const nova = banco.tabelas.audiencias.find(a => a.processo === '1002347-12.2026.8.11.0041');
        expect(nova, 'audiência gravada com o número formatado').toBeTruthy();
        expect(nova).toMatchObject({ tipo: 'Conciliação', status: 'A cumprir', observacoes: 'por videoconferência' });
        expect(new Date(nova.data_hora).toISOString()).toBe(amanha.iso);
        // a data fica para a próxima; o resto limpa
        await expect(page.locator('#qData')).toHaveValue(amanha.dia);
        await expect(page.locator('#qProcesso')).toHaveValue('');
        await expect(page.locator('#qTipo')).toHaveValue('');
        await expect(page.locator('#audGroups .day').first().locator('.rel')).toHaveText('amanhã');
      });

      test('número do processo: pontos e traço entram enquanto se digita', async ({ page }) => {
        await abrir(page);
        const campo = page.locator('#qProcesso');
        await campo.pressSequentially('100234567');
        await expect(campo).toHaveValue('1002345-67');
        await campo.press('ArrowLeft');
        await campo.press('ArrowLeft');
        await campo.press('Backspace');   // apaga o traço e o 5 antes dele
        await expect(campo).toHaveValue('1002346-7');
        await campo.press('End');
        await campo.pressSequentially('2026811004');
        await expect(campo).toHaveValue('1002346-72.0268.1.10.04');
        await campo.fill('processo físico 123');
        await expect(campo).toHaveValue('processo físico 123');
      });

      test('cadastro rápido sem tipo não grava', async ({ page, banco }) => {
        await abrir(page);
        await page.fill('#qProcesso', '1002347-12.2026.8.11.0041');
        await page.fill('#qHora', '10:00');
        await page.locator('#quickForm button[type=submit]').click();
        // o próprio navegador barra: o tipo é obrigatório
        expect(await page.locator('#qTipo').evaluate(e => e.validity.valueMissing)).toBe(true);
        await page.waitForTimeout(300);
        expect(banco.tabelas.audiencias).toHaveLength(2);
      });

      test('muda o status pela lista', async ({ page, banco }) => {
        await abrir(page);
        const cartao = page.locator('#audGroups .hcard', { hasText: '1002345-67' });
        await cartao.locator('.status-pill select').selectOption('Pronto para audiência');
        await expect(page.locator('#toast')).toHaveText('Status: Pronto para audiência');
        expect(banco.tabelas.audiencias.find(a => a.processo.startsWith('1002345')).status).toBe('Pronto para audiência');
        await expect(cartao.locator('.status-pill')).toHaveAttribute('data-status', 'Pronto para audiência');
      });

      test('cancelada fica marcada e sai do resumo', async ({ page }) => {
        await abrir(page);
        const cartao = page.locator('#audGroups .hcard', { hasText: '1002345-67' });
        await cartao.locator('.status-pill select').selectOption('Cancelada');
        await expect(cartao).toHaveClass(/cancelled/);
        await expect(page.locator('#statSemana')).toHaveText('1');
      });

      test('marca e desmarca a conferência', async ({ page, banco }) => {
        await abrir(page);
        const cartao = page.locator('#audGroups .hcard', { hasText: '1002345-67' });
        await cartao.locator('.conf-btn').click();
        await expect(cartao.locator('.conf-btn')).toContainText('Conferida');
        await expect(page.locator('#toast')).toContainText('Audiência conferida em');
        expect(banco.tabelas.audiencias.find(a => a.processo.startsWith('1002345')).conferida_em).toBeTruthy();
        // desmarcar pede confirmação (segundo clique)
        await cartao.locator('.conf-btn').click();
        await expect(cartao.locator('.conf-btn')).toContainText('Desmarcar conferência?');
        await cartao.locator('.conf-btn').click();
        await expect(cartao.locator('.conf-btn')).toContainText('Conferir');
        await expect(page.locator('#toast')).toHaveText('Conferência desmarcada');
        expect(banco.tabelas.audiencias.find(a => a.processo.startsWith('1002345')).conferida_em).toBeNull();
      });

      test('filtros de status, tipo e conferência', async ({ page }) => {
        await abrir(page);
        await chip(page, 'audStatuses', 'Intimações feitas').click();
        await expect(page.locator('#audCount')).toHaveText('1 audiência');
        await expect(page.locator('#audGroups')).toContainText('1002346-50');
        await chip(page, 'audStatuses', 'Todos').click();
        await chip(page, 'audTiposFiltro', 'Conciliação').click();
        await expect(page.locator('#audCount')).toHaveText('1 audiência');
        await expect(page.locator('#audGroups')).toContainText('1002345-67');
        await chip(page, 'audTiposFiltro', 'Todos').click();
        await page.locator('#audGroups .hcard', { hasText: '1002346-50' }).locator('.conf-btn').click();
        await expect(page.locator('#audGroups .hcard', { hasText: '1002346-50' }).locator('.conf-btn')).toContainText('Conferida');
        await chip(page, 'audConf', 'Não conferidas').click();
        await expect(page.locator('#audCount')).toHaveText('1 audiência');
        await expect(page.locator('#audGroups')).toContainText('1002345-67');
        await chip(page, 'audConf', 'Conferidas').click();
        await expect(page.locator('#audGroups')).toContainText('1002346-50');
        await chip(page, 'audStatuses', 'Cancelada').click();
        await expect(page.locator('#audEmpty')).toHaveText('Nenhuma audiência neste filtro.');
      });

      test('edita pela janela da audiência', async ({ page, banco }) => {
        await abrir(page);
        await page.locator('#audGroups .hcard', { hasText: '1002346-50' }).locator('.icon-btn').click();
        await expect(page.locator('#aProcesso')).toHaveValue('1002346-50.2026.8.11.0041');
        await expect(page.locator('#aHora')).toHaveValue('14:30');
        await expect(page.locator('#aTipo')).toHaveValue('Instrução e julgamento');
        await expect(page.locator('#aStatus')).toHaveValue('Intimações feitas');
        await page.fill('#aObs', 'redesignar para a tarde');
        await page.fill('#aHora', '15:00');
        await page.locator('#audForm button[type=submit]').click();
        await expect(page.locator('#toast')).toHaveText('Audiência atualizada');
        await expect(page.locator('#audGroups')).toContainText('redesignar para a tarde');
        const a = banco.tabelas.audiencias.find(x => x.processo.startsWith('1002346'));
        expect(a.observacoes).toBe('redesignar para a tarde');
        expect(new Date(a.data_hora).toISOString()).toBe(emDias(3, '15:00').iso);
      });

      test('exclui pela janela, com confirmação', async ({ page, banco }) => {
        await abrir(page);
        await page.locator('#audGroups .hcard', { hasText: '1002346-50' }).locator('.icon-btn').click();
        await page.click('#audDeleteBtn');
        await expect(page.locator('#audDeleteBtn')).toHaveText('Confirmar exclusão');
        expect(banco.tabelas.audiencias).toHaveLength(2);
        await page.click('#audDeleteBtn');
        await expect(page.locator('#toast')).toHaveText('Audiência excluída');
        await expect(page.locator('#audCount')).toHaveText('1 audiência');
        expect(banco.tabelas.audiencias.map(a => a.processo)).not.toContain(A2.processo);
      });

      test('busca por processo, tipo e observação', async ({ page }) => {
        await abrir(page);
        await page.fill('#audSearch', 'instrução');
        await expect(page.locator('#audCount')).toHaveText('1 audiência');
        await expect(page.locator('#audGroups mark')).toHaveText('Instrução');
        await page.fill('#audSearch', 'testemunhas');
        await expect(page.locator('#audGroups')).toContainText('1002345-67');
        await page.fill('#audSearch', '1002346');
        await expect(page.locator('#audCount')).toHaveText('1 audiência');
        await page.fill('#audSearch', '100234650');
        await expect(page.locator('#audCount')).toHaveText('1 audiência');
        await page.click('#audClearSearch');
        await expect(page.locator('#audCount')).toHaveText('2 audiências');
      });

      test('novo tipo pelo cadastro rápido já fica escolhido', async ({ page, banco }) => {
        await abrir(page);
        await page.selectOption('#qTipo', '__novo__');
        await expect(page.locator('#tiposDialog')).toBeVisible();
        await page.fill('#tipoNovo', 'Justificação');
        await page.press('#tipoNovo', 'Enter');
        await expect(page.locator('#tiposDialog')).not.toBeVisible();
        await expect(page.locator('#qTipo')).toHaveValue('Justificação');
        expect(banco.tabelas.audiencias_tipos.map(t => t.nome)).toContain('Justificação');
        await expect(chip(page, 'audTiposFiltro', 'Justificação')).toBeVisible();
      });

      test('tipos: renomeia (as audiências acompanham) e exclui com confirmação', async ({ page, banco }) => {
        await abrir(page);
        await page.locator('#audTiposFiltro .chip-manage').click();
        await expect(page.locator('#tiposDialog')).toBeVisible();
        const nomes = page.locator('#tiposLista .cat-row input');
        await expect(nomes).toHaveCount(2);
        await expect(nomes.nth(0)).toHaveValue('Conciliação');
        await nomes.nth(0).fill('Conciliação (CEJUSC)');
        await nomes.nth(0).press('Tab');
        await expect(page.locator('#toast')).toHaveText('Tipo renomeado');
        await expect.poll(() => banco.tabelas.audiencias.find(a => a.processo === A1.processo).tipo).toBe('Conciliação (CEJUSC)');
        const excluir = page.locator('#tiposLista .cat-row').nth(1).locator('.icon-btn');
        await excluir.click();
        await expect(excluir).toContainText('Excluir? (1 audiência mantém o nome)');
        await excluir.click();
        await expect(page.locator('#toast')).toHaveText('Tipo excluído da lista');
        expect(banco.tabelas.audiencias_tipos.map(t => t.nome)).toEqual(['Conciliação (CEJUSC)']);
        await page.click('#tiposFechar');
        await expect(page.locator('#audGroups')).toContainText('Instrução e julgamento');
      });

      test('imprime a lista da tela com os filtros', async ({ page }) => {
        await abrir(page);
        await page.evaluate(() => { window.print = () => { window.__impresso = document.getElementById('printArea').innerText; }; });
        await chip(page, 'audTiposFiltro', 'Conciliação').click();
        await page.click('#audPrint');
        const txt = await page.evaluate(() => window.__impresso);
        expect(txt).toContain('Pauta de audiências');
        expect(txt).toContain('Próximas · Tipo: Conciliação');
        expect(txt).toContain('1 audiência');
        expect(txt).toContain('1002345-67.2026.8.11.0041');
        expect(txt).not.toContain('1002346-50');
        await chip(page, 'audStatuses', 'Cancelada').click();
        await page.click('#audPrint');
        await expect(page.locator('#toast')).toHaveText('Nada para imprimir neste filtro.');
      });
    });

    test('períodos, resumo e audiência que já passou', async ({ page, banco }) => {
      banco.semear('audiencias_tipos', [{ nome: 'Conciliação' }]);
      banco.semear('audiencias', [
        { processo: '0000001-11.2026.8.11.0041', data_hora: emDias(0, '23:30').iso, tipo: 'Conciliação' },
        { processo: '0000002-22.2026.8.11.0041', data_hora: emDias(-2, '09:00').iso, tipo: 'Conciliação', status: 'Designada' },
        { processo: '0000003-33.2026.8.11.0041', data_hora: emDias(-5, '09:00').iso, tipo: 'Conciliação', status: 'Intimações feitas' },
        { processo: '0000004-44.2026.8.11.0041', data_hora: emDias(20, '09:00').iso, tipo: 'Conciliação' }
      ]);
      await abrir(page, 2);
      await expect(page.locator('#statHoje')).toHaveText('1');
      await expect(page.locator('#statSemana')).toHaveText('1');
      await expect(page.locator('#audGroups .day').first().locator('.rel')).toHaveText('hoje');

      await chip(page, 'audPeriods', 'Anteriores').click();
      await expect(page.locator('#audCount')).toHaveText('2 audiências');
      // mais recente primeiro; "Designada" (nome antigo) vira "A cumprir" e aparece como pendente
      const primeira = page.locator('#audGroups .hcard').first();
      await expect(primeira).toContainText('0000002-22');
      await expect(primeira).toHaveClass(/pending/);
      await expect(primeira.locator('.flag')).toHaveText('Já passou — atualize o status');
      await expect(primeira.locator('.status-pill select')).toHaveValue('A cumprir');
      await expect(page.locator('#audGroups .hcard').nth(1).locator('.flag')).toHaveCount(0);

      await chip(page, 'audPeriods', 'Todas').click();
      await expect(page.locator('#audCount')).toHaveText('4 audiências');
      await chip(page, 'audPeriods', 'Hoje').click();
      await expect(page.locator('#audCount')).toHaveText('1 audiência');
      await expect(page.locator('.stat[data-period="hoje"]')).toHaveAttribute('aria-pressed', 'true');

      // o quadro "próximos 15 dias" liga e desliga o filtro
      await page.locator('.stat[data-period="semana"]').click();
      await expect(chip(page, 'audPeriods', 'Próximos 15 dias')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('.stat[data-period="semana"]').click();
      await expect(chip(page, 'audPeriods', 'Próximas')).toHaveAttribute('aria-pressed', 'true');

      await chip(page, 'audPeriods', 'Entre datas').click();
      await expect(page.locator('#audRange')).toBeVisible();
      await expect(page.locator('#rangeFrom')).toHaveValue(emDias(0, '00:00').dia);
      await page.fill('#rangeFrom', emDias(-6, '00:00').dia);
      await page.fill('#rangeTo', emDias(-1, '00:00').dia);
      await expect(page.locator('#audCount')).toHaveText('2 audiências');
    });

    test('sem audiências', async ({ page, banco }) => {
      banco.semear('audiencias_tipos', [{ nome: 'Conciliação' }]);
      await abrir(page, 0);
      await expect(page.locator('#audEmpty')).toHaveText('Nenhuma audiência cadastrada ainda. Use o formulário acima para cadastrar a primeira.');
      await expect(page.locator('#statHoje')).toHaveText('0');
    });
  });
}
