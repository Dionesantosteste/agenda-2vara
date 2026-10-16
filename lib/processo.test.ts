import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarProcesso, soDigitos } from './processo.ts';

test('formata 20 dígitos no padrão CNJ', () => {
  assert.equal(formatarProcesso('10023456720268110041'), '1002345-67.2026.8.11.0041');
  assert.equal(formatarProcesso('1002345 67 2026 8 11 0041'), '1002345-67.2026.8.11.0041');
  assert.equal(formatarProcesso('1002345-67.2026.8.11.0041'), '1002345-67.2026.8.11.0041');
});

test('sem 20 dígitos, devolve o texto como veio', () => {
  assert.equal(formatarProcesso('  12345  '), '12345');
  assert.equal(formatarProcesso(''), '');
  assert.equal(formatarProcesso(null), '');
});

test('soDigitos tira tudo que não é número', () => {
  assert.equal(soDigitos('(65) 99811-2233'), '65998112233');
});
