'use client';
// Impressão da lista que está na tela (Audiências e, depois, Perícias): monta a folha em #printArea,
// direto no <body>, e chama a impressão do navegador. O resto da página some na impressão (legado.css).
import { useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';

type Folha = { titulo: string; filtro: string; total: string; corpo: ReactNode; emitido: Date };
const dois = (n: number) => (n < 10 ? '0' : '') + n;

export function useImpressao(){
  const [folha, setFolha] = useState<Folha | null>(null);
  function imprimir(titulo: string, filtro: string, total: string, corpo: ReactNode){
    flushSync(() => setFolha({ titulo, filtro, total, corpo, emitido: new Date() }));
    window.print();
  }
  const area = typeof document === 'undefined' ? null : createPortal(
    <div id="printArea" aria-hidden="true">
      {folha && <>
        <div className="pr-head">
          <div className="pr-logo"><img src="/brasao/menu.svg" alt="" /></div>
          <div className="pr-tit">
            <div className="pr-org">2ª Vara · Portal da secretaria</div>
            <h1>{folha.titulo}</h1>
            {folha.filtro && <div className="pr-filtro">{folha.filtro}</div>}
          </div>
          <div className="pr-meta">Emitido em {dois(folha.emitido.getDate())}/{dois(folha.emitido.getMonth() + 1)}/{folha.emitido.getFullYear()} às {dois(folha.emitido.getHours())}:{dois(folha.emitido.getMinutes())}<br /><b>{folha.total}</b></div>
        </div>
        {folha.corpo}
      </>}
    </div>,
    document.body
  );
  return { imprimir, area };
}
