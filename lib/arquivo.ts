// Arquivo de processos físicos: regras que não dependem da tela (busca, prateleiras, pendências).
// As mesmas do protótipo aprovado; os testes ficam em lib/arquivo.test.ts.

export type Local = [number, string];   // [prateleira, fileira]
export type Caixa = { id: string; nome: string; locais: Local[]; secretaria: boolean };
export type Processo = {
  id: string; codigo: string; caixa_id: string; origem_id: string | null; situacao: number;
  com_quem: string; destino: string; numero: string; classe: string; partes: string; ano: string; obs: string;
  volumes_ok: boolean; excluido: boolean;
};

export const SITUACOES = ['Arquivado', 'Em outra secretaria', 'Para desarquivar', 'Desarquivado', 'Remetido a outra vara'];
export const ARQUIVADO = 0, EM_SECRETARIA = 1, PARA_DESARQUIVAR = 2, DESARQUIVADO = 3, REMETIDO = 4;
export const NAO_INFORMADA = 'Não informada';   // caixa da secretaria quando a planilha não diz qual

const sem0 = (s: string) => s.replace(/^0+(?=\d)/, '');
export const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Ano com dois dígitos vira quatro (87 -> 1987, 05 -> 2005)
export function anoCompleto(a: string): string {
  return a.length === 2 ? (+a > 30 ? '19' : '20') + a : a;
}

// Numeração antiga "224/87": número e ano; null se não for desse formato
export function numeroAntigo(v: string): [string, string] | null {
  const m = String(v || '').trim().match(/^0*(\d+)\s*\/+\s*(\d{2,4})$/);
  return m ? [m[1], anoCompleto(m[2])] : null;
}

// Chave para comparar números: "224/87" = "0224/1987"; CNJ e códigos só pelos dígitos
export function chaveNum(v: string | null | undefined): string {
  const t = String(v || '').trim();
  if (!t) return '';
  const a = numeroAntigo(t);
  if (a) return a[0] + '/' + a[1];
  return t.replace(/\D/g, '').replace(/^0+/, '');
}

export function ordemCaixa(a: Caixa, b: Caixa): number {
  return (parseInt(a.nome) || 0) - (parseInt(b.nome) || 0) || a.nome.localeCompare(b.nome);
}

export function textoLocal(c: Caixa): string {
  if (c.secretaria) return 'estante da Outra Secretaria (' + c.nome + ')';
  if (!c.locais.length) return 'sem prateleira anotada';
  return c.locais.map(l => 'prateleira ' + l[0] + ', fileira ' + l[1]).join(' ou ');
}

// ---------- busca ----------
export type GrupoBusca = { tipo: 0 | 1 | 2 | 3; codigos: string[] };   // 0 igual, 1 começa com, 2 contém, 3 nas partes/classe/obs
export type ResultadoBusca =
  | { modo: 'vazio' }
  | { modo: 'caixas'; alvo: string; caixas: Caixa[] }
  | { modo: 'processos'; total: number; grupos: GrupoBusca[]; trecho: string; exato: [string, string] | null };

// Busca no índice código -> processos. "cx 1320" procura caixa; o resto procura processo.
export function buscar(txt: string, indice: Map<string, Processo[]>, caixas: Caixa[], limite = 40): ResultadoBusca {
  const t = txt.trim();
  if (!t) return { modo: 'vazio' };
  const mcx = t.match(/^(?:cx|caixa)\.?\s*(.+)$/i);
  if (mcx){
    const alvo = mcx[1].trim().toUpperCase().replace(/\s+/g, '-');
    const achadas = caixas.filter(c => c.nome.toUpperCase().startsWith(alvo))
      .sort((a, b) => Number(b.nome.toUpperCase() === alvo) - Number(a.nome.toUpperCase() === alvo) || ordemCaixa(a, b)).slice(0, 30);
    return { modo: 'caixas', alvo, caixas: achadas };
  }
  const alvo = sem0(t.replace(/\s+/g, ''));
  const temBarra = alvo.includes('/');
  const dig = sem0(alvo.replace(/\D/g, ''));
  const pq = temBarra ? numeroAntigo(alvo) : null;
  const achados: [number, number, string][] = [];
  for (const [cod, ps] of indice){
    let n = -1;
    const pc = numeroAntigo(cod);
    const base = pc ? pc[0] : sem0(cod);
    if (cod === alvo) n = 0;
    else if (temBarra){
      if (pq && pc && pq[0] === pc[0] && pq[1] === pc[1]) n = 0;
      else if (cod.startsWith(alvo)) n = 1;
      else if (cod.includes(alvo)) n = 2;
    } else if (dig && /\d/.test(alvo)){
      if (base === dig) n = 0;
      else if (dig.length >= 2 && base.startsWith(dig)) n = 1;
      else if (dig.length >= 4 && cod.replace(/\D/g, '').includes(dig)) n = 2;
      else if (dig.length >= 4 && ps.some(p => p.numero && p.numero.replace(/\D/g, '').includes(dig))) n = 2;
    } else if (alvo.length >= 3 && ps.some(p => norm([p.partes, p.classe, p.numero, p.obs].join(' ')).includes(norm(t)))) n = 3;
    if (n >= 0) achados.push([n, base.length, cod]);
  }
  achados.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (parseInt(a[2]) || 0) - (parseInt(b[2]) || 0) || a[2].localeCompare(b[2]));
  const grupos: GrupoBusca[] = [];
  for (const [n, , cod] of achados.slice(0, limite)){
    const ult = grupos[grupos.length - 1];
    if (ult && ult.tipo === n) ult.codigos.push(cod); else grupos.push({ tipo: n as GrupoBusca['tipo'], codigos: [cod] });
  }
  return { modo: 'processos', total: achados.length, grupos, trecho: temBarra ? alvo : dig, exato: pq };
}

