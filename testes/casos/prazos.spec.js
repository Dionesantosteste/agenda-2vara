// Prazos: contagem em dias úteis (CPC, art. 219), recesso, feriados do calendário e idade da parte.
// As datas esperadas foram conferidas à mão.
const { test, expect } = require('../apoio/teste');

async function calculaPrazo(page, { n, unidade = 'u', forma = 'djen', data }){
  await page.fill('#pzPN', String(n));
  await page.selectOption('#pzPUn', unidade);
  await page.selectOption('#pzPForma', forma);
  await page.fill('#pzPData1', data);
  await page.locator('#pzPData1').blur();
}
const vencimento = page => page.locator('#pzPRes');

test('15 dias úteis a partir do DJEN: publicação no dia útil seguinte e início no outro', async ({ page }) => {
  await page.goto('/#prazos');
  await calculaPrazo(page, { n: 15, data: '2026-03-02' });   // segunda-feira
  await expect(vencimento(page)).toContainText(/Vence em\s*24\/03\/2026/);
  await expect(vencimento(page)).toContainText(/03\/03\/2026\s*terça-feira\s*Publicação/);
  await expect(vencimento(page)).toContainText(/04\/03\/2026\s*quarta-feira\s*Início da contagem/);
});

test('o recesso de 20/12 a 20/01 não conta', async ({ page }) => {
  await page.goto('/#prazos');
  await calculaPrazo(page, { n: 5, data: '2026-12-15' });
  // 17 e 18/12 contam; recesso; volta em 21/01: 21, 22 e 25/01
  await expect(vencimento(page)).toContainText(/Vence em\s*25\/01\/2027/);
});

test('feriado do calendário da vara empurra o vencimento', async ({ page, banco }) => {
  banco.semear('prazos_config', [{ chave: 'extra.teste1', valor: { data: '2026-03-10', nome: 'Feriado municipal', anual: false } }]);
  await page.goto('/#prazos');
  await calculaPrazo(page, { n: 15, data: '2026-03-02' });
  await expect(vencimento(page)).toContainText(/Vence em\s*25\/03\/2026/);
});

test('acrescentar feriado na aba Feriados grava no banco', async ({ page, banco }) => {
  await page.goto('/#prazos');
  await page.click('[data-aba="feriados"]');
  await page.fill('#pzFData', '2026-04-08');
  await page.fill('#pzFNome', 'Aniversário de Cuiabá');
  await page.click('#pzFAdd');
  await expect(page.locator('#toast')).toHaveText('Acrescentado');
  await expect.poll(() => banco.tabelas.prazos_config.map(l => l.valor && l.valor.nome)).toContain('Aniversário de Cuiabá');
  const linha = banco.tabelas.prazos_config.find(l => l.valor && l.valor.nome === 'Aniversário de Cuiabá');
  expect(linha.chave).toMatch(/^extra\./);
  expect(linha.valor).toMatchObject({ data: '2026-04-08', anual: false });
});

test('idade da parte na data escolhida', async ({ page }) => {
  await page.goto('/#prazos');
  await page.click('[data-aba="idade"]');
  await page.fill('#pzINasc', '2008-05-12');
  await page.fill('#pzIRef', '2026-05-11');
  await page.locator('#pzIRef').blur();
  await expect(page.locator('#pzIRes')).toContainText(/17 anos\s*11 meses e 29 dias em 11\/05\/2026/);
  await page.fill('#pzIRef', '2026-05-12');
  await page.locator('#pzIRef').blur();
  await expect(page.locator('#pzIRes')).toContainText(/^18 anos/);
});
