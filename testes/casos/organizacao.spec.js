// Organização: entrada, quadro, tarefas, mural, conferência, envio ao gestor e estrelas.
const { test, expect, hojeVara } = require('../apoio/teste');
const { ANA, BIA, equipe, entrarComoPessoa, entrarComoGestor, abaOrg, cartao, coluna } = require('../apoio/org');

test.describe('entrada', () => {
  test('a pessoa entra pelo nome e vê só o quadro dela', async ({ page, banco }) => {
    equipe(banco, { tarefas: [
      { dono: ANA, titulo: 'Expedir intimação da Ana' },
      { dono: BIA, titulo: 'Tarefa da Bia' },
      { dono: null, titulo: 'Tarefa do gestor' }
    ] });
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(page.locator('#orgH1')).toContainText('Ana');
    await expect(cartao(page, 'Expedir intimação da Ana')).toBeVisible();
    await expect(page.locator('#orgKanban')).not.toContainText('Tarefa da Bia');
    await expect(page.locator('#orgKanban')).not.toContainText('Tarefa do gestor');
  });

  test('senha errada do gestor não entra; a certa entra', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: null, titulo: 'Tarefa do gestor' }] });
    await entrarComoGestor(page, '000000');
    await expect(page.locator('#orgContent')).toBeHidden();
    await expect(page.locator('#orgMsg')).toHaveText('Senha incorreta.');
    await page.locator('#orgPin').pressSequentially('123456');
    await expect(page.locator('#orgContent')).toBeVisible();
    await abaOrg(page, 'quadro');
    await expect(cartao(page, 'Tarefa do gestor')).toBeVisible();
  });
});

test.describe('quadro da pessoa', () => {
  test('cria tarefa na coluna A fazer e grava no banco', async ({ page, banco }) => {
    equipe(banco);
    await entrarComoPessoa(page, 'Ana Souza');
    await coluna(page, 'afazer').locator('[data-act="kadd"]').click();
    await coluna(page, 'afazer').locator('.kadd-in').fill('Juntar ofício do INSS');
    await coluna(page, 'afazer').locator('.kadd-in').press('Enter');
    await expect(cartao(page, 'Juntar ofício do INSS')).toBeVisible();
    expect(banco.org.tarefas.find(t => t.titulo === 'Juntar ofício do INSS')).toMatchObject({ dono: ANA, etapa: 'afazer', do_gestor: false });
  });

  test('o quadro começa com A fazer e Feito', async ({ page, banco }) => {
    equipe(banco);
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(page.locator('#orgKanban .col h3 .col-nome')).toHaveText(['A fazer', 'Feito']);
  });

  test('move a tarefa para Feito e comemora', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Certificar decurso de prazo' }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await cartao(page, 'Certificar decurso de prazo').locator('[data-act="mover"][data-dir="1"]').click();
    await expect(coluna(page, 'feito')).toContainText('Certificar decurso de prazo');
    await expect(page.locator('#toast')).toContainText('1 tarefa feita hoje');
    const t = banco.org.tarefas.find(x => x.titulo === 'Certificar decurso de prazo');
    expect(t.etapa).toBe('feito');
    expect(t.feita_em && t.feita_em.length).toBeTruthy();
  });

  test('tarefa mandada pelo gestor não pode ser excluída pela pessoa', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir mandado', do_gestor: true }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(cartao(page, 'Expedir mandado')).toContainText('Do gestor');
    await cartao(page, 'Expedir mandado').locator('.ktitle').click();
    await expect(page.locator('#orgCardDialog')).toBeVisible();
    await expect(page.locator('#ocExcluir')).toBeHidden();
  });

  test('cria um aviso no mural', async ({ page, banco }) => {
    equipe(banco);
    await entrarComoPessoa(page, 'Ana Souza');
    await abaOrg(page, 'lista');
    await page.fill('#orgNoteText', 'Malote sai às 15h');
    await page.locator('#orgNoteForm button[type=submit]').click();
    await expect(page.locator('#orgBoard')).toContainText('Malote sai às 15h');
    expect(banco.org.notas.find(n => n.texto === 'Malote sai às 15h')).toMatchObject({ dono: ANA });
  });
});

