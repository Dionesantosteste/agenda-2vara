// Peças pequenas do Arquivo: ícones, carimbos e as linhas datilografadas das fichas.
import type { ReactNode } from 'react';
import { SITUACOES, type Caixa } from '@/lib/arquivo';

export function Sprite(){
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="aq-i-busca" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
      <symbol id="aq-i-estante" viewBox="0 0 24 24"><path d="M4 3v18M20 3v18M4 9h16M4 15h16M4 21h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="7" y="5" width="3" height="4" fill="currentColor" rx=".5" /><rect x="11" y="6" width="3" height="3" fill="currentColor" rx=".5" /><rect x="8" y="11" width="4" height="4" fill="currentColor" rx=".5" /><rect x="14" y="17" width="3" height="4" fill="currentColor" rx=".5" /></symbol>
      <symbol id="aq-i-camera" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></symbol>
      <symbol id="aq-i-conf" viewBox="0 0 24 24"><path d="M9 4h6M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M8 6H6v15h12V6h-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 13l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="aq-i-hist" viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6M9 11h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></symbol>
      <symbol id="aq-i-caixa" viewBox="0 0 24 24"><path d="M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></symbol>
      <symbol id="aq-i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
      <symbol id="aq-i-alerta" viewBox="0 0 24 24"><path d="M12 3l10 18H2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 10v5M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
      <symbol id="aq-i-volta" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></symbol>
    </svg>
  );
}

export function Icone({ n, t = 18 }: { n: string; t?: number }){
  return <svg width={t} height={t} aria-hidden="true"><use href={'#aq-i-' + n} /></svg>;
}

export function Carimbo({ s, grande }: { s: number; grande?: boolean }){
  return <span className={(grande ? 'aq-carimbo' : 'aq-pill') + ' aq-s' + s}>{SITUACOES[s]}</span>;
}

// Linhas de ficha: Prateleira / Fileira / Caixa (ou Estante / Secretaria) e outras
export function linhasDoLocal(c: Caixa | undefined): [string, ReactNode][] {
  if (!c) return [['Caixa', '—']];
  if (c.secretaria) return [['Estante', 'Outra Secretaria'], ['Secretaria', c.nome]];
  const l = c.locais[0];
  return [['Prateleira', l ? l[0] : '—'], ['Fileira', l ? l[1] : '—'], ['Caixa', c.nome]];
}
export function LinhasFicha({ linhas, className = 'aq-linhas-ficha' }: { linhas: [string, ReactNode][]; className?: string }){
  return <dl className={className}>{linhas.map(([r, v]) => <FichaLinha key={r} r={r} v={v} />)}</dl>;
}
function FichaLinha({ r, v }: { r: string; v: ReactNode }){
  return <><dt>{r}</dt><dd>{v}</dd></>;
}

export function Vazio({ titulo, children, icone = 'caixa' }: { titulo: ReactNode; children?: ReactNode; icone?: string }){
  return <div className="aq-card aq-vazio"><Icone n={icone} t={28} /><b>{titulo}</b>{children && <span>{children}</span>}</div>;
}
