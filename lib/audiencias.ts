// Audiências: as mesmas regras do sistema atual (status, períodos, filtros, resumo e agrupamento por dia).
// As datas seguem o relógio do computador, como no sistema atual (a vara usa o horário de Cuiabá).
import { normalizar } from './agenda.ts';
import { chaveDoDia } from './datas.ts';
import { soDigitos } from './processo.ts';

export const STATUSES = ['A cumprir', 'Intimações feitas', 'Pronto para audiência', 'Redesignada', 'Cancelada'];
export const STATUS_PADRAO = STATUSES[0];
export const JANELA_DIAS = 15;   // período do filtro e do quadro "Próximos N dias"
// nomes usados na primeira versão, convertidos ao carregar
export const STATUS_ANTIGOS: Record<string, string> = { Designada: 'A cumprir', Realizada: 'Intimações feitas', Cumprida: 'Intimações feitas' };
export const TIPOS_PADRAO = ['Instrução e julgamento', 'Apresentação', 'Em continuação'];
export const TODOS = 'Todos';

export type Periodo = 'proximas' | 'hoje' | 'semana' | 'mes' | 'proxmes' | 'anteriores' | 'todas' | 'intervalo';
export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'proximas', label: 'Próximas' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Próximos ' + JANELA_DIAS + ' dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'proxmes', label: 'Próximo mês' },
  { key: 'anteriores', label: 'Anteriores' },
  { key: 'todas', label: 'Todas' },
  { key: 'intervalo', label: 'Entre datas' }
];
export type Conf = 'todas' | 'nao' | 'sim';
export const CONF_FILTROS: { key: Conf; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'nao', label: 'Não conferidas' },
  { key: 'sim', label: 'Conferidas' }
];

export type Audiencia = { id: string; processo: string; date: Date; tipo: string; status: string; observacoes: string; conferidaEm: Date | null };
export type Filtros = { periodo: Periodo; de: string; ate: string; status: string; tipo: string; conf: Conf; busca: string };

export function deLinha(r: Record<string, unknown>): Audiencia {
  const st = r.status as string;
  return {
    id: String(r.id),
    processo: (r.processo as string) || '',
    date: new Date(r.data_hora as string),
    tipo: (r.tipo as string) || '',
    status: STATUS_ANTIGOS[st] || st || STATUS_PADRAO,
    observacoes: (r.observacoes as string) || '',
    conferidaEm: r.conferida_em ? new Date(r.conferida_em as string) : null
  };
}

