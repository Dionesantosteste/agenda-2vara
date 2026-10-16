// Agenda (contatos): lista, busca, cadastro, edição e exclusão.
const { test, expect } = require('../apoio/teste');

const CONTATOS = [
  { name: 'Ana Paula Ribeiro', category: 'Advogado', phones: [{ label: 'Celular', value: '(65) 99811-2233' }], emails: [{ label: 'Trabalho', value: 'ana@adv.com' }] },
  { name: 'Bruno Costa (Perito)', category: 'Perito', phones: [{ label: 'Trabalho', value: '(65) 3322-1100' }], emails: [] },
  { name: 'Secretaria da 1ª Vara', category: 'Secretarias', phones: [], emails: [{ label: 'Trabalho', value: '1vara@tjmt.jus.br' }] }
];

test.beforeEach(async ({ banco }) => {
  banco.semear('categories', ['Advogado', 'Perito', 'Secretarias'].map(name => ({ name })));
  banco.semear('contacts', CONTATOS);
});

test('mostra os contatos do banco', async ({ page }) => {
  await page.goto('/#agenda');
  await expect(page.locator('#count')).toHaveText(/3 contatos/);
  for (const c of CONTATOS) await expect(page.locator('#groups')).toContainText(c.name);
});

test('busca por nome, telefone e e-mail', async ({ page }) => {
  await page.goto('/#agenda');
  await expect(page.locator('#count')).toHaveText(/3 contatos/);
  await page.fill('#search', 'bruno');
  await expect(page.locator('#count')).toHaveText('1 contato');
  await expect(page.locator('#groups')).toContainText('Bruno Costa');
  await page.fill('#search', '99811');
  await expect(page.locator('#groups')).toContainText('Ana Paula Ribeiro');
  await page.fill('#search', '1vara@');
  await expect(page.locator('#groups')).toContainText('Secretaria da 1ª Vara');
  await page.fill('#search', 'ninguém com esse nome');
  await expect(page.locator('#emptyState')).toHaveText('Nenhum contato encontrado.');
  await page.click('#clearSearch');
  await expect(page.locator('#count')).toHaveText(/3 contatos/);
});

test('filtra por categoria', async ({ page }) => {
  await page.goto('/#agenda');
  await page.locator('#filters .chip', { hasText: 'Perito' }).click();
  await expect(page.locator('#count')).toHaveText('1 contato');
  await expect(page.locator('#groups')).toContainText('Bruno Costa');
  await page.locator('#filters .chip', { hasText: 'Todos' }).click();
  await expect(page.locator('#count')).toHaveText(/3 contatos/);
});

test('cadastra um contato novo e grava no banco', async ({ page, banco }) => {
  await page.goto('/#agenda');
  await expect(page.locator('#count')).toHaveText(/3 contatos/);
  await page.click('#addBtn');
  await page.fill('#fName', 'Carla Mendes');
  await page.locator('#phoneRows .row-value').first().fill('(65) 98888-7777');
  await page.selectOption('#fCategory', 'Advogado');
  await page.locator('#form button[type=submit]').click();
  await expect(page.locator('#count')).toHaveText(/4 contatos/);
  await expect(page.locator('#groups')).toContainText('Carla Mendes');
  const salvo = banco.tabelas.contacts.find(c => c.name === 'Carla Mendes');
  expect(salvo).toMatchObject({ category: 'Advogado', phones: [{ value: '(65) 98888-7777' }] });
});

test('não salva contato vazio', async ({ page, banco }) => {
  await page.goto('/#agenda');
  await page.click('#addBtn');
  await page.locator('#form button[type=submit]').click();
  await expect(page.locator('#toast')).toHaveText('Preencha ao menos um campo');
  expect(banco.tabelas.contacts).toHaveLength(3);
});

test('edita e exclui um contato', async ({ page, banco }) => {
  await page.goto('/#agenda');
  const cartao = page.locator('#groups .card', { hasText: 'Bruno Costa' });
  await cartao.locator('.card-actions .icon-btn').click();
  await expect(page.locator('#fName')).toHaveValue('Bruno Costa (Perito)');
  await page.fill('#fName', 'Bruno Costa Lima (Perito)');
  await page.locator('#form button[type=submit]').click();
  await expect(page.locator('#groups')).toContainText('Bruno Costa Lima');
  expect(banco.tabelas.contacts.find(c => c.category === 'Perito').name).toBe('Bruno Costa Lima (Perito)');

  await page.locator('#groups .card', { hasText: 'Bruno Costa Lima' }).locator('.card-actions .icon-btn').click();
  await page.click('#deleteBtn');
  await expect(page.locator('#count')).toHaveText('2 contatos');
  expect(banco.tabelas.contacts.map(c => c.name)).not.toContain('Bruno Costa Lima (Perito)');
});
