import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Calendario, configPadrao } from './prazos/calendario.ts';
import {
  SEM_FILTRO, gruposDeLembretes, gruposDeTarefas, ordenaNotas, ordenaRotinas, paraSalvarLembrete, paraSalvarNota, paraSalvarRotina, colunasDe, corrige, diasParado, lerDados, mensagemDoStatus, novaOrdem, ordenaColuna, paraSalvar, passaNoFiltro, pedeFechamento,
  rotinaFeita, separaProcesso, seloPrazo, tarefaDe, travada, type Tarefa
} from './organizacao.ts';

const cal = new Calendario(configPadrao());
const util = (d: Date) => cal.util(d);
const hoje = new Date(2026, 2, 10, 10, 0);   // terça, 10/03/2026
const tar = (extra: Partial<Tarefa> = {}): Tarefa => ({ ...tarefaDe({ id: 'x', titulo: 'Tarefa', etapa: 'afazer' }, null), ...extra });

test('correção ao salvar: maiúscula e acento só nas palavras comuns da vara', () => {
  assert.equal(corrige('fazer a intimacao do reu'), 'Fazer a intimação do réu');
  assert.equal(corrige('  CERTIDAO de transito '), 'CERTIDÃO de trânsito');
  assert.equal(corrige('Audiencia'), 'Audiência');
  assert.equal(corrige('ofício já certo'), 'Ofício já certo');
  assert.equal(corrige(''), '');
});

test('separa o número do processo do texto da tarefa', () => {
  assert.deepEqual(separaProcesso('0001234-56.2026.8.11.0001 juntar AR'), { titulo: 'juntar AR', processo: '0001234-56.2026.8.11.0001' });
  assert.deepEqual(separaProcesso('juntar AR, processo nº 00012345620268110001'), { titulo: 'juntar AR', processo: '0001234-56.2026.8.11.0001' });
  assert.deepEqual(separaProcesso('00012345620268110001'), { titulo: 'Processo 0001234-56.2026.8.11.0001', processo: '0001234-56.2026.8.11.0001' });
  assert.deepEqual(separaProcesso('juntar AR 123'), { titulo: 'juntar AR 123', processo: '' });
});

test('tarefa do banco: prioridade, etapa que não existe mais e checklist', () => {
  const t = tarefaDe({ id: 'a', titulo: 'T', etapa: 'sumiu', urgente: true, feita_em: '2026-03-09T12:00:00Z', prazo: '2026-03-12', checklist: [{ t: 'x', ok: true }, null] }, ['afazer', 'feito']);
  assert.equal(t.prioridade, 'urgente');
  assert.equal(t.etapa, 'feito');
  assert.equal(t.prazo?.getDate(), 12);
  assert.deepEqual(t.checklist, [{ t: 'x', ok: true }, { t: '', ok: false }]);
  assert.equal(tarefaDe({ id: 'b', etapa: 'sumiu' }, ['afazer', 'feito']).etapa, 'afazer');
  assert.equal(tarefaDe({ id: 'c', prioridade: 'qualquer' }, null).prioridade, 'normal');
});

test('colunas: A fazer primeiro, Feito por último, as outras na ordem cadastrada', () => {
  const q = colunasDe({ colunas: [{ chave: 'feito', nome: 'Pronto' }, { chave: 'c2', nome: 'Depois', ordem: 20 }, { chave: 'c1', nome: 'Antes', ordem: 10 }], etiquetas: [{ id: 'e', nome: 'Juiz' }] });
  assert.deepEqual(q.colunas.map(c => c.chave + ':' + c.nome), ['afazer:A fazer', 'c1:Antes', 'c2:Depois', 'feito:Pronto']);
  assert.deepEqual(q.etiquetas, [{ id: 'e', nome: 'Juiz', cor: 'azul' }]);
  const sem = colunasDe({});
  assert.deepEqual(sem.colunas.map(c => c.chave), ['afazer', 'fazendo', 'feito']);
  assert.equal(sem.temCadastro, false);
});

