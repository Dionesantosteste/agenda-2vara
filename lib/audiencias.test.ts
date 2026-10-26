import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combina, deLinha, nomesTipos, noPeriodo, pauta, interpretarLinha, pendente, previaDoLote, repetidasDe, resumo, tituloDaTarefa, rotuloDoDia, textoDoFiltro, type Audiencia, type Filtros } from './audiencias.ts';

const agora = new Date(2026, 9, 16, 10, 0);   // sexta, 16/10/2026 10:00
const aud = (dia: number, mes = 9, extra: Partial<Audiencia> = {}): Audiencia =>
  ({ id: String(dia) + '-' + mes, processo: '1002345-67.2026.8.11.0041', date: new Date(2026, mes, dia, 9, 0), tipo: 'Conciliação', status: 'A cumprir', observacoes: '', conferidaEm: null, responsavelId: null, tarefaId: null, ...extra });
const F: Filtros = { periodo: 'proximas', de: '', ate: '', status: 'Todos', tipo: 'Todos', conf: 'todas', busca: '' };

test('status antigos são convertidos ao carregar', () => {
  assert.equal(deLinha({ id: 1, data_hora: '2026-10-16T12:00:00Z', status: 'Designada' }).status, 'A cumprir');
  assert.equal(deLinha({ id: 1, data_hora: '2026-10-16T12:00:00Z', status: 'Cumprida' }).status, 'Intimações feitas');
  assert.equal(deLinha({ id: 1, data_hora: '2026-10-16T12:00:00Z' }).status, 'A cumprir');
});

test('períodos', () => {
  const hojeCedo = aud(16, 9), ontem = aud(15, 9), novembro = aud(5, 10), em20 = aud(5, 10);
  assert.ok(noPeriodo(hojeCedo, { ...F, periodo: 'proximas' }, agora), 'hoje às 9h, mesmo já passado, conta como próxima');
  assert.ok(noPeriodo(hojeCedo, { ...F, periodo: 'hoje' }, agora));
  assert.ok(!noPeriodo(ontem, { ...F, periodo: 'proximas' }, agora));
  assert.ok(noPeriodo(ontem, { ...F, periodo: 'anteriores' }, agora));
  assert.ok(noPeriodo(novembro, { ...F, periodo: 'proxmes' }, agora));
  assert.ok(!noPeriodo(em20, { ...F, periodo: 'semana' }, agora));
  assert.ok(noPeriodo(ontem, { ...F, periodo: 'intervalo', de: '2026-10-15', ate: '2026-10-15' }, agora));
  assert.ok(!noPeriodo(hojeCedo, { ...F, periodo: 'intervalo', de: '2026-10-15', ate: '2026-10-15' }, agora));
});

test('busca por dígitos do processo, sem acento, e filtros', () => {
  const a = aud(20, 9, { tipo: 'Instrução e julgamento', observacoes: 'intimar testemunhas', conferidaEm: agora });
  assert.ok(combina(a, { ...F, busca: '100234567' }));
  assert.ok(combina(a, { ...F, busca: 'instrucao' }));
  assert.ok(combina(a, { ...F, busca: 'TESTEMUNHAS' }));
  assert.ok(!combina(a, { ...F, busca: '99' }));
  assert.ok(!combina(a, { ...F, conf: 'nao' }));
  assert.ok(!combina(a, { ...F, tipo: 'Conciliação' }));
});

test('pauta: anteriores da mais recente para a mais antiga, agrupada por dia', () => {
  const r = pauta([aud(10, 9), aud(14, 9), aud(14, 9, { id: 'b', date: new Date(2026, 9, 14, 8, 0) })], { ...F, periodo: 'anteriores' }, agora);
  assert.deepEqual(r.dias.map(d => [d.chave, d.itens.length]), [['2026-10-14', 2], ['2026-10-10', 1]]);
});

test('resumo não conta as canceladas', () => {
  const r = resumo([aud(16, 9, { date: new Date(2026, 9, 16, 15, 0) }), aud(17, 9, { status: 'Cancelada' }), aud(5, 10)], agora);
  assert.deepEqual(r, { hoje: 1, janela: 1, proxMes: 1, nomeProxMes: 'novembro' });
});

