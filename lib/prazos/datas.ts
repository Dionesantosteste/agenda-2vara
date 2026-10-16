// Datas da calculadora de prazos: sempre ao meio-dia, para não sofrer com horário de verão.
export const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const dois = (n: number) => (n < 10 ? '0' : '') + n;

export function D(ano: number, mes: number, dia: number): Date { return new Date(ano, mes, dia, 12); }
export function hoje(): Date { const t = new Date(); return D(t.getFullYear(), t.getMonth(), t.getDate()); }
export function chave(d: Date): string { return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()); }
export function lerData(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? D(+m[1], +m[2] - 1, +m[3]) : null;
}
export function somaDias(d: Date, n: number): Date { return D(d.getFullYear(), d.getMonth(), d.getDate() + n); }
export function fmt(d: Date): string { return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear(); }
export function diaDaSemana(d: Date): string { return DIAS_DA_SEMANA[d.getDay()]; }
export function mesmoDia(a: Date | null | undefined, b: Date | null | undefined): boolean { return !!a && !!b && chave(a) === chave(b); }
export function diasEntre(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 864e5); }
// CC, art. 132, § 3º: vence no dia de igual número; se não existir, no dia seguinte
export function somaMeses(d: Date, n: number): Date {
  const y = d.getFullYear(), m = d.getMonth() + n, ult = new Date(y, m + 1, 0).getDate();
  return d.getDate() > ult ? D(y, m + 1, 1) : D(y, m, d.getDate());
}
export function plural(n: number, s: string, p: string): string { return n + ' ' + (n === 1 ? s : p); }
export function esc(s: unknown): string {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
