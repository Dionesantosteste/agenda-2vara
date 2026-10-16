import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaDaVara, formatarDataHora, dataPorExtenso, chaveDoDia } from './datas.ts';

test('o dia da vara segue o horário de Cuiabá (UTC-4), não o UTC', () => {
  // 21h em Cuiabá do dia 15 já é dia 16 no UTC
  assert.equal(diaDaVara(new Date('2026-10-16T01:00:00Z')), '2026-10-15');
  assert.equal(diaDaVara(new Date('2026-10-16T05:00:00Z')), '2026-10-16');
});

test('data e hora no formato do sistema', () => {
  assert.equal(formatarDataHora(new Date(2026, 9, 6, 9, 5)), '06/10/2026 às 09:05');
  assert.equal(chaveDoDia(new Date(2026, 0, 2)), '2026-01-02');
});

test('data por extenso começa com maiúscula', () => {
  assert.equal(dataPorExtenso(new Date(2026, 9, 16, 12)), 'Sexta-feira, 16 de outubro');
});
