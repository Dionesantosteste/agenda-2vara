// Organização: as regras do Quadro e da entrada, iguais às do sistema atual.
// Tudo aqui é função pura (sem tela e sem banco), para poder ser testado.
import { normalizar } from './agenda.ts';
import { chaveDoDia } from './datas.ts';
import { formatarProcesso, soDigitos } from './processo.ts';

export const RESPS = ['Gestor', 'Secretaria', 'Cartório', 'Assessoria', 'Gabinete'];
export const ETAPAS: [string, string][] = [['afazer', 'A fazer'], ['fazendo', 'Fazendo'], ['feito', 'Feito']];
export const LIMITE_FAZENDO = 8;   // acima disso a coluna Fazendo fica vermelha
export const DIAS_PARADO = 7;      // cartão aberto sem mudança há tantos dias fica esmaecido
export const FEITO_VISIVEIS = 20;  // a coluna Feito mostra só as mais recentes

export type Prio = 'baixa' | 'normal' | 'alta' | 'urgente';
export const PRIO: [Prio, string][] = [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];
const PRIO_N: Record<string, number> = { baixa: 0, normal: 1, alta: 2, urgente: 3 };
export const prioOk = (p: unknown): Prio => (typeof p === 'string' && p in PRIO_N ? p as Prio : 'normal');
export const prioNivel = (t: { prioridade: string }) => PRIO_N[t.prioridade] || 0;
export const prioNome = (p: string) => (PRIO.find(x => x[0] === p) || PRIO[1])[1];

export const CORES_ETIQUETA: [string, string, string][] = [['vermelho', 'Vermelho', '#D92D20'], ['laranja', 'Laranja', '#E8590C'], ['amarelo', 'Amarelo', '#CA8A04'],
  ['verde', 'Verde', '#16A34A'], ['azul', 'Azul', '#2563EB'], ['roxo', 'Roxo', '#7C3AED'], ['rosa', 'Rosa', '#DB2777'], ['cinza', 'Cinza', '#64748B']];
export const corDaEtiqueta = (cor: string) => (CORES_ETIQUETA.find(x => x[0] === cor) || [0, 0, '#64748B'])[2] as string;

