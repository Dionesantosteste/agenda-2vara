'use client';
// Janela de tipos de audiência: cadastrar, renomear (as audiências acompanham) e excluir (pede confirmação)
import { useEffect, useRef, useState } from 'react';
import { erroDosTipos } from '@/lib/audiencias';
import { normalizar } from '@/lib/agenda';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';
import { useJanela } from '@/componentes/useJanela';

export type Tipo = { id: string; nome: string };
const limpa = (s: string) => s.trim().replace(/\s+/g, ' ');

function Linha({ t, usadas, renomeado, excluido }: { t: Tipo; usadas: number; renomeado: (antigo: string, novo: string) => Promise<void>; excluido: (nome: string) => Promise<void> }){
  const avisar = useAviso();
  const [armado, setArmado] = useState(false);
  async function renomear(campo: HTMLInputElement){
    const novo = limpa(campo.value);
    if (!novo || novo === t.nome){ campo.value = t.nome; return; }
    const res = await supabase().from('audiencias_tipos').update({ nome: novo }).eq('id', t.id);
    if (res.error){ avisar(erroDosTipos(res.error)); campo.value = t.nome; return; }
    const up = await supabase().from('audiencias').update({ tipo: novo }).eq('tipo', t.nome);
    avisar(up.error ? 'Tipo renomeado, mas não foi possível atualizar as audiências: ' + up.error.message : 'Tipo renomeado');
    await renomeado(t.nome, novo);
  }
  async function excluir(){
    if (!armado){ setArmado(true); return; }
    const res = await supabase().from('audiencias_tipos').delete().eq('id', t.id);
    if (res.error){ avisar(erroDosTipos(res.error)); return; }
    avisar('Tipo excluído da lista');
    await excluido(t.nome);
  }
  return (
    <div className="cat-row">
      <input defaultValue={t.nome} maxLength={60} aria-label={'Nome do tipo ' + t.nome} onBlur={e => renomear(e.currentTarget)}
        onKeyDown={e => { if (e.key === 'Enter'){ e.preventDefault(); e.currentTarget.blur(); } }} />
      <button type="button" className={'icon-btn danger' + (armado ? ' armed' : '')} title="Excluir tipo" aria-label={'Excluir o tipo ' + t.nome}
        style={armado ? { width: 'auto' } : undefined} onClick={excluir}>
        {armado
          ? <span style={{ fontSize: 12, padding: '0 6px', color: 'var(--danger)', whiteSpace: 'nowrap' }}>Excluir?{usadas ? ' (' + usadas + ' audiência' + (usadas === 1 ? '' : 's') + ' mantém o nome)' : ''}</span>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
      </button>
    </div>
  );
}

export function DialogoTipos({ aberto, fechar, tipos, erro, usadas, recarregar, renomeado, excluido, escolhido }: {
  aberto: boolean; fechar: () => void; tipos: Tipo[]; erro: string | null; usadas: (nome: string) => number;
  recarregar: () => Promise<void>; renomeado: (antigo: string, novo: string) => Promise<void>; excluido: (nome: string) => Promise<void>;
  escolhido: (nome: string) => void;   // tipo novo pedido por uma lista de tipo: já fica escolhido nela
}){
  const avisar = useAviso();
  const { ref, cliqueFora, aoFechar } = useJanela(aberto, fechar);
  const [novo, setNovo] = useState('');
  const novoRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!aberto) return; setNovo(''); setTimeout(() => novoRef.current?.focus(), 30); }, [aberto]);

  async function adicionar(){
    let nome = limpa(novo);
    if (!nome){ novoRef.current?.focus(); return; }
    const existente = tipos.find(t => normalizar(t.nome) === normalizar(nome));
    if (!existente){
      const res = await supabase().from('audiencias_tipos').insert({ nome });
      if (res.error){ avisar(erroDosTipos(res.error)); return; }
      avisar('Tipo "' + nome + '" cadastrado');
    } else nome = existente.nome;
    setNovo('');
    await recarregar();
    escolhido(nome);
  }

  const lista = tipos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return (
    <dialog id="tiposDialog" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      <form className="sheet" id="tiposForm" onSubmit={e => e.preventDefault()}>
        <h2>Tipos de audiência</h2>
        <p className="field-hint" style={{ margin: '-6px 0 0' }}>Renomear atualiza as audiências que usam o tipo. Excluir só tira da lista; as audiências antigas mantêm o nome.</p>
        <div className="cat-list" id="tiposLista">
          {erro ? <div className="cat-empty">{erro}</div>
            : !lista.length ? <div className="cat-empty">Nenhum tipo cadastrado ainda.</div>
            : lista.map(t => <Linha key={t.id + ':' + t.nome} t={t} usadas={usadas(t.nome)} renomeado={renomeado} excluido={excluido} />)}
        </div>
        <div className="cat-row">
          <input id="tipoNovo" ref={novoRef} maxLength={60} placeholder="Novo tipo (ex.: Conciliação)" value={novo} onChange={e => setNovo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter'){ e.preventDefault(); adicionar(); } }} />
          <button type="button" className="icon-btn" id="tipoAdd" title="Adicionar tipo" aria-label="Adicionar tipo" onClick={adicionar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div className="sheet-actions">
          <div style={{ marginLeft: 'auto' }}>
            <button type="button" className="btn" id="tiposFechar" onClick={fechar}>Fechar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
