import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasMarcados, hashDoPeriodo, lerPeriodoDoHash, rotuloDoDia, urgenciaDoDia } from './proximos.ts';

const agora = new Date(2026, 9, 28, 15, 0);   // quarta, 28/10/2026

test('agrupa por dia, ordena e limita a 7 dias', () => {
  const d = (dia: number, h = 9) => new Date(2026, 9 + (dia > 31 ? 1 : 0), dia > 31 ? dia - 31 : dia, h, 0);
  const r = diasMarcados([d(30), d(28, 8), d(28, 20), null, new Date(2026, 9, 27, 9), d(35), d(36)], agora);
  assert.deepEqual(r.map(x => [x.chave, x.qtd, x.n, x.urgencia]), [['2026-10-28', 2, 0, 'red'], ['2026-10-30', 1, 2, 'orange'], ['2026-11-04', 1, 7, 'yellow']]);
});
test('rótulos e urgência', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(urgenciaDoDia), ['red', 'red', 'orange', 'orange', 'yellow', 'yellow']);
  assert.deepEqual([0, 1, 5].map(rotuloDoDia), ['hoje', 'amanhã', 'em 5 dias']);
});
test('endereço do período', () => {
  assert.equal(hashDoPeriodo('2026-11-02', '2026-11-02'), '2026-11-02');
  assert.deepEqual(lerPeriodoDoHash('#2026-10-28_2026-11-04'), { de: '2026-10-28', ate: '2026-11-04' });
  assert.deepEqual(lerPeriodoDoHash('#2026-11-02'), { de: '2026-11-02', ate: '2026-11-02' });
  assert.equal(lerPeriodoDoHash('#agenda'), null);
});
