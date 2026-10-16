'use client';
import { useEffect, useRef, type MouseEvent } from 'react';

// Abre e fecha um <dialog> nativo conforme "aberto"; fecha também ao clicar fora da janela
export function useJanela(aberto: boolean, fechar: () => void){
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  const cliqueFora = (e: MouseEvent<HTMLDialogElement>) => { if (e.target === e.currentTarget) fechar(); };
  return { ref, cliqueFora, aoFechar: () => { if (aberto) fechar(); } };
}
