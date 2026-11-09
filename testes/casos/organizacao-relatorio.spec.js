// Organização: relatório de produtividade por pessoa (aba Tarefas da equipe, só o gestor).
const fs = require('fs');
const { test, expect, hojeVara } = require('../apoio/teste');
const { ANA, BIA, equipe, entrarComoGestor, abaOrg } = require('../apoio/org');

// O relatório fica na sanfona do Painel da equipe, logo abaixo de Desempenho
async function abrirRelatorio(page){
  await abaOrg(page, 'equipe');
  const sec = page.locator('#orgPnSecs details[data-sec="relatorio"]');
  await expect(sec.locator('xpath=preceding-sibling::details[1]')).toHaveAttribute('data-sec', 'desempenho');
  await sec.locator('summary').click();
  await expect(page.locator('#orgRelGerar')).toBeVisible();
}

// Meio-dia de um dia (horário da vara) N dias antes de hoje
function diasAtras(n){
  const [a, m, d] = hojeVara().split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - n, 16)).toISOString();
}
const dia = iso => iso.slice(0, 10);
const br = k => k.split('-').reverse().join('/');

function semear(banco){
  equipe(banco, { tarefas: [
    // Ana: duas concluídas nos últimos dias (uma no prazo, uma com atraso e devolvida), uma antiga e uma em aberto atrasada
    { dono: ANA, titulo: 'Expedir intimação', processo: '0001226-43.2017.8.11.0008', etapa: 'feito', do_gestor: true,
      created_at: diasAtras(5), feita_em: diasAtras(2), prazo: dia(diasAtras(1)), conclusao: { horas: 1, minutos: 30, conformidade: 'sim' } },
    { dono: ANA, titulo: 'Certificar decurso', etapa: 'feito', arquivada_em: diasAtras(0),
      created_at: diasAtras(6), feita_em: diasAtras(1), prazo: dia(diasAtras(3)), conf_hist: [{ a: 'devolvida', em: diasAtras(2), t: 'faltou' }] },
    { dono: ANA, titulo: 'Tarefa antiga', etapa: 'feito', created_at: diasAtras(90), feita_em: diasAtras(80) },
    { dono: ANA, titulo: 'Juntar ofício', prazo: dia(diasAtras(1)) },
    // Bia: uma concluída sem prazo
    { dono: BIA, titulo: 'Atualizar endereço', etapa: 'feito', created_at: diasAtras(3), feita_em: diasAtras(1) }
  ] });
}

test('o gestor tira o relatório do período, por pessoa, e imprime', async ({ page, banco }) => {
  semear(banco);
  await entrarComoGestor(page);
  await abrirRelatorio(page);
  await page.locator('#orgRelAtalhos [data-relp="30"]').click();
  await expect(page.locator('#orgRelAtalhos [data-relp="30"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#orgRelGerar').click();

  const linhaAna = page.locator('#orgRelSaida tbody tr[data-relp="' + ANA + '"]');
  const linhaBia = page.locator('#orgRelSaida tbody tr[data-relp="' + BIA + '"]');
  // Pessoa, Concluídas, No prazo, Com atraso, Tempo médio, Devolvidas, Tempo informado, Recebidas, Em aberto
  await expect(linhaAna.locator('td').nth(1)).toHaveText('2');
  await expect(linhaAna.locator('td').nth(2)).toHaveText('50%');
  await expect(linhaAna.locator('td').nth(3)).toHaveText('1');
  await expect(linhaAna.locator('td').nth(5)).toHaveText('1');
  await expect(linhaAna.locator('td').nth(6)).toHaveText('1h 30min');
  await expect(linhaAna.locator('td').nth(8)).toContainText('1');
  await expect(linhaBia.locator('td').nth(1)).toHaveText('1');
  await expect(linhaBia.locator('td').nth(2)).toHaveText('—');
  await expect(page.locator('#orgRelSaida tfoot td').nth(1)).toHaveText('3');
  await expect(page.locator('#orgRelSaida')).not.toContainText('Tarefa antiga');

  // lista das tarefas, inclusive a arquivada
  await page.locator('#orgRelLista').check();
  await expect(page.locator('#orgRelSaida .rel-lista')).toHaveCount(2);
  await expect(page.locator('#orgRelSaida')).toContainText('Certificar decurso');
  await expect(page.locator('#orgRelSaida .rel-lista tr', { hasText: 'Certificar decurso' })).toContainText('com atraso');

  await page.evaluate(() => { window.print = () => { window.__impresso = document.getElementById('printArea').innerText; }; });
  await page.locator('#orgRelImprimir').click();
  const impresso = await page.evaluate(() => window.__impresso);
  expect(impresso).toContain('Relatório de produtividade');
  expect(impresso).toContain('3 tarefas concluídas');
  expect(impresso).toContain('Expedir intimação');
  expect(impresso).toContain('Ana Souza');
});

test('filtra por pessoa e baixa as planilhas', async ({ page, banco }) => {
  semear(banco);
  await entrarComoGestor(page);
  await abrirRelatorio(page);
  await page.locator('#orgRelDe').fill(dia(diasAtras(7)));
  await page.locator('#orgRelAte').fill(hojeVara());
  await page.locator('#orgRelPessoa').selectOption(ANA);
  await page.locator('#orgRelGerar').click();
  await expect(page.locator('#orgRelSaida tbody tr')).toHaveCount(1);
  await expect(page.locator('#orgRelSaida .rel-tit')).toContainText('De ' + br(dia(diasAtras(7))) + ' a ' + br(hojeVara()) + ' · Ana Souza');
  expect(banco.chamadas.filter(c => c.alvo === 'org_relatorio').pop().corpo).toMatchObject({ p_de: dia(diasAtras(7)), p_ate: hojeVara() });

  const [resumo] = await Promise.all([page.waitForEvent('download'), page.locator('#orgRelCsvResumo').click()]);
  const txtResumo = fs.readFileSync(await resumo.path(), 'utf8');
  expect(txtResumo.split('\r\n')[1]).toMatch(/^Ana Souza;2;2;1;50;1;/);

  const [tarefas] = await Promise.all([page.waitForEvent('download'), page.locator('#orgRelCsvTarefas').click()]);
  const linhas = fs.readFileSync(await tarefas.path(), 'utf8').split('\r\n');
  expect(linhas).toHaveLength(3);
  expect(linhas[1]).toContain('Expedir intimação;0001226-43.2017.8.11.0008');
  expect(linhas[2]).toMatch(/Certificar decurso;.*;Não;.*;Sim;Sim$/);
});

test('período invertido não chama o banco', async ({ page, banco }) => {
  semear(banco);
  await entrarComoGestor(page);
  await abrirRelatorio(page);
  await page.locator('#orgRelDe').fill(hojeVara());
  await page.locator('#orgRelAte').fill(dia(diasAtras(3)));
  await page.locator('#orgRelGerar').click();
  await expect(page.locator('#toast')).toContainText('A data inicial não pode ser depois da final.');
  expect(banco.chamadas.some(c => c.alvo === 'org_relatorio')).toBe(false);
});
