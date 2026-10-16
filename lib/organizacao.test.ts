import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  corrige, descreverEmUso, gruposDaLista, iniciais, inicioDoPeriodo, mensagemDoStatus, ordenarRotinas, quadroDeLembretes, rotinaFeita,
  separaProcesso, tarefaDe, type Lembrete
} from './organizacao.ts';

const agora = new Date(2026, 9, 16, 10, 30);   // sexta, 16/10/2026 10:30

test('correção: maiúscula no começo e acento das palavras da vara', () => {
  assert.equal(corrige('expedir intimacao da reuniao'), 'Expedir intimação da reunião');
  assert.equal(corrige('CERTIDAO'), 'CERTIDÃO');
  assert.equal(corrige('  Oficio ao INSS '), 'Ofício ao INSS');
  assert.equal(corrige('naoexiste'), 'Naoexiste');
});

test('separa o número do processo do título', () => {
  assert.deepEqual(separaProcesso('expedir intimacao 00012264320178110008'), { titulo: 'expedir intimacao', processo: '0001226-43.2017.8.11.0008' });
  assert.deepEqual(separaProcesso('Juntar AR - processo nº 0001226-43.2017.8.11.0008'), { titulo: 'Juntar AR', processo: '0001226-43.2017.8.11.0008' });
  assert.deepEqual(separaProcesso('0001226-43.2017.8.11.0008'), { titulo: 'Processo 0001226-43.2017.8.11.0008', processo: '0001226-43.2017.8.11.0008' });
  assert.deepEqual(separaProcesso('Sem número'), { titulo: 'Sem número', processo: '' });
});

test('tarefa do banco: prioridade antiga, etapa desconhecida', () => {
  assert.equal(tarefaDe({ id: 1, urgente: true }, null).prioridade, 'urgente');
  assert.equal(tarefaDe({ id: 1, prioridade: 'xyz' }, null).prioridade, 'normal');
  assert.equal(tarefaDe({ id: 1, etapa: 'sumiu', feita_em: '2026-10-01T10:00:00Z' }, ['afazer', 'feito']).etapa, 'feito');
  assert.equal(tarefaDe({ id: 1, prazo: '2026-10-20' }, null).prazo!.getDate(), 20);
});

test('grupos da lista: ordem escolhida, prazo e prioridade', () => {
  const t = (id: string, extra: Record<string, unknown>) => tarefaDe({ id, titulo: id, ...extra }, null);
  const g = gruposDaLista([
    t('a', { prazo: '2026-10-14' }), t('b', { prazo: '2026-10-16' }), t('c', { prazo: '2026-10-20' }),
    t('d', {}), t('e', { prioridade: 'urgente' }), t('f', { ordem_lista: 10 }), t('g', { feita_em: '2026-10-15T10:00:00Z' })
  ], agora);
  assert.deepEqual(g.map(x => [x.nome, x.itens.map(i => i.id)]), [['Atrasadas', ['a']], ['Hoje', ['b']], ['Próximas', ['c']], ['Sem prazo', ['f', 'e', 'd']], ['Concluídas', ['g']]]);
});

test('lembretes: hoje, horário que passou, próximo, atrasados e próximos dias', () => {
  const l = (id: string, data: Date, hora = '', feito = false): Lembrete => ({ id, texto: id, data, hora, processo: '', feitoEm: feito ? agora : null });
  const hoje = new Date(2026, 9, 16), ontem = new Date(2026, 9, 15), amanha = new Date(2026, 9, 17);
  const q = quadroDeLembretes([l('cedo', hoje, '08:00'), l('tarde', hoje, '15:00'), l('feito', hoje, '09:00', true), l('ontem', ontem), l('amanha', amanha)], agora);
  assert.equal(q.pendHoje, 2);
  assert.equal(q.passou, 2);
  assert.equal(q.proximo!.id, 'tarde');
  assert.deepEqual(q.hoje.map(x => x.id), ['cedo', 'feito', 'tarde']);
  assert.deepEqual(q.proximos.map(x => x.id), ['amanha']);
});

test('rotinas: período e ordem', () => {
  assert.equal(inicioDoPeriodo('semanal', agora).getDate(), 12);
  assert.equal(inicioDoPeriodo('mensal', agora).getDate(), 1);
  assert.equal(inicioDoPeriodo('trimestral', agora).getMonth(), 9);
  const r = (id: string, frequencia: 'semanal' | 'mensal', feita: Date | null) => ({ id, titulo: id, frequencia, feitaEm: feita });
  assert.ok(rotinaFeita(r('x', 'mensal', new Date(2026, 9, 2)), agora));
  assert.ok(!rotinaFeita(r('x', 'semanal', new Date(2026, 9, 9)), agora));
  assert.deepEqual(ordenarRotinas([r('m', 'mensal', new Date(2026, 9, 2)), r('b', 'mensal', null), r('s', 'semanal', null)], agora).map(x => x.id), ['s', 'b', 'm']);
});

test('entrada: mensagens e iniciais', () => {
  assert.equal(mensagemDoStatus('senha', false), 'Senha incorreta.');
  assert.equal(mensagemDoStatus('senha', true), '');
  assert.equal(iniciais('Ana Maria Souza'), 'AS');
  assert.equal(iniciais('ana'), 'AN');
  const em = { id: '1', dono: null, dono_nome: null, titulo: 'Juntar AR', etapa: 'afazer', prazo: '2026-10-20', conferencia: null, coluna: null };
  assert.deepEqual(descreverEmUso(em, false, null, () => ''), { quem: 'Você (seu quadro)', resto: ': Juntar AR · A fazer · prazo 20/10' });
});
