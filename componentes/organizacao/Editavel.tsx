'use client';
// Texto que se edita clicando nele (título da tarefa, nota, lembrete, rotina): salva ao sair;
// Esc desfaz; Enter salva (na nota, Enter quebra a linha)
import { useRef, type KeyboardEvent } from 'react';

// "plaintext-only" evita colar formatação; navegadores antigos ficam com "true"
let modoEdicao: 'plaintext-only' | 'true' | null = null;
function contentEditable(){
  if (modoEdicao) return modoEdicao;
  const d = document.createElement('div');
  try { d.contentEditable = 'plaintext-only'; } catch { return (modoEdicao = 'true'); }
  return (modoEdicao = d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true');
}

export function Editavel({ texto, tipo, id, className, como = 'span', salvar, limite, multilinha, ...resto }: {
  texto: string; tipo: string; id: string; className?: string; como?: 'span' | 'div'; limite?: number; multilinha?: boolean;
  salvar: (txt: string, el: HTMLElement, original: string) => void;
} & Record<string, string | number | boolean | undefined | ((...a: never[]) => unknown)>){
  const original = useRef('');
  const Tag = como;
  return (
    <Tag key={id + ':' + texto} className={className} contentEditable={contentEditable() as 'true'} suppressContentEditableWarning spellCheck
      data-edit={tipo} data-id={id} {...resto}
      onFocus={e => { original.current = e.currentTarget.innerText; }}
      onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
        const el = e.currentTarget;
        if (e.key === 'Escape'){ el.innerText = original.current; el.blur(); }
        if (e.key === 'Enter' && !multilinha){ e.preventDefault(); el.blur(); }
        if (limite && el.innerText.length >= limite && e.key.length === 1 && !e.ctrlKey && !e.metaKey) e.preventDefault();
      }}
      onBlur={e => { const el = e.currentTarget; salvar(el.innerText.replace(/\n{3,}/g, '\n\n').trim(), el, original.current); }}>
      {texto}
    </Tag>
  );
}