export const FREQ: Record<string, string> = { semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral' };

// ---- correção ao salvar: primeira letra maiúscula e acento das palavras comuns da vara ----
// Só entram palavras que SEM acento não existem (ou quase não se usam); acrescente outras aqui: "sem acento": "com acento"
export const ACENTOS: Record<string, string> = {
  intimacao: 'intimação', intimacoes: 'intimações', citacao: 'citação', citacoes: 'citações', notificacao: 'notificação', notificacoes: 'notificações',
  audiencia: 'audiência', audiencias: 'audiências', pericia: 'perícia', pericias: 'perícias', certidao: 'certidão', certidoes: 'certidões',
  oficio: 'ofício', oficios: 'ofícios', peticao: 'petição', peticoes: 'petições', decisao: 'decisão', decisoes: 'decisões',
  sentenca: 'sentença', sentencas: 'sentenças', acordao: 'acórdão', acordaos: 'acórdãos', juizo: 'juízo', reu: 'réu', reus: 'réus',
  manifestacao: 'manifestação', manifestacoes: 'manifestações', contestacao: 'contestação', publicacao: 'publicação', distribuicao: 'distribuição',
  conclusao: 'conclusão', execucao: 'execução', avaliacao: 'avaliação', precatoria: 'precatória', precatorias: 'precatórias', precatorio: 'precatório',
  requisicao: 'requisição', informacao: 'informação', informacoes: 'informações', documentacao: 'documentação', comunicacao: 'comunicação',
  expedicao: 'expedição', apreensao: 'apreensão', orgao: 'órgão', orgaos: 'órgãos', acao: 'ação', acoes: 'ações',
  conciliacao: 'conciliação', mediacao: 'mediação', instrucao: 'instrução', designacao: 'designação', redesignacao: 'redesignação',
  habilitacao: 'habilitação', procuracao: 'procuração', honorarios: 'honorários', alvara: 'alvará', alvaras: 'alvarás',
  cartorio: 'cartório', relatorio: 'relatório', relatorios: 'relatórios', estatistica: 'estatística', correicao: 'correição', plantao: 'plantão',
  reuniao: 'reunião', diligencia: 'diligência', diligencias: 'diligências', ciencia: 'ciência', pendencia: 'pendência', pendencias: 'pendências',
  urgencia: 'urgência', conferencia: 'conferência', eletronico: 'eletrônico', eletronica: 'eletrônica', endereco: 'endereço', enderecos: 'endereços',
  materia: 'matéria', codigo: 'código', periodo: 'período', medico: 'médico', medica: 'médica', psicologico: 'psicológico', psicologica: 'psicológica',
  transito: 'trânsito', previdenciario: 'previdenciário', previdenciaria: 'previdenciária', indenizacao: 'indenização', pensao: 'pensão',
  alimenticia: 'alimentícia', uniao: 'união', divorcio: 'divórcio', inventario: 'inventário', usucapiao: 'usucapião',
  impugnacao: 'impugnação', apelacao: 'apelação',
  nao: 'não', tambem: 'também', voce: 'você', proximo: 'próximo', proxima: 'próxima',
  numero: 'número', numeros: 'números', titulo: 'título', responsavel: 'responsável', disponivel: 'disponível', possivel: 'possível',
  edicao: 'edição', revisao: 'revisão', situacao: 'situação', solicitacao: 'solicitação', atualizacao: 'atualização', organizacao: 'organização'
};

function caixa(orig: string, nova: string): string {
  if (orig === orig.toUpperCase() && orig.length > 1) return nova.toUpperCase();
  if (orig.charAt(0) === orig.charAt(0).toUpperCase()) return nova.charAt(0).toUpperCase() + nova.slice(1);
  return nova;
}
export function corrige(txt: string | null | undefined): string {
  const t = String(txt || '').replace(/[A-Za-z]+/g, w => {
    const c = ACENTOS[w.toLowerCase()];
    return c ? caixa(w, c) : w;
  }).trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---- tipos ----
export type Item = { t: string; ok: boolean };
export type Conclusao = { horas?: number; minutos?: number; conformidade?: string; dificuldade?: boolean; dificuldade_desc?: string; precisa_acao?: boolean; em?: string };
export type Tarefa = {
  id: string; titulo: string; prazo: Date | null; prioridade: Prio; urgente: boolean; responsavel: string; processo: string; feitaEm: Date | null;
  etapa: string; etiquetas: string[]; checklist: Item[]; posicao: number | null; ordemLista: number | null; arquivadaEm: Date | null;
  dono: string | null; doGestor: boolean; conclusao: Conclusao | null; conferencia: string | null; modeloTexto: string | null;
  enviadaPor: string | null; recadoGestor: string; enviadaEm: Date | null; apareceEm: Date | null; criada: Date | null; atualizada: Date | null;
};
export type Coluna = { chave: string; nome: string };
export type Etiqueta = { id: string; nome: string; cor: string };
export type Anotacao = { id: string; tarefa: string; texto: string; criada: Date };
export type Pessoa = { id: string; nome: string; ativo: boolean };
export type Lembrete = { id: string; data: Date; feitoEm: Date | null };
export type Rotina = { id: string; frequencia: string; feitaEm: Date | null };
export type Dados = {
  tarefas: Tarefa[]; colunas: Coluna[]; etiquetas: Etiqueta[]; anotacoes: Anotacao[]; pessoas: Pessoa[]; lembretes: Lembrete[]; rotinas: Rotina[];
  euNome: string; temEquipe: boolean; temConf: boolean; temCadastro: boolean; temOrdem: boolean; temChecklist: boolean; temExtras: boolean; arqLivre: boolean;
  aniversarios: { mes: number }[] | null; aConferir: number;
};
type Linha = Record<string, any>;   // resposta do banco (org_carregar), que traz vários formatos

export function tarefaDe(t: Linha, chaves: string[] | null): Tarefa {
  const pr = prioOk(t.prioridade || (t.urgente ? 'urgente' : 'normal'));
  const dia = (v: unknown) => (v ? new Date(String(v).slice(0, 10) + 'T00:00') : null);
  return {
    id: t.id, titulo: t.titulo || '', prazo: dia(t.prazo), prioridade: pr, urgente: pr === 'urgente',
    responsavel: t.responsavel || '', processo: t.processo || '', feitaEm: t.feita_em ? new Date(t.feita_em) : null,
    etapa: !chaves || chaves.includes(t.etapa) ? t.etapa : (t.feita_em ? 'feito' : 'afazer'),
    etiquetas: Array.isArray(t.etiquetas) ? t.etiquetas : [],
    checklist: Array.isArray(t.checklist) ? t.checklist.map((i: Linha) => ({ t: String((i && i.t) || ''), ok: !!(i && i.ok) })) : [],
    posicao: typeof t.posicao === 'number' ? t.posicao : null, ordemLista: typeof t.ordem_lista === 'number' ? t.ordem_lista : null,
    arquivadaEm: t.arquivada_em ? new Date(t.arquivada_em) : null,
    dono: t.dono || null, doGestor: !!t.do_gestor, conclusao: t.conclusao && typeof t.conclusao === 'object' ? t.conclusao : null,
    conferencia: t.conferencia || null, modeloTexto: t.modelo_texto || null,
    enviadaPor: t.enviada_por || null, recadoGestor: t.recado_gestor || '', enviadaEm: t.enviada_em ? new Date(t.enviada_em) : null,
    apareceEm: dia(t.aparece_em), criada: t.created_at ? new Date(t.created_at) : null, atualizada: t.updated_at ? new Date(t.updated_at) : null
  };
}

// Colunas: A fazer sempre primeiro, Feito sempre por último, as outras na ordem cadastrada
export function colunasDe(r: Linha): { colunas: Coluna[]; etiquetas: Etiqueta[]; temCadastro: boolean } {
  if (!Array.isArray(r.colunas)) return { colunas: ETAPAS.map(c => ({ chave: c[0], nome: c[1] })), etiquetas: [], temCadastro: false };
  const nome = (k: string, padrao: string) => { const c = r.colunas.find((x: Linha) => x.chave === k); return c && c.nome ? c.nome as string : padrao; };
  const meio = r.colunas.filter((c: Linha) => c.chave !== 'afazer' && c.chave !== 'feito')
    .sort((a: Linha, b: Linha) => (a.ordem || 0) - (b.ordem || 0))
    .map((c: Linha) => ({ chave: c.chave as string, nome: (c.nome || 'Sem nome') as string }));
  return {
    colunas: [{ chave: 'afazer', nome: nome('afazer', 'A fazer') }, ...meio, { chave: 'feito', nome: nome('feito', 'Feito') }],
    etiquetas: (r.etiquetas || []).map((e: Linha) => ({ id: e.id, nome: e.nome || '', cor: e.cor || 'azul' })),
    temCadastro: true
  };
}

// A resposta de org_carregar (ou de org_listar) já em objetos do sistema
export function lerDados(r: Linha): Dados {
  const q = colunasDe(r);
  const chaves = q.colunas.map(c => c.chave);
  return {
    tarefas: (r.tarefas || []).map((t: Linha) => tarefaDe(t, chaves)),
    colunas: q.colunas, etiquetas: q.etiquetas, temCadastro: q.temCadastro,
    anotacoes: (r.anotacoes || []).map((a: Linha) => ({ id: a.id, tarefa: a.tarefa_id, texto: a.texto || '', criada: new Date(a.created_at) })),
    pessoas: (r.pessoas || []).map((p: Linha) => ({ id: p.id, nome: p.nome || '', ativo: p.ativo !== false })),
    lembretes: (r.lembretes || []).map((l: Linha) => ({ id: l.id, data: new Date(l.data + 'T00:00'), feitoEm: l.feito_em ? new Date(l.feito_em) : null })),
    rotinas: (r.rotinas || []).map((x: Linha) => ({ id: x.id, frequencia: FREQ[x.frequencia] ? x.frequencia : 'mensal', feitaEm: x.feita_em ? new Date(x.feita_em) : null })),
    euNome: r.pessoa && r.pessoa.nome ? r.pessoa.nome : '',
    temEquipe: r.equipe === true, temConf: r.conferencia === true, temOrdem: r.ordem === true, temChecklist: r.checklist === true,
    temExtras: Array.isArray(r.modelos), arqLivre: r.arquivar_livre === true,
    aniversarios: Array.isArray(r.aniversarios) ? r.aniversarios.map((a: Linha) => ({ mes: +a.mes })) : null,
    aConferir: typeof r.equipe_conferir === 'number' ? r.equipe_conferir : 0
  };
}

// ---- datas ----
export const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Dias de hoje até a data (negativo = já passou)
export const diasAte = (d: Date, hoje: Date) => Math.round((d.getTime() - inicioDoDia(hoje).getTime()) / 86400000);
export const diaMes = (d: Date) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');

export function periodoInicio(freq: string, hoje: Date): Date {
  const d = inicioDoDia(hoje);
  if (freq === 'semanal') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (freq === 'mensal') d.setDate(1);
  else d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  return d;
}
export const rotinaFeita = (r: Rotina, hoje: Date) => !!(r.feitaEm && r.feitaEm >= periodoInicio(r.frequencia, hoje));

// ---- quadro ----
export const aberta = (t: Tarefa) => t.etapa !== 'feito';
export const arquivada = (t: Tarefa) => !!t.arquivadaEm;
export const emConferencia = (t: Tarefa) => t.conferencia === 'enviada';
// Agendada: ainda não aparece na tela da pessoa (só o gestor vê)
export const agendada = (t: Tarefa, hoje: Date) => !!t.apareceEm && aberta(t) && diasAte(t.apareceEm, hoje) > 0;

export function diasParado(t: Tarefa, hoje: Date): number {
  if (t.etapa === 'feito' || !t.atualizada) return 0;
  const d = Math.floor((inicioDoDia(hoje).getTime() - inicioDoDia(t.atualizada).getTime()) / 86400000);
  return d >= DIAS_PARADO ? d : 0;
}

export type Util = (d: Date) => boolean;
// Dias úteis depois de "a" até "b", inclusive
function diasUteisEntre(a: Date, b: Date, util: Util): number {
  const d = inicioDoDia(a), fim = inicioDoDia(b);
  let c = 0;
  while (d < fim){ d.setDate(d.getDate() + 1); if (util(d)) c++; }
  return c;
}

// Selo do prazo: atrasada (vermelho), vence hoje (laranja), vence em até 2 dias úteis (amarelo)
export function seloPrazo(t: Tarefa, hoje: Date, util: Util): { cls: string; txt: string } | null {
  if (!t.prazo) return null;
  const df = diasAte(t.prazo, hoje);
  if (t.etapa === 'feito') return { cls: '', txt: 'Prazo ' + diaMes(t.prazo) };
  if (df < 0) return { cls: 'late', txt: 'Atrasada · ' + diaMes(t.prazo) };
  if (df === 0) return { cls: 'hoje', txt: 'Vence hoje' };
  if (diasUteisEntre(hoje, t.prazo, util) <= 2) return { cls: 'breve', txt: df === 1 ? 'Vence amanhã' : 'Vence ' + diaMes(t.prazo) };
  return { cls: '', txt: 'Prazo ' + diaMes(t.prazo) };
}

export type FiltroQuadro = { q: string; resp: string; prazo: string; etq: string };
export const SEM_FILTRO: FiltroQuadro = { q: '', resp: '', prazo: '', etq: '' };
export const filtroAtivo = (f: FiltroQuadro) => !!(f.q || f.resp || f.prazo || f.etq);
export const CHIPS_PRAZO: [string, string][] = [['', 'Todas'], ['atrasadas', 'Atrasadas'], ['hoje', 'Vence hoje'], ['semana', 'Próximos 7 dias'], ['urgentes', 'Urgentes'], ['parados', 'Paradas']];

export function passaNoFiltro(t: Tarefa, f: FiltroQuadro, hoje: Date): boolean {
  const abre = aberta(t), df = t.prazo ? diasAte(t.prazo, hoje) : null;
  if (f.resp === '-' ? !!t.responsavel : (f.resp && t.responsavel !== f.resp)) return false;
  if (f.prazo === 'atrasadas' && !(abre && df !== null && df < 0)) return false;
  if (f.prazo === 'hoje' && !(abre && df === 0)) return false;
  if (f.prazo === 'semana' && !(abre && df !== null && df >= 0 && df <= 7)) return false;
  if (f.prazo === 'urgentes' && !(abre && t.urgente)) return false;
  if (f.prazo === 'parados' && !diasParado(t, hoje)) return false;
  if (f.etq && !t.etiquetas.includes(f.etq)) return false;
  if (f.q){
    const dig = soDigitos(f.q);
    const noTitulo = normalizar(t.titulo).includes(normalizar(f.q));
    const noProc = dig.length >= 3 && soDigitos(t.processo).includes(dig);
    if (!noTitulo && !noProc) return false;
  }
  return true;
}

// Responsáveis do filtro: os de sempre e os que já aparecem nas tarefas
export function responsaveisDoFiltro(tarefas: Tarefa[]): string[] {
  const lista = RESPS.slice();
  tarefas.forEach(t => { if (t.responsavel && !lista.includes(t.responsavel)) lista.push(t.responsavel); });
  return lista;
}

// Ordem dos cartões na coluna: primeiro os que têm posição definida (arrastados),
// depois os demais por prazo e urgência. Em Feito, as mais recentes primeiro.
export function ordenaColuna(lista: Tarefa[], chave: string): Tarefa[] {
  return lista.slice().sort((a, b) => {
    if (chave === 'feito') return (b.feitaEm?.getTime() || 0) - (a.feitaEm?.getTime() || 0);
    const pa = a.posicao === null ? Infinity : a.posicao, pb = b.posicao === null ? Infinity : b.posicao;
    if (pa !== pb) return pa < pb ? -1 : 1;
    return ((a.prazo?.getTime() || 8.64e15) - (b.prazo?.getTime() || 8.64e15)) || (prioNivel(b) - prioNivel(a));
  });
}
export const podeOrdenar = (temOrdem: boolean, chave: string) => temOrdem && chave !== 'feito';

// Põe o cartão antes de "antesDe" (null = no fim) na coluna dele e devolve os ids na nova ordem
export function novaOrdem(tarefas: Tarefa[], t: Tarefa, antesDe: string | null): string[] {
  const lista = ordenaColuna(tarefas.filter(x => x.etapa === t.etapa && x.id !== t.id), t.etapa);
  const i = lista.findIndex(x => x.id === antesDe);
  lista.splice(i === -1 ? lista.length : i, 0, t);
  return lista.map(x => x.id);
}

// Tarefa mandada pelo gestor, vista pela pessoa: não pode ser excluída nem arquivada antes de concluída
export const protegida = (t: Tarefa, modoPessoa: boolean) => modoPessoa && t.doGestor;
// A pessoa não muda a etapa enquanto o gestor confere
export const travada = (t: Tarefa, modoPessoa: boolean) => modoPessoa && emConferencia(t);
// Tarefa mandada pelo gestor: ao ir para a última coluna, a pessoa responde o fechamento
export const pedeFechamento = (t: Tarefa, modoPessoa: boolean) => modoPessoa && t.doGestor && !t.conclusao;

// Separa o nº do processo (padrão CNJ, com ou sem pontuação) do texto da tarefa.
// "0001234-56.2026.8.11.0001 juntar AR" -> título "juntar AR", processo "0001234-56.2026.8.11.0001"
export function separaProcesso(txt: string): { titulo: string; processo: string } {
  txt = String(txt || '');
  const m = txt.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/) || txt.match(/(?:\d[\s.\-]*){20}/);
  if (!m || soDigitos(m[0]).length !== 20) return { titulo: txt.trim(), processo: '' };
  const proc = formatarProcesso(soDigitos(m[0]));
  const sep = /^[\s,;:\-–—]+|[\s,;:\-–—]+$/g;
  const resto = (txt.slice(0, m.index) + ' ' + txt.slice((m.index || 0) + m[0].length)).replace(/\s+/g, ' ').replace(sep, '')
    .replace(/(?:^|\s)(?:processo|proc\.?|autos)\s*(?:n[º°o]?\.?)?$/i, '').replace(sep, '').trim();
  return { titulo: resto || 'Processo ' + proc, processo: proc };
}

// Argumentos de org_salvar_tarefa
export function paraSalvar(t: { id?: string | null; titulo: string; prazo: Date | null; prioridade: string; responsavel: string; processo: string; feitaEm: Date | null; etapa: string }){
  return {
    p_id: t.id || null, p_titulo: corrige(t.titulo), p_prazo: t.prazo ? chaveDoDia(t.prazo) : null, p_prioridade: prioOk(t.prioridade),
    p_responsavel: t.responsavel || '', p_processo: t.processo || '', p_feita_em: t.feitaEm ? t.feitaEm.toISOString() : null,
    p_etapa: t.etapa || (t.feitaEm ? 'feito' : 'afazer')
  };
}

// ---- entrada ----
export function mensagemDoStatus(st: string, modoPessoa: boolean): string {
  if (st === 'senha') return modoPessoa ? '' : 'Senha incorreta.';
  if (st === 'bloqueado') return 'Muitas tentativas erradas. Aguarde 5 minutos e tente de novo.';
  if (st === 'sem_config') return 'A senha ainda não foi configurada no Supabase (veja o LEIA-ME.md).';
  if (st === 'sem_pessoa') return 'Este nome não está mais liberado. Fale com o gestor.';
  return '';
}
export function iniciais(nome: string): string {
  const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}
