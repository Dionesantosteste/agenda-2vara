// Assistente do gestor: busca nas rotinas de secretaria e nos modelos de texto, e conferência
// do que a IA propõe salvar. Funções puras (sem banco nem rede), usadas na rota e na tela.
import { normalizar } from './agenda.ts';

export type Rotina = {
  id: string; titulo: string; assunto: string; quando: string; passos: string[]; observacoes: string;
  alterado_por?: string; updated_at?: string;
};
export type ModeloTexto = { id: string; nome: string; categoria: string; texto: string };

// O que a IA sugere salvar. Só vira registro quando o gestor clica em Salvar.
export type PropostaRotina = { tipo: 'rotina'; titulo: string; assunto: string; quando: string; passos: string[]; observacoes: string };
export type PropostaModelo = { tipo: 'modelo'; nome: string; categoria: string; texto: string };
export type Proposta = PropostaRotina | PropostaModelo;

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max);

// Palavras da busca (sem acento, sem palavras curtas como "de", "o", "a")
export function palavras(termo: string): string[] {
  return normalizar(termo).split(/[^a-z0-9º°]+/).filter(p => p.length > 2 || /\d/.test(p));
}

// Pontua quantas palavras aparecem em cada campo; o título e o assunto valem mais
function pontuar(campos: [string, number][], ps: string[]): number {
  let total = 0;
  for (const p of ps){
    let melhor = 0;
    for (const [c, peso] of campos) if (c.includes(p)) melhor = Math.max(melhor, peso);
    total += melhor;
  }
  return total;
}

export function buscarRotinas(rotinas: Rotina[], termo: string, limite = 8): Rotina[] {
  const ps = palavras(termo);
  if (!ps.length) return rotinas.slice(0, limite);
  return rotinas
    .map(r => ({ r, n: pontuar([[normalizar(r.titulo), 3], [normalizar(r.assunto), 3], [normalizar(r.quando), 2],
      [normalizar((r.passos || []).join(' ')), 1], [normalizar(r.observacoes), 1]], ps) }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limite)
    .map(x => x.r);
}

export function buscarModelos(modelos: ModeloTexto[], termo: string, limite = 10): ModeloTexto[] {
  const ps = palavras(termo);
  if (!ps.length) return modelos.slice(0, limite);
  return modelos
    .map(m => ({ m, n: pontuar([[normalizar(m.nome), 3], [normalizar(m.categoria), 2], [normalizar(m.texto), 1]], ps) }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limite)
    .map(x => x.m);
}

// Rotina em texto corrido, para a IA ler e para copiar
export function rotinaEmTexto(r: Pick<Rotina, 'titulo' | 'assunto' | 'quando' | 'passos' | 'observacoes'>): string {
  const linhas = [r.titulo + (r.assunto ? ' (' + r.assunto + ')' : '')];
  if (r.quando) linhas.push('Quando: ' + r.quando);
  (r.passos || []).forEach((p, i) => linhas.push((i + 1) + '. ' + p));
  if (r.observacoes) linhas.push('Observações: ' + r.observacoes);
  return linhas.join('\n');
}

// Confere a proposta de rotina que veio da IA; devolve null se não der para usar
export function lerPropostaRotina(v: unknown): PropostaRotina | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const passos = (Array.isArray(o.passos) ? o.passos : []).map(p => texto(p, 1000)).filter(Boolean).slice(0, 60);
  const titulo = texto(o.titulo, 120);
  if (!titulo || !passos.length) return null;
  return { tipo: 'rotina', titulo, assunto: texto(o.assunto, 60), quando: texto(o.quando, 500), passos, observacoes: texto(o.observacoes, 4000) };
}

export function lerPropostaModelo(v: unknown): PropostaModelo | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const nome = texto(o.nome, 80);
  const corpo = typeof o.texto === 'string' ? o.texto.trim().slice(0, 20000) : '';
  if (!nome || !corpo) return null;
  return { tipo: 'modelo', nome, categoria: texto(o.categoria, 40), texto: corpo };
}

// Lista de passos digitada pelo gestor (um por linha, aceita "1." ou "-" no começo)
export function passosDoTexto(s: string): string[] {
  return s.split(/\r?\n/).map(l => l.replace(/^\s*(?:\d+[.)-]|[-*•])\s*/, '').trim()).filter(Boolean);
}

// Rotina → tarefas para alguém da equipe (org_mandar_lote): uma tarefa por processo, com os
// passos da rotina como checklist. Sem processo, manda uma tarefa só.
export type ItemTarefa = { titulo: string; para: string; prazo: string; prioridade: string; processo: string };
export function tarefasDaRotina(r: Pick<Rotina, 'titulo' | 'assunto' | 'passos'>, o: { para: string; processos: string[]; prazo: string; prioridade: string }):
  { itens: ItemTarefa[]; checklist: { t: string; ok: boolean }[] } {
  const titulo = ((r.assunto ? r.assunto + ': ' : '') + r.titulo).slice(0, 160);
  const processos = [...new Set(o.processos.map(p => p.trim()).filter(Boolean))].slice(0, 100);
  const itens = (processos.length ? processos : ['']).map(processo => ({ titulo, para: o.para, prazo: o.prazo, prioridade: o.prioridade, processo }));
  return { itens, checklist: (r.passos || []).map(t => ({ t, ok: false })) };
}
