'use client';
// Botão flutuante do Assistente: acompanha o gestor em todas as telas do portal (fica na moldura
// e no Arquivo). Aparece só quando a senha do gestor está guardada nesta aba (entrou na
// Organização como gestor); a equipe não vê. Abre um painel lateral com /assistente-painel.
// Ao trocar de tela, a conversa continua (fica guardada na aba) e o painel reabre se estava aberto.
import { useEffect, useState } from 'react';
import { lerPin } from './comum';

const lerAberto = () => { try { return sessionStorage.getItem('astAberto') === '1'; } catch { return false; } };
const gravarAberto = (v: boolean) => { try { if (v) sessionStorage.setItem('astAberto', '1'); else sessionStorage.removeItem('astAberto'); } catch { /* sem armazenamento */ } };

export function BotaoAssistente(){
  const [gestor, setGestor] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);

  // a senha entra e sai pela Organização (Entrar / Trancar): confere a cada segundo
  useEffect(() => {
    const confere = () => {
      const tem = !!lerPin();
      setGestor(tem);
      if (!tem){ setAberto(false); setCarregado(false); gravarAberto(false); }
    };
    confere();
    if (lerPin() && lerAberto()){ setCarregado(true); setAberto(true); }
    const t = setInterval(confere, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) mudar(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]);

  function mudar(v: boolean){
    if (v) setCarregado(true);
    setAberto(v);
    gravarAberto(v);
    if (!v) setTimeout(() => document.getElementById('astFab')?.focus(), 0);
  }

  if (!gestor) return null;
  return (
    <>
      <button type="button" className="ast-fab" id="astFab" aria-expanded={aberto} aria-controls="astGaveta" title="Assistente (IA)"
        hidden={aberto} onClick={() => mudar(true)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path className="ast-brilho" d="M10 3l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7z" /><path className="ast-brilho-p" d="M18 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>
        <span>Assistente</span>
      </button>
      <aside className="ast-gaveta" id="astGaveta" role="dialog" aria-label="Assistente" hidden={!aberto}>
        <div className="ast-gaveta-topo">
          <strong><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 3l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7z" /><path d="M18 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg><span>Assistente</span></strong>
          <button type="button" className="icon-btn" id="astGavetaFechar" title="Fechar (Esc)" aria-label="Fechar o Assistente" onClick={() => mudar(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {carregado && <iframe className="ast-gaveta-quadro" id="astQuadro" src="/assistente-painel" title="Assistente" />}
      </aside>
    </>
  );
}
