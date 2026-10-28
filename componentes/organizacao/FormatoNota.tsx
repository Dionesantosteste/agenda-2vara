'use client';
// Anotações da tarefa: barra com negrito, itálico e marcador amarelo, e o texto já formatado
import type { KeyboardEvent } from 'react';
import { MARCAS_NOTA, aplicarMarca, partesDaNota } from '@/lib/organizacao';

type Tipo = keyof typeof MARCAS_NOTA;

// Aplica a marca no trecho selecionado do campo e devolve o texto novo (quem chama grava no estado)
export function formatarCampo(id: string, tipo: Tipo, valor: string, gravar: (v: string) => void){
  const ta = document.getElementById(id) as HTMLTextAreaElement | null;
  if (!ta) return;
  const r = aplicarMarca(valor, ta.selectionStart, ta.selectionEnd, MARCAS_NOTA[tipo]);
  gravar(r.texto);
  setTimeout(() => { ta.focus(); ta.setSelectionRange(r.ini, r.fim); }, 0);
}
// Ctrl+B e Ctrl+I; devolve true quando tratou a tecla
export function atalhoDeFormato(e: KeyboardEvent<HTMLTextAreaElement>, id: string, valor: string, gravar: (v: string) => void): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return false;
  const k = e.key.toLowerCase();
  if (k !== 'b' && k !== 'i') return false;
  e.preventDefault();
  formatarCampo(id, k, valor, gravar);
  return true;
}

export function BarraFormato({ alvo, valor, gravar }: { alvo: string; valor: string; gravar: (v: string) => void }){
  const bt = (tipo: Tipo, titulo: string, rotulo: string, conteudo: React.ReactNode) => (
    <button type="button" className="fmt-btn" data-fmt={tipo} title={titulo} aria-label={rotulo} onClick={() => formatarCampo(alvo, tipo, valor, gravar)}>{conteudo}</button>
  );
  return (
    <div className="fmt-bar" role="group" aria-label="Formatar anotação">
      {bt('b', 'Negrito (Ctrl+B)', 'Negrito', <b>B</b>)}
      {bt('i', 'Itálico (Ctrl+I)', 'Itálico', <i>I</i>)}
      {bt('m', 'Marcador amarelo', 'Marcador amarelo', <span>A</span>)}
    </div>
  );
}

export function TextoNota({ texto }: { texto: string }){
  return <>{partesDaNota(texto).map((p, i) => p.f === 'b' ? <strong key={i}>{p.t}</strong> : p.f === 'i' ? <em key={i}>{p.t}</em> : p.f === 'm' ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>)}</>;
}
