// Agenda de contatos: as mesmas regras do sistema atual (busca sem acento, grupos por inicial, destaque).

export type Rotulado = { label: string; value: string };
export type Contato = { id: string; name: string; phones: Rotulado[]; emails: Rotulado[]; category: string };

export const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
export const ROTULOS_TELEFONE = ['Celular', 'Casa', 'Trabalho', 'Fax', 'Outro'];
export const ROTULOS_EMAIL = ['Pessoal', 'Trabalho', 'Outro'];
export const CATEGORIAS_PADRAO = ['Perito', 'Advogado', 'Magistrado', 'Secretarias', 'Gabinetes', 'Diretorias', 'Cidades'];
export const TODOS = 'Todos';

// Contatos criados quando a agenda está vazia (o mesmo exemplo do sistema atual)
export const EXEMPLOS: Omit<Contato, 'id'>[] = [
  { name: 'Dr. Ricardo Mendes (Perito Contábil)', category: 'Perito',
    phones: [{ label: 'Celular', value: '(65) 99811-2233' }], emails: [{ label: 'Trabalho', value: 'ricardo.mendes@pericia.com' }] },
  { name: 'Dra. Carla Souza (OAB/MT 12345)', category: 'Advogado',
    phones: [{ label: 'Celular', value: '(65) 99722-4455' }], emails: [{ label: 'Trabalho', value: 'carla.souza@advocacia.com' }] },
  { name: 'Secretaria da 2ª Vara Cível', category: 'Secretarias',
    phones: [{ label: 'Trabalho', value: '(65) 99544-8899' }], emails: [{ label: 'Trabalho', value: '2vara.civel@tjmt.jus.br' }] }
];

// Minúsculas e sem acento
export function normalizar(s: unknown): string {
  return (s == null ? '' : String(s)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Letra do índice: A a Z, ou "#" para o resto
export function inicial(nome: string): string {
  const n = normalizar(nome).trim();
  if (!n) return '#';
  const c = n[0].toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

export function deLinha(row: Record<string, unknown>): Contato {
  return {
    id: String(row.id),
    name: (row.name as string) || '',
    phones: (row.phones as Rotulado[]) || [],
    emails: (row.emails as Rotulado[]) || [],
    category: (row.category as string) || ''
  };
}

// Combina com a categoria escolhida e com a busca (nome, telefones ou e-mails)
export function combina(c: Contato, busca: string, categoria: string): boolean {
  if (categoria !== TODOS && (c.category || '') !== categoria) return false;
  const q = normalizar(busca);
  if (!q) return true;
  if (normalizar(c.name).includes(q)) return true;
  return c.phones.some(p => normalizar(p.value).includes(q)) || c.emails.some(e => normalizar(e.value).includes(q));
}

// Contatos filtrados, em ordem alfabética, agrupados pela inicial (na ordem do índice)
export function agrupar(contatos: Contato[], busca: string, categoria: string): { total: number; grupos: { letra: string; contatos: Contato[] }[] } {
  const lista = contatos.filter(c => combina(c, busca, categoria)).sort((a, b) => normalizar(a.name).localeCompare(normalizar(b.name)));
  const porLetra: Record<string, Contato[]> = {};
  for (const c of lista) (porLetra[inicial(c.name)] ||= []).push(c);
  return { total: lista.length, grupos: ALFABETO.filter(l => porLetra[l]).map(letra => ({ letra, contatos: porLetra[letra] })) };
}

// Trecho que combina com a busca, para destacar: [antes, trecho, depois], ou null
export function destaque(texto: string, busca: string): [string, string, string] | null {
  if (!busca) return null;
  const i = normalizar(texto).indexOf(normalizar(busca));
  if (i === -1) return null;
  return [texto.slice(0, i), texto.slice(i, i + busca.length), texto.slice(i + busca.length)];
}

// Linhas de telefone/e-mail do formulário: só as preenchidas, sem espaços nas pontas
export function linhasPreenchidas(linhas: Rotulado[]): Rotulado[] {
  return linhas.map(l => ({ label: l.label, value: l.value.trim() })).filter(l => l.value);
}
