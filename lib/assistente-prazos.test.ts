import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calendario, configPadrao } from './prazos/calendario.ts';
import { atosEmTexto, buscarAtos, calcularPrazoIA, type EntradaPrazo } from './assistente-prazos.ts';

const cal = () => new Calendario(configPadrao());
const entrada = (x: Partial<EntradaPrazo>): EntradaPrazo => ({ ato_id: '', dias: 0, unidade: '', forma: '', data: '', data_leitura: '', dobro: '', ...x });

test('acha o ato na Tabela de prazos', () => {
  assert.equal(buscarAtos('réplica')[0].id, 'replica');
  assert.match(atosEmTexto(buscarAtos('replica')), /Réplica \[id: replica\]: 15 dias úteis \(arts\. 350 e 351\)/);
  assert.equal(atosEmTexto([]), 'Nenhum ato da Tabela de prazos combina com a busca.');
});

test('calcula pela tabela com o calendário da vara (DJEN)', () => {
  // disponibilizado sexta 06/11/2026 → publicação segunda 09/11 → 15 dias úteis (feriado de 20/11 não conta)
  const t = calcularPrazoIA(entrada({ ato_id: 'replica', forma: 'djen', data: '2026-11-06' }), cal());
  assert.match(t, /Réplica \(arts\. 350 e 351\): 15 dias úteis/);
  assert.match(t, /09\/11\/2026 \(segunda-feira\): Publicação/);
  assert.match(t, /Vencimento: 01\/12\/2026 \(terça-feira\)/);
});

test('prazo livre em dobro e erros claros', () => {
  assert.match(calcularPrazoIA(entrada({ dias: 5, unidade: 'uteis', forma: 'ciencia', data: '2026-11-09', dobro: 'faz' }), cal()), /Prazo em dobro/);
  assert.match(calcularPrazoIA(entrada({ ato_id: 'nao_existe' }), cal()), /Ato não encontrado/);
  assert.match(calcularPrazoIA(entrada({ dias: 5, unidade: 'semanas' }), cal()), /Unidade inválida/);
  assert.match(calcularPrazoIA(entrada({ dias: 5, unidade: 'uteis', forma: 'djen', data: '09/11/2026' }), cal()), /Não deu para calcular/);
});
