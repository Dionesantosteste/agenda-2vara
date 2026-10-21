// Perícias: nomeação → agendamento → realização → laudo (30 dias úteis). As mesmas regras do sistema atual.
// Os dias úteis vêm do calendário da vara (seção Prazos): quem chama passa a função "util".
// As datas seguem o relógio do computador, como no sistema atual.
import { normalizar } from './agenda.ts';
import { chaveDoDia } from './datas.ts';
import { formatarProcesso, soDigitos } from './processo.ts';

export type Status = 'nao_agendada' | 'agendada' | 'intimacoes_feitas' | 'pronta' | 'realizada' | 'laudo_juntado' | 'cancelada';
export const PER_STATUS: [Status, string][] = [
  ['nao_agendada', 'Não agendada'], ['agendada', 'Agendada'], ['intimacoes_feitas', 'Intimações feitas'], ['pronta', 'Pronta para perícia'], ['realizada', 'Realizada'],
  ['laudo_juntado', 'Laudo juntado'], ['cancelada', 'Cancelada']
];
export const PER_NOME = Object.fromEntries(PER_STATUS) as Record<Status, string>;
export const PER_FLUXO: Status[] = ['nao_agendada', 'agendada', 'intimacoes_feitas', 'pronta', 'realizada', 'laudo_juntado'];
export const ESPECIALIDADES = ['', 'Médica', 'Psicológica', 'Social', 'Contábil', 'Engenharia', 'Grafotécnica', 'Avaliação de imóveis', 'Outra'];
export const PRAZO_LAUDO = 30;     // dias úteis depois da realização
export const PRAZO_ALERTA = 5;     // destaca o laudo quando faltam até 5 dias úteis
export const ATALHOS = ['Perito intimado para dizer se aceita', 'Perito aceitou', 'Perito recusou', 'Perito informou a data', 'Laudo cobrado do perito'];
export type Situacao = 'andamento' | 'nao_agendada' | 'agendada' | 'intimacoes_feitas' | 'pronta' | 'realizada' | 'atrasado';
export const SITUACOES: [Situacao, string][] = [
  ['andamento', 'Todas em andamento'], ['nao_agendada', 'Não agendadas'], ['agendada', 'Agendadas'],
  ['intimacoes_feitas', 'Intimações feitas'], ['pronta', 'Prontas para perícia'],
  ['realizada', 'Aguardando laudo'], ['atrasado', 'Laudo atrasado']
];
export type Concluidas = 'todas' | 'laudo_juntado' | 'cancelada';
export const CONCLUIDAS: [Concluidas, string][] = [['todas', 'Todas'], ['laudo_juntado', 'Laudo juntado'], ['cancelada', 'Canceladas']];
export type Aba = 'andamento' | 'concluidas' | 'peritos';

export type Pericia = {
  id: string; processo: string; autor: string; perito: string; especialidade: string; status: Status; data: Date | null;
  local: string; realizadaEm: Date | null; laudoEm: Date | null; observacoes: string; conferidaEm: Date | null;
};
export type Perito = { id: string; nome: string; especialidade: string; telefone: string; email: string; observacoes: string };
export type Andamento = { id: string; texto: string; em: Date };
export type Util = (d: Date) => boolean;

const dois = (n: number) => (n < 10 ? '0' : '') + n;
export const diaMes = (d: Date) => dois(d.getDate()) + '/' + dois(d.getMonth() + 1);
export const dataBr = (d: Date) => diaMes(d) + '/' + d.getFullYear();
export const hora = (d: Date) => dois(d.getHours()) + ':' + dois(d.getMinutes());
export const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// "AAAA-MM-DD" (ou um timestamp) → meia-noite local daquele dia
export const dataLocal = (s: unknown) => (s ? new Date(String(s).slice(0, 10) + 'T00:00') : null);
export const marcada = (s: Status) => s === 'agendada' || s === 'intimacoes_feitas' || s === 'pronta';
export const aberta = (p: Pericia) => p.status !== 'laudo_juntado' && p.status !== 'cancelada';
// Dias de distância entre hoje e a data (negativo = passou)
export const distancia = (d: Date, agora: Date) => Math.round((inicioDoDia(d).getTime() - inicioDoDia(agora).getTime()) / 86400000);
const maiuscula = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function deLinha(r: Record<string, unknown>): Pericia {
  const st = r.status as Status;
  return {
    id: String(r.id), processo: (r.processo as string) || '', autor: (r.autor as string) || '', perito: (r.perito as string) || '',
    especialidade: (r.especialidade as string) || '', status: PER_NOME[st] ? st : 'nao_agendada',
    data: r.data_pericia ? new Date(r.data_pericia as string) : null, local: (r.local as string) || '',
    realizadaEm: dataLocal(r.realizada_em), laudoEm: dataLocal(r.laudo_em), observacoes: (r.observacoes as string) || '',
    conferidaEm: r.conferida_em ? new Date(r.conferida_em as string) : null
  };
}
export function peritoDeLinha(x: Record<string, unknown>): Perito {
  return { id: String(x.id), nome: (x.nome as string) || '', especialidade: (x.especialidade as string) || '', telefone: (x.telefone as string) || '', email: (x.email as string) || '', observacoes: (x.observacoes as string) || '' };
}
export function paraGravar(p: Pericia){
  return {
    processo: p.processo, autor: p.autor || '', perito: p.perito, especialidade: p.especialidade, status: p.status,
    data_pericia: p.data ? p.data.toISOString() : null, local: p.local,
    realizada_em: p.realizadaEm ? chaveDoDia(p.realizadaEm) : null, laudo_em: p.laudoEm ? chaveDoDia(p.laudoEm) : null,
    observacoes: p.observacoes, conferida_em: p.conferidaEm ? p.conferidaEm.toISOString() : null,
    updated_at: new Date().toISOString()
  };
}

