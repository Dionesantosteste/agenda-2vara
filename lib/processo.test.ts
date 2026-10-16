import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitarCNJ, formatarProcesso, mascaraCNJ, soDigitos } from './processo.ts';

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

test('máscara enquanto se digita', () => {
  assert.equal(mascaraCNJ('10023'), '10023');
  assert.equal(mascaraCNJ('100234567'), '1002345-67');
  assert.equal(mascaraCNJ('10023456720268110041999'), '1002345-67.2026.8.11.0041');
  assert.deepEqual(digitarCNJ('10023456', 8, '1002345', 'insertText'), { valor: '1002345-6', cursor: 9 });
  assert.deepEqual(digitarCNJ('abc 123', 7, 'abc 12', 'insertText'), { valor: 'abc 123', cursor: 7 });
  // Backspace logo depois do traço apaga o 5
  assert.deepEqual(digitarCNJ('100234567', 7, '1002345-67', 'deleteContentBackward'), { valor: '1002346-7', cursor: 6 });
});