test('lerDados: o que o SQL antigo não manda fica desligado', () => {
  const d = lerDados({ status: 'ok', tarefas: [{ id: 'a', titulo: 'T', etapa: 'afazer' }] });
  assert.equal(d.temChecklist, false);
  assert.equal(d.temCadastro, false);
  assert.equal(d.aniversarios, null);
  assert.equal(d.tarefas.length, 1);
  const n = lerDados({ status: 'ok', checklist: true, ordem: true, equipe: true, modelos: [], aniversarios: [{ mes: '3' }], equipe_conferir: 2, pessoa: { nome: 'Ana' } });
  assert.deepEqual([n.temChecklist, n.temOrdem, n.temEquipe, n.temExtras, n.aConferir, n.euNome], [true, true, true, true, 2, 'Ana']);
  assert.deepEqual(n.aniversarios, [{ mes: 3 }]);
});

test('selo do prazo: atrasada, vence hoje, vence em até 2 dias úteis', () => {
  const com = (dia: number, extra: Partial<Tarefa> = {}) => tar({ prazo: new Date(2026, 2, dia), ...extra });
  assert.equal(seloPrazo(tar(), hoje, util), null);
  assert.deepEqual(seloPrazo(com(8), hoje, util), { cls: 'late', txt: 'Atrasada · 08/03' });
  assert.deepEqual(seloPrazo(com(10), hoje, util), { cls: 'hoje', txt: 'Vence hoje' });
  assert.deepEqual(seloPrazo(com(11), hoje, util), { cls: 'breve', txt: 'Vence amanhã' });
  assert.deepEqual(seloPrazo(com(12), hoje, util), { cls: 'breve', txt: 'Vence 12/03' });
  assert.deepEqual(seloPrazo(com(20), hoje, util), { cls: '', txt: 'Prazo 20/03' });
  assert.deepEqual(seloPrazo(com(8, { etapa: 'feito' }), hoje, util), { cls: '', txt: 'Prazo 08/03' });
});

test('tarefa parada: só a partir de 7 dias e nunca em Feito', () => {
  assert.equal(diasParado(tar({ atualizada: new Date(2026, 2, 4, 9) }), hoje), 0);
  assert.equal(diasParado(tar({ atualizada: new Date(2026, 2, 3, 23) }), hoje), 7);
  assert.equal(diasParado(tar({ atualizada: new Date(2026, 1, 1), etapa: 'feito' }), hoje), 0);
});

test('filtros do quadro', () => {
  const lista = [
    tar({ id: '1', titulo: 'Expedir mandado', processo: '0001226-43.2017.8.11.0008', prazo: new Date(2026, 2, 8) }),
    tar({ id: '2', titulo: 'Juntar laudo', responsavel: 'Cartório', prazo: new Date(2026, 2, 15) }),
    tar({ id: '3', titulo: 'Intimar perito', urgente: true, prioridade: 'urgente', etapa: 'fazendo', etiquetas: ['e1'] }),
    tar({ id: '4', titulo: 'Já feita', prazo: new Date(2026, 2, 1), etapa: 'feito' })
  ];
  const ids = (f: Partial<typeof SEM_FILTRO>) => lista.filter(t => passaNoFiltro(t, { ...SEM_FILTRO, ...f }, hoje)).map(t => t.id);
  assert.deepEqual(ids({}), ['1', '2', '3', '4']);
  assert.deepEqual(ids({ q: 'LAUDO' }), ['2']);
  assert.deepEqual(ids({ q: 'intimaçao' }), []);
  assert.deepEqual(ids({ q: '000122643' }), ['1']);
  assert.deepEqual(ids({ q: '00' }), []);
  assert.deepEqual(ids({ prazo: 'atrasadas' }), ['1']);
  assert.deepEqual(ids({ prazo: 'semana' }), ['2']);
  assert.deepEqual(ids({ prazo: 'urgentes' }), ['3']);
  assert.deepEqual(ids({ resp: 'Cartório' }), ['2']);
  assert.deepEqual(ids({ resp: '-' }), ['1', '3', '4']);
  assert.deepEqual(ids({ etq: 'e1' }), ['3']);
});

