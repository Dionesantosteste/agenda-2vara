import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORES, corPorId } from './aparencia.ts';

test('as cores são as mesmas do sistema atual', () => {
  const legado = readFileSync(new URL('../public/legado.html', import.meta.url), 'utf8');
  for (const c of CORES){
    const linha = legado.split('\n').find(l => l.includes('id: "' + c.id + '"'));
    assert.ok(linha, 'cor ' + c.id + ' existe no sistema atual');
    for (const v of [...c.fundo, ...c.col]) assert.ok(linha!.includes(v), c.id + ' tem ' + v);
  }
});

test('corPorId acha a cor ou devolve null', () => {
  assert.equal(corPorId('ceu')?.nome, 'Céu');
  assert.equal(corPorId('inexistente'), null);
  assert.equal(corPorId(null), null);
});
