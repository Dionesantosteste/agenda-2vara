import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORES, corPorId, epocaDeNatal } from './aparencia.ts';

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

test('a época do Natal vai de 15/11 a 06/01', () => {
  assert.equal(epocaDeNatal(new Date(2026, 10, 14)), false);
  assert.equal(epocaDeNatal(new Date(2026, 10, 15)), true);
  assert.equal(epocaDeNatal(new Date(2026, 11, 25)), true);
  assert.equal(epocaDeNatal(new Date(2027, 0, 6)), true);
  assert.equal(epocaDeNatal(new Date(2027, 0, 7)), false);
  assert.equal(epocaDeNatal(new Date(2026, 6, 1)), false);
});

test('o sistema atual usa a mesma época do Natal', () => {
  const legado = readFileSync(new URL('../public/legado.html', import.meta.url), 'utf8');
  assert.ok(legado.includes('return (m === 11 && dia >= 15) || m === 12 || (m === 1 && dia <= 6);'));
});