test('ordem dos cartões: posição primeiro, depois prazo e prioridade; em Feito, a mais recente primeiro', () => {
  const a = tar({ id: 'a', prazo: new Date(2026, 2, 20) }), b = tar({ id: 'b', prazo: new Date(2026, 2, 12) }), c = tar({ id: 'c' });
  const d = tar({ id: 'd', prioridade: 'alta' }), e = tar({ id: 'e', posicao: 10 });
  assert.deepEqual(ordenaColuna([a, b, c, d, e], 'afazer').map(t => t.id), ['e', 'b', 'a', 'd', 'c']);
  const f1 = tar({ id: 'f1', etapa: 'feito', feitaEm: new Date(2026, 2, 1) }), f2 = tar({ id: 'f2', etapa: 'feito', feitaEm: new Date(2026, 2, 5) });
  assert.deepEqual(ordenaColuna([f1, f2], 'feito').map(t => t.id), ['f2', 'f1']);
});

test('nova ordem: põe o cartão antes de outro ou no fim da coluna', () => {
  const t1 = tar({ id: '1', posicao: 10 }), t2 = tar({ id: '2', posicao: 20 }), t3 = tar({ id: '3', posicao: 30 });
  assert.deepEqual(novaOrdem([t1, t2, t3], t3, '1'), ['3', '1', '2']);
  assert.deepEqual(novaOrdem([t1, t2, t3], t1, null), ['2', '3', '1']);
  assert.deepEqual(novaOrdem([t1, t2, t3], t1, '3'), ['2', '1', '3']);
});

test('regras da pessoa: tarefa em conferência trava; tarefa do gestor pede fechamento', () => {
  assert.equal(travada(tar({ conferencia: 'enviada' }), true), true);
  assert.equal(travada(tar({ conferencia: 'enviada' }), false), false);
  assert.equal(pedeFechamento(tar({ doGestor: true }), true), true);
  assert.equal(pedeFechamento(tar({ doGestor: true, conclusao: { horas: 1 } }), true), false);
  assert.equal(pedeFechamento(tar({ doGestor: true }), false), false);
});

test('argumentos de org_salvar_tarefa', () => {
  assert.deepEqual(paraSalvar({ titulo: 'fazer intimacao', prazo: new Date(2026, 2, 12), prioridade: 'rara', responsavel: '', processo: '', feitaEm: null, etapa: '' }),
    { p_id: null, p_titulo: 'Fazer intimação', p_prazo: '2026-03-12', p_prioridade: 'normal', p_responsavel: '', p_processo: '', p_feita_em: null, p_etapa: 'afazer' });
  const feita = new Date(Date.UTC(2026, 2, 9, 12));
  assert.equal(paraSalvar({ id: 'z', titulo: 'x', prazo: null, prioridade: 'alta', responsavel: 'Cartório', processo: 'p', feitaEm: feita, etapa: '' }).p_etapa, 'feito');
});

test('rotinas: feita no período atual', () => {
  assert.equal(rotinaFeita({ id: 'r', titulo: 'r', frequencia: 'semanal', feitaEm: new Date(2026, 2, 9, 8) }, hoje), true);    // segunda desta semana
  assert.equal(rotinaFeita({ id: 'r', titulo: 'r', frequencia: 'semanal', feitaEm: new Date(2026, 2, 8, 8) }, hoje), false);   // domingo passado
  assert.equal(rotinaFeita({ id: 'r', titulo: 'r', frequencia: 'mensal', feitaEm: new Date(2026, 2, 1, 8) }, hoje), true);
  assert.equal(rotinaFeita({ id: 'r', titulo: 'r', frequencia: 'trimestral', feitaEm: new Date(2025, 11, 31) }, hoje), false);
  assert.equal(rotinaFeita({ id: 'r', titulo: 'r', frequencia: 'mensal', feitaEm: null }, hoje), false);
});

test('mensagens da entrada', () => {
  assert.equal(mensagemDoStatus('senha', false), 'Senha incorreta.');
  assert.equal(mensagemDoStatus('senha', true), '');
  assert.match(mensagemDoStatus('bloqueado', false), /5 minutos/);
  assert.match(mensagemDoStatus('sem_pessoa', true), /gestor/);
});

