// Natal: de 15/11 a 06/01 os bichinhos ganham gorro, a árvore aparece ao lado da caminha (com um
// enfeite por estrela ganha desde 15/11), a estrela vira presente e cai neve no topo. Cada pessoa
// pode desligar em Aparência. O relógio do navegador é fixado no dia de cada teste.
const { test, expect, hojeVara } = require('../apoio/teste');
const { inicioNatal, fixarRelogio } = require('../apoio/supabase-falso');
const { ANA, equipe, entrarComoPessoa, cartao } = require('../apoio/org');

const DEZEMBRO = new Date('2026-12-10T10:00:00-04:00');
const OUTUBRO = new Date('2026-10-20T10:00:00-04:00');
// três estrelas antigas (o bastante para ter o primeiro bichinho) e duas recentes
const ESTRELAS = ['2025-10-01', '2025-10-02', '2025-10-03', '2026-11-16', '2026-11-17'].map(dia => ({ dono: ANA, dia }));
// enfeites esperados: as estrelas desde o último 15/11 (em 10/12/2026, as duas de novembro)
const enfeites = () => Math.min(10, ESTRELAS.filter(e => e.dia >= inicioNatal(hojeVara())).length);

test.describe('em dezembro', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(DEZEMBRO); fixarRelogio(DEZEMBRO); });
  test.afterEach(() => fixarRelogio(null));

  test('o bichinho ganha gorro, a árvore fica ao lado da caminha e cai neve', async ({ page, banco }) => {
    equipe(banco, { estrelas: ESTRELAS, bichos: [{ dono: ANA, tipo: 'gato' }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(page.locator('html')).toHaveAttribute('data-natal', '');
    await expect(page.locator('#orgKanban .bicho .gorro')).toBeVisible();
    await expect(page.locator('#orgKanban .cantinho [data-item="arvore"] .arvore')).toBeVisible();
    await expect(page.locator('#orgKanban .cantinho [data-item="presentes"]')).toBeVisible();
    await expect(page.locator('#orgKanban .arvore .luz').first()).toBeVisible();
    expect(enfeites()).toBe(2);
    await expect(page.locator('#orgKanban .arvore .bola:not(.vazia)')).toHaveCount(enfeites());
    await expect(page.locator('#orgEstrelas')).toContainText('Árvore de Natal');
    await expect(page.locator('.neve')).toBeVisible();
  });

  test('a pessoa desliga os enfeites em Aparência, e a escolha fica guardada', async ({ page, banco }) => {
    equipe(banco, { estrelas: ESTRELAS, bichos: [{ dono: ANA, tipo: 'gato' }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await page.click('#aparBtn');
    await expect(page.locator('#aparNatalBox')).toBeVisible();
    await page.locator('#aparNeve [data-neve="nao"]').click();
    await expect(page.locator('.neve')).toBeHidden();
    await expect(page.locator('#orgKanban .bicho .gorro')).toBeVisible();
    await page.locator('#aparNatal [data-natal="nao"]').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-natal', '');
    await expect(page.locator('#orgKanban .bicho .gorro')).toBeHidden();
    await expect(page.locator('#orgKanban .arvore')).toHaveCount(0);
    await expect(page.locator('#aparNeve [data-neve="sim"]')).toBeDisabled();
    expect(await page.evaluate(() => localStorage.getItem('aparNatal'))).toBe('nao');
    await page.reload();
    await expect(page.locator('#orgKanban .bicho')).toHaveAttribute('data-tipo', 'gato');
    await expect(page.locator('#orgKanban .bicho .gorro')).toBeHidden();
    await expect(page.locator('#orgKanban .arvore')).toHaveCount(0);
  });

  test('o peixinho ganha gorro e a arvorezinha fica dentro do aquário', async ({ page, banco }) => {
    equipe(banco, { estrelas: ESTRELAS, bichos: [{ dono: ANA, tipo: 'peixe' }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(page.locator('#orgKanban .bicho .gorro')).toBeVisible();
    await expect(page.locator('#orgKanban .bicho .arv-aquario')).toBeVisible();
    await expect(page.locator('#orgKanban .cantinho [data-item="arvore"]')).toHaveCount(0);
  });

  test('a estrela do dia vira presente de Natal e enfeita a árvore', async ({ page, banco }) => {
    const feitas = Array.from({ length: 9 }, (_, i) => ({ dono: ANA, titulo: 'Feita ' + (i + 1), etapa: 'feito', feita_em: new Date(DEZEMBRO.getTime() - (i + 1) * 60000).toISOString() }));
    equipe(banco, { estrelas: ESTRELAS.slice(0, 3), bichos: [{ dono: ANA, tipo: 'raposa' }], tarefas: feitas.concat([{ dono: ANA, titulo: 'A décima', etapa: 'fazendo' }]) });
    await entrarComoPessoa(page, 'Ana Souza');
    await cartao(page, 'A décima').locator('[data-act="mover"][data-dir="1"]').click();
    await expect(page.locator('.org-festa-card')).toContainText('Presente de Natal! Você ganhou uma estrela!');
    await expect(page.locator('.org-festa-card')).toContainText('A sua árvore ganhou um enfeite novo');
    await page.locator('.org-festa-card [data-festa-ok]').click();
    await expect(page.locator('#orgKanban .arvore .bola:not(.vazia)')).toHaveCount(1);
  });
});

test.describe('fora da época', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(OUTUBRO); fixarRelogio(OUTUBRO); });
  test.afterEach(() => fixarRelogio(null));

  test('sem gorro, sem árvore, sem neve e sem a escolha do Natal em Aparência', async ({ page, banco }) => {
    equipe(banco, { estrelas: ESTRELAS, bichos: [{ dono: ANA, tipo: 'gato' }] });
    await entrarComoPessoa(page, 'Ana Souza');
    await expect(page.locator('#orgKanban .bicho')).toHaveAttribute('data-tipo', 'gato');
    await expect(page.locator('html')).not.toHaveAttribute('data-natal', '');
    await expect(page.locator('#orgKanban .bicho .gorro')).toBeHidden();
    await expect(page.locator('#orgKanban .arvore')).toHaveCount(0);
    await expect(page.locator('.neve')).toBeHidden();
    await expect(page.locator('#orgEstrelas')).not.toContainText('Árvore de Natal');
    await page.click('#aparBtn');
    await expect(page.locator('#aparNatalBox')).toBeHidden();
  });
});

test('no sistema novo, a escolha do Natal aparece na época e vale também no sistema atual', async ({ page }) => {
  await page.clock.setFixedTime(DEZEMBRO);
  await page.goto('/novo');
  await expect(page.locator('html')).toHaveAttribute('data-natal', '');
  await expect(page.locator('.neve')).toBeVisible();
  await page.click('#aparBtn');
  await page.locator('#aparNatal [data-natal="nao"]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-natal', '');
  await expect(page.locator('.neve')).toBeHidden();
  await page.goto('/#prazos');
  await expect(page.locator('html')).not.toHaveAttribute('data-natal', '');
});
