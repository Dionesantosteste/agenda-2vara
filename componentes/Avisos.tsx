'use client';
// Aviso rápido no rodapé da tela (o "toast" do sistema atual): some sozinho depois de 2,2 s
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const Contexto = createContext<(msg: string) => void>(() => {});

export function useAviso(){ return useContext(Contexto); }

export function Avisos({ children }: { children: ReactNode }){
  const [msg, setMsg] = useState('');
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = useCallback((m: string) => {
    setMsg(m); setVisivel(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisivel(false), 2200);
  }, []);
  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className={'toast' + (visivel ? ' show' : '')} id="toast" role="status">{msg}</div>
    </Contexto.Provider>
  );
}
