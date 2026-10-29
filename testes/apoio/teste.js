// Base de todos os testes: cada teste ganha um Supabase simulado novo (o "banco") e uma página
// em que nada sai para a internet. Ao fim, o teste falha se a página teve erro de JavaScript ou
// se o site chamou alguma tabela ou função que o simulador não conhece.
const base = require('@playwright/test');
const { SupabaseFalso, semearOrg, hojeVara, PIN_GESTOR } = require('./supabase-falso');

const SUPABASE_UMD = require.resolve('@supabase/supabase-js/dist/umd/supabase.js');

// Sessão de login de mentira, já guardada no navegador, para os testes entrarem direto no sistema
// (o site só abre para quem entrou com e-mail e senha). É o mesmo formato que o supabase-js guarda.
const CHAVE_SESSAO = 'sb-mgfsfzzvngqarwcmfzxy-auth-token';
function sessaoFalsa(admin = true){
  const usuario = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'teste@vara.com',
    app_metadata: admin ? { admin: true } : {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  return { access_token: 'teste.sessao.falsa', refresh_token: 'teste', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: usuario };
}

const test = base.test.extend({
  semSessao: [false, { option: true }],
  banco: async ({}, use) => { await use(new SupabaseFalso()); },
  page: async ({ page, banco, semSessao }, use) => {
    const erros = [];
    if (!semSessao) await page.addInitScript(([chave, valor]) => { try { localStorage.setItem(chave, valor); } catch (e) {} }, [CHAVE_SESSAO, JSON.stringify(sessaoFalsa())]);
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

module.exports = { sessaoFalsa, test, expect: base.expect, semearOrg, hojeVara, PIN_GESTOR };
