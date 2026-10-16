'use client';
// Lista de peritos: os cadastrados (com a especialidade) e os já usados nas perícias
import type { SelectHTMLAttributes } from 'react';
import { ESPECIALIDADES, chaveNome, peritoCadastrado, type Perito } from '@/lib/pericias';

export const NOVO_PERITO = '__novo__';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  nomes: string[]; peritos: Perito[]; value: string; onChange: (v: string) => void; comNovo?: boolean;
};

export function SelectPerito({ nomes, peritos, value, onChange, comNovo, ...resto }: Props){
  const lista = value && value !== NOVO_PERITO && !nomes.map(chaveNome).includes(chaveNome(value)) ? [value, ...nomes] : nomes;
  // o valor da lista é o nome como aparece; um nome com outra grafia escolhe o mesmo perito
  const atual = value === NOVO_PERITO ? value : lista.find(n => chaveNome(n) === chaveNome(value)) || '';
  return (
    <select {...resto} value={atual} onChange={e => onChange(e.target.value)}>
      <option value="" disabled>Escolha o perito…</option>
      {lista.map(n => { const c = peritoCadastrado(peritos, n); return <option key={n} value={n}>{n}{c && c.especialidade ? ' · ' + c.especialidade : ''}</option>; })}
      {comNovo && <option value={NOVO_PERITO}>+ Cadastrar novo perito…</option>}
    </select>
  );
}

export function SelectEspecialidade({ value, onChange, ...resto }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void }){
  return (
    <select {...resto} value={value} onChange={e => onChange(e.target.value)}>
      {ESPECIALIDADES.map(e => <option key={e} value={e}>{e || 'Não informada'}</option>)}
    </select>
  );
}
