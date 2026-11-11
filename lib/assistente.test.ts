import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarModelos, buscarRotinas, lerPropostaModelo, lerPropostaRotina, palavras, passosDoTexto, rotinaEmTexto, type Rotina } from './assistente.ts';

const inss: Rotina = { id: '1', titulo: 'Após a decisão', assunto: 'INSS', quando: 'Decisão que concede o benefício', passos: ['Intimar a APS para implantar', 'Aguardar 30 dias'], observacoes: '' };
const alvara: Rotina = { id: '2', titulo: 'Expedir alvará', assunto: 'Execução', quando: 'Depósito judicial', passos: ['Conferir a conta', 'Expedir alvará eletrônico'], observacoes: 'Ver dados bancários do advogado' };

test('busca ignora acento, maiúscula e palavras curtas', () => {
  assert.deepEqual(palavras('Rotina de INSS após decisão'), ['rotina', 'inss', 'apos', 'decisao']);
  assert.deepEqual(buscarRotinas([alvara, inss], 'inss apos decisao').map(r => r.id), ['1']);
  assert.deepEqual(buscarRotinas([alvara, inss], 'ALVARÁ').map(r => r.id), ['2']);
});

test('busca vazia devolve as primeiras; sem resultado devolve vazio', () => {
  assert.equal(buscarRotinas([alvara, inss], '').length, 2);
  assert.equal(buscarRotinas([alvara, inss], 'perícia').length, 0);
});

test('modelos: o nome pesa mais que o texto', () => {
  const ms = [
    { id: 'a', nome: 'Ato ordinatório', categoria: 'Atos', texto: 'certidão de decurso citada no texto' },
    { id: 'b', nome: 'Certidão de decurso de prazo', categoria: 'Certidões', texto: 'Certifico que...' }
  ];
  assert.equal(buscarModelos(ms, 'certidão decurso')[0].id, 'b');
});

test('rotina em texto numera os passos', () => {
  assert.equal(rotinaEmTexto(inss), 'Após a decisão (INSS)\nQuando: Decisão que concede o benefício\n1. Intimar a APS para implantar\n2. Aguardar 30 dias');
});

test('propostas da IA: limpa e recusa as incompletas', () => {
  assert.deepEqual(lerPropostaRotina({ titulo: ' INSS ', passos: ['a', '', ' b '] }), { tipo: 'rotina', titulo: 'INSS', assunto: '', quando: '', passos: ['a', 'b'], observacoes: '' });
  assert.equal(lerPropostaRotina({ titulo: 'Sem passos', passos: [] }), null);
  assert.equal(lerPropostaModelo({ nome: 'X' }), null);
  assert.equal(lerPropostaModelo({ nome: 'Certidão', texto: 'Certifico {{processo}}' })?.categoria, '');
});

test('passos digitados: um por linha, sem numeração', () => {
  assert.deepEqual(passosDoTexto('1. Intimar\n2) Aguardar\n\n- Conferir\n• Arquivar'), ['Intimar', 'Aguardar', 'Conferir', 'Arquivar']);
});