test('pendente: passou e continua "A cumprir"', () => {
  assert.ok(pendente(aud(15, 9), agora));
  assert.ok(!pendente(aud(15, 9, { status: 'Intimações feitas' }), agora));
  assert.ok(!pendente(aud(17, 9), agora));
});

test('rótulo do dia e tipos', () => {
  assert.equal(rotuloDoDia(new Date(2026, 9, 17, 8), agora).rel, 'amanhã');
  assert.match(rotuloDoDia(new Date(2026, 9, 17, 8), agora).texto, /^Sábado, 17 de outubro$/);
  assert.match(rotuloDoDia(new Date(2027, 0, 4, 8), agora).texto, /2027/);
  assert.deepEqual(nomesTipos(null, [aud(1, 9, { tipo: 'conciliação' }), aud(2, 9, { tipo: 'Apresentação' })]), ['Apresentação', 'conciliação', 'Em continuação', 'Instrução e julgamento']);
  assert.deepEqual(nomesTipos(['B', 'a'], []), ['a', 'B']);
});

test('texto do filtro para a impressão', () => {
  assert.equal(textoDoFiltro({ ...F, tipo: 'Conciliação', conf: 'nao', busca: ' x ' }), 'Próximas · Tipo: Conciliação · Não conferidas · Busca: "x"');
  assert.equal(textoDoFiltro({ ...F, periodo: 'intervalo', de: '2026-10-01', ate: '' }), 'De 01/10/2026 a …');
});

test('audiência repetida: mesmo processo no mesmo dia ou com o mesmo tipo', () => {
  const base = [aud(20, 9), aud(25, 9, { tipo: 'Instrução' }), aud(20, 9, { id: 'x', processo: '9999999-99.2026.8.11.0041' })];
  const proc = '10023456720268110041';
  assert.equal(repetidasDe(base, proc, new Date(2026, 9, 20, 14, 0), 'Outro').length, 1, 'mesmo dia');
  assert.equal(repetidasDe(base, proc, new Date(2026, 10, 3, 14, 0), 'Conciliação').length, 1, 'mesmo tipo');
  assert.equal(repetidasDe(base, proc, new Date(2026, 10, 3, 14, 0), 'Outro').length, 0);
  assert.equal(repetidasDe(base, proc, new Date(2026, 9, 20, 9, 0), 'Conciliação', '20-9').length, 0, 'ignora a própria');
});

test('lote: interpreta a linha e confere a prévia', () => {
  const l = interpretarLinha('1002345-67.2026.8.11.0041 14:30 20/10 intimar testemunhas', 2026);
  assert.deepEqual([l.processo, l.hora, l.data, l.obs], ['1002345-67.2026.8.11.0041', '14:30', '2026-10-20', 'intimar testemunhas']);
  const base = { data: '2026-11-10', hora: '09:00', tipo: 'Outro' };
  const p = previaDoLote('1002345-67.2026.8.11.0041\n8888888-88.2026.8.11.0041 10:00\n8888888-88.2026.8.11.0041 11:00\nsem número', [aud(20, 9)], {}, base);
  assert.equal(p.prontas, 2);
  assert.equal(p.repetidas, 1, 'repetida dentro da lista (mesmo dia)');
  assert.equal(p.problemas, 1);
  assert.equal(p.linhas[0].incluir, true);
  assert.equal(previaDoLote('8888888-88.2026.8.11.0041', [], {}, { ...base, hora: '' }).problemas, 1, 'sem hora');
  assert.equal(previaDoLote('1002345-67.2026.8.11.0041', [aud(20, 9)], { 0: true }, { ...base, data: '2026-10-20' }).prontas, 1, 'forçar repetida');
});

test('título da tarefa da audiência', () => {
  assert.equal(tituloDaTarefa('Instrução', new Date(2026, 9, 20, 14, 5)), 'Audiência de Instrução · 20/10/2026 às 14:05');
});
