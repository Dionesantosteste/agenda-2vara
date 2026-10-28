import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calendario, configPadrao } from './prazos/calendario.ts';
import {
  agrupar, andamentoAoSalvar, aplicarStatus, dataSugerida, deLinha, diasUteisEntre, interpretarLinha, laudoAtrasado, ordemDoLote,
  passa, previaDoLote, prazoLaudo, resumoDoLote, somarDiasUteis, textoDoFiltro, type Filtros, type Pericia
} from './pericias.ts';

const cal = new Calendario(configPadrao());
const util = (d: Date) => cal.util(d);
const agora = new Date(2026, 2, 10, 10, 0);   // terça, 10/03/2026
const per = (extra: Partial<Pericia> = {}): Pericia => ({
  id: 'x', processo: '1002345-67.2026.8.11.0041', autor: 'Maria', perito: 'Dra. Paula', especialidade: '', status: 'nao_agendada',
  data: null, local: '', realizadaEm: null, laudoEm: null, observacoes: '', conferidaEm: null, ...extra
});
const F: Filtros = { aba: 'andamento', situacao: 'andamento', concl: 'todas', perito: '', busca: '' };

test('prazo do laudo: 30 dias úteis, sem feriados (Sexta-feira Santa) e sem o recesso', () => {
  assert.equal(somarDiasUteis(new Date(2026, 2, 2), 30, util).toDateString(), new Date(2026, 3, 14).toDateString());
  assert.equal(somarDiasUteis(new Date(2025, 11, 18), 1, util).toDateString(), new Date(2025, 11, 19).toDateString());
  assert.equal(somarDiasUteis(new Date(2025, 11, 19), 1, util).toDateString(), new Date(2026, 0, 21).toDateString());
  assert.equal(diasUteisEntre(agora, new Date(2026, 3, 14), util), 24);
});

test('laudo atrasado', () => {
  const p = per({ status: 'realizada', realizadaEm: new Date(2026, 0, 21) });
  assert.equal(prazoLaudo(p, util)!.toDateString(), new Date(2026, 2, 6).toDateString());
  assert.ok(laudoAtrasado(p, agora, util));
  assert.ok(!laudoAtrasado(per({ status: 'realizada', realizadaEm: new Date(2026, 2, 2) }), agora, util));
});

test('situação ajusta as datas', () => {
  const ontem = new Date(2026, 2, 9, 8, 0);
  assert.equal(aplicarStatus(per({ status: 'agendada', data: ontem }), 'realizada', agora).realizadaEm!.toDateString(), ontem.toDateString());
  assert.equal(aplicarStatus(per({ status: 'agendada', data: new Date(2026, 2, 20) }), 'realizada', agora).realizadaEm!.toDateString(), agora.toDateString());
  const voltou = aplicarStatus(per({ status: 'realizada', realizadaEm: ontem }), 'agendada', agora);
  assert.equal(voltou.realizadaEm, null);
  assert.equal(aplicarStatus(per(), 'laudo_juntado', agora).laudoEm!.toDateString(), agora.toDateString());
});

test('andamento automático ao salvar', () => {
  const d = new Date(2026, 2, 20, 14, 0);
  assert.equal(andamentoAoSalvar(per({ status: 'agendada', data: d }), null, true, util), 'Perícia cadastrada. Perícia agendada para 20/03/2026 às 14:00');
  assert.equal(andamentoAoSalvar(per(), null, true, util), 'Perícia cadastrada (não agendada)');
  const antes = per({ status: 'agendada', data: d });
  assert.equal(andamentoAoSalvar(per({ status: 'agendada', data: new Date(2026, 2, 20, 15, 0) }), antes, false, util), 'Data da perícia alterada para 20/03/2026 às 15:00');
  assert.equal(andamentoAoSalvar(per({ status: 'realizada', realizadaEm: new Date(2026, 2, 2) }), antes, false, util), 'Perícia realizada em 02/03/2026. Prazo do laudo: 14/04/2026 (30 dias úteis)');
  assert.equal(andamentoAoSalvar(antes, antes, false, util), null);
});

