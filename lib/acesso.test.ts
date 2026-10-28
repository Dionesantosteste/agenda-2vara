import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caminhoPublico, emailValido, problemaNaSenha, traduzirErroAuth, voltaSegura } from './acesso.ts';

test('telas públicas são só o login e a criação de senha', () => {
  assert.equal(caminhoPublico('/entrar'), true);
  assert.equal(caminhoPublico('/definir-senha'), true);
  assert.equal(caminhoPublico('/'), false);
  assert.equal(caminhoPublico('/novo/agenda'), false);
  assert.equal(caminhoPublico('/entrarx'), false);
});

test('voltaSegura aceita só endereços do próprio site', () => {
  assert.equal(voltaSegura('/novo/agenda'), '/novo/agenda');
  assert.equal(voltaSegura('/#prazos'), '/#prazos');
  assert.equal(voltaSegura('https://outro.com'), '/');
  assert.equal(voltaSegura('//outro.com'), '/');
  assert.equal(voltaSegura('/\\outro.com'), '/');
  assert.equal(voltaSegura('/entrar?volta=/'), '/');
  assert.equal(voltaSegura(null), '/');
});

test('e-mail e senha', () => {
  assert.equal(emailValido('ana@tj.mt.gov.br'), true);
  assert.equal(emailValido('ana@'), false);
  assert.equal(emailValido('ana tj@x.com'), false);
  assert.match(problemaNaSenha('curta', 'curta'), /pelo menos 8/);
  assert.match(problemaNaSenha('senhaboa123', 'outra12345'), /não são iguais/);
  assert.equal(problemaNaSenha('senhaboa123', 'senhaboa123'), '');
});

test('traduz os erros do login', () => {
  assert.equal(traduzirErroAuth('Invalid login credentials'), 'E-mail ou senha incorretos.');
  assert.match(traduzirErroAuth('coisa estranha'), /Não deu certo/);
});
