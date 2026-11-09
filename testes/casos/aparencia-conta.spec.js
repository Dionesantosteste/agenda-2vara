// Aparência guardada na conta (tabela preferencias): vale em qualquer computador, navegador ou endereço.
const { test, expect, sessaoFalsa } = require('../apoio/teste');

const EU = sessaoFalsa().user.id;
const conta = banco => banco.tabelas.preferencias.find(p => p.user_id === EU);
// Aparência já guardada neste navegador antes de abrir a página (só na primeira carga)
async function navegador(page, valores){
  await page.addInitScript(v => {
    if (sessionStorage.getItem('__aparSemeada')) return;
    sessionStorage.setItem('__aparSemeada', '1');
    Object.entries(v).forEach(([k, x]) => localStorage.setItem(k, x));
  }, valores);
}

for (const [nome, endereco] of [['sistema atual', '/#prazos'], ['sistema novo', '/novo']]){
  test.describe(nome, () => {
    test('a aparência da conta vale num navegador novo', async ({ page, banco }) => {
      banco.semear('preferencias', [{ user_id: EU, aparencia: { tema: 'dark', fundo: 'ceu', colunas: { afazer: 'rosa' } } }]);
      await page.goto(endereco);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('html')).toHaveAttribute('data-fundo', 'ceu');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aparColunas')))).toEqual({ afazer: 'rosa' });
    });

    test('a conta sem aparência recebe a deste navegador', async ({ page, banco }) => {
      await navegador(page, { aparFundo: 'salvia', aparTema: 'contraste' });
      await page.goto(endereco);
      await expect.poll(() => conta(banco) && conta(banco).aparencia).toMatchObject({ tema: 'contraste', fundo: 'salvia' });
      await expect(page.locator('html')).toHaveAttribute('data-fundo', 'salvia');
    });

    test('trocar a cor no menu grava na conta', async ({ page, banco }) => {
      banco.semear('preferencias', [{ user_id: EU, aparencia: { tema: null, fundo: 'ceu', colunas: {} } }]);
      await page.goto(endereco);
      await expect(page.locator('html')).toHaveAttribute('data-fundo', 'ceu');
      await page.click('#aparBtn');
      await page.locator('#aparFundo [data-cor-id="amarelo"]').click();
      await page.locator('#aparTema [data-tema="dark"]').click();
      await expect.poll(() => conta(banco).aparencia).toMatchObject({ tema: 'dark', fundo: 'amarelo' });
      await expect.poll(() => page.evaluate(() => localStorage.getItem('aparPendente'))).toBeNull();
    });

    test('mudança que a conta não confirmou não é desfeita', async ({ page, banco }) => {
      banco.semear('preferencias', [{ user_id: EU, aparencia: { tema: null, fundo: 'ceu', colunas: {} } }]);
      await navegador(page, { aparFundo: 'lavanda', aparPendente: '1' });
      await page.goto(endereco);
      await expect.poll(() => conta(banco).aparencia.fundo).toBe('lavanda');
      await expect(page.locator('html')).toHaveAttribute('data-fundo', 'lavanda');
    });
  });
}
