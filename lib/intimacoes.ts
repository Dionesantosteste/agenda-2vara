// Intimações da audiência: quem precisa ser intimado (partes, testemunhas, perito…) e se já foi.
// Fica gravado na coluna "intimacoes" (jsonb) da tabela audiencias — ver sql/audiencias_intimacoes.sql.

export const PAPEIS = ['Autor', 'Réu', 'Testemunha do autor', 'Testemunha do réu', 'Testemunha do juízo', 'Perito', 'Informante', 'Advogado', 'Outro'];
export const MEIOS = ['Mandado', 'AR', 'DJEN (advogado)', 'WhatsApp', 'E-mail', 'Carta precatória', 'Em secretaria', 'Outro'];
export const MOTIVOS = ['Não localizada', 'Mudou-se', 'Endereço insuficiente', 'Faleceu', 'Recusou-se', 'Outro'];
export const PAPEL_PADRAO = 'Testemunha do autor';

// '' = pendente (nada marcado)
export type Situacao = '' | 'intimada' | 'nao' | 'dispensada';
export type Intimacao = { id: string; nome: string; papel: string; meio: string; situacao: Situacao; em: string | null; motivo: string };
export type FiltroIntim = 'todas' | 'pendentes' | 'frustradas';
export const INTIM_FILTROS: { key: FiltroIntim; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendentes', label: 'Com intimação pendente' },
  { key: 'frustradas', label: 'Com intimação frustrada' }
];

const SITUACOES: Situacao[] = ['', 'intimada', 'nao', 'dispensada'];
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function novoId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Lê o que veio do banco, descartando o que não tiver nome
export function lerIntimacoes(v: unknown): Intimacao[] {
  if (!Array.isArray(v)) return [];
  const out: Intimacao[] = [];
  for (const x of v){
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const nome = texto(r.nome, 200);
    if (!nome) continue;
    const situacao = SITUACOES.includes(r.situacao as Situacao) ? r.situacao as Situacao : '';
    out.push({
      id: texto(r.id, 60) || novoId(), nome, papel: texto(r.papel, 60) || 'Outro', meio: texto(r.meio, 60),
      situacao, em: typeof r.em === 'string' && r.em ? r.em : null, motivo: situacao === 'nao' ? texto(r.motivo, 200) : ''
    });
  }
  return out;
}

// Meio de intimação mais comum para o papel
export function meioPadrao(papel: string): string {
  return /^Testemunha|^Informante/.test(papel) ? 'Mandado' : papel === 'Perito' ? 'E-mail' : 'DJEN (advogado)';
}

// Vários nomes de uma vez: um por linha ou separados por ";" (ex.: colados do rol de testemunhas).
// Tira numeração ("1.", "2)", "a -") do começo da linha e ignora nomes que já estão na lista.
export function separarNomes(txt: string, jaTem: Intimacao[] = []): string[] {
  const vistos = new Set(jaTem.map(p => chave(p.nome)));
  const out: string[] = [];
  for (const parte of txt.split(/\r?\n|;/)){
    const nome = parte.replace(/^\s*(\d{1,3}|[a-zA-Z])\s*[-.)–]\s+/, '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!nome || vistos.has(chave(nome))) continue;
    vistos.add(chave(nome));
    out.push(nome);
  }
  return out;
}
const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function adicionar(lista: Intimacao[], nomes: string[], papel: string): Intimacao[] {
  return [...lista, ...nomes.map(nome => ({ id: novoId(), nome, papel, meio: meioPadrao(papel), situacao: '' as Situacao, em: null, motivo: '' }))];
}

// Clicar de novo na mesma situação volta para pendente. Grava quando foi marcada.
export function marcar(lista: Intimacao[], id: string, s: Situacao, agora: Date = new Date()): Intimacao[] {
  return lista.map(p => {
    if (p.id !== id) return p;
    const situacao: Situacao = p.situacao === s ? '' : s;
    return { ...p, situacao, em: situacao && situacao !== 'dispensada' ? agora.toISOString() : null, motivo: situacao === 'nao' ? p.motivo : '' };
  });
}

export function alterar(lista: Intimacao[], id: string, campos: Partial<Pick<Intimacao, 'meio' | 'motivo' | 'papel' | 'nome'>>): Intimacao[] {
  return lista.map(p => (p.id === id ? { ...p, ...campos } : p));
}
export const remover = (lista: Intimacao[], id: string) => lista.filter(p => p.id !== id);

// Os dispensados não contam
export function contagem(lista: Intimacao[]){
  const ativos = lista.filter(p => p.situacao !== 'dispensada');
  const intimadas = ativos.filter(p => p.situacao === 'intimada').length, nao = ativos.filter(p => p.situacao === 'nao').length;
  return { total: ativos.length, intimadas, nao, pendentes: ativos.length - intimadas - nao };
}
// Todo mundo intimado: dá para sugerir o status "Intimações feitas"
export function todasIntimadas(lista: Intimacao[]): boolean {
  const c = contagem(lista);
  return c.total > 0 && c.intimadas === c.total;
}
export function combinaIntim(lista: Intimacao[], f: FiltroIntim): boolean {
  if (f === 'todas') return true;
  const c = contagem(lista);
  return f === 'frustradas' ? c.nao > 0 : c.pendentes > 0 || c.nao > 0;
}

// "3/5 intimados · 1 não intimado"
export function resumoIntim(lista: Intimacao[]): string {
  const c = contagem(lista);
  if (!lista.length) return 'Intimações';
  if (!c.total) return 'Todos dispensados';
  return c.intimadas + '/' + c.total + ' ' + (c.total === 1 ? 'intimado' : 'intimados') + (c.nao ? ' · ' + c.nao + (c.nao === 1 ? ' não intimado' : ' não intimados') : '');
}

// Linha da pauta impressa: "✓ Fulano (Testemunha do autor) · ✗ Beltrano — Mudou-se"
export function linhaDaImpressao(p: Intimacao): string {
  const marca = p.situacao === 'intimada' ? '✓' : p.situacao === 'nao' ? '✗' : p.situacao === 'dispensada' ? '–' : '☐';
  return marca + ' ' + p.nome + ' (' + p.papel + ')' + (p.situacao === 'nao' && p.motivo ? ' — ' + p.motivo : '') + (p.situacao === 'dispensada' ? ' — dispensado' : '');
}
