// Perícias: lista, cadastro, situação, andamento, conclusão e cadastro de peritos.
const { test, expect, hojeVara } = require('../apoio/teste');

function diaMais(n){ return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date(Date.now() + n * 86400000)); }

test.beforeEach(async ({ banco }) => {
  banco.semear('peritos', [
    { nome: 'Dra. Paula Andrade', especialidade: 'Médica', telefone: '(65) 99900-1122' },
    { nome: 'Dr. Ricardo Mendes', especialidade: 'Contábil' }
  ]);
  banco.semear('pericias', [
    { processo: '1002345-67.2026.8.11.0041', autor: 'Maria Aparecida dos Santos', perito: 'Dra. Paula Andrade', especialidade: 'Médica',
      status: 'agendada', data_pericia: new Date(diaMais(5) + 'T08:00:00-04:00').toISOString(), local: 'Consultório central' },
    { processo: '1002346-50.2026.8.11.0041', autor: 'José Carlos Ferreira', perito: 'Dr. Ricardo Mendes', especialidade: 'Contábil', status: 'nao_agendada' }
  ]);
});

test('mostra as perícias em andamento', async ({ page }) => {
  await page.goto('/#pericias');
  await expect(page.locator('#perCount')).toHaveText('2 perícias');
  await expect(page.locator('#perGroups')).toContainText('Maria Aparecida dos Santos');
  await expect(page.locator('#perGroups')).toContainText('Consultório central');
  // o telefone do perito cadastrado aparece no cartão
  await expect(page.locator('.pcard', { hasText: 'Maria Aparecida' })).toContainText('(65) 99900-1122');
});

test('cadastra uma perícia com data e registra o andamento automático', async ({ page, banco }) => {
  await page.goto('/#pericias');
  await expect(page.locator('#perCount')).toHaveText('2 perícias');
  await page.fill('#pProcesso', '10023471220268110041');
  await page.fill('#pAutor', 'Ana Beatriz Lima');
  await page.selectOption('#pPerito', 'Dr. Ricardo Mendes');
  await page.fill('#pData', diaMais(7));
  await page.fill('#pHora', '10:30');
  await page.locator('#perForm button[type=submit]').first().click();
  await expect(page.locator('#toast')).toHaveText('Perícia cadastrada como Agendada');
  await expect(page.locator('#perCount')).toHaveText('3 perícias');
  const nova = banco.tabelas.pericias.find(p => p.autor === 'Ana Beatriz Lima');
  expect(nova).toMatchObject({ processo: '1002347-12.2026.8.11.0041', perito: 'Dr. Ricardo Mendes', status: 'agendada' });
  expect(banco.tabelas.pericias_andamentos.filter(a => a.pericia_id === nova.id).map(a => a.texto).join(' ')).toMatch(/^Perícia cadastrada/);
});

test('não cadastra sem autor', async ({ page, banco }) => {
  await page.goto('/#pericias');
  await page.fill('#pProcesso', '1002999-00.2026.8.11.0041');
  await page.selectOption('#pPerito', 'Dr. Ricardo Mendes');
  await page.locator('#perForm button[type=submit]').first().click();
  expect(banco.tabelas.pericias).toHaveLength(2);
});

test('marcar como realizada começa a contar o prazo do laudo', async ({ page, banco }) => {
  await page.goto('/#pericias');
  await page.locator('.pcard', { hasText: 'Maria Aparecida' }).locator('select[data-pst]').selectOption('realizada');
  await expect(page.locator('#toast')).toContainText('Realizada. Laudo até');
  const p = banco.tabelas.pericias.find(x => x.autor === 'Maria Aparecida dos Santos');
  expect(p.status).toBe('realizada');
  expect(p.realizada_em).toBe(hojeVara());
  await expect(page.locator('.pcard', { hasText: 'Maria Aparecida' })).toContainText('para o laudo');
});

test('registra andamento e conclui com o laudo juntado', async ({ page, banco }) => {
  await page.goto('/#pericias');
  const cartao = page.locator('.pcard', { hasText: 'José Carlos' });
  await cartao.locator('[data-pact="andamento"]').click();
  await cartao.locator('form[data-pform="andamento"] input').fill('Perito intimado por e-mail');
  await cartao.locator('form[data-pform="andamento"] button[type=submit]').click();
  await expect(cartao.locator('.timeline')).toContainText('Perito intimado por e-mail');
  expect(banco.tabelas.pericias_andamentos.map(a => a.texto)).toContain('Perito intimado por e-mail');

  await cartao.locator('[data-pact="concluir"]').click();
  await expect(page.locator('#perCount')).toHaveText('1 perícia');
  expect(banco.tabelas.pericias.find(p => p.autor === 'José Carlos Ferreira')).toMatchObject({ status: 'laudo_juntado', laudo_em: hojeVara() });
  await page.click('#perAbaConc');
  await expect(page.locator('#perGroups')).toContainText('José Carlos Ferreira');
});

test('cadastra um perito na aba Peritos', async ({ page, banco }) => {
  await page.goto('/#pericias');
  await page.click('#perAbaPeritos');
  await expect(page.locator('#perCount')).toHaveText('2 peritos');
  await page.fill('#ptNome', 'Dr. Felipe Rocha');
  await page.selectOption('#ptEsp', 'Engenharia');
  await page.fill('#ptEmail', 'felipe@pericia.com');
  await page.click('#ptSalvar');
  await expect(page.locator('#perCount')).toHaveText('3 peritos');
  expect(banco.tabelas.peritos.find(p => p.nome === 'Dr. Felipe Rocha')).toMatchObject({ especialidade: 'Engenharia', email: 'felipe@pericia.com' });
});
