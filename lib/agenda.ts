// Agenda de contatos: as mesmas regras do sistema atual (busca sem acento, grupos por inicial, destaque).

export type Rotulado = { label: string; value: string };
export type Contato = {
  id: string; name: string; phones: Rotulado[]; emails: Rotulado[]; category: string;
  service_hours: string;      // horário de atendimento (texto livre, ex.: "Seg a sex, 8h às 18h")
  has_on_call: boolean;       // tem plantão?
  on_call_phone: string;      // telefone do plantão
};

export const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
export const ROTULOS_TELEFONE = ['Celular', 'Fixo', 'Fax', 'Outro'];
export const ROTULOS_EMAIL = ['Pessoal', 'Trabalho', 'Outro'];
export const CATEGORIAS_PADRAO = ['Perito', 'Advogado', 'Magistrado', 'Secretarias', 'Gabinetes', 'Diretorias', 'Cidades'];
export const TODOS = 'Todos';

// Contatos criados quando a agenda está vazia (o mesmo exemplo do sistema atual)
export const EXEMPLOS: Pick<Contato, 'name' | 'category' | 'phones' | 'emails'>[] = [
  { name: 'Dr. Ricardo Mendes (Perito Contábil)', category: 'Perito',
    phones: [{ label: 'Celular', value: '(65) 99811-2233' }], emails: [{ label: 'Trabalho', value: 'ricardo.mendes@pericia.com' }] },
  { name: 'Dra. Carla Souza (OAB/MT 12345)', category: 'Advogado',
    phones: [{ label: 'Celular', value: '(65) 99722-4455' }], emails: [{ label: 'Trabalho', value: 'carla.souza@advocacia.com' }] },
  { name: 'Secretaria da 2ª Vara Cível', category: 'Secretarias',
    phones: [{ label: 'Celular', value: '(65) 99544-8899' }], emails: [{ label: 'Trabalho', value: '2vara.civel@tjmt.jus.br' }] }
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
    category: (row.category as string) || '',
    service_hours: (row.service_hours as string) || '',
    has_on_call: !!row.has_on_call,
    on_call_phone: (row.on_call_phone as string) || ''
  };
}

// Combina com a categoria escolhida e com a busca (nome, telefones ou e-mails)
export function combina(c: Contato, busca: string, categoria: string): boolean {
  if (categoria !== TODOS && (c.category || '') !== categoria) return false;
  const q = normalizar(busca);
  if (!q) return true;
  if (normalizar(c.name).includes(q)) return true;
  if (c.has_on_call && normalizar(c.on_call_phone).includes(q)) return true;
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

// Máscara de telefone enquanto digita: fixo (65) 3333-3333 ou celular (65) 99999-9999.
// Números que começam com 0 (0800, 0300…) ou com mais de 11 dígitos ficam como foram digitados.
export function formatarTelefone(texto: string): string {
  const d = texto.replace(/\D/g, '');
  if (!d || d[0] === '0' || d.length > 11) return texto;
  if (d.length <= 2) return '(' + d;
  const ddd = d.slice(0, 2), resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

// Fixo ou celular pelo número completo (com DDD); null se ainda não dá para saber
export function tipoTelefone(texto: string): 'Fixo' | 'Celular' | null {
  const d = texto.replace(/\D/g, '');
  if (d[0] === '0') return null;
  if (d.length === 11 && d[2] === '9') return 'Celular';
  if (d.length === 10) return 'Fixo';
  return null;
}

// Ao digitar o número, o rótulo acompanha (só troca entre Fixo e Celular; Fax, Outro etc. ficam como estão)
export function rotuloAutomatico(rotulo: string, numero: string): string {
  if (rotulo !== 'Fixo' && rotulo !== 'Celular') return rotulo;
  return tipoTelefone(numero) || rotulo;
}

// Erro do Supabase de quando a tabela contacts ainda não tem as colunas de horário/plantão
export function faltaColunaAtendimento(msg: string | undefined): boolean {
  return /service_hours|has_on_call|on_call_phone/.test(msg || '');
}
