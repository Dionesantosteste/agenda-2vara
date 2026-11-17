import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adicionar, combinaIntim, contagem, lerIntimacoes, linhaDaImpressao, marcar, meioPadrao, resumoIntim, separarNomes, todasIntimadas, type Intimacao } from './intimacoes.ts';

const p = (nome: string, situacao: Intimacao['situacao'] = '', extra: Partial<Intimacao> = {}): Intimacao =>
  ({ id: nome, nome, papel: 'Testemunha do autor', meio: 'Mandado', situacao, em: null, motivo: '', ...extra });

test('lê do banco e descarta o que não serve', () => {
  assert.deepEqual(lerIntimacoes(null), []);
  assert.deepEqual(lerIntimacoes('x'), []);
  const l = lerIntimacoes([{ id: 'a', nome: ' Ana ', papel: 'Réu', situacao: 'nao', motivo: 'Mudou-se', em: '2026-11-10T12:00:00Z' }, { nome: '' }, 3, { nome: 'Bia', situacao: 'xyz', motivo: 'sobra' }]);
  assert.equal(l.length, 2);
  assert.deepEqual(l[0], { id: 'a', nome: 'Ana', papel: 'Réu', meio: '', situacao: 'nao', em: '2026-11-10T12:00:00Z', motivo: 'Mudou-se' });
  assert.equal(l[1].situacao, '');
  assert.equal(l[1].motivo, '', 'motivo só vale para "não intimada"');
  assert.ok(l[1].id, 'ganha um id');
});

test('separa vários nomes colados, sem numeração e sem repetir', () => {
  assert.deepEqual(separarNomes('1. João da Silva\n2) Maria Souza\n\n a - Pedro;  Ana   Lima '), ['João da Silva', 'Maria Souza', 'Pedro', 'Ana Lima']);
  assert.deepEqual(separarNomes('José\njose\nJOSÉ'), ['José']);
  assert.deepEqual(separarNomes('Ana\nCarlos', [p('ana')]), ['Carlos']);
});

test('adicionar usa o meio mais comum para o papel', () => {
  const l = adicionar([], ['Ana', 'Bia'], 'Réu');
  assert.equal(l.length, 2);
  assert.equal(l[0].meio, 'DJEN (advogado)');
  assert.equal(l[0].situacao, '');
  assert.notEqual(l[0].id, l[1].id);
  assert.equal(meioPadrao('Testemunha do réu'), 'Mandado');
  assert.equal(meioPadrao('Perito'), 'E-mail');
});

test('marcar grava a data; clicar de novo volta para pendente', () => {
  const agora = new Date('2026-11-17T13:00:00Z');
  let l = marcar([p('Ana')], 'Ana', 'nao', agora);
  assert.equal(l[0].situacao, 'nao');
  assert.equal(l[0].em, agora.toISOString());
  l = l.map(x => ({ ...x, motivo: 'Mudou-se' }));
  l = marcar(l, 'Ana', 'intimada', agora);
  assert.equal(l[0].situacao, 'intimada');
  assert.equal(l[0].motivo, '', 'o motivo some quando passa a intimada');
  l = marcar(l, 'Ana', 'intimada', agora);
  assert.equal(l[0].situacao, '');
  assert.equal(l[0].em, null);
});

test('contagem, sugestão de status e filtros (dispensados não contam)', () => {
  const l = [p('A', 'intimada'), p('B', 'nao'), p('C'), p('D', 'dispensada')];
  assert.deepEqual(contagem(l), { total: 3, intimadas: 1, nao: 1, pendentes: 1 });
  assert.equal(resumoIntim(l), '1/3 intimados · 1 não intimado');
  assert.ok(!todasIntimadas(l));
  assert.ok(todasIntimadas([p('A', 'intimada'), p('D', 'dispensada')]));
  assert.ok(!todasIntimadas([]));
  assert.ok(!todasIntimadas([p('D', 'dispensada')]));
  assert.ok(combinaIntim(l, 'frustradas'));
  assert.ok(combinaIntim([p('C')], 'pendentes'));
  assert.ok(!combinaIntim([p('C')], 'frustradas'));
  assert.ok(!combinaIntim([p('A', 'intimada')], 'pendentes'));
  assert.ok(!combinaIntim([], 'pendentes'), 'sem lista não é pendente');
  assert.ok(combinaIntim([], 'todas'));
});

test('linha da pauta impressa', () => {
  assert.equal(linhaDaImpressao(p('Ana', 'intimada')), '✓ Ana (Testemunha do autor)');
  assert.equal(linhaDaImpressao(p('Bia', 'nao', { motivo: 'Mudou-se' })), '✗ Bia (Testemunha do autor) — Mudou-se');
  assert.equal(linhaDaImpressao(p('Caio')), '☐ Caio (Testemunha do autor)');
});
