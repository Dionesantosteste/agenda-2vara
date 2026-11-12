// Arquivo de processos físicos (/arquivo): menu, busca, ficha, saídas, cadastro, prateleiras,
// secretarias e conferência. O Arquivo é uma página própria, igual nos dois sistemas.
const { test, expect } = require('../apoio/teste');

const CX = { c1320: 'c0000000-0000-4000-8000-000000001320', cri: 'c0000000-0000-4000-8000-000000000155', c1321: 'c0000000-0000-4000-8000-000000001321', sec: 'c0000000-0000-4000-8000-0000000000aa' };
function semear(banco){
  banco.semear('arquivo_caixas', [
    { id: CX.c1320, nome: '1320', locais: [[5, 'B']] },
    { id: CX.cri, nome: '155-CRI', locais: [] },
    { id: CX.c1321, nome: '1321', locais: [[5, 'C'], [7, 'A']] },
    { id: CX.sec, nome: 'Não informada', locais: [], secretaria: true }
  ]);
  banco.semear('arquivo_processos', [
    { codigo: '30208', caixa_id: CX.c1320 }, { codigo: '30208', caixa_id: CX.c1321 },
    { codigo: '1421/1996', caixa_id: CX.cri }, { codigo: '14212', caixa_id: CX.c1320 }, { codigo: '224/87', caixa_id: CX.c1320 },
    { codigo: '81954', caixa_id: CX.c1320, situacao: 2 },
    { codigo: '36324', caixa_id: CX.sec, origem_id: CX.c1320, situacao: 1 }
  ]);
  banco.semear('arquivo_notas', [{ celula: 'R804', texto: 'cp precatória', contexto: 'dentro da caixa 1031' }]);
}
const proc = (banco, cod) => banco.tabelas.arquivo_processos.find(p => p.codigo === cod && !p.excluido);
const abrir = async (page, hash = '') => { await page.goto('/arquivo' + hash); await expect(page.locator('.aq-app')).toBeVisible(); await expect(page.locator('.aq-vazio', { hasText: 'Abrindo o arquivo' })).toHaveCount(0); };

test.beforeEach(async ({ banco }) => semear(banco));

