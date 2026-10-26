'use client';
// Texto que se edita clicando nele (como no sistema atual): salva ao sair do campo, Esc desfaz,
// Enter salva (menos nas notas, em que Enter pula linha). Branco ou igual ao que estava: não salva.
import { useLayoutEffect, useRef, type ElementType } from 'react';

// Onde o navegador aceita, só texto puro (sem negrito nem imagem colados)
const modo = (): 'plaintext-only' | 'true' => {
  if (typeof document === 'undefined') return 'true';
  const d = document.createElement('div');
  try { d.contentEditable = 'plaintext-only'; } catch { return 'true'; }
  return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
};

type Props = {
  texto: string;
  // devolve o texto já limpo; "vazio" só é aceito quando permiteVazio
  aoSalvar: (novo: string) => void;
  como?: ElementType;
  className?: string;
  titulo?: string;
  rotulo?: string;
  multilinha?: boolean;
  permiteVazio?: boolean;
  maxLetras?: number;
  dataEdit?: string;
};

export function Editavel({ texto, aoSalvar, como: Tag = 'span', className, titulo, rotulo, multilinha, permiteVazio, maxLetras, dataEdit }: Props){
  const ref = useRef<HTMLElement>(null);
  const original = useRef('');
  // o texto é posto à mão: o React não mexe no que a pessoa está digitando
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.innerText !== texto && document.activeElement !== el) el.innerText = texto;
  });
  return (
    <Tag ref={ref} className={className} contentEditable={modo()} suppressContentEditableWarning spellCheck={multilinha ? true : undefined}
      data-edit={dataEdit} title={titulo} role={multilinha ? 'textbox' : undefined} aria-multiline={multilinha ? true : undefined} aria-label={rotulo}
      onFocus={(e: React.FocusEvent<HTMLElement>) => { original.current = e.currentTarget.innerText; }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        const el = e.currentTarget;
        if (e.key === 'Escape'){ el.innerText = original.current; el.blur(); }
        if (e.key === 'Enter' && !multilinha){ e.preventDefault(); el.blur(); }
        if (maxLetras && el.innerText.length >= maxLetras && e.key.length === 1 && !e.ctrlKey && !e.metaKey) e.preventDefault();
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const el = e.currentTarget;
        let novo = el.innerText.replace(/\n{3,}/g, '\n\n').trim();
        if (maxLetras) novo = novo.replace(/\s+/g, ' ').slice(0, maxLetras);
        if (!novo && !permiteVazio){ el.innerText = original.current; return; }
        if (novo === original.current.trim()){ el.innerText = novo; return; }
        aoSalvar(novo);
        el.innerText = texto;   // volta ao que está guardado; quando a tela atualizar, entra o texto já corrigido
      }} />
  );
}
