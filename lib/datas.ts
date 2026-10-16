// Datas no horário da vara (Cuiabá). Os mesmos formatos do sistema atual.

export const FUSO_VARA = 'America/Cuiaba';

const doisDigitos = (n: number) => (n < 10 ? '0' : '') + n;

// AAAA-MM-DD no horário da vara (o "hoje" da vara, como org_hoje() no banco)
export function diaDaVara(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_VARA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// AAAA-MM-DD da data no fuso do computador (o dayKey do sistema atual)
export function chaveDoDia(d: Date): string {
  return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate());
}

// 16/10/2026 às 14:30
export function formatarDataHora(d: Date): string {
  return doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1) + '/' + d.getFullYear() + ' às ' + doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
}

// "Sexta-feira, 16 de outubro" (rodapé do menu)
export function dataPorExtenso(d: Date = new Date()): string {
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
