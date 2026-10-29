// Cartão central das telas de entrada (sem menu lateral: quem não entrou não vê o sistema)
import type { ReactNode } from 'react';

export function Cartao({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }){
  return (
    <main className="acesso-tela">
      <section className="acesso-cartao panel" aria-labelledby="acTitulo">
        <img src="/brasao/menu.svg" alt="" aria-hidden="true" className="acesso-brasao" />
        <h1 id="acTitulo">{titulo}</h1>
        <p className="acesso-sub">{sub}</p>
        {children}
      </section>
    </main>
  );
}