test.describe('conferência e envio ao gestor', () => {
  test('a pessoa envia para conferência e a tarefa fica travada', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Minuta de sentença', etapa: 'fazendo' }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await cartao(page, 'Minuta de sentença').locator('[data-act="conf-enviar"]').click();
    await page.fill('#ocfTexto', 'Falta só a assinatura');
    await page.click('#ocfOk');
    await expect(cartao(page, 'Minuta de sentença')).toContainText('Aguardando o gestor conferir');
    const t = banco.org.tarefas.find(x => x.titulo === 'Minuta de sentença');
    expect(t.conferencia).toBe('enviada');
    expect(t.conf_hist[0]).toMatchObject({ a: 'enviada', t: 'Falta só a assinatura' });
  });

  test('mandar para o gestor exige recado e tira a tarefa do quadro', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Ofício ao INSS' }, { dono: ANA, titulo: 'Tarefa que veio do gestor', do_gestor: true }] });
    await entrarComoPessoa(page, 'Ana Souza');
    // tarefa que veio do gestor não tem o botão
    await cartao(page, 'Tarefa que veio do gestor').locator('.ktitle').click();
    await expect(page.locator('#ocGestor')).toBeHidden();
    await page.click('#ocCancelar');

    await cartao(page, 'Ofício ao INSS').locator('.ktitle').click();
    await page.locator('[data-gestor-enviar]').click();
    await page.click('#ocfOk');
    await expect(page.locator('#toast')).toHaveText('Escreva um recado para o gestor saber o que precisa.');
    await page.fill('#ocfTexto', 'Preciso da sua assinatura');
    await page.click('#ocfOk');
    await expect(page.locator('#toast')).toHaveText('Tarefa mandada para o gestor. Ela saiu do seu quadro.');
    await expect(cartao(page, 'Ofício ao INSS')).toHaveCount(0);
    expect(banco.org.tarefas.find(t => t.titulo === 'Ofício ao INSS')).toMatchObject({ dono: null, enviada_por: ANA, recado_gestor: 'Preciso da sua assinatura', etapa: 'afazer' });
  });

  test('o gestor vê de quem veio a tarefa e o recado', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: null, titulo: 'Ofício ao INSS', enviada_por: ANA, recado_gestor: 'Preciso da sua assinatura', enviada_em: new Date().toISOString() }] });
    await entrarComoGestor(page);
    await abaOrg(page, 'quadro');
    await expect(cartao(page, 'Ofício ao INSS')).toContainText('De Ana');
    await expect(cartao(page, 'Ofício ao INSS')).toContainText('Preciso da sua assinatura');
  });
});