test('o menu dos dois sistemas leva ao Arquivo, que tem "Voltar ao portal"', async ({ page }) => {
  await page.goto('/#agenda');
  await expect(page.locator('#navArquivo')).toHaveAttribute('href', '/arquivo');
  await page.click('#navArquivo');
  await expect(page).toHaveURL(/\/arquivo/);
  await expect(page.locator('.aq-lateral .aq-plaqueta')).toContainText('2ª VARA');
  await expect(page.locator('#voltarPortal')).toHaveAttribute('href', /^\/(#.*)?$/);
  await page.goto('/novo/agenda');
  await expect(page.locator('#navArquivo')).toHaveAttribute('href', '/arquivo');
});

test('busca: número igual primeiro (1421 acha 1421/1996), com a pendência da caixa sem prateleira', async ({ page }) => {
  await abrir(page);
  await page.fill('#aq-q', '1421');
  const grupos = page.locator('#aq-resultados .aq-grupo-busca');
  await expect(grupos.first()).toContainText('Igual a');
  const primeira = page.locator('#aq-resultados .aq-res').first();
  await expect(primeira.locator('.aq-cod')).toHaveText('1421/1996');
  await expect(primeira.locator('.aq-aviso-ficha')).toContainText('caixa sem prateleira');
  await expect(page.locator('#aq-resultados .aq-res').nth(1).locator('.aq-cod')).toHaveText('14212');
  await page.fill('#aq-q', '224/1987');
  await expect(page.locator('#aq-resultados .aq-res').first().locator('.aq-cod')).toHaveText('224/87');
  await page.fill('#aq-q', 'cx 1320');
  await expect(page.locator('#aq-resultados .aq-res').first()).toContainText('Caixa 1320');
});

test('ficha: registrar saída e devolver pelo Livro de saídas grava no banco e no histórico', async ({ page, banco }) => {
  await abrir(page);
  await page.fill('#aq-q', '14212');
  await page.locator('#aq-resultados .aq-res').first().click();
  await expect(page.locator('.aq-gaveta .aq-cod')).toHaveText('14212');
  await expect(page.locator('.aq-gaveta .aq-dados')).toContainText('5');
  await page.click('text=Registrar saída (desarquivar)');
  await page.fill('#aq-g-quem', 'Maria');
  await page.locator('.aq-sub-form button[type=submit]').click();
  await expect(page.locator('.aq-toast')).toContainText('Saída do 14212 registrada');
  await expect.poll(() => proc(banco, '14212').situacao).toBe(3);
  expect(proc(banco, '14212').com_quem).toBe('Maria');
  await expect.poll(() => banco.tabelas.arquivo_movimentos.map(m => m.texto)).toContain('Saiu do arquivo com Maria (Secretaria da vara)');
  await page.locator('.aq-fechar').click();
  await page.fill('#aq-q', '');
  const livro = page.locator('#aq-livro');
  await expect(livro).toContainText('14212');
  await livro.locator('.aq-saida-item', { hasText: '14212' }).locator('text=Devolver à caixa 1320').click();
  await expect.poll(() => proc(banco, '14212').situacao).toBe(0);
  // desfazer volta para desarquivado
  await page.locator('.aq-toast button', { hasText: 'Desfazer' }).click();
  await expect.poll(() => proc(banco, '14212').situacao).toBe(3);
});

test('os de outra secretaria não aparecem no Livro de saídas; o "para desarquivar" pode voltar à caixa', async ({ page, banco }) => {
  await abrir(page);
  const livro = page.locator('#aq-livro');
  await expect(livro).toContainText('81954');
  await expect(livro).not.toContainText('36324');
  await livro.locator('text=Devolver à caixa 1320').click();
  await expect.poll(() => proc(banco, '81954').situacao).toBe(0);
  await expect(page.locator('#aq-livro')).toHaveCount(0);   // livro vazio some
});

test('cadastro: aviso vermelho de duplicado pede confirmação; caixa nova exige prateleira e fileira', async ({ page, banco }) => {
  await abrir(page, '#cadastrar');
  await page.fill('#aq-c-codigo', '30208');
  await expect(page.locator('#aq-dupl')).toBeVisible();
  await expect(page.locator('#aq-dupl')).toHaveClass(/aq-vermelho/);
  await page.fill('#aq-c-cx', '1320');
  await expect(page.locator('#aq-c-cx-p')).toHaveValue('5');
  await expect(page.locator('#aq-c-cx-f')).toHaveValue('B');
  const salvar = page.locator('#aq-fcad button[type=submit]');
  await salvar.click();
  await expect(salvar).toHaveText('Salvar mesmo assim (outro volume)');
  expect(banco.tabelas.arquivo_processos.filter(p => p.codigo === '30208')).toHaveLength(2);
  await salvar.click();
  await expect.poll(() => banco.tabelas.arquivo_processos.filter(p => p.codigo === '30208').length).toBe(3);
  // caixa nova: sem lugar não salva; com lugar cria a caixa
  await page.fill('#aq-c-codigo', '777001');
  await page.fill('#aq-c-cx', '9999');
  await page.fill('#aq-c-cx-p', ''); await page.fill('#aq-c-cx-f', '');
  await salvar.click();
  await expect(page.locator('.aq-toast')).toContainText('Caixa nova: preencha a prateleira e a fileira');
  await page.fill('#aq-c-cx-p', '40'); await page.fill('#aq-c-cx-f', 'c');
  await page.fill('#aq-c-obs', 'Volume 2');
  await salvar.click();
  await expect.poll(() => proc(banco, '777001') && proc(banco, '777001').obs).toBe('Volume 2');
  const nova = banco.tabelas.arquivo_caixas.find(c => c.nome === '9999');
  expect(nova.locais).toEqual([[40, 'C']]);
  expect(proc(banco, '777001').caixa_id).toBe(nova.id);
});

test('cadastro por foto sem a chave configurada avisa e deixa preencher à mão', async ({ page }) => {
  await page.route('**/api/arquivo/ler-capa', r => r.fulfill({ status: 503, json: { erro: 'A leitura por foto ainda não foi configurada (falta a chave da Anthropic na Vercel). Preencha os campos.' } }));
  await abrir(page, '#cadastrar');
  await page.setInputFiles('#aq-arqfoto', { name: 'capa.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await expect(page.locator('#aq-estado-ia')).toContainText('ainda não foi configurada');
});

test('prateleiras: filtro P5, fileira destacada, Outra Secretaria no fim e caixa em dois lugares', async ({ page }) => {
  await abrir(page, '#prateleiras');
  const titulos = page.locator('#aq-estantes .aq-estante-cab h3');
  await expect(titulos.last()).toContainText('Outra Secretaria');
  await page.fill('#aq-fcx', 'P5 C');
  await expect(titulos).toHaveCount(1);
  await expect(titulos.first()).toContainText('Prateleira 5');
  await expect(page.locator('.aq-fileira.aq-foco')).toHaveAttribute('data-f', 'C');
  await expect(page.locator('.aq-cxb.aq-conf')).toHaveCount(1);
  await page.fill('#aq-fcx', 'os');
  await expect(titulos).toHaveText([/Outra Secretaria/]);
  await page.locator('.aq-filtro-ativo button').click();
  await page.locator('.aq-cxb', { hasText: '1320' }).first().click();
  await expect(page).toHaveURL(/#cx-/);
  await expect(page.locator('h1')).toHaveText('Caixa 1320');
  await expect(page.locator('#aq-cx-fora')).toContainText('81954');
});

test('mandar para uma secretaria cria a caixa dela e devolver volta para a caixa de origem', async ({ page, banco }) => {
  await abrir(page);
  await page.fill('#aq-q', '14212');
  await page.locator('#aq-resultados .aq-res').first().click();
  await page.click('text=Mandar para outra secretaria');
  await page.fill('#aq-j-sec', 'Contadoria');
  await page.locator('#aq-jan button[type=submit]').click();
  await expect.poll(() => proc(banco, '14212').situacao).toBe(1);
  const contadoria = banco.tabelas.arquivo_caixas.find(c => c.nome === 'Contadoria');
  expect(contadoria.secretaria).toBe(true);
  expect(proc(banco, '14212').caixa_id).toBe(contadoria.id);
  expect(proc(banco, '14212').origem_id).toBe(CX.c1320);
  await expect(page.locator('.aq-gaveta .aq-dados')).toContainText('Contadoria');
  await page.click('text=Devolver à caixa 1320');
  await expect.poll(() => proc(banco, '14212').caixa_id).toBe(CX.c1320);
  expect(proc(banco, '14212').situacao).toBe(0);
});

test('conferir: anotar a prateleira de uma caixa e escolher a caixa certa de um processo repetido', async ({ page, banco }) => {
  await abrir(page, '#conferir');
  await page.fill('input[aria-label="Prateleira da caixa 155-CRI"]', '12');
  await page.fill('input[aria-label="Fileira da caixa 155-CRI"]', 'c');
  await page.locator('.aq-conf-item', { hasText: '155-CRI' }).locator('text=Anotar').click();
  await expect.poll(() => banco.tabelas.arquivo_caixas.find(c => c.id === CX.cri).locais).toEqual([[12, 'C']]);
  await page.locator('.aq-conf-aba', { hasText: 'processos em mais de uma caixa' }).click();
  await page.locator('.aq-conf-item', { hasText: '30208' }).locator('button', { hasText: '1320' }).click();
  await expect.poll(() => banco.tabelas.arquivo_processos.filter(p => p.codigo === '30208' && !p.excluido).map(p => p.caixa_id)).toEqual([CX.c1320]);
  await page.locator('.aq-conf-aba', { hasText: 'anotações estranhas' }).click();
  await page.locator('.aq-conf-item', { hasText: 'R804' }).locator('text=Resolvido').click();
  await expect.poll(() => banco.tabelas.arquivo_notas[0].resolvida).toBe(true);
});
