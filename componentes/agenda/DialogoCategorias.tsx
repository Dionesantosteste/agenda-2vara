'use client';
// Janela de categorias: acrescentar, renomear (os contatos acompanham) e excluir
import { useEffect, useRef, useState } from 'react';
import { useAviso } from '@/componentes/Avisos';
import { useJanela } from '@/componentes/useJanela';

export function DialogoCategorias({ aberto, fechar, categorias, acrescentar, renomear, excluir }: {
  aberto: boolean; fechar: () => void; categorias: string[];
  acrescentar: (nome: string) => void; renomear: (antigo: string, novo: string) => void; excluir: (nome: string) => void;
}){
  const avisar = useAviso();
  const { ref, cliqueFora, aoFechar } = useJanela(aberto, fechar);
  const [nova, setNova] = useState('');
  const novaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setNova('');
    setTimeout(() => novaRef.current?.focus(), 30);
  }, [aberto]);

  function adicionar(){
    const n = nova.trim();
    if (!n) return;
    if (categorias.includes(n)){ avisar('Essa categoria já existe'); return; }
    acrescentar(n);
    setNova('');
    novaRef.current?.focus();
  }
  function trocarNome(antigo: string, campo: HTMLInputElement){
    const n = campo.value.trim();
    if (!n){ campo.value = antigo; return; }
    if (n === antigo) return;
    if (categorias.includes(n)){ avisar('Já existe uma categoria com esse nome'); campo.value = antigo; return; }
    renomear(antigo, n);
  }

  return (
    <dialog id="catDialog" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      <form className="sheet" id="catForm" onSubmit={e => e.preventDefault()}>
        <h2>Categorias</h2>
        <div className="cat-list" id="catList">
          {categorias.length === 0 ? <div className="cat-empty">Nenhuma categoria ainda.</div> : categorias.map(cat => (
            <div className="cat-row" key={cat}>
              <input defaultValue={cat} onBlur={e => trocarNome(cat, e.currentTarget)}
                onKeyDown={e => { if (e.key === 'Enter'){ e.preventDefault(); e.currentTarget.blur(); } }} />
              <button type="button" className="icon-btn danger" title="Excluir categoria" onClick={() => excluir(cat)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          ))}
        </div>
        <div className="cat-row">
          <input id="newCatName" ref={novaRef} maxLength={30} placeholder="Nova categoria" value={nova} onChange={e => setNova(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter'){ e.preventDefault(); adicionar(); } }} />
          <button type="button" className="icon-btn" id="addCatBtn" title="Adicionar categoria" onClick={adicionar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div className="sheet-actions">
          <div style={{ marginLeft: 'auto' }}>
            <button type="button" className="btn" id="closeCatBtn" onClick={fechar}>Fechar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
