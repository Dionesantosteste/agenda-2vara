// As mesmas contas dos testes de navegador, direto nas regras (datas contadas à mão).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATOS, ATO_POR_ID } from './atos.ts';
import { Calendario, configPadrao, configDasLinhas, pascoa } from './calendario.ts';
import { calcular, certidao, extenso, type Pedido } from './calculo.ts';
import { lerData, fmt, D } from './datas.ts';
import { idade, lerLote } from './idade.ts';
import { transito } from './transito.ts';

const cal = () => new Calendario(configPadrao());
const pedido = (x: Partial<Pedido>): Pedido => Object.assign({ n: 15, un: 'u', dir: 'apos', forma: 'djen', d1: '', d2: '', alvo: '', dobro: '' }, x) as Pedido;
const venc = (x: Partial<Pedido>, c = cal()) => { const r = calcular(pedido(x), c); assert.ok(r.ok, r.erro); return fmt(r.venc!); };

test('Páscoa e feriados móveis de 2026', () => {
  assert.equal(fmt(pascoa(2026)), '05/04/2026');
  const f = cal().feriadosDoAno(2026);
  assert.equal(f['2026-02-16'].nome, 'Carnaval (segunda-feira)');
  assert.equal(f['2026-04-03'].nome, 'Sexta-feira Santa');
  assert.equal(f['2026-06-04'].nome, 'Corpus Christi');
  assert.equal(f['2026-12-08'].nome, 'Dia da Justiça (08/12)');   // marcado por padrão
});

test('dias úteis pelo DJEN, recesso e feriado da comarca', () => {
  assert.equal(venc({ d1: '2026-03-02' }), '24/03/2026');
  assert.equal(venc({ n: 5, d1: '2026-12-15' }), '25/01/2027');
  const comFeriado = new Calendario(configDasLinhas([{ chave: 'extra.x', valor: { data: '2026-03-10', nome: 'Municipal' } }]));
  assert.equal(venc({ d1: '2026-03-02' }, comFeriado), '25/03/2026');
  const semRecesso = new Calendario(configDasLinhas([{ chave: 'recesso', valor: false }]));
  assert.equal(venc({ n: 5, d1: '2026-12-15' }, semRecesso), '23/12/2026');
});

test('corridos, dobro, regressiva, PJe, Domicílio, meses e ECA', () => {
  assert.equal(venc({ n: 10, un: 'c', d1: '2026-03-02' }), '13/03/2026');
  assert.equal(venc({ n: 10, un: 'c', d1: '2026-03-04' }), '16/03/2026');
  assert.equal(venc({ ato: ATO_POR_ID.contestacao, d1: '2026-03-02', dobro: 'faz' }), '15/04/2026');
  const proprio = calcular(pedido({ ato: ATO_POR_ID.impug_535, n: 30, d1: '2026-03-02', dobro: 'faz' }), cal());
  assert.equal(proprio.nFinal, 30);
  assert.match(proprio.avisos[0], /Não dobra/);
  assert.equal(venc({ ato: ATO_POR_ID.cit_334, n: 20, dir: 'antes', alvo: '2026-03-31' }), '03/03/2026');
  assert.equal(venc({ forma: 'pje', d1: '2026-03-02' }), '02/04/2026');
  assert.equal(venc({ forma: 'pje', d1: '2026-03-02', d2: '2026-03-04' }), '25/03/2026');
  assert.equal(venc({ forma: 'dom', d1: '2026-03-02' }), '30/03/2026');
  assert.equal(venc({ n: 2, un: 'm', forma: 'juntada', d1: '2025-12-31' }), '02/03/2026');
  assert.equal(venc({ ato: ATO_POR_ID.eca_acolh, n: 18, un: 'm', d1: '2026-01-10' }), '10/07/2027');
});

test('certidão e número por extenso', () => {
  assert.equal(extenso(15), 'quinze');
  assert.equal(extenso(121), 'cento e vinte e um');
  const p = pedido({ ato: ATO_POR_ID.apelacao, d1: '2026-03-02' });
  const r = calcular(p, cal());
  assert.equal(certidao(p, r, { parte: 'a parte ré', proc: '1002345-67.2026.8.11.0041', decurso: false, hoje: D(2026, 9, 16) }),
    'Certifico que a parte ré foi intimada por publicação no Diário de Justiça Eletrônico Nacional disponibilizada em 02/03/2026 e considerada publicada em 03/03/2026, nos autos 1002345-67.2026.8.11.0041. O prazo de 15 (quinze) dias úteis para apelação teve início em 04/03/2026 e encerrou-se em 24/03/2026.');
});

test('trânsito em julgado: vale o último prazo', () => {
  const t = transito('comum', [{ tipo: 'autor', forma: 'djen', data: '2026-03-02' }, { tipo: 'reu', forma: 'juntada', data: '2026-03-10' }], cal())!;
  assert.equal(fmt(t.maior.venc!), '31/03/2026');
  assert.equal(fmt(t.transito), '01/04/2026');
  assert.equal(t.maior.parte.tipo, 'reu');
});

test('idade e lote', () => {
  assert.deepEqual(idade(lerData('2008-05-12')!, lerData('2026-05-11')!), { a: 17, m: 11, d: 29 });
  const l = lerLote('Maria Souza; 12/05/2011\nJoão Lima 03/09/2008\nSem data', lerData('2026-10-16')!);
  assert.equal(l[0].tipo === 'ok' && `${l[0].idade.a}a ${l[0].idade.m}m ${l[0].idade.d}d`, '15a 5m 4d');
  assert.equal(l[1].nome, 'João Lima');
  assert.equal(l[2].tipo, 'sem-data');
});

test('a tabela tem os 71 atos do sistema atual', () => {
  assert.equal(ATOS.length, 71);
  assert.equal(new Set(ATOS.map(a => a.id)).size, 71);
});
