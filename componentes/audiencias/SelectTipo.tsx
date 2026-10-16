'use client';
// Lista de tipos de audiência: um tipo antigo fora da lista continua aparecendo;
// "+ Cadastrar novo tipo…" abre a janela de tipos e o tipo criado já fica escolhido
import type { SelectHTMLAttributes } from 'react';

const NOVO = '__novo__';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  nomes: string[]; value: string; onChange: (v: string) => void; novoTipo: () => void;
};

export function SelectTipo({ nomes, value, onChange, novoTipo, ...resto }: Props){
  const opcoes = value && !nomes.includes(value) ? [...nomes, value] : nomes;
  return (
    <select {...resto} value={value} onChange={e => { if (e.target.value === NOVO) novoTipo(); else onChange(e.target.value); }}>
      <option value="" disabled>Selecione…</option>
      {opcoes.map(t => <option key={t} value={t}>{t}</option>)}
      <option value={NOVO}>+ Cadastrar novo tipo…</option>
    </select>
  );
}
