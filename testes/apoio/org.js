// Atalhos para os testes da Organização
const { expect } = require('@playwright/test');
const { semearOrg, PIN_GESTOR } = require('./supabase-falso');

const ANA = '00000000-0000-4000-8000-00000000000a';
const BIA = '00000000-0000-4000-8000-00000000000b';

function equipe(banco, extra = {}){
  semearOrg(banco.org, Object.assign({ pessoas: [{ id: ANA, nome: 'Ana Souza' }, { id: BIA, nome: 'Bia Lima' }] }, extra));
}
// Entra pela tela de entrada, clicando no nome (como a equipe faz)
async function entrarComoPessoa(page, nome){
  await page.goto('/#organizacao');
  await page.locator('#orgEntrarLista button', { hasText: nome }).click();
  await expect(page.locator('#orgContent')).toBeVisible();
}
// Digitar os 6 números já envia a senha (não precisa clicar em Entrar)
async function entrarComoGestor(page, pin = PIN_GESTOR){
  await page.goto('/#organizacao');
  await page.locator('#orgPin').pressSequentially(pin);
}
async function abaOrg(page, tab){
  await page.locator('.org-tab[data-tab="' + tab + '"]').click();
}
const cartao = (page, titulo) => page.locator('#orgKanban .kcard', { hasText: titulo });
const coluna = (page, etapa) => page.locator('#orgKanban .col[data-etapa="' + etapa + '"]');

module.exports = { ANA, BIA, equipe, entrarComoPessoa, entrarComoGestor, abaOrg, cartao, coluna, PIN_GESTOR };
