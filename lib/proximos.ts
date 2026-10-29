// Card "Próximos 7 dias" da barra lateral: em quais dias há audiência ou perícia marcada, de hoje até daqui a 7 dias.
// Fica de fora: audiência cancelada e perícia que não está marcada (não agendada, realizada, laudo juntado, cancelada).
import { chaveDoDia } from './datas.ts';

export const DIAS_AVISO = 7;
export type Urgencia = 'red' | 'orange' | 'yellow';
export type DiaMarcado = { chave: string; data: Date; n: number; qtd: number; urgencia: Urgencia };

const inicioDoDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const urgenciaDoDia = (n: number): Urgencia => (n <= 1 ? 'red' : n <= 3 ? 'orange' : 'yellow');
export const rotuloDoDia = (n: number) => (n === 0 ? 'hoje' : n === 1 ? 'amanhã' : 'em ' + n + ' dias');

// datas: as datas já filtradas (audiência não cancelada, perícia marcada); agrupa por dia, em ordem
export function diasMarcados(datas: (Date | null)[], agora: Date): DiaMarcado[] {
  const hoje = inicioDoDia(agora), fim = somaDias(hoje, DIAS_AVISO + 1);
  const por = new Map<string, DiaMarcado>();
  for (const d of datas){
    if (!d || d < hoje || d >= fim) continue;
    const k = chaveDoDia(d);
    const g = por.get(k);
    if (g){ g.qtd++; continue; }
    const n = Math.round((inicioDoDia(d).getTime() - hoje.getTime()) / 86400000);
    por.set(k, { chave: k, data: d, n, qtd: 1, urgencia: urgenciaDoDia(n) });
  }
  return [...por.values()].sort((a, b) => a.n - b.n);
}

// O que a seção abre ao clicar: "AAAA-MM-DD" (um dia) ou "AAAA-MM-DD_AAAA-MM-DD" (hoje até daqui a 7 dias)
export function hashDoPeriodo(de: string, ate: string): string { return de === ate ? de : de + '_' + ate; }
export function lerPeriodoDoHash(hash: string): { de: string; ate: string } | null {
  const m = String(hash || '').replace(/^#/, '').match(/^(\d{4}-\d{2}-\d{2})(?:_(\d{4}-\d{2}-\d{2}))?$/);
  return m ? { de: m[1], ate: m[2] || m[1] } : null;
}
