'use client';
// Campo do número do processo: pontos e traço entram enquanto se digita; ao sair, formata no padrão CNJ
import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';
import { digitarCNJ, formatarProcesso } from '@/lib/processo';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void };

export function CampoProcesso({ value, onChange, onBlur, ...resto }: Props){
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursor.current !== null && ref.current && document.activeElement === ref.current){
      try { ref.current.setSelectionRange(cursor.current, cursor.current); } catch { /* campo sem seleção */ }
    }
    cursor.current = null;
  });
  return (
    <input {...resto} ref={ref} data-cnj="" value={value}
      onChange={e => {
        const el = e.target, tipo = (e.nativeEvent as InputEvent).inputType || '';
        const r = digitarCNJ(el.value, el.selectionStart ?? el.value.length, value, tipo);
        cursor.current = r.cursor;
        onChange(r.valor);
      }}
      onBlur={e => { onChange(formatarProcesso(e.target.value)); onBlur?.(e); }} />
  );
}