test.describe('estrelas e bichinhos', () => {
  const feitasHoje = n => Array.from({ length: n }, (_, i) => ({ dono: ANA, titulo: 'Feita ' + (i + 1), etapa: 'feito', feita_em: new Date(Date.now() - (i + 1) * 60000).toISOString() }));

  test('a 10ª tarefa do dia dá a estrela; com 3 a pessoa escolhe o bichinho', async ({ page, banco }) => {
    equipe(banco, {
      tarefas: feitasHoje(9).concat([{ dono: ANA, titulo: 'A décima', etapa: 'fazendo' }]),
      estrelas: [{ dono: ANA, dia: '2026-01-05' }, { dono: ANA, dia: '2026-01-06' }]
    });
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(page.locator('#orgEstrelas')).toContainText(/9\/10\s*tarefas/);
    await expect(page.locator('#orgKanban .bicho')).toHaveCount(0);
    await cartao(page, 'A décima').locator('[data-act="mover"][data-dir="1"]').click();
    await expect(page.locator('.org-festa-card')).toContainText('Você ganhou uma estrela!');
    await expect(page.locator('.org-festa-card')).toContainText('Conquistou');
    expect(banco.org.estrelas.filter(e => e.dono === ANA).map(e => e.dia)).toContain(hojeVara());

    await page.locator('[data-festa-escolher]').click();
    await expect(page.locator('#orgBichoTit')).toHaveText('Escolha seu primeiro bichinho');
    await expect(page.locator('.opcao')).toHaveCount(6);
    await expect(page.locator('[data-escolhe="peixe"]')).toContainText('Peixinho');
    await expect(page.locator('[data-escolhe="dragao"]')).toContainText('Dragãozinho');
    await page.locator('[data-escolhe="raposa"]').click();
    await expect(page.locator('#orgKanban .bicho')).toHaveAttribute('data-tipo', 'raposa');
    expect(banco.org.bichos).toEqual([expect.objectContaining({ dono: ANA, tipo: 'raposa' })]);
    await expect(page.locator('#orgEstrelas')).toContainText(/Acumuladas\s*3/);
  });

  test('esconder e mostrar o bichinho fica gravado', async ({ page, banco }) => {
    equipe(banco, { estrelas: [1, 2, 3].map(d => ({ dono: ANA, dia: '2026-01-0' + d })), bichos: [{ dono: ANA, tipo: 'gato' }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(page.locator('#orgKanban .bicho')).toHaveAttribute('data-tipo', 'gato');
    await page.locator('#orgKBichos [data-bicho=""]').click();
    await expect(page.locator('#orgKanban .bicho')).toHaveCount(0);
    await expect.poll(() => banco.org.pessoas.find(p => p.id === ANA).bicho_quadro).toBe('');
    await page.reload();
    await expect(page.locator('#orgKBichos')).toBeVisible();
    await expect(page.locator('#orgKanban .bicho')).toHaveCount(0);
  });
});

test.describe('gestor e equipe', () => {
  test('a pessoa conclui tarefa do gestor respondendo o fechamento', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Expedir mandado', do_gestor: true }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await cartao(page, 'Expedir mandado').locator('[data-act="mover"][data-dir="1"]').click();
    await expect(page.locator('#orgFechDialog')).toBeVisible();
    await page.fill('#ofHoras', '1');
    await page.fill('#ofMinutos', '30');
    await page.click('#ofConcluir');
    // (o aviso "Tarefa concluída…" é logo substituído pela comemoração; por isso confere o resultado)
    await expect(page.locator('#orgFechDialog')).toBeHidden();
    await expect(coluna(page, 'feito')).toContainText('Expedir mandado');
    expect(banco.org.tarefas[0]).toMatchObject({ etapa: 'feito', conclusao: { horas: 1, minutos: 30, conformidade: 'sim' } });
  });

  test('o gestor aprova a conferência na aba Tarefas da equipe', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: ANA, titulo: 'Minuta de sentença', etapa: 'afazer', conferencia: 'enviada',
      conf_hist: [{ a: 'enviada', em: new Date().toISOString(), t: 'Falta só a assinatura' }] }] });
    await entrarComoGestor(page);
    await abaOrg(page, 'equipe');
    const linha = page.locator('#orgEqLista tr', { hasText: 'Minuta de sentença' });
    await expect(linha).toContainText('Falta só a assinatura');
    await linha.locator('[data-eqconf="aprovar"]').click();
    await expect(page.locator('#toast')).toContainText('Tarefa aprovada');
    expect(banco.org.tarefas[0].conferencia).toBe('aprovada');
  });

  test('o gestor manda uma tarefa do quadro dele para a tela da pessoa', async ({ page, banco }) => {
    equipe(banco, { tarefas: [{ dono: null, titulo: 'Intimar perito' }] });
    await entrarComoGestor(page);
    await abaOrg(page, 'quadro');
    await cartao(page, 'Intimar perito').locator('.ktitle').click();
    await page.selectOption('#ocEnviar', { label: 'Ana Souza' });
    await page.locator('#orgCardForm button[type=submit]').click();
    await expect(cartao(page, 'Intimar perito')).toHaveCount(0);
    expect(banco.org.tarefas[0]).toMatchObject({ dono: ANA, do_gestor: true, etapa: 'afazer' });
  });
});

test.describe('lembretes', () => {
  test('cria lembrete com a correção automática (maiúscula e acentos da vara)', async ({ page, banco }) => {
    equipe(banco);
    await entrarComoPessoa(page, 'Ana Souza');
    await abaOrg(page, 'lembretes');
    await page.fill('#orgLemTexto', 'ligar para o perito sobre a intimacao');
    await page.locator('#orgLemForm button[type=submit]').click();
    await expect(page.locator('#orgLemList')).toContainText('Ligar para o perito sobre a intimação');
    expect(banco.org.lembretes[0]).toMatchObject({ dono: ANA, texto: 'Ligar para o perito sobre a intimação' });
  });
});
