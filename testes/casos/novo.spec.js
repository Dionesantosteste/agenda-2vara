// Base do sistema novo (/novo): menu, Aparência compartilhada com o sistema atual, aviso e menu do celular.
const { test, expect } = require('../apoio/teste');

test('o endereço principal continua sendo o sistema atual', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#view-organizacao')).toBeAttached();
  await expect(page).toHaveURL(/\/$/);
});

test('o menu do sistema novo leva as seções migradas para o sistema novo e as demais para o sistema atual', async ({ page }) => {
  await page.goto('/novo');
  const itens = page.locator('.nav .nav-item');
  await expect(itens).toHaveText(['Agenda', 'Audiências', 'Perícias', 'Prazos', 'Organização']);
  await expect(itens.nth(0)).toHaveAttribute('href', '/novo/agenda');
  await expect(itens.nth(1)).toHaveAttribute('href', '/#audiencias');
  await expect(itens.nth(3)).toHaveAttribute('href', '/novo/prazos');
  await expect(itens.nth(4)).toHaveAttribute('href', '/#organizacao');
  await expect(page.locator('#todayLong')).not.toBeEmpty();
});

test('a Aparência escolhida no sistema novo vale também no sistema atual', async ({ page }) => {
  await page.goto('/novo');
  await page.click('#aparBtn');
  await page.locator('#aparTema [data-tema="dark"]').click();
  await page.locator('#aparFundo [data-cor-id="lavanda"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-fundo', 'lavanda');
  await page.goto('/#prazos');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-fundo', 'lavanda');
  // e volta: "Automático" e fundo padrão tiram as marcas
  await page.goto('/novo');
  await page.click('#aparBtn');
  await expect(page.locator('#aparTema [data-tema="dark"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#aparTema [data-tema="auto"]').click();
  await page.locator('#aparFundo .cor-sw.padrao').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  await expect(page.locator('html')).not.toHaveAttribute('data-fundo', /./);
});

test('aviso aparece e some sozinho', async ({ page }) => {
  await page.goto('/novo');
  await page.click('#novoTesteAviso');
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toHaveText('Aviso de teste do sistema novo');
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 4000 });
});

test.describe('no celular', () => {
  test.use({ viewport: { width: 400, height: 800 } });
  test('o menu abre pelo botão e fecha com Esc', async ({ page }) => {
    await page.goto('/novo');
    await expect(page.locator('#sidebar')).not.toBeInViewport();
    await page.click('#navToggle');
    await expect(page.locator('#shell')).toHaveClass(/nav-open/);
    await expect(page.locator('#sidebar')).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.locator('#shell')).not.toHaveClass(/nav-open/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
});
