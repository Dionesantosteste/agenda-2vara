import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscar, chaveNum, destaque, filtroPrateleira, indexar, jaCadastrados, localValido, numeroAntigo, pendenciasDe, type Caixa, type Processo } from './arquivo.ts';

const cx = (id: string, nome: string, locais: [number, string][] = [[1, 'A']], secretaria = false): Caixa => ({ id, nome, locais, secretaria });
const pr = (id: string, codigo: string, caixa_id: string, extra: Partial<Processo> = {}): Processo => ({
  id, codigo, caixa_id, origem_id: null, situacao: 0, com_quem: '', destino: '', numero: '', classe: '', partes: '', ano: '', obs: '',
  volumes_ok: false, excluido: false, ...extra
});

const CAIXAS = [cx('a', '155-CRI', []), cx('b', '1320', [[5, 'B']]), cx('c', '1321', [[5, 'C'], [7, 'A']]), cx('d', '284')];
const PROCS = [
  pr('1', '1421/1996', 'a'), pr('2', '14212', 'd'), pr('3', '14213', 'b'), pr('4', '30208', 'b'), pr('5', '30208', 'c'),
  pr('6', '224/87', 'b'), pr('7', '51421', 'b'), pr('8', '999', 'b', { partes: 'Maria da Silva', classe: 'Execução' })
];
const IDX = indexar(PROCS);

test('numeração antiga: número e ano, com ano curto ou completo e zeros à esquerda', () => {
  assert.deepEqual(numeroAntigo('224/87'), ['224', '1987']);
  assert.deepEqual(numeroAntigo('0224/1987'), ['224', '1987']);
  assert.deepEqual(numeroAntigo('02//99'), ['2', '1999']);
  assert.deepEqual(numeroAntigo('10/05'), ['10', '2005']);
  assert.equal(numeroAntigo('30208'), null);
  assert.equal(chaveNum('224/87'), chaveNum('0224/1987'));
  assert.equal(chaveNum('0001234-56.2005.8.11.0041'), '12345620058110041');
});

test('busca: igual primeiro (inclusive 1421/1996 para "1421"), depois começa com, depois contém', () => {
  const r = buscar('1421', IDX, CAIXAS);
  assert.equal(r.modo, 'processos');
  if (r.modo !== 'processos') return;
  assert.deepEqual(r.grupos.map(g => [g.tipo, g.codigos]), [[0, ['1421/1996']], [1, ['14212', '14213']], [2, ['51421']]]);
});

test('busca: numeração antiga com ano curto acha o processo, e o destaque pega o número todo', () => {
  const r = buscar('224/1987', IDX, CAIXAS);
  assert.ok(r.modo === 'processos' && r.grupos[0].tipo === 0 && r.grupos[0].codigos[0] === '224/87');
  if (r.modo === 'processos') assert.deepEqual(destaque('224/87', r.trecho, r.exato), ['', '224/87', '']);
  const r2 = buscar('1421/96', IDX, CAIXAS);
  assert.ok(r2.modo === 'processos' && r2.grupos[0].codigos[0] === '1421/1996');
});

test('busca: caixa com "cx", texto nas partes e nada encontrado', () => {
  const c = buscar('cx 1320', IDX, CAIXAS);
  assert.ok(c.modo === 'caixas' && c.caixas[0].nome === '1320');
  const t = buscar('maria', IDX, CAIXAS);
  assert.ok(t.modo === 'processos' && t.grupos[0].tipo === 3 && t.grupos[0].codigos[0] === '999');
  const v = buscar('777777', IDX, CAIXAS);
  assert.ok(v.modo === 'processos' && v.total === 0);
  assert.equal(buscar('  ', IDX, CAIXAS).modo, 'vazio');
});

test('filtro das prateleiras: P25, prateleira 25 fileira b, OS, caixa', () => {
  assert.deepEqual(filtroPrateleira('P25'), { tipo: 'prateleira', p: 25, f: null });
  assert.deepEqual(filtroPrateleira('p.25'), { tipo: 'prateleira', p: 25, f: null });
  assert.deepEqual(filtroPrateleira('prateleira 25 fileira b'), { tipo: 'prateleira', p: 25, f: 'B' });
  assert.deepEqual(filtroPrateleira('P25 C'), { tipo: 'prateleira', p: 25, f: 'C' });
  assert.deepEqual(filtroPrateleira('os'), { tipo: 'secretaria' });
  assert.deepEqual(filtroPrateleira('1320'), { tipo: 'caixa', alvo: '1320' });
  assert.deepEqual(filtroPrateleira(''), { tipo: 'nenhum' });
});

test('pendências: caixa sem prateleira, caixa em dois lugares, código em duas caixas', () => {
  assert.deepEqual(pendenciasDe(PROCS[0], CAIXAS[0], IDX), ['caixa sem prateleira']);
  assert.deepEqual(pendenciasDe(PROCS[4], CAIXAS[2], IDX), ['caixa anotada em 2 lugares', 'código em 2 caixas']);
  assert.deepEqual(pendenciasDe({ ...PROCS[3], volumes_ok: true }, CAIXAS[1], IDX), []);
  assert.deepEqual(pendenciasDe(PROCS[1], CAIXAS[3], IDX), []);
  // caixa de secretaria não tem prateleira, e isso não é pendência
  assert.deepEqual(pendenciasDe(PROCS[1], cx('s', 'Gabinete', [], true), IDX), []);
});

test('duplicado no cadastro: pelo código, pelo número antigo e ignorando excluídos', () => {
  assert.deepEqual(jaCadastrados('30208', '', PROCS).map(x => x.p.id), ['4', '5']);
  assert.deepEqual(jaCadastrados('', '0224/1987', PROCS).map(x => [x.p.id, x.por]), [['6', 'número 0224/1987']]);
  assert.deepEqual(jaCadastrados('', '', PROCS), []);
  assert.deepEqual(jaCadastrados('999', '', [{ ...PROCS[7], excluido: true }]), []);
});

test('lugar da caixa: prateleira e fileira só valem juntas', () => {
  assert.deepEqual(localValido('12', 'c'), [12, 'C']);
  assert.equal(localValido('', 'C'), null);
  assert.equal(localValido('12', ''), null);
  assert.equal(localValido('x', 'C'), null);
});