// ---- dias úteis ----
// n dias úteis a partir do dia seguinte ao início (o dia do início não conta)
export function somarDiasUteis(inicio: Date, n: number, util: Util): Date {
  const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  let c = 0;
  while (c < n){ d.setDate(d.getDate() + 1); if (util(d)) c++; }
  return d;
}
// Dias úteis depois de "a" até "b", inclusive
export function diasUteisEntre(a: Date, b: Date, util: Util): number {
  const d = new Date(a.getFullYear(), a.getMonth(), a.getDate()), fim = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  let c = 0;
  while (d < fim){ d.setDate(d.getDate() + 1); if (util(d)) c++; }
  return c;
}
export const prazoLaudo = (p: Pericia, util: Util) => (p.realizadaEm ? somarDiasUteis(p.realizadaEm, PRAZO_LAUDO, util) : null);
export function laudoAtrasado(p: Pericia, agora: Date, util: Util): boolean {
  const pr = prazoLaudo(p, util);
  return p.status === 'realizada' && !!pr && inicioDoDia(agora) > pr;
}
export function laudoPerto(p: Pericia, agora: Date, util: Util): boolean {
  const pr = prazoLaudo(p, util);
  if (p.status !== 'realizada' || !pr || laudoAtrasado(p, agora, util)) return false;
  return diasUteisEntre(agora, pr, util) <= PRAZO_ALERTA;
}
export const agendadaProxima = (p: Pericia, agora: Date) => marcada(p.status) && !!p.data && distancia(p.data, agora) >= 0 && distancia(p.data, agora) < 15;