const doisDigitos = (n: number) => (n < 10 ? '0' : '') + n;
export const hora = (d: Date) => doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
export const diaMes = (d: Date) => doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1);
const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const inicioProxMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1);
const maiuscula = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Tipos para as listas: os cadastrados; sem a tabela, os padrão e os já usados nas audiências
export function nomesTipos(cadastrados: string[] | null, audiencias: Audiencia[]): string[] {
  const vistos = new Set<string>(), out: string[] = [];
  const add = (n: string) => { n = (n || '').trim(); const k = normalizar(n); if (n && !vistos.has(k)){ vistos.add(k); out.push(n); } };
  if (cadastrados) cadastrados.forEach(add);
  else { TIPOS_PADRAO.forEach(add); audiencias.forEach(a => add(a.tipo)); }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Passou da data e continua "A cumprir": pede para atualizar o status
export function pendente(a: Audiencia, agora: Date): boolean { return a.status === STATUS_PADRAO && a.date < agora; }

export function noPeriodo(a: Audiencia, f: Pick<Filtros, 'periodo' | 'de' | 'ate'>, agora: Date): boolean {
  const hoje = inicioDoDia(agora);
  switch (f.periodo){
    case 'proximas': return a.date >= hoje;
    case 'hoje': return a.date >= hoje && a.date < somaDias(hoje, 1);
    case 'semana': return a.date >= hoje && a.date < somaDias(hoje, JANELA_DIAS);
    case 'mes': return a.date.getFullYear() === agora.getFullYear() && a.date.getMonth() === agora.getMonth();
    case 'proxmes': return a.date >= inicioProxMes(agora) && a.date < inicioProxMes(inicioProxMes(agora));
    case 'anteriores': return a.date < hoje;
    case 'intervalo': {
      const de = f.de ? new Date(f.de + 'T00:00') : null, ate = f.ate ? somaDias(new Date(f.ate + 'T00:00'), 1) : null;
      return (!de || a.date >= de) && (!ate || a.date < ate);
    }
    default: return true;
  }
}

export function combina(a: Audiencia, f: Pick<Filtros, 'status' | 'tipo' | 'conf' | 'busca'>): boolean {
  if (f.status !== TODOS && a.status !== f.status) return false;
  if (f.tipo !== TODOS && a.tipo !== f.tipo) return false;
  if (f.conf === 'sim' && !a.conferidaEm) return false;
  if (f.conf === 'nao' && a.conferidaEm) return false;
  const q = normalizar(f.busca).trim();
  if (!q) return true;
  const qd = soDigitos(q);
  if (qd.length >= 3 && soDigitos(a.processo).includes(qd)) return true;
  return [a.processo, a.tipo, a.observacoes, a.status].some(c => normalizar(c).includes(q));
}

// Lista da tela: filtrada e em ordem (anteriores: a mais recente primeiro), agrupada por dia
export function pauta(itens: Audiencia[], f: Filtros, agora: Date): { lista: Audiencia[]; dias: { chave: string; date: Date; itens: Audiencia[] }[] } {
  const desc = f.periodo === 'anteriores';
  const lista = itens.filter(a => noPeriodo(a, f, agora) && combina(a, f))
    .sort((x, y) => (desc ? y.date.getTime() - x.date.getTime() : x.date.getTime() - y.date.getTime()));
  const dias: { chave: string; date: Date; itens: Audiencia[] }[] = [];
  for (const a of lista){
    const k = chaveDoDia(a.date);
    if (!dias.length || dias[dias.length - 1].chave !== k) dias.push({ chave: k, date: a.date, itens: [] });
    dias[dias.length - 1].itens.push(a);
  }
  return { lista, dias };
}

// Quadros do resumo (as canceladas não contam)
export function resumo(itens: Audiencia[], agora: Date){
  const hoje = inicioDoDia(agora), amanha = somaDias(hoje, 1), janela = somaDias(hoje, JANELA_DIAS);
  const pm = inicioProxMes(agora), pm2 = inicioProxMes(pm);
  let nHoje = 0, nJanela = 0, nProxMes = 0;
  for (const a of itens){
    if (a.status === 'Cancelada') continue;
    if (a.date >= hoje && a.date < amanha) nHoje++;
    if (a.date >= hoje && a.date < janela) nJanela++;
    if (a.date >= pm && a.date < pm2) nProxMes++;
  }
  return { hoje: nHoje, janela: nJanela, proxMes: nProxMes, nomeProxMes: pm.toLocaleDateString('pt-BR', { month: 'long' }) };
}

// "Quinta-feira, 18 de outubro" e "hoje" / "amanhã" / "ontem"
export function rotuloDoDia(d: Date, agora: Date): { texto: string; rel: string } {
  const diff = Math.round((inicioDoDia(d).getTime() - inicioDoDia(agora).getTime()) / 86400000);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long' };
  if (d.getFullYear() !== agora.getFullYear()) opts.year = 'numeric';
  return { texto: maiuscula(d.toLocaleDateString('pt-BR', opts)), rel: diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : diff === -1 ? 'ontem' : '' };
}

// Impressão
export const dataDaImpressao = (d: Date) => maiuscula(d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
const isoBr = (k: string) => { const x = (k || '').split('-'); return x.length === 3 ? x[2] + '/' + x[1] + '/' + x[0] : '…'; };
export function textoDoFiltro(f: Filtros): string {
  const partes: string[] = [];
  const pd = PERIODOS.find(x => x.key === f.periodo);
  if (f.periodo === 'intervalo') partes.push('De ' + isoBr(f.de) + ' a ' + isoBr(f.ate));
  else if (pd) partes.push(pd.label);
  if (f.status !== TODOS) partes.push('Status: ' + f.status);
  if (f.tipo !== TODOS) partes.push('Tipo: ' + f.tipo);
  const cf = CONF_FILTROS.find(x => x.key === f.conf);
  if (f.conf !== 'todas' && cf) partes.push(cf.label);
  if (f.busca.trim()) partes.push('Busca: "' + f.busca.trim() + '"');
  return partes.join(' · ');
}

// Mensagem de erro da tabela de tipos
export function erroDosTipos(err: { message?: string; code?: string } | null): string {
  const m = (err?.message || '') + ' ' + (err?.code || '');
  return /duplicate|23505|audiencias_tipos_nome_idx/.test(m) ? 'Esse tipo já existe.'
    : /audiencias_tipos|42P01|PGRST205/.test(m) ? 'Falta a tabela de tipos no Supabase. Rode o SQL do LEIA-ME.md (tipos de audiência).'
    : 'Não foi possível salvar: ' + (err?.message);
}

// ---- audiência repetida ----
// Mesmo processo no mesmo dia ou com o mesmo tipo (o mesmo processo pode ter outras audiências em outras datas/tipos)
export function repetidasDe(itens: Audiencia[], processo: string, date: Date, tipo: string, ignorarId?: string | null): Audiencia[] {
  const k = soDigitos(processo);
  if (!k) return [];
  const dia = (d: Date) => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  return itens.filter(a => a.id !== ignorarId && soDigitos(a.processo) === k && (dia(a.date) === dia(date) || (!!tipo && a.tipo === tipo)));
}
export function descreverAudiencia(a: Audiencia): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return p(a.date.getDate()) + '/' + p(a.date.getMonth() + 1) + '/' + a.date.getFullYear() + ' às ' + hora(a.date) + (a.tipo ? ' (' + a.tipo + ')' : '');
}
