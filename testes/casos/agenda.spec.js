// Agenda (contatos): lista, busca, filtro, cadastro, edição, exclusão e categorias.
// Os mesmos testes rodam no sistema atual (/#agenda) e no sistema novo (/novo/agenda).
const { test, expect } = require('../apoio/teste');

const VERSOES = [
  { nome: 'sistema atual', endereco: '/#agenda' },
  { nome: 'sistema novo', endereco: '/novo/agenda' }
];

const CONTATOS = [
  { name: 'Ana Paula Ribeiro', category: 'Advogado', phones: [{ label: 'Celular', value: '(65) 99811-2233' }], emails: [{ label: 'Trabalho', value: 'ana@adv.com' }] },
  { name: 'Bruno Costa (Perito)', category: 'Perito', phones: [{ label: 'Trabalho', value: '(65) 3322-1100' }], emails: [] },
  { name: 'Secretaria da 1ª Vara', category: 'Secretarias', phones: [], emails: [{ label: 'Trabalho', value: '1vara@tjmt.jus.br' }] }
];

for (const v of VERSOES){
  test.describe(v.nome, () => {
    const salvar = page => page.locator('#form button[type=submit]').click();

    test.describe('com contatos', () => {
      test.beforeEach(async ({ banco }) => {
        banco.semear('categories', ['Advogado', 'Perito', 'Secretarias'].map(name => ({ name })));
        banco.semear('contacts', CONTATOS);
      });
      const abrir = async page => {
        await page.goto(v.endereco);
        await expect(page.locator('#count')).toHaveText(/3 contatos/);
      };

      test('mostra os contatos do banco', async ({ page }) => {
        await abrir(page);
        for (const c of CONTATOS) await expect(page.locator('#groups')).toContainText(c.name);
        const ana = page.locator('#groups .card', { hasText: 'Ana Paula' });
        await expect(ana.locator('.badge')).toHaveText('Advogado');
        await expect(ana.locator('.meta a.phone')).toHaveAttribute('href', 'tel:' + encodeURIComponent('(65) 99811-2233'));
        await expect(ana.locator('.meta')).toContainText('ana@adv.com');
      });

      test('índice alfabético: só as letras com contato ficam ativas', async ({ page }) => {
        await abrir(page);
        const letras = page.locator('#index button');
        await expect(letras).toHaveCount(27);
        await expect(page.locator('#index button', { hasText: /^A$/ })).toBeEnabled();
        await expect(page.locator('#index button', { hasText: /^S$/ })).toBeEnabled();
        await expect(page.locator('#index button', { hasText: /^C$/ })).toBeDisabled();
        await expect(page.locator('#groups .group-label')).toHaveText(['A', 'B', 'S']);
      });

      test('busca por nome, telefone e e-mail, com o trecho destacado', async ({ page }) => {
        await abrir(page);
        await page.fill('#search', 'bruno');
        await expect(page.locator('#count')).toHaveText('1 contato');
        await expect(page.locator('#groups mark')).toHaveText('Bruno');
        await page.fill('#search', '99811');
        await expect(page.locator('#groups')).toContainText('Ana Paula Ribeiro');
        await expect(page.locator('#groups mark')).toHaveText('99811');
        await page.fill('#search', '1vara@');
        await expect(page.locator('#groups')).toContainText('Secretaria da 1ª Vara');
        await page.fill('#search', 'ninguém com esse nome');
        await expect(page.locator('#emptyState')).toHaveText('Nenhum contato encontrado.');
        await page.click('#clearSearch');
        await expect(page.locator('#count')).toHaveText(/3 contatos/);
        await expect(page.locator('#clearSearch')).toBeHidden();
      });

      test('busca ignora acentos', async ({ page }) => {
        await abrir(page);
        await page.fill('#search', 'secretaria da 1a');
        await expect(page.locator('#count')).toHaveText('0 contatos');
        await page.fill('#search', 'SECRETÁRIA');
        await expect(page.locator('#count')).toHaveText('1 contato');
      });

      test('filtra por categoria', async ({ page }) => {
        await abrir(page);
        await page.locator('#filters .chip', { hasText: 'Perito' }).click();
        await expect(page.locator('#filters .chip', { hasText: 'Perito' })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#count')).toHaveText('1 contato');
        await expect(page.locator('#groups')).toContainText('Bruno Costa');
        await page.locator('#filters .chip', { hasText: 'Todos' }).click();
        await expect(page.locator('#count')).toHaveText(/3 contatos/);
      });

      test('cadastra um contato novo e grava no banco', async ({ page, banco }) => {
        await abrir(page);
        await page.click('#addBtn');
        await expect(page.locator('#dialogTitle')).toHaveText('Novo contato');
        await expect(page.locator('#deleteBtn')).toBeHidden();
        await page.fill('#fName', 'Carla Mendes');
        await page.locator('#phoneRows .row-value').first().fill('(65) 98888-7777');
        await page.selectOption('#fCategory', 'Advogado');
        await salvar(page);
        await expect(page.locator('#toast')).toHaveText('Contato adicionado');
        await expect(page.locator('#count')).toHaveText(/4 contatos/);
        await expect(page.locator('#groups')).toContainText('Carla Mendes');
        const salvo = banco.tabelas.contacts.find(c => c.name === 'Carla Mendes');
        expect(salvo).toMatchObject({ category: 'Advogado', phones: [{ label: 'Celular', value: '(65) 98888-7777' }], emails: [] });
      });

      test('vários telefones e e-mails, com linha removida', async ({ page, banco }) => {
        await abrir(page);
        await page.click('#addBtn');
        await page.fill('#fName', 'Daniel Rocha');
        await page.locator('#phoneRows .row-value').first().fill('(65) 3000-1000');
        await page.locator('#phoneRows select').first().selectOption('Trabalho');
        await page.click('#addPhoneRow');
        await page.locator('#phoneRows .row-value').nth(1).fill('(65) 99000-2000');
        await page.click('#addEmailRow');
        await expect(page.locator('#emailRows .multi-row')).toHaveCount(2);
        await page.locator('#emailRows .row-value').nth(1).fill('daniel@exemplo.com');
        await page.locator('#emailRows .remove-row-btn').first().click();
        await expect(page.locator('#emailRows .multi-row')).toHaveCount(1);
        await expect(page.locator('#emailRows .row-value')).toHaveValue('daniel@exemplo.com');
        await salvar(page);
        await expect(page.locator('#count')).toHaveText(/4 contatos/);
        const salvo = banco.tabelas.contacts.find(c => c.name === 'Daniel Rocha');
        expect(salvo.phones).toEqual([{ label: 'Trabalho', value: '(65) 3000-1000' }, { label: 'Celular', value: '(65) 99000-2000' }]);
        expect(salvo.emails).toEqual([{ label: 'Pessoal', value: 'daniel@exemplo.com' }]);
        await expect(page.locator('#groups .card', { hasText: 'Daniel Rocha' }).locator('.meta .more')).toHaveText('+1');
      });

      test('não salva contato vazio', async ({ page, banco }) => {
        await abrir(page);
        await page.click('#addBtn');
        await salvar(page);
        await expect(page.locator('#toast')).toHaveText('Preencha ao menos um campo');
        expect(banco.tabelas.contacts).toHaveLength(3);
      });

      test('cancelar não grava nada', async ({ page, banco }) => {
        await abrir(page);
        await page.click('#addBtn');
        await page.fill('#fName', 'Não vai salvar');
        await page.click('#cancelBtn');
        await expect(page.locator('#dialog')).not.toBeVisible();
        expect(banco.tabelas.contacts).toHaveLength(3);
        await page.click('#addBtn');
        await expect(page.locator('#fName')).toHaveValue('');
      });

      test('edita e exclui um contato', async ({ page, banco }) => {
        await abrir(page);
        const cartao = page.locator('#groups .card', { hasText: 'Bruno Costa' });
        await cartao.locator('.card-actions .icon-btn').click();
        await expect(page.locator('#dialogTitle')).toHaveText('Editar contato');
        await expect(page.locator('#fName')).toHaveValue('Bruno Costa (Perito)');
        await expect(page.locator('#phoneRows .row-value')).toHaveValue('(65) 3322-1100');
        await expect(page.locator('#fCategory')).toHaveValue('Perito');
        await page.fill('#fName', 'Bruno Costa Lima (Perito)');
        await salvar(page);
        await expect(page.locator('#toast')).toHaveText('Contato atualizado');
        await expect(page.locator('#groups')).toContainText('Bruno Costa Lima');
        expect(banco.tabelas.contacts.find(c => c.category === 'Perito').name).toBe('Bruno Costa Lima (Perito)');

        await page.locator('#groups .card', { hasText: 'Bruno Costa Lima' }).locator('.card-actions .icon-btn').click();
        await page.click('#deleteBtn');
        await expect(page.locator('#count')).toHaveText('2 contatos');
        expect(banco.tabelas.contacts.map(c => c.name)).not.toContain('Bruno Costa Lima (Perito)');
      });

      test('categoria nova direto no cadastro', async ({ page, banco }) => {
        await abrir(page);
        await page.click('#addBtn');
        await page.fill('#fName', 'Fórum de Várzea Grande');
        await page.selectOption('#fCategory', '__add_new__');
        await expect(page.locator('#inlineCatWrap')).toBeVisible();
        await page.fill('#inlineCatInput', 'Fóruns');
        await page.press('#inlineCatInput', 'Enter');
        await expect(page.locator('#inlineCatWrap')).toBeHidden();
        await expect(page.locator('#fCategory')).toHaveValue('Fóruns');
        await expect.poll(() => banco.tabelas.categories.map(c => c.name)).toContain('Fóruns');
        await salvar(page);
        await expect(page.locator('#count')).toHaveText(/4 contatos/);
        expect(banco.tabelas.contacts.find(c => c.name === 'Fórum de Várzea Grande').category).toBe('Fóruns');
        await expect(page.locator('#filters .chip', { hasText: 'Fóruns' })).toBeVisible();
      });

      test('contato com categoria que não existe mais', async ({ page }) => {
        await abrir(page);
        await page.locator('#filters .chip-manage').click();
        await expect(page.locator('#catList .cat-row input').nth(2)).toHaveValue('Secretarias');
        await page.locator('#catList .cat-row').nth(2).locator('.icon-btn').click();
        await page.click('#closeCatBtn');
        await page.locator('#groups .card', { hasText: 'Secretaria da 1ª Vara' }).locator('.card-actions .icon-btn').click();
        await expect(page.locator('#fCategory')).toHaveValue('Secretarias');
        await expect(page.locator('#fCategory option:checked')).toHaveText('Secretarias (removida)');
      });

      test('categorias: acrescenta, renomeia (os contatos acompanham) e exclui', async ({ page, banco }) => {
        await abrir(page);
        await page.locator('#filters .chip-manage').click();
        await expect(page.locator('#catDialog')).toBeVisible();
        await page.fill('#newCatName', 'Juízes');
        await page.click('#addCatBtn');
        await expect(page.locator('#filters .chip', { hasText: 'Juízes' })).toBeVisible();
        await expect.poll(() => banco.tabelas.categories.map(c => c.name)).toContain('Juízes');

        await page.fill('#newCatName', 'Perito');
        await page.click('#addCatBtn');
        await expect(page.locator('#toast')).toHaveText('Essa categoria já existe');

        const perito = page.locator('#catList .cat-row input').nth(1);
        await expect(perito).toHaveValue('Perito');
        await perito.fill('Peritos');
        await perito.press('Tab');
        await expect.poll(() => banco.tabelas.contacts.find(c => c.name.startsWith('Bruno')).category).toBe('Peritos');
        expect(banco.tabelas.categories.map(c => c.name)).toContain('Peritos');
        await expect(page.locator('#filters .chip', { hasText: 'Peritos' })).toBeVisible();

        await expect(page.locator('#catList .cat-row input').nth(0)).toHaveValue('Advogado');
        await page.locator('#catList .cat-row').nth(0).locator('.icon-btn').click();
        await expect.poll(() => banco.tabelas.categories.map(c => c.name)).not.toContain('Advogado');
        await expect(page.locator('#filters .chip', { hasText: 'Advogado' })).toHaveCount(0);
        await page.click('#closeCatBtn');
        await expect(page.locator('#catDialog')).not.toBeVisible();
        await expect(page.locator('#groups .card', { hasText: 'Bruno' }).locator('.badge')).toHaveText('Peritos');
      });
    });

    test('banco vazio: cria as categorias padrão e três contatos de exemplo', async ({ page, banco }) => {
      await page.goto(v.endereco);
      await expect(page.locator('#count')).toHaveText('3 contatos');
      expect(banco.tabelas.categories.map(c => c.name).sort()).toEqual(['Advogado', 'Cidades', 'Diretorias', 'Gabinetes', 'Magistrado', 'Perito', 'Secretarias']);
      await expect(page.locator('#groups')).toContainText('Secretaria da 2ª Vara Cível');
      await expect(page.locator('#filters .chip')).toHaveCount(8);
    });
  });
}