// ---- peritos ----
export const chaveNome = (n: string) => normalizar(n).trim().replace(/\s+/g, ' ');
export function peritoCadastrado(peritos: Perito[], nome: string): Perito | null {
  const k = chaveNome(nome);
  return (k && peritos.find(x => chaveNome(x.nome) === k)) || null;
}
// Nomes para escolher: os cadastrados e, se faltar algum, os já usados nas perícias
export function nomesDePeritos(peritos: Perito[], itens: Pericia[]): string[] {
  const vistos = new Set<string>(), out: string[] = [];
  peritos.forEach(x => { const k = chaveNome(x.nome); if (!vistos.has(k)){ vistos.add(k); out.push(x.nome); } });
  itens.forEach(p => { const k = chaveNome(p.perito); if (k && !vistos.has(k)){ vistos.add(k); out.push(p.perito.trim()); } });
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
// Especialidade para o perito escolhido: a do cadastro ou a da perícia mais recente dele
export function especialidadeDoPerito(peritos: Perito[], itens: Pericia[], nome: string): string {
  const c = peritoCadastrado(peritos, nome);
  if (c && c.especialidade) return c.especialidade;
  const n = chaveNome(nome);
  for (let i = itens.length - 1; i >= 0; i--) if (chaveNome(itens[i].perito) === n && itens[i].especialidade) return itens[i].especialidade;
  return '';
}

// ---- situação e andamentos ----
// Ajusta as datas quando a situação muda
export function aplicarStatus(p: Pericia, novo: Status, agora: Date): Pericia {
  const x = { ...p, status: novo }, hoje = inicioDoDia(agora);
  if (novo === 'realizada' && !x.realizadaEm) x.realizadaEm = x.data && inicioDoDia(x.data) <= hoje ? inicioDoDia(x.data) : hoje;
  if (novo === 'laudo_juntado' && !x.laudoEm) x.laudoEm = hoje;
  if (novo === 'nao_agendada' || marcada(novo)){ x.realizadaEm = null; x.laudoEm = null; }
  if (novo === 'realizada') x.laudoEm = null;
  return x;
}
// Texto automático do andamento quando a situação muda
export function textoMudanca(p: Pericia, util: Util): string {
  const dt = p.data ? dataBr(p.data) + ' às ' + hora(p.data) : '';
  if (p.status === 'agendada') return 'Perícia agendada' + (dt ? ' para ' + dt : '');
  if (p.status === 'intimacoes_feitas') return 'Intimações feitas' + (dt ? ' para a perícia de ' + dt : '');
  if (p.status === 'pronta') return 'Pronta para perícia' + (dt ? ' (' + dt + ')' : '');
  if (p.status === 'realizada') return 'Perícia realizada em ' + dataBr(p.realizadaEm!) + '. Prazo do laudo: ' + dataBr(prazoLaudo(p, util)!) + ' (' + PRAZO_LAUDO + ' dias úteis)';
  if (p.status === 'laudo_juntado') return 'Laudo juntado em ' + dataBr(p.laudoEm!) + '. Perícia concluída';
  return 'Situação alterada para ' + PER_NOME[p.status];
}
// Andamento a registrar ao salvar (cadastro novo, mudança de situação ou de data)
export function andamentoAoSalvar(p: Pericia, antes: Pericia | null, novo: boolean, util: Util): string | null {
  if (novo) return 'Perícia cadastrada' + (p.status === 'agendada' ? '. ' + textoMudanca(p, util) : ' (não agendada)');
  if (!antes) return null;
  if (antes.status !== p.status) return textoMudanca(p, util);
  if (marcada(p.status) && (antes.data ? antes.data.getTime() : 0) !== (p.data ? p.data.getTime() : 0)) return 'Data da perícia alterada para ' + dataBr(p.data!) + ' às ' + hora(p.data!);
  if (p.status === 'realizada' && antes.realizadaEm && p.realizadaEm && antes.realizadaEm.getTime() !== p.realizadaEm.getTime()) return textoMudanca(p, util);
  if (p.status === 'laudo_juntado' && antes.laudoEm && p.laudoEm && antes.laudoEm.getTime() !== p.laudoEm.getTime()) return textoMudanca(p, util);
  return null;
}

// ---- processos repetidos ----
export function duplicadasDe(itens: Pericia[], proc: string, ignorarId?: string): Pericia[] {
  const k = soDigitos(proc);
  if (!k) return [];
  return itens.filter(p => p.id !== ignorarId && soDigitos(p.processo) === k);
}
export function descrever(p: Pericia): string {
  const t = marcada(p.status) && p.data ? 'agendada para ' + dataBr(p.data) + ' às ' + hora(p.data)
    : p.status === 'realizada' && p.realizadaEm ? 'realizada em ' + dataBr(p.realizadaEm) + ' (aguardando laudo)'
    : p.status === 'laudo_juntado' ? 'concluída (laudo juntado' + (p.laudoEm ? ' em ' + dataBr(p.laudoEm) : '') + ')'
    : p.status === 'cancelada' ? 'cancelada'
    : 'cadastrada como Não agendada';
  return t + (p.perito ? ' com ' + p.perito : '');
}

// ---- lista da tela ----
export type Filtros = { aba: Aba; situacao: Situacao; concl: Concluidas; perito: string; busca: string };
export function passa(p: Pericia, f: Filtros, agora: Date, util: Util): boolean {
  if (f.aba === 'concluidas'){
    if (aberta(p)) return false;
    if (f.concl !== 'todas' && p.status !== f.concl) return false;
  } else {
    if (!aberta(p)) return false;
    if (f.situacao === 'atrasado' && !laudoAtrasado(p, agora, util)) return false;
    if (f.situacao !== 'andamento' && f.situacao !== 'atrasado' && p.status !== f.situacao) return false;
  }
  if (f.perito && chaveNome(p.perito) !== f.perito) return false;
  const q = normalizar(f.busca).trim();
  if (!q) return true;
  const qd = soDigitos(q);
  if (qd.length >= 3 && soDigitos(p.processo).includes(qd)) return true;
  return [p.autor, p.processo, p.perito, p.especialidade, p.observacoes].some(c => normalizar(c).includes(q));
}
// Data que define a ordem: agendada → data da perícia; realizada → prazo do laudo
export function dataDeOrdem(p: Pericia, util: Util): Date | null {
  if (p.status === 'realizada') return prazoLaudo(p, util);
  if (p.status === 'laudo_juntado') return p.laudoEm;
  return p.data;
}
export type Grupo = { titulo: string; rel: string; itens: Pericia[] };
export function agrupar(itens: Pericia[], f: Filtros, agora: Date, util: Util): { total: number; grupos: Grupo[] } {
  const lista = itens.filter(p => passa(p, f, agora, util));
  lista.sort((a, b) => {
    const la = laudoAtrasado(a, agora, util), lb = laudoAtrasado(b, agora, util);
    if (la !== lb) return la ? -1 : 1;
    const x = dataDeOrdem(a, util), y = dataDeOrdem(b, util);
    if (!x && !y) return 0;
    if (!x) return 1;
    if (!y) return -1;
    return f.aba === 'concluidas' ? y.getTime() - x.getTime() : x.getTime() - y.getTime();
  });
  const grupos: Grupo[] = [], porTitulo: Record<string, Grupo> = {};
  for (const p of lista){
    let titulo: string, rel = '';
    if (f.aba === 'concluidas'){
      const dc = p.status === 'laudo_juntado' ? p.laudoEm : null;
      titulo = p.status === 'cancelada' ? 'Canceladas' : dc ? 'Concluídas em ' + dc.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Concluídas';
    } else if (laudoAtrasado(p, agora, util)) titulo = 'Laudos atrasados';
    else {
      const d = dataDeOrdem(p, util);
      if (!d) titulo = p.status === 'nao_agendada' ? 'Aguardando data do perito' : 'Sem data';
      else {
        const pre = p.status === 'realizada' ? 'Laudo até ' : p.status === 'laudo_juntado' ? 'Laudo juntado em ' : '';
        const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        titulo = pre ? pre + dia : maiuscula(dia);
        const df = distancia(d, agora);
        rel = df === 0 ? 'hoje' : df === 1 ? 'amanhã' : df === -1 ? 'ontem' : df < 0 ? 'há ' + (-df) + ' dias' : 'em ' + df + ' dias';
      }
    }
    if (!porTitulo[titulo]){ porTitulo[titulo] = { titulo, rel, itens: [] }; grupos.push(porTitulo[titulo]); }
    porTitulo[titulo].itens.push(p);
  }
  return { total: lista.length, grupos };
}

export function resumo(itens: Pericia[], agora: Date, util: Util){
  return {
    proximas: itens.filter(p => agendadaProxima(p, agora)).length,
    naoAgendadas: itens.filter(p => p.status === 'nao_agendada').length,
    aguardando: itens.filter(p => p.status === 'realizada').length,
    atrasados: itens.filter(p => laudoAtrasado(p, agora, util)).length
  };
}

export function textoDoFiltro(f: Filtros, nomePerito: string): string {
  const partes: string[] = [];
  if (f.aba === 'concluidas'){
    const c = CONCLUIDAS.find(x => x[0] === f.concl);
    partes.push('Concluídas' + (f.concl !== 'todas' && c ? ': ' + c[1] : ''));
  } else {
    const s = SITUACOES.find(x => x[0] === f.situacao);
    partes.push('Em andamento' + (s && f.situacao !== 'andamento' ? ': ' + s[1] : ''));
  }
  if (f.perito) partes.push('Perito: ' + nomePerito);
  if (f.busca.trim()) partes.push('Busca: "' + f.busca.trim() + '"');
  return partes.join(' · ');
}

// ---- várias de uma vez ----
const RE_PROC = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/;
const RE_HORA = /(^|[^\d])([01]?\d|2[0-3])\s*[:hH]\s*([0-5]\d)(?!\d)/;
// Lê "processo; autor; hora" em qualquer ordem e com qualquer separador
export function interpretarLinha(txt: string){
  let resto = txt, processo = '', h = '';
  const m = resto.match(RE_PROC);
  if (m){ processo = formatarProcesso(m[0]); resto = resto.replace(m[0], ' '); }
  const mh = resto.match(RE_HORA);
  if (mh){ h = dois(+mh[2]) + ':' + mh[3]; resto = resto.replace(mh[0], mh[1] + ' '); }
  const autor = resto.replace(/[;\t|]+/g, ' ').replace(/\s[-–—]\s/g, ' ').replace(/\b(autor|autora|requerente)\s*:/ig, ' ')
    .replace(/\s+/g, ' ').trim().replace(/^[-–—,.:]+\s*|\s*[-–—,.:]+$/g, '').trim();
  return { texto: txt.trim(), processo, autor, hora: h };
}
export const paraMinutos = (hm: string) => { const x = String(hm).split(':'); return (+x[0] || 0) * 60 + (+x[1] || 0); };
export const deMinutos = (m: number) => { m = Math.min(m, 23 * 60 + 59); return dois(Math.floor(m / 60)) + ':' + dois(m % 60); };

export type LinhaLote = ReturnType<typeof interpretarLinha> & { erro: string; aviso: string; incluir: boolean; horaCalc: string };
export function previaDoLote(texto: string, itens: Pericia[], forcar: Record<number, boolean>, horaInicial: string, intervalo: number){
  const linhas: LinhaLote[] = texto.split(/\r?\n/).map(t => t.trim()).filter(Boolean)
    .map(t => ({ ...interpretarLinha(t), erro: '', aviso: '', incluir: false, horaCalc: '' }));
  const vistos: Record<string, number> = {};
  let prontas = 0, repetidas = 0, problemas = 0;
  linhas.forEach((r, i) => {
    r.erro = !r.processo ? 'Nº do processo não reconhecido' : !r.autor ? 'Falta o nome do autor' : '';
    if (!r.erro){
      const k = soDigitos(r.processo);
      if (vistos[k] !== undefined) r.aviso = 'Repetido na lista (linha ' + (vistos[k] + 1) + ')';
      else {
        vistos[k] = i;
        const d = duplicadasDe(itens, r.processo);
        if (d.length) r.aviso = 'Já tem perícia ' + d.map(descrever).join('; ');
      }
    }
    r.incluir = !r.erro && (!r.aviso || !!forcar[i]);
    if (r.erro) problemas++; else if (r.aviso && !r.incluir) repetidas++; else prontas++;
  });
  // Horários em sequência: começa na hora da primeira e soma o intervalo; hora escrita na linha reinicia a sequência
  const passo = Math.max(0, intervalo || 0);
  let t = paraMinutos(horaInicial || '08:00');
  for (const r of linhas){
    if (!r.incluir) continue;
    if (r.hora) t = paraMinutos(r.hora);
    r.horaCalc = deMinutos(t);
    t += passo;
  }
  return { linhas, prontas, repetidas, problemas };
}
export function resumoDoLote(n: { linhas: unknown[]; prontas: number; repetidas: number; problemas: number }, semPerito: boolean): string {
  if (!n.linhas.length) return '';
  return n.prontas + (n.prontas === 1 ? ' pronta' : ' prontas') +
    (n.repetidas ? ' · ' + n.repetidas + (n.repetidas === 1 ? ' repetida (não será cadastrada)' : ' repetidas (não serão cadastradas)') : '') +
    (n.problemas ? ' · ' + n.problemas + ' com problema' : '') + (semPerito ? ' · escolha o perito' : '');
}

// ---- alteração em lote ----
// Sugere a data: todas no mesmo dia → esse dia; senão, hoje
export function dataSugerida(st: string, sel: Pericia[], agora: Date): string {
  if (st === 'realizada'){
    const dias = new Set(sel.filter(p => p.data).map(p => chaveDoDia(p.data!)));
    const k = [...dias];
    if (k.length === 1 && sel.every(p => p.data) && k[0] <= chaveDoDia(agora)) return k[0];
    return chaveDoDia(agora);
  }
  if (st === 'laudo_juntado') return chaveDoDia(agora);
  return '';
}
// Mantém a ordem em que as perícias já estavam (pela data atual; sem data, pelo processo)
export function ordemDoLote(sel: Pericia[]): Pericia[] {
  return sel.slice().sort((a, b) => {
    const x = a.data ? a.data.getTime() : Infinity, y = b.data ? b.data.getTime() : Infinity;
    return (x === y ? 0 : x - y) || a.processo.localeCompare(b.processo);
  });
}

// Lista da aba Peritos: os cadastrados e os nomes usados em perícias ainda sem cadastro, filtrados pela busca
export type LinhaPerito = Perito & { cadastrado: boolean };
export function listaDePeritos(peritos: Perito[], nomes: string[], busca: string): LinhaPerito[] {
  const q = normalizar(busca).trim();
  let lista: LinhaPerito[] = peritos.map(x => ({ ...x, cadastrado: true }));
  nomes.forEach(n => { if (!peritoCadastrado(peritos, n)) lista.push({ id: '', nome: n, especialidade: '', telefone: '', email: '', observacoes: '', cadastrado: false }); });
  if (q) lista = lista.filter(x => [x.nome, x.especialidade, x.telefone, x.email, x.observacoes].some(c => normalizar(c).includes(q)));
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
