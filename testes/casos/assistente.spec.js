// Assistente do gestor: entrada com a senha da Organização, conversa com a IA (simulada aqui),
// salvar rotina e modelo de texto a partir da resposta, e a aba Rotinas de secretaria.
const { test, expect, PIN_GESTOR } = require('../apoio/teste');

async function entrar(page){
  await page.goto('/novo/assistente');
  await page.getByLabel('Senha de 6 dígitos').fill(PIN_GESTOR);
  await expect(page.getByRole('tab', { name: 'Conversa' })).toBeVisible();
}

// A rota /api/assistente chama a IA de verdade; nos testes ela é trocada por respostas prontas
async function iaFalsa(page, respostas){
  const pedidos = [];
  await page.route('**/api/assistente', async route => {
    const corpo = JSON.parse(route.request().postData() || '{}');
    pedidos.push(corpo);
    const r = respostas[Math.min(pedidos.length - 1, respostas.length - 1)];
    if (r.status) return route.fulfill({ status: r.status, json: r.json });
    await route.fulfill({ status: 200, json: { historico: [...corpo.historico, { role: 'user', content: corpo.mensagem }, { role: 'assistant', content: r.resposta }], resposta: r.resposta, propostas: r.propostas || [] } });
  });
  return pedidos;
}

test('pede a senha do gestor antes de abrir e aceita só a certa', async ({ page }) => {
  await page.goto('/novo/assistente');
  await expect(page.locator('.nav-item[aria-current="page"]')).toHaveText('Assistente');
  await page.getByLabel('Senha de 6 dígitos').fill('000000');
  await expect(page.locator('.lock-msg')).toHaveText('Senha incorreta.');
  await page.getByLabel('Senha de 6 dígitos').fill(PIN_GESTOR);
  await expect(page.getByRole('tab', { name: 'Conversa' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('orgPin'))).toBe(PIN_GESTOR);
});

test('a IA propõe uma rotina e o gestor confere e salva', async ({ page, banco }) => {
  const pedidos = await iaFalsa(page, [
    { resposta: 'Segue a rotina sugerida. Está na tela para conferir e salvar.', propostas: [
      { tipo: 'rotina', titulo: 'Após a decisão', assunto: 'INSS', quando: 'Decisão que concede o benefício', passos: ['Intimar a APS para implantar', 'Aguardar 30 dias'], observacoes: '' }
    ] },
    { resposta: 'Pronto.' }
  ]);
  await entrar(page);
  await page.getByLabel('Sua pergunta ou pedido').fill('Salve a rotina de INSS após a decisão');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('.ast-balao.ia')).toContainText('Segue a rotina sugerida');
  expect(pedidos[0]).toMatchObject({ pin: PIN_GESTOR, historico: [], mensagem: 'Salve a rotina de INSS após a decisão' });

  await page.getByRole('button', { name: 'Conferir e salvar rotina' }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Após a decisão');
  await expect(page.getByLabel('Passos (um por linha)')).toHaveValue('1. Intimar a APS para implantar\n2. Aguardar 30 dias');
  await page.getByLabel('Passos (um por linha)').fill('1. Intimar a APS para implantar\n2. Aguardar 30 dias\n3. Conferir a implantação');
  await page.getByRole('button', { name: 'Salvar rotina', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(banco.org.ast_rotinas).toHaveLength(1);
  expect(banco.org.ast_rotinas[0]).toMatchObject({ titulo: 'Após a decisão', assunto: 'INSS', passos: ['Intimar a APS para implantar', 'Aguardar 30 dias', 'Conferir a implantação'] });

  // a conversa continua: a próxima pergunta leva o histórico de volta
  await page.getByLabel('Sua pergunta ou pedido').fill('Obrigado');
  await page.getByLabel('Sua pergunta ou pedido').press('Control+Enter');
  await expect(page.locator('.ast-balao.ia')).toHaveCount(2);
  expect(pedidos[1].historico).toHaveLength(2);

  await page.getByRole('tab', { name: /Rotinas de secretaria/ }).click();
  await expect(page.locator('.ast-grupo h3')).toHaveText('INSS');
  await page.locator('.ast-rot summary').click();
  await expect(page.locator('.ast-rot .ast-rot-passos li')).toHaveText(['Intimar a APS para implantar', 'Aguardar 30 dias', 'Conferir a implantação']);
});

test('a resposta da IA vira modelo de texto na biblioteca da Organização', async ({ page, banco }) => {
  await iaFalsa(page, [{ resposta: 'CERTIDÃO\n\nCertifico que decorreu o prazo sem manifestação no processo {{processo}}.' }]);
  await entrar(page);
  await page.locator('.ast-sugestao').nth(1).click();
  await expect(page.locator('.ast-balao.ia')).toContainText('Certifico que decorreu');
  await page.getByRole('button', { name: 'Salvar como modelo de texto' }).click();
  await expect(page.getByLabel('Texto', { exact: true })).toHaveValue('CERTIDÃO\n\nCertifico que decorreu o prazo sem manifestação no processo {{processo}}.');
  await page.getByRole('button', { name: 'Salvar modelo' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Dê um nome ao modelo.' })).toBeVisible();
  await page.getByLabel('Nome do modelo').fill('Certidão de decurso de prazo');
  await page.getByLabel('Categoria').fill('Certidões');
  await page.getByRole('button', { name: 'Salvar modelo' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(banco.org.txt_modelos).toHaveLength(1);
  expect(banco.org.txt_modelos[0]).toMatchObject({ nome: 'Certidão de decurso de prazo', categoria: 'Certidões' });
});

test('erro da IA aparece na conversa e devolve a pergunta; senha vencida volta para a tranca', async ({ page }) => {
  await iaFalsa(page, [
    { status: 500, json: { erro: 'O servidor ainda não tem a chave da IA (ANTHROPIC_API_KEY).' } },
    { status: 403, json: { erro: 'Senha incorreta.', senha: true } }
  ]);
  await entrar(page);
  await page.getByLabel('Sua pergunta ou pedido').fill('Oi');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('.ast-balao.erro')).toContainText('ANTHROPIC_API_KEY');
  await expect(page.getByLabel('Sua pergunta ou pedido')).toHaveValue('Oi');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByLabel('Senha de 6 dígitos')).toBeVisible();
});

test('aba Rotinas: cadastrar, procurar, editar e excluir', async ({ page, banco }) => {
  await entrar(page);
  await page.getByRole('tab', { name: /Rotinas de secretaria/ }).click();
  await expect(page.locator('.ast-vazio')).toContainText('Nenhuma rotina cadastrada');

  await page.getByRole('button', { name: 'Nova rotina' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Expedir alvará');
  await page.getByLabel('Assunto').fill('Execução');
  await page.getByLabel('Passos (um por linha)').fill('Conferir a conta\nExpedir o alvará\nIntimar o advogado');
  await page.getByRole('button', { name: 'Salvar rotina', exact: true }).click();
  await expect(page.locator('.ast-rot')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'Rotinas de secretaria (1)' })).toBeVisible();

  await page.getByLabel('Procurar rotina').fill('inss');
  await expect(page.locator('.ast-vazio')).toContainText('Nenhuma rotina combina');
  await page.getByLabel('Procurar rotina').fill('alvara');
  await expect(page.locator('.ast-rot')).toHaveCount(1);

  await page.locator('.ast-rot summary').click();
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByLabel('Passos (um por linha)')).toHaveValue('1. Conferir a conta\n2. Expedir o alvará\n3. Intimar o advogado');
  await page.getByLabel('Quando se aplica').fill('Depósito judicial na conta única');
  await page.getByRole('button', { name: 'Salvar rotina', exact: true }).click();
  await expect(page.locator('.ast-rot-quando')).toHaveText('Depósito judicial na conta única');
  expect(banco.org.ast_rotinas[0].passos).toEqual(['Conferir a conta', 'Expedir o alvará', 'Intimar o advogado']);

  await page.getByRole('button', { name: 'Excluir a rotina Expedir alvará' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão da rotina Expedir alvará' }).click();
  await expect(page.locator('.ast-rot')).toHaveCount(0);
  expect(banco.org.ast_rotinas).toHaveLength(0);
});
