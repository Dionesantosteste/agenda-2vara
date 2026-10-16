// Calendário de dias úteis: feriados nacionais (fixos e móveis), suspensões do tribunal que a vara
// marca, feriados da comarca cadastrados e o recesso de 20/12 a 20/01 (CPC, art. 220).
// A configuração fica na tabela prazos_config do Supabase e vale para toda a equipe.
import { D, chave, lerData, somaDias } from './datas.ts';

export type Extra = { id: string; data: string; nome: string; anual: boolean };
export type ConfigCalendario = { recesso: boolean; opc: Record<string, boolean>; extras: Extra[] };
export type Feriado = { nome: string; tipo: string };

export const FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Dia Nacional de Zumbi e da Consciência Negra', '12-25': 'Natal'
};
// dias contados a partir do domingo de Páscoa
export const MOVEIS: [number, string][] = [[-48, 'Carnaval (segunda-feira)'], [-47, 'Carnaval (terça-feira)'], [-2, 'Sexta-feira Santa'], [60, 'Corpus Christi']];
export const OPCIONAIS: { id: string; nome: string; pascoa?: number; md?: string; obs: string }[] = [
  { id: 'cinzas', nome: 'Quarta-feira de Cinzas', pascoa: -46, obs: 'Muitos tribunais só abrem à tarde. Se os prazos ficarem suspensos, marque.' },
  { id: 'qsanta', nome: 'Quinta-feira Santa', pascoa: -3, obs: 'Ponto facultativo em vários tribunais.' },
  { id: 'servidor', nome: 'Dia do Servidor Público (28/10)', md: '10-28', obs: 'Costuma ser transferido; confira a data na portaria do ano.' },
  { id: 'justica', nome: 'Dia da Justiça (08/12)', md: '12-08', obs: 'Sem expediente na maioria dos tribunais.' }
];
// Feriados locais fixos no código (formato "MM-DD"); os demais ficam no cadastro da aba Feriados
export const FERIADOS_EXTRAS: string[] = [];

export function configPadrao(): ConfigCalendario {
  return { recesso: true, opc: { cinzas: false, qsanta: false, servidor: false, justica: true }, extras: [] };
}

// Linhas da tabela prazos_config ("recesso", "opc.<id>", "extra.<id>") → configuração
export function configDasLinhas(linhas: { chave: string; valor: unknown }[]): ConfigCalendario {
  const cfg = configPadrao();
  for (const l of linhas){
    const k = l.chave || '', v = l.valor as { data?: string; nome?: string; anual?: boolean } | boolean | null;
    if (k === 'recesso') cfg.recesso = v !== false;
    else if (k.startsWith('opc.')) cfg.opc[k.slice(4)] = v === true;
    else if (k.startsWith('extra.') && v && typeof v === 'object' && v.data) cfg.extras.push({ id: k.slice(6), data: v.data, nome: v.nome || 'Feriado local', anual: !!v.anual });
  }
  cfg.extras.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return cfg;
}

export function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4,
    f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return D(ano, mes - 1, dia);
}

export class Calendario {
  readonly cfg: ConfigCalendario;
  private cache: Record<number, Record<string, Feriado>> = {};
  constructor(cfg: ConfigCalendario){ this.cfg = cfg; }

  feriadosDoAno(ano: number): Record<string, Feriado> {
    if (this.cache[ano]) return this.cache[ano];
    const map: Record<string, Feriado> = {}, p = pascoa(ano);
    for (const md of Object.keys(FIXOS)) map[ano + '-' + md] = { nome: FIXOS[md], tipo: 'Nacional' };
    for (const [dias, nome] of MOVEIS) map[chave(somaDias(p, dias))] = { nome, tipo: 'Nacional' };
    for (const o of OPCIONAIS){
      if (!this.cfg.opc[o.id]) continue;
      const d = o.md ? lerData(ano + '-' + o.md)! : somaDias(p, o.pascoa!);
      map[chave(d)] = { nome: o.nome, tipo: 'Tribunal' };
    }
    for (const md of FERIADOS_EXTRAS) map[ano + '-' + md] = { nome: 'Feriado local', tipo: 'Comarca (no código)' };
    for (const x of this.cfg.extras){
      const k = x.anual ? ano + '-' + x.data.slice(5) : x.data;
      if (k.slice(0, 4) === String(ano)) map[k] = { nome: x.nome, tipo: x.anual ? 'Comarca (todo ano)' : 'Avulso' };
    }
    this.cache[ano] = map;
    return map;
  }
  emRecesso(d: Date): boolean {
    const m = d.getMonth(), dia = d.getDate();
    return this.cfg.recesso && ((m === 11 && dia >= 20) || (m === 0 && dia <= 20));
  }
  // Motivo de o dia não ser útil, ou null se for útil
  motivo(d: Date): string | null {
    const f = this.feriadosDoAno(d.getFullYear())[chave(d)];
    if (f) return f.nome;
    if (this.emRecesso(d)) return 'Recesso forense';
    if (d.getDay() === 0) return 'Domingo';
    if (d.getDay() === 6) return 'Sábado';
    return null;
  }
  util(d: Date): boolean { return !this.motivo(d); }
  proxUtil(d: Date): Date { let x = somaDias(d, 1); while (!this.util(x)) x = somaDias(x, 1); return x; }   // primeiro dia útil depois de d
  utilOuProx(d: Date): Date { return this.util(d) ? d : this.proxUtil(d); }
  antUtil(d: Date): Date { let x = somaDias(d, -1); while (!this.util(x)) x = somaDias(x, -1); return x; }
  somaUteis(d: Date, n: number): Date { let x = d; for (let i = 0; i < n; i++) x = this.proxUtil(x); return x; }
  diasUteisEntre(a: Date, b: Date): number { let c = 0, x = a; while (x < b){ x = somaDias(x, 1); if (this.util(x)) c++; } return c; }
}
