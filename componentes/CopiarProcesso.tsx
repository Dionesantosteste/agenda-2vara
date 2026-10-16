'use client';
// Botão com o número do processo: um clique copia (Perícias e Organização)
import { useState } from 'react';
import { useAviso } from '@/componentes/Avisos';

const IconeCopiar = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>;

export function CopiarProcesso({ proc }: { proc: string }){
  const avisar = useAviso();
  const [copiado, setCopiado] = useState(false);
  function copiar(){
    const ok = () => { avisar('Número copiado: ' + proc); setCopiado(true); setTimeout(() => setCopiado(false), 1500); };
    const reserva = () => {
      const ta = document.createElement('textarea');
      ta.value = proc; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let feito = false;
      try { feito = document.execCommand('copy'); } catch { /* sem cópia */ }
      ta.remove();
      if (feito) ok(); else avisar('Não foi possível copiar. Selecione o número e use Ctrl+C.');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(proc).then(ok, reserva);
    else reserva();
  }
  return (
    <button type="button" className={'proc-copy' + (copiado ? ' copied' : '')} data-act="copiar" data-proc={proc} title="Copiar número do processo" aria-label={'Copiar número do processo ' + proc} onClick={copiar}>
      {proc}<IconeCopiar />
    </button>
  );
}
