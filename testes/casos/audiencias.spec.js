// Audiências: pauta, cadastro rápido, status, conferência, edição e busca.
const { test, expect } = require('../apoio/teste');

// data/hora daqui a N dias, às HH:MM no horário da vara (Cuiabá, UTC-4)
function emDias(n, hhmm){
  const d = new Date(Date.now() + n * 86400000);
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(d);
  return { dia, iso: new Date(dia + 'T' + hhmm + ':00-04:00').toISOString() };
}

test.beforeEach(async ({ banco }) => {
  banco.semear('audiencias_tipos', [{ nome: 'Conciliação' }, { nome: 'Instrução e julgamento' }]);
  banco.semear('audiencias', [
    { processo: '1002345-67.2026.8.11.0041', data_hora: emDias(2, '08:00').iso, tipo: 'Conciliação', observacoes: 'intimar testemunhas' },
    { processo: '1002346-50.2026.8.11.0041', data_hora: emDias(3, '14:30').iso, tipo: 'Instrução e julgamento', status: 'Intimações feitas' }
  ]);
});

test('mostra as próximas audiências', async ({ page }) => {
  await page.goto('/#audiencias');
  await expect(page.locator('#audCount')).toHaveText('2 audiências');
  await expect(page.locator('#audGroups')).toContainText('1002345-67.2026.8.11.0041');
  await expect(page.locator('#audGroups')).toContainText('intimar testemunhas');
  await expect(page.locator('#audGroups .hcard').first().locator('.htime')).toHaveText('08:00');
});

test('cadastro rápido grava no banco e formata o número CNJ', async ({ page, banco }) => {
  await page.goto('/#audiencias');
  await expect(page.locator('#audCount')).toHaveText('2 audiências');
  const amanha = emDias(1, '09:15');
  await page.fill('#qProcesso', '10023471220268110041');
  await page.fill('#qData', amanha.dia);
  await page.fill('#qHora', '09:15');
  await page.selectOption('#qTipo', 'Conciliação');
  await page.fill('#qObs', 'por videoconferência');
  await page.locator('#quickForm button[type=submit]').click();
  await expect(page.locator('#audCount')).toHaveText('3 audiências');
  const nova = banco.tabelas.audiencias.find(a => a.processo === '1002347-12.2026.8.11.0041');
  expect(nova, 'audiência gravada com o número formatado').toBeTruthy();
  expect(nova).toMatchObject({ tipo: 'Conciliação', status: 'A cumprir', observacoes: 'por videoconferência' });
  expect(new Date(nova.data_hora).toISOString()).toBe(amanha.iso);
  // a data fica para a próxima; o resto limpa
  await expect(page.locator('#qData')).toHaveValue(amanha.dia);
  await expect(page.locator('#qProcesso')).toHaveValue('');
});

test('muda o status pela lista', async ({ page, banco }) => {
  await page.goto('/#audiencias');
  const cartao = page.locator('#audGroups .hcard', { hasText: '1002345-67' });
  await cartao.locator('.status-pill select').selectOption('Pronto para audiência');
  await expect(page.locator('#toast')).toHaveText('Status: Pronto para audiência');
  expect(banco.tabelas.audiencias.find(a => a.processo.startsWith('1002345')).status).toBe('Pronto para audiência');
});

test('marca e desmarca a conferência', async ({ page, banco }) => {
  await page.goto('/#audiencias');
  const cartao = page.locator('#audGroups .hcard', { hasText: '1002345-67' });
  await cartao.locator('.conf-btn').click();
  await expect(cartao.locator('.conf-btn')).toContainText('Conferida');
  expect(banco.tabelas.audiencias.find(a => a.processo.startsWith('1002345')).conferida_em).toBeTruthy();
  // desmarcar pede confirmação (segundo clique)
  await cartao.locator('.conf-btn').click();
  await expect(cartao.locator('.conf-btn')).toContainText('Desmarcar conferência?');
  await cartao.locator('.conf-btn').click();
  await expect(cartao.locator('.conf-btn')).toContainText('Conferir');
  expect(banco.tabelas.audiencias.find(a => a.processo.startsWith('1002345')).conferida_em).toBeNull();
});

test('edita pela janela da audiência', async ({ page, banco }) => {
  await page.goto('/#audiencias');
  await page.locator('#audGroups .hcard', { hasText: '1002346-50' }).locator('.icon-btn').click();
  await expect(page.locator('#aProcesso')).toHaveValue('1002346-50.2026.8.11.0041');
  await page.fill('#aObs', 'redesignar para a tarde');
  await page.locator('#audForm button[type=submit]').click();
  await expect(page.locator('#audGroups')).toContainText('redesignar para a tarde');
  expect(banco.tabelas.audiencias.find(a => a.processo.startsWith('1002346')).observacoes).toBe('redesignar para a tarde');
});

test('busca por processo, tipo e observação', async ({ page }) => {
  await page.goto('/#audiencias');
  await page.fill('#audSearch', 'instrução');
  await expect(page.locator('#audCount')).toHaveText('1 audiência');
  await page.fill('#audSearch', 'testemunhas');
  await expect(page.locator('#audGroups')).toContainText('1002345-67');
  await page.fill('#audSearch', '1002346');
  await expect(page.locator('#audCount')).toHaveText('1 audiência');
});
