// Arquivo de processos físicos: regras que não dependem da tela (busca, prateleiras, pendências).
// As mesmas do protótipo aprovado; os testes ficam em lib/arquivo.test.ts.

// [prateleira, fileira] ou [prateleira, fileira, posição]: a posição (1, 2, 3… da esquerda para a direita)
// guarda a sequência das caixas na fileira; sem ela a caixa vai para o fim, em ordem de número.
export type Local = [number, string] | [number, string, number];
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

// Nome padronizado da caixa. As caixas da série criminal levam "-CRI" e são OUTRA caixa (60-CRI não é a 60).
// Aceita como vem da etiqueta, da planilha ou digitado: "60 CRIME", "60 crim", "CX 60 CRI", "60-Criminal",
// "60CR1" (I lido como 1) -> "60-CRI"; "caixa 0060" -> "60". O que não for número + série fica como está.
export const SERIE_CRI = /^(?:CRI|CRIM|CRIME|CRIMES|CRIMINAL|CR1|CRL)$/;
export function nomeCaixa(txt: string): string {
  const t = String(txt || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
  const m = t.match(/^(?:CX|CAIXA)?\s*\.?\s*0*(\d+)\s*(?:[-\/.]\s*)?([A-Z][A-Z0-9]*)?$/);
  if (!m) return t;
  if (!m[2]) return m[1];
  if (SERIE_CRI.test(m[2])) return m[1] + '-CRI';
  return t.replace(/^(?:CX|CAIXA)\s*\.?\s*/, '').replace(/^0+(?=\d)/, '');   // outra letra: fica como escrito
}
export const ehCriminal = (nome: string) => /-CRI$/.test(nome);

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
    const alvo = nomeCaixa(mcx[1]);
    const k = chaveCaixa(alvo), igual = (c: Caixa) => Number(chaveCaixa(c.nome) === k);
    const achadas = caixas.filter(c => chaveCaixa(c.nome).startsWith(k))
      .sort((a, b) => igual(b) - igual(a) || ordemCaixa(a, b)).slice(0, 30);
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
  return { tipo: 'caixa', alvo: nomeCaixa(t) };
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

// ---------- ordem das caixas dentro da fileira ----------
export const posicaoEm = (c: Caixa, p: number, f: string): number | null => {
  const l = c.locais.find(x => x[0] === p && x[1] === f);
  return l && l.length > 2 && Number(l[2]) > 0 ? Number(l[2]) : null;
};
// Ordem da fileira: primeiro as que têm posição anotada, depois as outras por número
export function ordemNaFileira(p: number, f: string){
  return (a: Caixa, b: Caixa) => {
    const pa = posicaoEm(a, p, f), pb = posicaoEm(b, p, f);
    if (pa !== null && pb !== null && pa !== pb) return pa - pb;
    if ((pa === null) !== (pb === null)) return pa === null ? 1 : -1;
    return ordemCaixa(a, b);
  };
}
// Locais da caixa com a posição trocada só no lugar [p, f] (os outros lugares ficam como estão)
export function comPosicao(c: Caixa, p: number, f: string, pos: number): Local[] {
  return c.locais.map(l => (l[0] === p && l[1] === f ? [p, f, pos] as Local : l));
}
// Onde a caixa solta entra numa fileira: nova sequência (ids) e quem precisa mudar de posição
export function reordenar(ids: string[], id: string, indice: number): string[] {
  const resto = ids.filter(x => x !== id);
  const i = Math.max(0, Math.min(indice, resto.length));
  return [...resto.slice(0, i), id, ...resto.slice(i)];
}

// ---------- conferir uma prateleira por foto ----------
// A IA lê as fileiras de CIMA para BAIXO (como se vê na foto); na vara a fileira A é a de BAIXO.
// Com 7 níveis: o 1º lido (topo) é G e o último (chão) é A.
export function letraFileira(indiceDeCima: number, total: number): string {
  const n = total - 1 - indiceDeCima;
  return n >= 0 && n < 26 ? String.fromCharCode(65 + n) : '';
}
export const letraMais = (f: string, d: number) => {
  const n = f.length === 1 ? f.charCodeAt(0) - 65 + d : -1;
  return n >= 0 && n < 26 ? String.fromCharCode(65 + n) : '';
};

// Chave para achar a caixa pelo nome lido: o nome padronizado, sem espaços e traços ("0155 crime" = "155CRI")
export function chaveCaixa(nome: string): string {
  return nomeCaixa(nome).replace(/[^A-Z0-9]/g, '');
}

export type LidaFoto = { nome: string; f: string };
// certo = mesmo lugar e mesma posição; ordem = fileira certa, mas fora da sequência (ou sem sequência
// anotada); fileira = mesma prateleira, outra fileira; mudou = outra prateleira (ou dois lugares, ou sem lugar)
export type EstadoFoto = 'certo' | 'ordem' | 'fileira' | 'mudou' | 'nova' | 'repetida' | 'invalida';
export type ItemFoto = LidaFoto & { estado: EstadoFoto; caixa: Caixa | null; pos: number };

// Compara o que a foto mostra na prateleira p com o que o sistema tem anotado. "pos" é a posição da caixa
// na fileira, contando só as caixas válidas da foto, da esquerda para a direita. "ausentes" = caixas
// anotadas nesta prateleira que não apareceram na foto (só aviso).
export function compararFoto(p: number, lidas: LidaFoto[], caixas: Caixa[]): { itens: ItemFoto[]; ausentes: Caixa[] } {
  const porChave = new Map<string, Caixa>();
  for (const c of [...caixas].sort(ordemCaixa)){
    if (c.secretaria) continue;
    const k = chaveCaixa(c.nome);
    if (k && !porChave.has(k)) porChave.set(k, c);
  }
  const vistas = new Set<string>();
  const contagem = new Map<string, number>();
  const itens: ItemFoto[] = lidas.map(l => {
    const nome = nomeCaixa(l.nome), f = l.f.trim().toUpperCase(), k = chaveCaixa(nome);
    if (!k || !/^[A-Z]{1,2}$/.test(f)) return { nome, f, estado: 'invalida', caixa: null, pos: 0 };
    const caixa = porChave.get(k) || null;
    if (vistas.has(k)) return { nome, f, estado: 'repetida', caixa, pos: 0 };
    vistas.add(k);
    const pos = (contagem.get(f) || 0) + 1; contagem.set(f, pos);
    if (!caixa) return { nome, f, estado: 'nova', caixa: null, pos };
    const um = caixa.locais.length === 1 ? caixa.locais[0] : null;
    let estado: EstadoFoto = 'mudou';
    if (um && um[0] === p && um[1] === f) estado = posicaoEm(caixa, p, f) === pos ? 'certo' : 'ordem';
    else if (um && um[0] === p) estado = 'fileira';
    return { nome, f, estado, caixa, pos };
  });
  const ausentes = caixas
    .filter(c => !c.secretaria && c.locais.some(l => l[0] === p) && !vistas.has(chaveCaixa(c.nome)))
    .sort((a, b) => (a.locais.find(l => l[0] === p)![1]).localeCompare(b.locais.find(l => l[0] === p)![1]) || ordemCaixa(a, b));
  return { itens, ausentes };
}

// Leitura com as letras deslocadas: quando quase todas as caixas conhecidas de uma fileira da foto estão
// anotadas, nesta mesma prateleira, numa outra fileira (a mesma para todas), a letra da foto provavelmente
// está errada. Devolve { foto: 'C', sistema: 'B', caixas: 5 } para cada fileira assim.
export function sugerirLetras(itens: ItemFoto[]): { foto: string; sistema: string; caixas: number }[] {
  const porF = new Map<string, ItemFoto[]>();
  for (const it of itens){ if (it.caixa && it.pos){ const l = porF.get(it.f); if (l) l.push(it); else porF.set(it.f, [it]); } }
  const out: { foto: string; sistema: string; caixas: number }[] = [];
  for (const [f, l] of [...porF.entries()].sort((a, b) => b[0].localeCompare(a[0]))){
    const outras = new Map<string, number>();
    for (const it of l) if (it.estado === 'fileira') { const s = it.caixa!.locais[0][1]; outras.set(s, (outras.get(s) || 0) + 1); }
    const [s, n] = [...outras.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
    if (n >= 3 && n / l.length >= 0.6) out.push({ foto: f, sistema: s, caixas: n });
  }
  return out;
}
