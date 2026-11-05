import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, combina, destaque, faltaColunaAtendimento, formatarTelefone, inicial, linhasPreenchidas, normalizar, rotuloAutomatico, tipoTelefone, type Contato } from './agenda.ts';

const c = (name: string, extra: Partial<Contato> = {}): Contato =>
  ({ id: name, name, phones: [], emails: [], category: '', service_hours: '', has_on_call: false, on_call_phone: '', ...extra });

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

test('máscara de telefone: fixo (65) 3333-3333 e celular (65) 99999-9999', () => {
  assert.equal(formatarTelefone('6533221100'), '(65) 3322-1100');
  assert.equal(formatarTelefone('65998112233'), '(65) 99811-2233');
  assert.equal(formatarTelefone('(65) 3322-11000'), '(65) 33221-1000');  // 9º dígito digitado: vira celular
  assert.equal(formatarTelefone('65 9 9811 2233'), '(65) 99811-2233');
  // enquanto digita
  assert.equal(formatarTelefone('6'), '(6');
  assert.equal(formatarTelefone('653'), '(65) 3');
  assert.equal(formatarTelefone('653322'), '(65) 3322');
  assert.equal(formatarTelefone('6533221'), '(65) 3322-1');
  // apagando tudo, ou números especiais: ficam como estão
  assert.equal(formatarTelefone(''), '');
  assert.equal(formatarTelefone('0800 123 4567'), '0800 123 4567');
  assert.equal(formatarTelefone('+55 65 99811-2233'), '+55 65 99811-2233');
});

test('fixo ou celular pelo número, e o rótulo acompanha só entre os dois', () => {
  assert.equal(tipoTelefone('(65) 3322-1100'), 'Fixo');
  assert.equal(tipoTelefone('(65) 99811-2233'), 'Celular');
  assert.equal(tipoTelefone('(65) 3322'), null);
  assert.equal(tipoTelefone('0800 123 4567'), null);
  assert.equal(rotuloAutomatico('Celular', '(65) 3322-1100'), 'Fixo');
  assert.equal(rotuloAutomatico('Fixo', '(65) 99811-2233'), 'Celular');
  assert.equal(rotuloAutomatico('Celular', '(65) 998'), 'Celular');
  assert.equal(rotuloAutomatico('Fax', '(65) 3322-1100'), 'Fax');
  assert.equal(rotuloAutomatico('Trabalho', '(65) 99811-2233'), 'Trabalho');
});

test('busca acha o telefone do plantão (só se tem plantão)', () => {
  const vara = c('Vara', { has_on_call: true, on_call_phone: '(65) 99999-1234' });
  assert.ok(combina(vara, '1234', 'Todos'));
  assert.ok(!combina({ ...vara, has_on_call: false }, '1234', 'Todos'));
});

test('reconhece o erro de banco sem as colunas de horário e plantão', () => {
  assert.ok(faltaColunaAtendimento("Could not find the 'service_hours' column of 'contacts' in the schema cache"));
  assert.ok(!faltaColunaAtendimento('permission denied'));
  assert.ok(!faltaColunaAtendimento(undefined));
});
