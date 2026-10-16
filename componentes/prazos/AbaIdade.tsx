'use client';
// Aba "Idade": idade da parte numa data, marcos (12, 16, 18, 21, 60, 80 anos) e várias pessoas de uma vez.
import { useState } from 'react';
import { chave, diasEntre, fmt, hoje, lerData, mesmoDia, plural } from '@/lib/prazos/datas';
import { MARCOS, aniversario, efeitos, faixa, idade, lerLote } from '@/lib/prazos/idade';
import { Rico } from './comum';

const Vazio = ({ texto }: { texto: string }) => <><h2>Resultado</h2><p className="muted" style={{ margin: 0 }}>{texto}</p></>;

export function AbaIdade(){
  const [nasc, setNasc] = useState('');
  const [refTxt, setRef] = useState(() => chave(hoje()));
  const [lote, setLote] = useState('');
  const h = hoje(), ref = lerData(refTxt) || h, n = lerData(nasc);

  let resultado;
  if (!n) resultado = <Vazio texto="Informe a data de nascimento." />;
  else if (n > ref) resultado = <Vazio texto="A data de nascimento é posterior à data de referência." />;
  else {
    const i = idade(n, ref), f = faixa(i.a);
    resultado = <>
      <div className="idade-big">{plural(i.a, 'ano', 'anos')}<small>{plural(i.m, 'mês', 'meses')} e {plural(i.d, 'dia', 'dias')} em {fmt(ref)}{mesmoDia(ref, h) ? ' (hoje)' : ''}</small></div>
      <div className="chips"><span className={'chip ' + f.c}>{f.t}</span>{i.a < 18 && <span className="chip warn">Intervenção do MP</span>}</div>
      <h3>Marcos</h3>
      <div className="marcos">{MARCOS.map(([anos, nome]) => {
        const d = aniversario(n, anos), passou = d <= ref, dd = diasEntre(ref, d);
        const s = passou ? 'já completou' : dd < 400 ? 'faltam ' + plural(dd, 'dia', 'dias') : 'em ' + (d.getFullYear() - ref.getFullYear()) + ' anos';
        return <div key={anos} className={'marco' + (passou ? ' passou' : '')}><span className="k">{anos} anos · {nome}</span><span className="v">{fmt(d)}</span><span className="s">{s}</span></div>;
      })}</div>
      <h3>O que muda no processo</h3>
      <ul className="efeitos">{efeitos(i.a).map((t, k) => <Rico key={k} como="li" html={t} />)}</ul>
      {n.getMonth() === 1 && n.getDate() === 29 && <div className="aviso">Nascimento em 29/02: nos anos não bissextos, considerei o aniversário em 01/03.</div>}
    </>;
  }

  const linhas = lerLote(lote, ref);
  return (
    <>
      <div className="grid2">
        <form className="panel" id="pzFIdade" autoComplete="off" onSubmit={e => e.preventDefault()}>
          <h2>Idade da parte</h2>
          <div className="field"><label htmlFor="pzINasc">Data de nascimento</label><input id="pzINasc" type="date" value={nasc} onChange={e => setNasc(e.target.value)} />
            <span className="field-hint" id="pzIExemplo" hidden>Preenchido com um exemplo. Troque pela data da parte.</span></div>
          <div className="field"><label htmlFor="pzIRef">Idade na data de</label><input id="pzIRef" type="date" value={refTxt} onChange={e => setRef(e.target.value)} />
            <span className="field-hint">Hoje, por padrão. Use outra data para saber a idade no ajuizamento, na citação ou na data do fato.</span></div>
          <div className="acts"><button type="button" className="btn sm" id="pzIHoje" onClick={() => setRef(chave(hoje()))}>Usar hoje</button></div>
        </form>
        <div className="panel" id="pzIRes" aria-live="polite">{resultado}</div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Várias pessoas de uma vez</h2>
        <div className="field">
          <label htmlFor="pzILote">Uma por linha: nome e data de nascimento</label>
          <textarea id="pzILote" rows={4} placeholder={'Maria Souza; 12/05/2011\nJoão Lima 03/09/2008'} value={lote} onChange={e => setLote(e.target.value)} />
          <span className="field-hint">Pode colar de uma planilha. A idade é calculada na data escolhida acima.</span>
        </div>
        <div className="tbl-wrap" id="pzILoteTab" hidden={!linhas.length}>
          {linhas.length > 0 && <table className="tb">
            <thead><tr><th>Nome</th><th>Nascimento</th><th>Idade em {fmt(ref)}</th><th>Situação</th></tr></thead>
            <tbody>{linhas.map((l, k) => {
              if (l.tipo === 'sem-data') return <tr key={k}><td>{l.nome}</td><td colSpan={3} className="obs">Data não reconhecida. Use dd/mm/aaaa.</td></tr>;
              if (l.tipo === 'futuro') return <tr key={k}><td>{l.nome}</td><td className="n">{fmt(l.nasc)}</td><td colSpan={2} className="obs">Nascimento depois da data de referência.</td></tr>;
              return (
                <tr key={k}>
                  <td>{l.nome}</td><td className="n">{fmt(l.nasc)}</td><td className="n">{l.idade.a}a {l.idade.m}m {l.idade.d}d</td>
                  <td><span className={'chip ' + l.faixa.c}>{l.faixa.t}</span>{l.idade.a < 18 && <> <span className="obs">maior em {fmt(l.maior)}</span></>}</td>
                </tr>
              );
            })}</tbody>
          </table>}
        </div>
      </div>
    </>
  );
}
