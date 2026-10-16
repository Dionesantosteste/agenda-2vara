// Ícones do menu (os mesmos do sistema atual)
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export function IconeSecao({ id }: { id: string }){
  switch (id){
    case 'agenda': return <svg {...base}><rect x="4" y="3" width="14" height="18" rx="2"/><circle cx="11" cy="10" r="2.5"/><path d="M7 17c.8-1.9 2.2-2.9 4-2.9s3.2 1 4 2.9"/><path d="M18 7h2M18 12h2M18 17h2"/></svg>;
    case 'audiencias': return <svg {...base}><path d="M12 3v17"/><path d="M8 20h8"/><path d="M5 7h14"/><path d="M5 7l-3 6.5a3 3 0 0 0 6 0z"/><path d="M19 7l-3 6.5a3 3 0 0 0 6 0z"/></svg>;
    case 'pericias': return <svg {...base}><circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20"/><path d="M8 10h4M10 8v4"/></svg>;
    case 'prazos': return <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/><path d="M12 13.5v3l2 1.2"/></svg>;
    case 'organizacao': return <svg {...base}><path d="M9 4h6"/><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 11l2 2 4-4"/><path d="M9 17h6"/></svg>;
    default: return null;
  }
}

export function IconeAparencia(){
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg>;
}

export function IconeMenu(){
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>;
}

// Engrenagem dos botões "categorias" e "tipos"
export function IconeEngrenagem(){
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
