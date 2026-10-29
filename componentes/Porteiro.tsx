'use client';
// Porteiro do site: quem não entrou com e-mail e senha é levado para /entrar e nada é mostrado.
// (A proteção de verdade dos dados está no banco, sql/acesso.sql; isto só cuida da tela.)
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { caminhoPublico } from '@/lib/acesso';

type Sessao = { email: string; admin: boolean; sair: () => void };
const Contexto = createContext<Sessao>({ email: '', admin: false, sair: () => {} });
export function useSessao(){ return useContext(Contexto); }

function irParaEntrar(){
  const volta = location.pathname + location.search + location.hash;
  location.replace('/entrar?volta=' + encodeURIComponent(volta));
}

export function Porteiro({ children }: { children: ReactNode }){
  const [sessao, setSessao] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(false);
  const publica = caminhoPublico(usePathname() || '/');

  useEffect(() => {
    const auth = supabase().auth;
    auth.getSession().then(({ data }) => { setSessao(data.session); setPronto(true); if (!data.session && !caminhoPublico(location.pathname)) irParaEntrar(); });
    const { data: assinatura } = auth.onAuthStateChange((evento, nova) => {
      setSessao(nova);
      if (evento === 'SIGNED_OUT' && !caminhoPublico(location.pathname)) irParaEntrar();
    });
    return () => assinatura.subscription.unsubscribe();
  }, []);

  const sair = () => { supabase().auth.signOut().finally(() => { location.replace('/entrar'); }); };
  const valor: Sessao = { email: sessao?.user.email || '', admin: sessao?.user.app_metadata?.admin === true, sair };

  if (publica) return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
  if (!pronto || !sessao) return <div className="porteiro-espera" role="status" aria-live="polite">Verificando o acesso…</div>;
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