test('lista de tarefas: grupos por prazo, ordem escolhida primeiro, concluídas limitadas e arquivadas fora', () => {
  const dia = (n: number) => new Date(2026, 2, 10 + n);
  const lista = [
    tar({ id: 'atr', prazo: dia(-2) }), tar({ id: 'hoje', prazo: dia(0) }), tar({ id: 'p2', prazo: dia(5) }), tar({ id: 'p1', prazo: dia(2) }),
    tar({ id: 'p3', prazo: dia(9), ordemLista: 10 }), tar({ id: 'solta' }), tar({ id: 'arq', arquivadaEm: dia(-1) }),
    ...Array.from({ length: 17 }, (_, i) => tar({ id: 'f' + i, feitaEm: new Date(2026, 2, 1, 8, i), etapa: 'feito' }))
  ];
  const g = gruposDeTarefas(lista, hoje);
  assert.deepEqual(g.map(x => x.nome), ['Atrasadas', 'Hoje', 'Próximas', 'Sem prazo', 'Concluídas']);
  assert.deepEqual(g[2].itens.map(t => t.id), ['p3', 'p1', 'p2']);
  assert.equal(g[4].itens.length, 15);
  assert.equal(g[4].itens[0].id, 'f16');
  assert.equal(g[4].concluidas, true);
  assert.deepEqual(gruposDeTarefas([tar({ id: 'x', prazo: dia(1) })], hoje).map(x => x.nome), ['Próximas']);
});

test('lembretes: atrasados, hoje, próximos, o próximo do dia e o que já passou', () => {
  const l = (id: string, data: Date, hora = '', feitoEm: Date | null = null) => ({ id, texto: id, data, hora, processo: '', feitoEm });
  const dia = (n: number) => new Date(2026, 2, 10 + n);
  const g = gruposDeLembretes([
    l('atr', dia(-1)), l('feito-ontem', dia(-1), '', new Date()), l('manha', dia(0), '08:00'), l('tarde', dia(0), '15:00'), l('sem-hora', dia(0)),
    l('feito', dia(0), '07:00', new Date()), l('amanha', dia(1)), l('depois', dia(1), '09:00')
  ], hoje);   // hoje = 10:00
  assert.deepEqual(g.atrasados.map(x => x.id), ['atr']);
  assert.deepEqual(g.deHoje.map(x => x.id), ['sem-hora', 'feito', 'manha', 'tarde']);
  assert.deepEqual(g.proximos.map(x => x.id), ['amanha', 'depois']);
  assert.equal(g.proximo?.id, 'tarde');
  assert.equal(g.passou, 2);   // "manha" (já passou) + 1 atrasado
  assert.equal(g.horarioPassou(g.deHoje[2]), true);
  assert.equal(g.horarioPassou(g.deHoje[1]), false);
});

test('rotinas: pendentes primeiro, mais frequentes antes, depois pelo título', () => {
  const r = (titulo: string, frequencia: string, feitaEm: Date | null = null) => ({ id: titulo, titulo, frequencia, feitaEm });
  const ordem = ordenaRotinas([r('B', 'mensal'), r('A', 'mensal'), r('Z', 'semanal'), r('feita', 'semanal', new Date(2026, 2, 9)), r('T', 'trimestral')], hoje);
  assert.deepEqual(ordem.map(x => x.titulo), ['Z', 'A', 'B', 'T', 'feita']);
});

test('notas: fixadas primeiro e depois as mais novas', () => {
  const n = (id: string, fixada: boolean, d: number) => ({ id, texto: id, titulo: '', cor: 'amarelo', fixada, criada: new Date(2026, 0, d) });
  assert.deepEqual(ordenaNotas([n('a', false, 5), n('b', true, 1), n('c', false, 9), n('d', true, 3)]).map(x => x.id), ['d', 'b', 'c', 'a']);
});

test('argumentos de lembrete, rotina e nota: corrigem o texto', () => {
  assert.deepEqual(paraSalvarLembrete({ texto: 'ligar para a audiencia', data: new Date(2026, 2, 12), hora: '', processo: '', feitoEm: null }),
    { p_id: null, p_texto: 'Ligar para a audiência', p_data: '2026-03-12', p_hora: null, p_processo: '', p_feito_em: null });
  assert.equal(paraSalvarRotina({ id: 'r', titulo: 'estatistica mensal', frequencia: 'mensal', feitaEm: null }).p_titulo, 'Estatística mensal');
  assert.deepEqual(paraSalvarNota({ texto: 'malote sai as 15h', cor: 'verde', fixada: true }), { p_id: null, p_texto: 'Malote sai as 15h', p_cor: 'verde', p_fixada: true });
});
