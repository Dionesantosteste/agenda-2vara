'use client';
// Aba "Tabela de prazos": todos os atos, com busca; "Calcular" leva o ato para a calculadora.
import { useState, type ReactNode } from 'react';
import { ATOS, UN_TXT, type Ato } from '@/lib/prazos/atos';
import { TagsDoAto } from './comum';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const qtdCurto = (a: Ato) => a.n + ' ' + (a.un === 'u' ? (a.n === 1 ? 'dia útil' : 'dias úteis') : a.un === 'c' ? 'dias' : UN_TXT[a.un][a.n === 1 ? 0 : 1]) + (a.dir === 'antes' ? ' antes' : '');

export function AbaTabela({ calcular }: { calcular: (id: string) => void }){
  const [busca, setBusca] = useState('');
  const q = norm(busca.trim()), re = new RegExp('(^|[^a-z0-9])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const achados = ATOS.filter(a => !q || re.test(norm(a.ato + ' ' + a.art + ' ' + a.g + ' ' + a.ini + (a.eca ? ' eca infancia' : '') + (a.g.includes('CEJUSC') ? ' cejusc conciliacao mediacao' : ''))));
  const linhas: ReactNode[] = [];
  let g = '';
  for (const a of achados){
    if (a.g !== g){ g = a.g; linhas.push(<tr className="grp" key={'g:' + g}><td colSpan={5}>{g}</td></tr>); }
    linhas.push(
      <tr key={a.id}>
        <td>{a.ato}</td>
        <td className="n">{qtdCurto(a)}<TagsDoAto a={a} /></td>
        <td className="art">{a.art}</td>
        <td className="obs">{a.ini}</td>
        <td><button type="button" className="btn sm" data-calc={a.id} onClick={() => calcular(a.id)}>Calcular</button></td>
      </tr>
    );
  }
  return (
    <div className="panel">
      <div className="field"><label htmlFor="pzTBusca">Buscar ato ou artigo</label><input id="pzTBusca" type="search" placeholder="Ex.: apelação, 1.023, impugnação" value={busca} onChange={e => setBusca(e.target.value)} /></div>
      <div className="tbl-wrap"><table className="tb" id="pzTTab">
        <thead><tr><th>Ato</th><th>Prazo</th><th>Base</th><th>Conta a partir de</th><th></th></tr></thead>
        <tbody>{linhas.length ? linhas : <tr><td colSpan={5} className="obs">Nenhum ato encontrado.</td></tr>}</tbody>
      </table></div>
      <p className="fontes" style={{ margin: 0 }}>Prazos do CPC (Lei 13.105/2015) contam só dias úteis (art. 219). Na falta de prazo na lei ou fixado pelo juiz, o prazo é de 5 dias (art. 218, § 3º).
        {' '}<span className="tag c">corridos</span> marca prazos de direito material ou com entendimento do STJ pela contagem corrida.
        {' '}<span className="tag a">sem dobro</span> marca prazos próprios, que não dobram para Fazenda, MP ou Defensoria.
        {' '}No <span className="tag e">ECA</span>, os prazos são em dias corridos e não dobram para Fazenda e MP (art. 152, § 2º); a Defensoria mantém o dobro (STJ).
        {' '}<span className="tag e">prazo máximo</span> marca limites de duração (acolhimento, estágio, internação), contados da data de início.</p>
    </div>
  );
}
