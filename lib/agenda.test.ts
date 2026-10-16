import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, combina, destaque, inicial, linhasPreenchidas, normalizar, type Contato } from './agenda.ts';

const c = (name: string, extra: Partial<Contato> = {}): Contato => ({ id: name, name, phones: [], emails: [], category: '', ...extra });

test('normaliza sem acento e em minúsculas', () => {
  assert.equal(normalizar('Secretária JOÃO'), 'secretaria joao');
  assert.equal(normalizar(null), '');
});

test('inicial do índice: letra sem acento ou #', () => {
  assert.equal(inicial('Ângela'), 'A');
  assert.equal(inicial('  bruno'), 'B');
  assert.equal(inicial('2ª Vara'), '#');
  assert.equal(inicial(''), '#');
});

test('busca por nome, telefone e e-mail, dentro da categoria', () => {
  const ana = c('Ana Ribeiro', { category: 'Advogado', phones: [{ label: 'Celular', value: '(65) 99811-2233' }], emails: [{ label: 'Trabalho', value: 'ana@adv.com' }] });
  assert.ok(combina(ana, 'RIBEIRO', 'Todos'));
  assert.ok(combina(ana, '99811', 'Todos'));
  assert.ok(combina(ana, 'adv.com', 'Advogado'));
  assert.ok(!combina(ana, '', 'Perito'));
  assert.ok(!combina(ana, 'zzz', 'Todos'));
});

test('agrupa em ordem alfabética pela inicial, com # no fim', () => {
  const r = agrupar([c('bruno'), c('Ângela'), c('1ª Vara'), c('Ana')], '', 'Todos');
  assert.equal(r.total, 4);
  assert.deepEqual(r.grupos.map(g => [g.letra, g.contatos.map(x => x.name)]), [['A', ['Ana', 'Ângela']], ['B', ['bruno']], ['#', ['1ª Vara']]]);
});

test('destaque mantém o texto original, com acento', () => {
  assert.deepEqual(destaque('Secretária da Vara', 'secretaria'), ['', 'Secretária', ' da Vara']);
  assert.equal(destaque('Ana', 'zz'), null);
  assert.equal(destaque('Ana', ''), null);
});

test('linhas do formulário: só as preenchidas', () => {
  assert.deepEqual(linhasPreenchidas([{ label: 'Celular', value: '  (65) 1 ' }, { label: 'Casa', value: '   ' }]), [{ label: 'Celular', value: '(65) 1' }]);
});
