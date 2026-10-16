// Organização: regras comuns às partes (o mesmo do sistema atual). Os dados vêm das funções org_* do
// sql/organizacao.sql, sempre com a senha do gestor ou a pessoa que entrou pelo nome.
import { chaveDoDia } from './datas.ts';
import { formatarProcesso, soDigitos } from './processo.ts';

// ---- correção ao salvar: primeira letra maiúscula e acento das palavras comuns da vara ----
// Só entram palavras que SEM acento não existem (ou quase não se usam): "sem acento": "com acento"
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
function caixa(orig: string, nova: string){
  if (orig === orig.toUpperCase() && orig.length > 1) return nova.toUpperCase();
  if (orig.charAt(0) === orig.charAt(0).toUpperCase()) return nova.charAt(0).toUpperCase() + nova.slice(1);
  return nova;
}
export function corrige(txt: unknown): string {
  const t = String(txt || '').replace(/[A-Za-z]+/g, w => { const c = ACENTOS[w.toLowerCase()]; return c ? caixa(w, c) : w; }).trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---- prioridade em 4 níveis ----
export type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export const PRIO: [Prioridade, string][] = [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];
const PRIO_N: Record<Prioridade, number> = { baixa: 0, normal: 1, alta: 2, urgente: 3 };
export const prioOk = (p: unknown): Prioridade => (typeof p === 'string' && p in PRIO_N ? p as Prioridade : 'normal');
export const prioN = (p: Prioridade) => PRIO_N[p] || 0;
export const prioNome = (p: Prioridade) => (PRIO.find(x => x[0] === p) || PRIO[1])[1];

export const CORES = ['amarelo', 'verde', 'rosa', 'azul'];
export const RESPONSAVEIS = ['Gestor', 'Secretaria', 'Cartório', 'Assessoria', 'Gabinete'];
export const ROTACAO = ['-0.8deg', '0.6deg', '-0.3deg', '0.9deg', '-0.6deg', '0.4deg'];
export type Frequencia = 'semanal' | 'mensal' | 'trimestral';
export const FREQ: Record<Frequencia, string> = { semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral' };
export const PERIODO: Record<Frequencia, string> = { semanal: 'nesta semana', mensal: 'neste mês', trimestral: 'neste trimestre' };

// ---- dados vindos do banco ----
const diaLocal = (s: unknown) => (s ? new Date(String(s).slice(0, 10) + 'T00:00') : null);
export type Tarefa = {
  id: string; titulo: string; prazo: Date | null; prioridade: Prioridade; urgente: boolean; responsavel: string; processo: string;
  feitaEm: Date | null; etapa: string; etiquetas: string[]; checklist: { t: string; ok: boolean }[]; posicao: number | null;
  ordemLista: number | null; arquivadaEm: Date | null; dono: string | null; doGestor: boolean; conclusao: Record<string, unknown> | null;
  conferencia: string | null; confHist: { a: string; em: string; t?: string }[]; modeloTexto: string | null;
  enviadaPor: string | null; recadoGestor: string; enviadaEm: Date | null; apareceEm: Date | null; criada: Date | null; atualizada: Date | null;
};
export function tarefaDe(t: Record<string, unknown>, chaves: string[] | null): Tarefa {
  const pr = prioOk(t.prioridade || (t.urgente ? 'urgente' : 'normal'));
  const etapa = String(t.etapa || '');
  return {
    id: String(t.id), titulo: (t.titulo as string) || '', prazo: diaLocal(t.prazo), prioridade: pr, urgente: pr === 'urgente',
    responsavel: (t.responsavel as string) || '', processo: (t.processo as string) || '', feitaEm: t.feita_em ? new Date(t.feita_em as string) : null,
    etapa: !chaves || chaves.includes(etapa) ? etapa : (t.feita_em ? 'feito' : 'afazer'),
    etiquetas: Array.isArray(t.etiquetas) ? t.etiquetas as string[] : [],
    checklist: Array.isArray(t.checklist) ? (t.checklist as { t?: unknown; ok?: unknown }[]).map(i => ({ t: String(i && i.t || ''), ok: !!(i && i.ok) })) : [],
    posicao: typeof t.posicao === 'number' ? t.posicao : null, ordemLista: typeof t.ordem_lista === 'number' ? t.ordem_lista : null,
    arquivadaEm: t.arquivada_em ? new Date(t.arquivada_em as string) : null, dono: (t.dono as string) || null, doGestor: !!t.do_gestor,
    conclusao: t.conclusao && typeof t.conclusao === 'object' ? t.conclusao as Record<string, unknown> : null,
    conferencia: (t.conferencia as string) || null, confHist: Array.isArray(t.conf_hist) ? t.conf_hist as Tarefa['confHist'] : [],
    modeloTexto: (t.modelo_texto as string) || null, enviadaPor: (t.enviada_por as string) || null, recadoGestor: (t.recado_gestor as string) || '',
    enviadaEm: t.enviada_em ? new Date(t.enviada_em as string) : null, apareceEm: diaLocal(t.aparece_em),
    criada: t.created_at ? new Date(t.created_at as string) : null, atualizada: t.updated_at ? new Date(t.updated_at as string) : null
  };
}
export type Nota = { id: string; texto: string; titulo: string; cor: string; fixada: boolean; criada: Date };
export const notaDe = (n: Record<string, unknown>): Nota => ({
  id: String(n.id), texto: (n.texto as string) || '', titulo: (n.titulo as string) || '',
  cor: CORES.includes(n.cor as string) ? n.cor as string : 'amarelo', fixada: !!n.fixada, criada: new Date(n.created_at as string)
});
export type Lembrete = { id: string; texto: string; data: Date; hora: string; processo: string; feitoEm: Date | null };
export const lembreteDe = (l: Record<string, unknown>): Lembrete => ({
  id: String(l.id), texto: (l.texto as string) || '', data: new Date(l.data + 'T00:00'), hora: l.hora ? String(l.hora).slice(0, 5) : '',
  processo: (l.processo as string) || '', feitoEm: l.feito_em ? new Date(l.feito_em as string) : null
});
export type Rotina = { id: string; titulo: string; frequencia: Frequencia; feitaEm: Date | null };
export const rotinaDe = (x: Record<string, unknown>): Rotina => ({
  id: String(x.id), titulo: (x.titulo as string) || '', frequencia: (x.frequencia as Frequencia) in FREQ ? x.frequencia as Frequencia : 'mensal',
  feitaEm: x.feita_em ? new Date(x.feita_em as string) : null
});
export type Pessoa = { id: string; nome: string; ativo: boolean };

// Situação devolvida pelo banco → mensagem na tela de entrada
export function mensagemDoStatus(st: string, pessoa: boolean): string {
  if (st === 'senha') return pessoa ? '' : 'Senha incorreta.';
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

// ---- datas ----
const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Dias da data até hoje (negativo = já passou)
export const diferenca = (d: Date, agora: Date) => Math.round((d.getTime() - inicioDoDia(agora).getTime()) / 86400000);
const dois = (n: number) => (n < 10 ? '0' : '') + n;
export const diaMes = (d: Date) => dois(d.getDate()) + '/' + dois(d.getMonth() + 1);
export const horaDe = (d: Date) => dois(d.getHours()) + ':' + dois(d.getMinutes());
export const chave = chaveDoDia;

// Título com o número do processo dentro: separa os dois
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

// ---- lista "Tarefas e mural": grupos por prazo ----
export function gruposDaLista(tarefas: Tarefa[], agora: Date): { nome: string; itens: Tarefa[] }[] {
  const df = (t: Tarefa) => diferenca(t.prazo!, agora);
  const grupos: { nome: string; f: (t: Tarefa) => boolean; desc?: boolean }[] = [
    { nome: 'Atrasadas', f: t => !t.feitaEm && !!t.prazo && df(t) < 0 },
    { nome: 'Hoje', f: t => !t.feitaEm && !!t.prazo && df(t) === 0 },
    { nome: 'Próximas', f: t => !t.feitaEm && !!t.prazo && df(t) > 0 },
    { nome: 'Sem prazo', f: t => !t.feitaEm && !t.prazo },
    { nome: 'Concluídas', f: t => !!t.feitaEm && !t.arquivadaEm, desc: true }
  ];
  const out: { nome: string; itens: Tarefa[] }[] = [];
  for (const g of grupos){
    let itens = tarefas.filter(t => !t.arquivadaEm && g.f(t)).sort((a, b) => {
      if (g.desc) return b.feitaEm!.getTime() - a.feitaEm!.getTime();
      // a ordem escolhida arrastando vem primeiro; o resto segue por prazo e prioridade
      const oa = a.ordemLista === null ? 1e9 : a.ordemLista, ob = b.ordemLista === null ? 1e9 : b.ordemLista;
      return (oa - ob) || ((a.prazo ? a.prazo.getTime() : 0) - (b.prazo ? b.prazo.getTime() : 0)) || (prioN(b.prioridade) - prioN(a.prioridade));
    });
    if (!itens.length) continue;
    if (g.desc && itens.length > 15) itens = itens.slice(0, 15);
    out.push({ nome: g.nome, itens });
  }
  return out;
}

// ---- lembretes ----
export const lemOrdem = (a: Lembrete, b: Lembrete) => (a.data.getTime() - b.data.getTime()) || (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0);
export function pendentesAte(lembretes: Lembrete[], dias: number, agora: Date){ return lembretes.filter(l => !l.feitoEm && diferenca(l.data, agora) <= dias); }
export function quadroDeLembretes(lembretes: Lembrete[], agora: Date){
  const hm = horaDe(agora);
  const hoje = lembretes.filter(l => diferenca(l.data, agora) === 0).sort(lemOrdem);
  const atrasados = lembretes.filter(l => !l.feitoEm && diferenca(l.data, agora) < 0).sort(lemOrdem);
  const proximos = lembretes.filter(l => !l.feitoEm && diferenca(l.data, agora) > 0).sort(lemOrdem);
  const pendHoje = hoje.filter(l => !l.feitoEm);
  const passouHoje = pendHoje.filter(l => l.hora && l.hora < hm);
  const proximo = pendHoje.find(l => l.hora && l.hora >= hm) || null;
  return { hm, hoje, atrasados, proximos, pendHoje: pendHoje.length, passou: passouHoje.length + atrasados.length, proximo };
}

// ---- rotinas ----
export function inicioDoPeriodo(freq: Frequencia, agora: Date): Date {
  const d = inicioDoDia(agora);
  if (freq === 'semanal') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (freq === 'mensal') d.setDate(1);
  else d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  return d;
}
export const rotinaFeita = (r: Rotina, agora: Date) => !!(r.feitaEm && r.feitaEm >= inicioDoPeriodo(r.frequencia, agora));
export function ordenarRotinas(rotinas: Rotina[], agora: Date): Rotina[] {
  const ordemFreq: Record<Frequencia, number> = { semanal: 0, mensal: 1, trimestral: 2 };
  return rotinas.slice().sort((a, b) => (Number(rotinaFeita(a, agora)) - Number(rotinaFeita(b, agora))) || (ordemFreq[a.frequencia] - ordemFreq[b.frequencia]) || a.titulo.localeCompare(b.titulo));
}

// Itens da lista de "processo já está com alguém"
export type EmUso = { id: string; dono: string | null; dono_nome: string | null; titulo: string; etapa: string; prazo: string | null; conferencia: string | null; coluna: string | null };
export function descreverEmUso(t: EmUso, modoPessoa: boolean, eu: string | null, nomeDe: (id: string) => string): { quem: string; resto: string } {
  const quem = !t.dono ? (modoPessoa ? 'Gestor' : 'Você (seu quadro)') : modoPessoa && t.dono === eu ? 'Você' : (t.dono_nome || nomeDe(t.dono) || 'Pessoa excluída');
  const pz = t.prazo ? new Date(String(t.prazo).slice(0, 10) + 'T00:00') : null;
  const onde = t.conferencia === 'enviada' ? 'em conferência' : (t.coluna || (t.etapa === 'afazer' ? 'A fazer' : 'Em andamento'));
  return { quem, resto: ': ' + (t.titulo || 'Sem título') + ' · ' + onde + (pz ? ' · prazo ' + diaMes(pz) : '') };
}
