import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonimizar, cpfValido, desanonimizar, desanonimizarTudo, resumoTrocados } from './anonimizar.ts';

test('troca CPF, CNPJ, NB, e-mail, telefone e CEP por marcadores', () => {
  const r = anonimizar('Autora CPF 123.456.789-09, NB 123.456.789-0, empresa 12.345.678/0001-90, '
    + 'e-mail maria@exemplo.com.br, fone (65) 99999-1234, CEP 78000-000.', {});
  assert.equal(r.texto, 'Autora CPF [CPF-1], NB [NB-1], empresa [CNPJ-1], e-mail [EMAIL-1], fone [TELEFONE-1], CEP [CEP-1].');
  assert.equal(r.mapa['[CPF-1]'], '123.456.789-09');
  assert.equal(resumoTrocados(r.trocados), '1 e-mail, 1 CNPJ, 1 CPF, 1 nº de benefício, 1 CEP e 1 telefone');
});

test('não mexe no número do processo nem em datas e valores', () => {
  const t = 'Processo 0001226-43.2017.8.11.0008, decisão de 10/11/2026, valor R$ 1.234,56, prazo de 15 dias.';
  assert.equal(anonimizar(t, {}).texto, t);
});

test('número solto: CPF válido vira CPF; outro vira NUMERO', () => {
  assert.equal(cpfValido('12345678909'), true);
  assert.equal(cpfValido('11111111111'), false);
  assert.equal(anonimizar('cpf 12345678909 e 65999991235', {}).texto, 'cpf [CPF-1] e [NUMERO-1]');
});

test('o mesmo valor ganha o mesmo marcador, inclusive na pergunta seguinte', () => {
  const a = anonimizar('CPF 123.456.789-09 e de novo 123.456.789-09', {});
  assert.equal(a.texto, 'CPF [CPF-1] e de novo [CPF-1]');
  const b = anonimizar('outro 529.982.247-25 e o primeiro 123.456.789-09', a.mapa);
  assert.equal(b.texto, 'outro [CPF-2] e o primeiro [CPF-1]');
});

test('devolve os dados reais na resposta e nas propostas', () => {
  const { mapa } = anonimizar('CPF 123.456.789-09', {});
  assert.equal(desanonimizar('Certifico que [CPF-1] ... [CPF-9]', mapa), 'Certifico que 123.456.789-09 ... [CPF-9]');
  assert.deepEqual(desanonimizarTudo({ tipo: 'rotina', passos: ['Intimar [CPF-1]'] }, mapa), { tipo: 'rotina', passos: ['Intimar 123.456.789-09'] });
});
