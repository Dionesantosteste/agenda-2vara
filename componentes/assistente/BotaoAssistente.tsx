'use client';
// Botão flutuante do Assistente na tela do gestor (Organização): abre um painel lateral com o
// Assistente (/assistente-painel) sem tirar o gestor da tela. O painel só carrega na primeira vez
// que é aberto e continua aberto por cima do quadro, para consultar e trabalhar ao mesmo tempo.
import { useEffect, useState } from 'react';

export function BotaoAssistente(){
  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) setAberto(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]);
  return (
    <>
      <button type="button" className="ast-fab" id="astFab" aria-expanded={aberto} aria-controls="astGaveta" title="Assistente (IA)"
        hidden={aberto} onClick={() => { setCarregado(true); setAberto(true); }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /><path d="M9 9h6M9 12h4" /></svg>
        <span>Assistente</span>
      </button>
      <aside className="ast-gaveta" id="astGaveta" role="dialog" aria-label="Assistente" hidden={!aberto}>
        <div className="ast-gaveta-topo">
          <strong>Assistente</strong>
          <button type="button" className="icon-btn" id="astGavetaFechar" title="Fechar (Esc)" aria-label="Fechar o Assistente" onClick={() => setAberto(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {carregado && <iframe className="ast-gaveta-quadro" id="astQuadro" src="/assistente-painel" title="Assistente" />}
      </aside>
    </>
  );
}
