// Anonimização antes de mandar o texto para a IA (Resolução CNJ 615/2025: nada de dado pessoal
// sem necessidade). Troca CPF, CNPJ, número de benefício do INSS, e-mail, telefone e CEP por
// marcadores como [CPF-1]; a tabela de troca fica só no navegador e serve para devolver os dados
// reais na resposta. O número do processo (padrão CNJ) NÃO é trocado: é público e necessário.

export type Tipo = 'CPF' | 'CNPJ' | 'NB' | 'EMAIL' | 'TELEFONE' | 'CEP' | 'NUMERO';
// marcador → valor original (ex.: { "[CPF-1]": "123.456.789-09" })
export type Mapa = Record<string, string>;

const so = (s: string) => s.replace(/\D/g, '');

export function cpfValido(s: string): boolean {
  const d = so(s);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]){
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}

// Ordem importa: os formatos mais longos e específicos primeiro. As bordas (?<![\w.-]) evitam
// pegar pedaços do número do processo (0001226-43.2017.8.11.0008) ou de outros números.
const B = '(?<![\\w.\\-/])', F = '(?![\\w\\-/]|\\.\\d)';
const REGRAS: { tipo: Tipo | ((v: string) => Tipo); re: RegExp }[] = [
  { tipo: 'EMAIL', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { tipo: 'CNPJ', re: new RegExp(B + '\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}' + F, 'g') },
  { tipo: 'CPF', re: new RegExp(B + '\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}' + F, 'g') },
  { tipo: 'NB', re: new RegExp(B + '\\d{3}\\.\\d{3}\\.\\d{3}-\\d' + F, 'g') },
  { tipo: 'CEP', re: new RegExp(B + '\\d{5}-\\d{3}' + F, 'g') },
  { tipo: 'TELEFONE', re: new RegExp(B + '(?:\\+?55\\s?)?\\(?\\d{2}\\)?\\s?9?\\d{4}[\\s-]\\d{4}' + F, 'g') },
  { tipo: 'TELEFONE', re: new RegExp(B + '9?\\d{4}-\\d{4}' + F, 'g') },
  { tipo: 'CNPJ', re: new RegExp(B + '\\d{14}' + F, 'g') },
  { tipo: v => (cpfValido(v) ? 'CPF' : 'NUMERO'), re: new RegExp(B + '\\d{10,11}' + F, 'g') }
];

export function anonimizar(texto: string, mapa: Mapa): { texto: string; mapa: Mapa; trocados: Partial<Record<Tipo, number>> } {
  const novo: Mapa = { ...mapa };
  const trocados: Partial<Record<Tipo, number>> = {};
  // o mesmo valor ganha sempre o mesmo marcador, inclusive entre perguntas
  const marcadorDe = (tipo: Tipo, valor: string) => {
    const existente = Object.keys(novo).find(k => k.startsWith('[' + tipo + '-') && novo[k] === valor);
    if (existente) return existente;
    let n = 1;
    while (novo['[' + tipo + '-' + n + ']'] !== undefined) n++;
    const k = '[' + tipo + '-' + n + ']';
    novo[k] = valor;
    return k;
  };
  let t = texto;
  for (const r of REGRAS){
    t = t.replace(r.re, valor => {
      const tipo = typeof r.tipo === 'function' ? r.tipo(valor) : r.tipo;
      trocados[tipo] = (trocados[tipo] || 0) + 1;
      return marcadorDe(tipo, valor);
    });
  }
  return { texto: t, mapa: novo, trocados };
}

// Devolve os dados reais no texto da IA
export function desanonimizar(texto: string, mapa: Mapa): string {
  return texto.replace(/\[(?:CPF|CNPJ|NB|EMAIL|TELEFONE|CEP|NUMERO)-\d+\]/g, k => mapa[k] ?? k);
}

// Também dentro das propostas (rotina e modelo) que vêm da IA
export function desanonimizarTudo<T>(v: T, mapa: Mapa): T {
  if (typeof v === 'string') return desanonimizar(v, mapa) as T;
  if (Array.isArray(v)) return v.map(x => desanonimizarTudo(x, mapa)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, desanonimizarTudo(x, mapa)])) as T;
  return v;
}

const NOMES: Record<Tipo, [string, string]> = {
  CPF: ['CPF', 'CPFs'], CNPJ: ['CNPJ', 'CNPJs'], NB: ['nº de benefício', 'nºs de benefício'], EMAIL: ['e-mail', 'e-mails'],
  TELEFONE: ['telefone', 'telefones'], CEP: ['CEP', 'CEPs'], NUMERO: ['número', 'números']
};
// "1 CPF e 2 telefones"
export function resumoTrocados(trocados: Partial<Record<Tipo, number>>): string {
  const partes = (Object.keys(trocados) as Tipo[]).map(t => trocados[t] + ' ' + NOMES[t][trocados[t] === 1 ? 0 : 1]);
  return partes.length <= 1 ? partes.join('') : partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
}