test('lista: atrasados primeiro, depois pela data; grupos com título', () => {
  const r = agrupar([
    per({ id: 'a', status: 'agendada', data: new Date(2026, 2, 11, 8) }),
    per({ id: 'b', status: 'realizada', realizadaEm: new Date(2026, 0, 21) }),
    per({ id: 'c' })
  ], F, agora, util);
  assert.deepEqual(r.grupos.map(g => [g.titulo, g.rel, g.itens.map(p => p.id)]), [
    ['Laudos atrasados', '', ['b']], ['Quarta-feira, 11 de março', 'amanhã', ['a']], ['Aguardando data do perito', '', ['c']]
  ]);
  assert.equal(agrupar([per()], { ...F, busca: '100234567' }, agora, util).total, 1);
});

test('leitura das linhas do cadastro em lote', () => {
  assert.deepEqual(interpretarLinha('10023612220268110041 Bruno Lima 10h00'), { texto: '10023612220268110041 Bruno Lima 10h00', processo: '1002361-22.2026.8.11.0041', autor: 'Bruno Lima', hora: '10:00' });
  assert.equal(interpretarLinha('Autora: Ana Souza - 1002360-11.2026.8.11.0041').autor, 'Ana Souza');
  const p = previaDoLote('1002360-11.2026.8.11.0041; Ana\nsem processo\n1002360-11.2026.8.11.0041; Ana de novo\n1002362-33.2026.8.11.0041; Dora 9:30\n1002363-33.2026.8.11.0041; Eva', [], {}, '08:00', 15);
  assert.deepEqual(p.linhas.map(l => l.horaCalc), ['08:00', '', '', '09:30', '09:45']);
  assert.equal(resumoDoLote(p, false), '3 prontas · 1 repetida (não será cadastrada) · 1 com problema');
  assert.equal(previaDoLote('1002360-11.2026.8.11.0041; Ana\n1002360-11.2026.8.11.0041; Ana', [], { 1: true }, '08:00', 10).prontas, 2);
});

test('alteração em lote: data sugerida e ordem', () => {
  const a = per({ id: 'a', processo: '2', data: new Date(2026, 2, 9, 9) }), b = per({ id: 'b', processo: '1', data: new Date(2026, 2, 9, 8) });
  assert.equal(dataSugerida('realizada', [a, b], agora), '2026-03-09');
  assert.equal(dataSugerida('realizada', [a, per()], agora), '2026-03-10');
  assert.equal(dataSugerida('agendada', [a], agora), '');
  assert.deepEqual(ordemDoLote([a, per({ id: 'c', processo: '0' }), b]).map(p => p.id), ['b', 'a', 'c']);
});

test('situação desconhecida vira "Não agendada"; texto do filtro', () => {
  assert.equal(deLinha({ id: 1, status: 'xyz' }).status, 'nao_agendada');
  assert.equal(deLinha({ id: 1, realizada_em: '2026-03-02' }).realizadaEm!.getDate(), 2);
  assert.equal(textoDoFiltro({ ...F, situacao: 'realizada', perito: 'x', busca: ' ana ' }, 'Dr. X'), 'Em andamento: Aguardando laudo · Perito: Dr. X · Busca: "ana"');
  assert.equal(textoDoFiltro({ ...F, aba: 'concluidas' }, ''), 'Concluídas');
});

test('filtro por data (card "Próximos 7 dias")', () => {
  const mk = (id: string, d: Date | null): Pericia => ({ id, processo: id, autor: '', perito: '', especialidade: '', status: 'agendada', data: d, local: '', realizadaEm: null, laudoEm: null, observacoes: '', conferidaEm: null });
  const f = { aba: 'andamento', situacao: 'andamento', concl: 'todas', perito: '', busca: '', de: '2026-10-30', ate: '2026-10-30' } as const;
  const util = () => true;
  assert.ok(passa(mk('a', new Date(2026, 9, 30, 8, 0)), f, new Date(2026, 9, 28), util));
  assert.ok(!passa(mk('b', new Date(2026, 9, 31, 8, 0)), f, new Date(2026, 9, 28), util));
  assert.ok(!passa(mk('c', null), f, new Date(2026, 9, 28), util));
});
