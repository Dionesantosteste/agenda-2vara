// Base de todos os testes: cada teste ganha um Supabase simulado novo (o "banco") e uma página
// em que nada sai para a internet. Ao fim, o teste falha se a página teve erro de JavaScript ou
// se o site chamou alguma tabela ou função que o simulador não conhece.
const base = require('@playwright/test');
const { SupabaseFalso, semearOrg, hojeVara, PIN_GESTOR } = require('./supabase-falso');

const SUPABASE_UMD = require.resolve('@supabase/supabase-js/dist/umd/supabase.js');

const test = base.test.extend({
  banco: async ({}, use) => { await use(new SupabaseFalso()); },
  page: async ({ page, banco }, use) => {
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    await page.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('.supabase.co')) return banco.tratar(route);
      // biblioteca do Supabase servida do disco (sem depender da internet)
      if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('@supabase/supabase-js')) return route.fulfill({ path: SUPABASE_UMD, contentType: 'application/javascript' });
      return route.abort();   // fontes, imagens externas etc.: o site tem de funcionar sem elas
    });
    // atualização em tempo real (contatos, prazos): aceita a conexão e não responde nada
    await page.routeWebSocket(/supabase\.co/, () => {});
    await use(page);
    base.expect(erros, 'erros de JavaScript na página').toEqual([]);
    base.expect(banco.naoSimuladas, 'chamadas ao banco que o simulador não conhece').toEqual([]);
  }
});

module.exports = { test, expect: base.expect, semearOrg, hojeVara, PIN_GESTOR };
