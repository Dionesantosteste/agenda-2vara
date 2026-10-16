// Prazos: contagem em dias úteis (CPC, art. 219), recesso, feriados, trânsito em julgado, idade e tabela.
// As datas esperadas foram contadas à mão (calendário de 2026: Carnaval 16 e 17/02, Sexta-feira Santa 03/04).
// Os mesmos testes rodam no sistema atual (/#prazos) e no sistema novo (/novo/prazos).
const { test, expect } = require('../apoio/teste');

const VERSOES = [
  { nome: 'sistema atual', endereco: '/#prazos' },
  { nome: 'sistema novo', endereco: '/novo/prazos' }
];

for (const v of VERSOES){
  test.describe(v.nome, () => {
    const abrir = async (page, aba) => {
      await page.goto(v.endereco);
      await expect(page.locator('#pzPRes')).not.toBeEmpty();
      if (aba) await page.locator('[data-aba="' + aba + '"]').click();
    };
    // preenche a aba Calcular prazo (ato vazio = "Outro prazo (digitar)")
    const calcula = async (page, { ato, n, unidade, forma, data, leitura, dobro, alvo }) => {
      if (ato !== undefined) await page.selectOption('#pzPAto', ato);
      if (n !== undefined) await page.fill('#pzPN', String(n));
      if (unidade) await page.selectOption('#pzPUn', unidade);
      if (forma) await page.selectOption('#pzPForma', forma);
      if (alvo){ await page.click('#pzPDirAntes'); await page.fill('#pzPAlvo', alvo); }
      if (data) await page.fill('#pzPData1', data);
      if (leitura) await page.fill('#pzPData2', leitura);
      if (dobro !== undefined) await page.selectOption('#pzPDobro', dobro);
    };
    const venc = page => page.locator('#pzPRes .venc .data');
    const res = page => page.locator('#pzPRes');

    test.describe('calcular prazo', () => {
      test('15 dias úteis pelo DJEN: publicação no dia útil seguinte e início no outro', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 15, unidade: 'u', forma: 'djen', data: '2026-03-02' });
        await expect(venc(page)).toHaveText('24/03/2026');
        await expect(res(page)).toContainText(/03\/03\/2026\s*terça-feira\s*Publicação/);
        await expect(res(page)).toContainText(/04\/03\/2026\s*quarta-feira\s*Início da contagem/);
      });

      test('o recesso de 20/12 a 20/01 não conta', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 5, unidade: 'u', forma: 'djen', data: '2026-12-15' });
        await expect(venc(page)).toHaveText('25/01/2027');
      });

      test('feriado do calendário da vara empurra o vencimento', async ({ page, banco }) => {
        banco.semear('prazos_config', [{ chave: 'extra.teste1', valor: { data: '2026-03-10', nome: 'Feriado municipal', anual: false } }]);
        await abrir(page);
        await calcula(page, { ato: '', n: 15, unidade: 'u', forma: 'djen', data: '2026-03-02' });
        await expect(venc(page)).toHaveText('25/03/2026');
      });

      test('dias corridos: fins de semana contam', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 10, unidade: 'c', forma: 'djen', data: '2026-03-02' });
        await expect(venc(page)).toHaveText('13/03/2026');
        await expect(res(page)).toContainText('Dias corridos:');
      });

      test('dias corridos: último dia num domingo passa para segunda', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 10, unidade: 'c', forma: 'djen', data: '2026-03-04' });
        await expect(venc(page)).toHaveText('16/03/2026');
        await expect(res(page)).toContainText('O último dia (15/03/2026) caiu em dia sem expediente (Domingo). Prorrogado para 16/03/2026');
      });

      test('prazo em dobro para a Fazenda Pública', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: 'contestacao', forma: 'djen', data: '2026-03-02', dobro: 'faz' });
        await expect(res(page)).toContainText('30 (trinta) dias úteis');
        await expect(res(page)).toContainText('Prazo em dobro para Fazenda Pública (art. 183): 15 (quinze) dias úteis passam a 30 (trinta) dias úteis.');
        await expect(venc(page)).toHaveText('15/04/2026');   // pula a Sexta-feira Santa (03/04)
      });

      test('prazo próprio não dobra', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: 'impug_535', forma: 'djen', data: '2026-03-02', dobro: 'faz' });
        await expect(res(page)).toContainText('Não dobra: este é um prazo próprio (art. 535). Mantido em 30 (trinta) dias úteis.');
      });

      test('contagem regressiva antes da audiência', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: 'cit_334', alvo: '2026-03-31' });
        await expect(page.locator('#pzPRes .venc .lbl')).toHaveText('Cumprir até');
        await expect(venc(page)).toHaveText('03/03/2026');
      });

      test('PJe sem leitura: ciência automática 10 dias corridos após o envio', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 15, unidade: 'u', forma: 'pje', data: '2026-03-02' });
        await expect(res(page)).toContainText(/12\/03\/2026\s*quinta-feira\s*Ciência automática/);
        await expect(venc(page)).toHaveText('02/04/2026');
      });

      test('PJe com leitura: ciência na data da leitura', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 15, unidade: 'u', forma: 'pje', data: '2026-03-02', leitura: '2026-03-04' });
        await expect(res(page)).toContainText(/04\/03\/2026\s*quarta-feira\s*Leitura da intimação/);
        await expect(venc(page)).toHaveText('25/03/2026');
      });

      test('Domicílio Judicial: começa do 5º dia útil após a confirmação', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 15, unidade: 'u', forma: 'dom', data: '2026-03-02' });
        await expect(res(page)).toContainText(/09\/03\/2026\s*segunda-feira\s*5º dia útil após a confirmação/);
        await expect(venc(page)).toHaveText('30/03/2026');
      });

      test('meses: dia que não existe vai para o dia seguinte, e fim de semana passa para o dia útil', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: '', n: 2, unidade: 'm', forma: 'juntada', data: '2025-12-31' });
        await expect(venc(page)).toHaveText('02/03/2026');
      });

      test('prazo máximo do ECA conta direto da data, sem prorrogar', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: 'eca_acolh' });
        await expect(page.locator('#pzPData1Lbl')).toHaveText('Data do acolhimento');
        await expect(page.locator('#pzBoxForma')).toBeHidden();
        await page.fill('#pzPData1', '2026-01-10');
        await expect(page.locator('#pzPRes .venc .lbl')).toHaveText('Data limite');
        await expect(venc(page)).toHaveText('10/07/2027');
      });

      test('texto da certidão, com o número do processo formatado e o decurso', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: 'apelacao', forma: 'djen', data: '2026-03-02' });
        await page.fill('#pzPParte', 'a parte ré');
        await page.locator('#pzPProc').pressSequentially('10023456720268110041');
        await expect(page.locator('#pzPProc')).toHaveValue('1002345-67.2026.8.11.0041');
        await expect(page.locator('#pzPCert')).toHaveValue('Certifico que a parte ré foi intimada por publicação no Diário de Justiça Eletrônico Nacional disponibilizada em 02/03/2026 e considerada publicada em 03/03/2026, nos autos 1002345-67.2026.8.11.0041. O prazo de 15 (quinze) dias úteis para apelação teve início em 04/03/2026 e encerrou-se em 24/03/2026.');
        await page.check('#pzPDecurso');
        await expect(page.locator('#pzPCert')).toHaveValue(/Certifico, ainda, que o prazo decorreu sem manifestação\.$/);
      });

      test('texto da certidão editado à mão não é refeito sozinho', async ({ page }) => {
        await abrir(page);
        await calcula(page, { ato: 'apelacao', forma: 'djen', data: '2026-03-02' });
        await page.fill('#pzPCert', 'Texto meu');
        await expect(page.locator('#pzPCertAviso')).toBeVisible();
        await page.fill('#pzPData1', '2026-03-03');
        await expect(page.locator('#pzPCert')).toHaveValue('Texto meu');
        await expect(page.locator('#pzPCertMsg')).toContainText('Os dados do prazo mudaram');
        await page.click('#pzPRefazer');
        await expect(page.locator('#pzPCert')).toHaveValue(/^Certifico que a parte foi intimada/);
      });
    });

    test.describe('trânsito em julgado', () => {
      test('vale o prazo que termina por último; trânsito no dia seguinte', async ({ page }) => {
        await abrir(page, 'transito');
        await page.fill('#pzTjD0', '2026-03-02');            // autor, DJEN: vence 24/03
        await page.selectOption('#pzTjF1', 'juntada');        // réu, AR juntado em 10/03: vence 31/03
        await page.fill('#pzTjD1', '2026-03-10');
        await expect(page.locator('#pzTjRes .venc .lbl')).toHaveText('Transitou em julgado em');
        await expect(page.locator('#pzTjRes .venc .data')).toHaveText('01/04/2026');
        await expect(page.locator('#pzTjRes')).toContainText('O último prazo termina em 31/03/2026');
        await expect(page.locator('#pzTjCert')).toHaveValue('Certifico que a sentença transitou em julgado em 01/04/2026, tendo decorrido sem interposição de recurso o prazo recursal das partes, cujo último dia foi 31/03/2026.');
        // 2 anos do trânsito = 01/04/2028, um sábado: passa para segunda
        await expect(page.locator('#pzTjRes')).toContainText('Prazo para ação rescisória: até 03/04/2028');
      });

      test('acordo com renúncia transita na própria data', async ({ page }) => {
        await abrir(page, 'transito');
        await page.selectOption('#pzTjTipo', 'acordo');
        await page.fill('#pzTjAcordoData', '2026-05-15');
        await expect(page.locator('#pzTjPartesBox')).toBeHidden();
        await expect(page.locator('#pzTjRes .venc .data')).toHaveText('15/05/2026');
      });

      test('acrescenta e remove parte', async ({ page }) => {
        await abrir(page, 'transito');
        await expect(page.locator('#pzTjPartes .tj-parte')).toHaveCount(2);
        await page.click('#pzTjAdd');
        await expect(page.locator('#pzTjPartes .tj-parte')).toHaveCount(3);
        await expect(page.locator('#pzTjT2')).toHaveValue('mp');
        await page.locator('#pzTjPartes [data-rm="2"]').click();
        await expect(page.locator('#pzTjPartes .tj-parte')).toHaveCount(2);
      });
    });

    test.describe('idade', () => {
      test('idade da parte na data escolhida', async ({ page }) => {
        await abrir(page, 'idade');
        await page.fill('#pzINasc', '2008-05-12');
        await page.fill('#pzIRef', '2026-05-11');
        await expect(page.locator('#pzIRes')).toContainText(/17 anos\s*11 meses e 29 dias em 11\/05\/2026/);
        await expect(page.locator('#pzIRes')).toContainText('Intervenção do MP');
        await page.fill('#pzIRef', '2026-05-12');
        await expect(page.locator('#pzIRes')).toContainText(/^18 anos/);
      });

      test('várias pessoas de uma vez', async ({ page }) => {
        await abrir(page, 'idade');
        await page.fill('#pzIRef', '2026-10-16');
        await page.fill('#pzILote', 'Maria Souza; 12/05/2011\nJoão Lima 03/09/2008\nSem data');
        const linhas = page.locator('#pzILoteTab tbody tr');
        await expect(linhas).toHaveCount(3);
        await expect(linhas.nth(0)).toContainText(/Maria Souza\s*12\/05\/2011\s*15a 5m 4d/);
        await expect(linhas.nth(0)).toContainText('maior em 12/05/2029');
        await expect(linhas.nth(1)).toContainText(/João Lima\s*03\/09\/2008\s*18a 1m 13d\s*Maior e capaz/);
        await expect(linhas.nth(2)).toContainText('Data não reconhecida');
      });
    });

    test.describe('tabela e feriados', () => {
      test('busca na tabela e "Calcular" leva o ato para a calculadora', async ({ page }) => {
        await abrir(page, 'tabela');
        await page.fill('#pzTBusca', '1.023');
        await expect(page.locator('#pzTTab tbody')).toContainText('Embargos de declaração');
        await expect(page.locator('#pzTTab tbody')).not.toContainText('Apelação');
        await page.locator('#pzTTab [data-calc="ed"]').click();
        await expect(page.locator('#pztab-prazo')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#pzPAto')).toHaveValue('ed');
        await expect(page.locator('#pzPN')).toHaveValue('5');
      });

      test('acrescentar feriado grava no banco', async ({ page, banco }) => {
        await abrir(page, 'feriados');
        await page.fill('#pzFData', '2026-04-08');
        await page.fill('#pzFNome', 'Aniversário de Cuiabá');
        await page.click('#pzFAdd');
        await expect(page.locator('#toast')).toHaveText('Acrescentado');
        await expect.poll(() => banco.tabelas.prazos_config.map(l => l.valor && l.valor.nome)).toContain('Aniversário de Cuiabá');
        const linha = banco.tabelas.prazos_config.find(l => l.valor && l.valor.nome === 'Aniversário de Cuiabá');
        expect(linha.chave).toMatch(/^extra\./);
        expect(linha.valor).toMatchObject({ data: '2026-04-08', anual: false });
        await expect(page.locator('#pzFExtras')).toContainText('Aniversário de Cuiabá');
      });

      test('remover feriado apaga no banco', async ({ page, banco }) => {
        banco.semear('prazos_config', [{ chave: 'extra.abc', valor: { data: '2026-04-08', nome: 'Aniversário de Cuiabá', anual: true } }]);
        await abrir(page, 'feriados');
        await expect(page.locator('#pzFExtras')).toContainText('08/04');
        await page.locator('#pzFExtras [data-del="abc"]').click();
        await expect(page.locator('#pzFExtras')).toContainText('Nenhum feriado local cadastrado.');
        await expect.poll(() => banco.tabelas.prazos_config.length).toBe(0);
      });

      test('desligar o recesso grava no banco e muda a contagem', async ({ page, banco }) => {
        await abrir(page, 'feriados');
        await page.uncheck('#pzFRecesso');
        await expect.poll(() => banco.tabelas.prazos_config.find(l => l.chave === 'recesso')?.valor).toBe(false);
        await page.click('[data-aba="prazo"]');
        await calcula(page, { ato: '', n: 5, unidade: 'u', forma: 'djen', data: '2026-12-15' });
        await expect(venc(page)).toHaveText('23/12/2026');   // 17, 18, 21, 22 e 23/12
      });

      test('suspensão opcional do tribunal (Quarta-feira de Cinzas)', async ({ page, banco }) => {
        await abrir(page, 'feriados');
        await page.locator('#pzFOpc [data-opc="cinzas"]').check();
        await expect.poll(() => banco.tabelas.prazos_config.find(l => l.chave === 'opc.cinzas')?.valor).toBe(true);
        await page.selectOption('#pzFAno', '2026');
        await expect(page.locator('#pzFLista')).toContainText('18/02');
        await expect(page.locator('#pzFLista')).toContainText('Quarta-feira de Cinzas');
      });

      test('lista de feriados do ano inclui os móveis e o recesso', async ({ page }) => {
        await abrir(page, 'feriados');
        await page.selectOption('#pzFAno', '2026');
        await expect(page.locator('#pzFAnoTit')).toHaveText('Dias sem expediente em 2026');
        for (const t of ['16/02Carnaval (segunda-feira)', '03/04Sexta-feira Santa', '04/06Corpus Christi', '08/12Dia da Justiça (08/12)', '20/12Recesso forense até 20/01/2027'])
          await expect(page.locator('#pzFLista')).toContainText(t);
      });
    });
  });
}
