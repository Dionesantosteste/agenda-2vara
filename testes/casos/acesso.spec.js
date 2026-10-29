// Acesso por convite: quem não entrou não vê o sistema; login; criação de senha; tela do administrador.
const { test, expect, sessaoFalsa } = require('../apoio/teste');

test.describe('sem login', () => {
  test.use({ semSessao: true });

  test('o sistema novo manda para a tela de entrada e guarda para onde voltar', async ({ page }) => {
    await page.goto('/novo/agenda');
    await expect(page).toHaveURL(/\/entrar\?volta=%2Fnovo%2Fagenda/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.locator('#sidebar')).toHaveCount(0);   // nada do sistema aparece
  });

  test('o sistema atual (endereço principal) também manda para a entrada', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('entrar com e-mail e senha leva de volta para onde a pessoa queria ir', async ({ page }) => {
    await page.route('**/auth/v1/token*', route => route.fulfill({ json: sessaoFalsa(false) }));
    await page.goto('/entrar?volta=' + encodeURIComponent('/novo/prazos'));
    await page.getByLabel('E-mail').fill('ana@vara.com');
    await page.getByLabel('Senha').fill('senhaboa123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/novo\/prazos$/);
    await expect(page.locator('#sidebar')).toBeVisible();
  });

  test('senha errada mostra o aviso em português', async ({ page }) => {
    await page.route('**/auth/v1/token*', route => route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials' } }));
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill('ana@vara.com');
    await page.getByLabel('Senha').fill('errada');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.locator('.acesso-msg.erro')).toHaveText('E-mail ou senha incorretos.');
  });

  test('link do convite vencido explica o que fazer', async ({ page }) => {
    await page.goto('/definir-senha');
    await expect(page.getByRole('heading', { name: 'Link vencido' })).toBeVisible({ timeout: 8000 });
  });

  test('link do convite que aponta direto para o site abre a criação de senha', async ({ page }) => {
    let pedido = null;
    await page.route('**/auth/v1/verify*', route => { pedido = JSON.parse(route.request().postData()); return route.fulfill({ json: sessaoFalsa(false) }); });
    await page.route('**/auth/v1/user*', route => route.fulfill({ json: sessaoFalsa(false).user }));
    await page.goto('/definir-senha?token_hash=abc123&type=invite');
    await expect(page.getByRole('heading', { name: 'Criar senha' })).toBeVisible();
    await expect(page.getByLabel('Nova senha')).toBeVisible();
    expect(pedido).toMatchObject({ token_hash: 'abc123', type: 'invite' });
    await expect(page).toHaveURL(/\/definir-senha$/);   // o código sai do endereço
  });

  test('link com código inválido mostra link vencido', async ({ page }) => {
    await page.route('**/auth/v1/verify*', route => route.fulfill({ status: 403, json: { error: 'otp_expired', error_description: 'Email link is invalid or has expired' } }));
    await page.goto('/definir-senha?token_hash=velho&type=invite');
    await expect(page.getByRole('heading', { name: 'Link vencido' })).toBeVisible();
  });

  test('não volta para outro site depois de entrar', async ({ page }) => {
    await page.route('**/auth/v1/token*', route => route.fulfill({ json: sessaoFalsa(false) }));
    await page.goto('/entrar?volta=' + encodeURIComponent('https://outro.com/x'));
    await page.getByLabel('E-mail').fill('ana@vara.com');
    await page.getByLabel('Senha').fill('senhaboa123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/localhost|127\.0\.0\.1/);
  });
});

test.describe('com login', () => {
  test('o botão Sair volta para a entrada', async ({ page }) => {
    await page.route('**/auth/v1/logout*', route => route.fulfill({ status: 204, body: '' }));
    await page.goto('/novo/agenda');
    await page.locator('#sairBtn').click();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('administrador convida e vê a lista de pessoas', async ({ page }) => {
    const convidados = [];
    await page.route('**/api/acesso*', async route => {
      const req = route.request();
      if (req.method() === 'POST') { convidados.push(JSON.parse(req.postData()).email); return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ json: { usuarios: [
        { id: 'a', email: 'teste@vara.com', criadoEm: '2026-01-01T00:00:00Z', ultimoAcesso: '2026-02-01T00:00:00Z', ativo: true, admin: true, eu: true },
        { id: 'b', email: 'ana@vara.com', criadoEm: '2026-02-01T00:00:00Z', ultimoAcesso: null, ativo: false, admin: false, eu: false }
      ] } });
    });
    await page.goto('/novo/acesso');
    await expect(page.getByText('ana@vara.com')).toBeVisible();
    await expect(page.getByText('Convite pendente')).toBeVisible();
    await page.getByLabel('E-mail da pessoa').fill('beto@vara.com');
    await page.getByRole('button', { name: 'Enviar convite', exact: true }).click();
    await expect.poll(() => convidados).toEqual(['beto@vara.com']);
  });

  test('quem não é administrador não vê o link Acessos', async ({ page }) => {
    await page.addInitScript(([chave, valor]) => localStorage.setItem(chave, valor), ['sb-mgfsfzzvngqarwcmfzxy-auth-token', JSON.stringify(sessaoFalsa(false))]);
    await page.goto('/novo/agenda');
    await expect(page.locator('#sairBtn')).toBeVisible();
    await expect(page.locator('#acessosLink')).toHaveCount(0);
  });
});