// Onde destacar o trecho buscado dentro do código: [antes, trecho, depois] ou null
export function destaque(cod: string, trecho: string, exato: [string, string] | null): [string, string, string] | null {
  const pc = numeroAntigo(cod);
  if (exato && pc && exato[0] === pc[0] && exato[1] === pc[1]) return ['', cod, ''];
  if (!trecho) return null;
  const i = cod.indexOf(trecho);
  return i < 0 ? null : [cod.slice(0, i), cod.slice(i, i + trecho.length), cod.slice(i + trecho.length)];
}

// ---------- filtro das prateleiras: "P25", "prateleira 25 fileira b", "OS" ----------
export type FiltroPrateleira = { tipo: 'prateleira'; p: number; f: string | null } | { tipo: 'secretaria' } | { tipo: 'caixa'; alvo: string } | { tipo: 'nenhum' };
export function filtroPrateleira(txt: string): FiltroPrateleira {
  const t = txt.trim().toUpperCase();
  if (!t) return { tipo: 'nenhum' };
  const m = t.match(/^(?:P|PRAT|PRATELEIRA)\.?\s*(\d+)(?:\s*[-,·]?\s*(?:F|FIL|FILEIRA)?\.?\s*([A-Z]))?$/);
  if (m) return { tipo: 'prateleira', p: +m[1], f: m[2] || null };
  if (/^(OS|SEC|SECRETARIA|OUTRA)/.test(t)) return { tipo: 'secretaria' };
  return { tipo: 'caixa', alvo: t };
}

// ---------- pendências ----------
export function indexar(processos: Processo[]): Map<string, Processo[]> {
  const m = new Map<string, Processo[]>();
  for (const p of processos){ if (p.excluido) continue; const l = m.get(p.codigo); if (l) l.push(p); else m.set(p.codigo, [p]); }
  return m;
}

export function pendenciasDe(p: Processo, caixa: Caixa | undefined, indice: Map<string, Processo[]>): string[] {
  const l: string[] = [];
  if (caixa && !caixa.secretaria && !caixa.locais.length) l.push('caixa sem prateleira');
  if (caixa && caixa.locais.length > 1) l.push('caixa anotada em 2 lugares');
  const n = (indice.get(p.codigo) || []).length;
  if (n > 1 && !p.volumes_ok) l.push('código em ' + n + ' caixas');
  return l;
}

// Processos que batem com o código ou o número digitados no cadastro (aviso de duplicado)
export function jaCadastrados(codigo: string, numero: string, processos: Processo[]): { p: Processo; por: string }[] {
  const kc = chaveNum(codigo), kn = chaveNum(numero);
  if (!kc && !kn) return [];
  const out: { p: Processo; por: string }[] = [];
  for (const p of processos){
    if (p.excluido) continue;
    const kp = chaveNum(p.codigo), kx = chaveNum(p.numero);
    const porCod = !!kc && (kp === kc || kx === kc);
    const porNum = !!kn && kn.length >= 3 && (kp === kn || kx === kn);
    if (porCod || porNum) out.push({ p, por: porCod ? 'código ' + codigo.trim() : 'número ' + numero.trim() });
  }
  return out;
}

// Caixa com a fileira normalizada; prateleira e fileira só valem juntas
export function localValido(p: string, f: string): Local | null {
  const pn = parseInt(p, 10), fl = f.trim().toUpperCase();
  return pn > 0 && /^[A-Z]{1,2}$/.test(fl) ? [pn, fl] : null;
}
