'use client';
// Checklist de intimações dentro do cartão da audiência: quem intimar e se foi intimado (✓) ou não (✗).
import { useState } from 'react';
import { MEIOS, MOTIVOS, PAPEIS, PAPEL_PADRAO, adicionar, alterar, contagem, marcar, remover, resumoIntim, separarNomes, todasIntimadas, type Intimacao, type Situacao } from '@/lib/intimacoes';
import { diaMes } from '@/lib/audiencias';

const IconeCheck = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;
const IconeX = ({ t = 14 }: { t?: number }) => <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>;
const opcoes = (lista: string[], atual: string) => (atual && !lista.includes(atual) ? [...lista, atual] : lista);
const quando = (iso: string | null) => (iso ? diaMes(new Date(iso)) : '');

// Botão do cartão: quadradinhos coloridos + "3/5 intimados"
export function ResumoIntimacoes({ lista, aberto, alternar, rotulo }: { lista: Intimacao[]; aberto: boolean; alternar: () => void; rotulo: string }){
  const c = contagem(lista);
  return (
    <button type="button" className={'int-btn' + (lista.length ? '' : ' vazio')} aria-expanded={aberto} onClick={alternar} title="Quem intimar para esta audiência" aria-label={rotulo}>
      {lista.length > 0 && <span className="int-bar" aria-hidden="true">{lista.map(p => <i key={p.id} className={p.situacao ? 's-' + p.situacao : ''} />)}</span>}
      <span>{lista.length ? <>{resumoIntim(lista).split(' · ')[0]}{c.nao > 0 && <> · <b className="int-alerta">{c.nao + (c.nao === 1 ? ' não intimado' : ' não intimados')}</b></>}</> : '+ Quem intimar'}</span>
      <span className="int-caret" aria-hidden="true" />
    </button>
  );
}

export function PainelIntimacoes({ lista, salvar, status, mudarStatus, idBase }: {
  lista: Intimacao[]; salvar: (nova: Intimacao[]) => Promise<boolean>; status: string; mudarStatus: (s: string) => void; idBase: string;
}){
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState(PAPEL_PADRAO);
  const [remover1, setRemover1] = useState<string | null>(null);

  async function incluir(txt: string){
    const nomes = separarNomes(txt, lista);
    if (!nomes.length){ setNome(''); return; }
    if (await salvar(adicionar(lista, nomes, papel))) setNome('');
  }

  return (
    <div className="int-painel">
      <div className="int-head">
        <h3>Quem intimar</h3>
        {todasIntimadas(lista) && status === 'A cumprir' && (
          <button type="button" className="int-sug" onClick={() => mudarStatus('Intimações feitas')}>Todos intimados · mudar status para “Intimações feitas”</button>
        )}
      </div>
      {lista.map(p => {
        const sit = (s: Situacao) => salvar(marcar(lista, p.id, s));
        return (
          <div key={p.id} className={'int-pessoa' + (p.situacao ? ' s-' + p.situacao : '')}>
            <div className="int-seg" role="group" aria-label={'Situação de ' + p.nome}>
              <button type="button" className="b-ok" aria-pressed={p.situacao === 'intimada'} title="Intimado" aria-label={'Intimado: ' + p.nome} onClick={() => sit('intimada')}><IconeCheck /></button>
              <button type="button" className="b-no" aria-pressed={p.situacao === 'nao'} title="Não intimado" aria-label={'Não intimado: ' + p.nome} onClick={() => sit('nao')}><IconeX /></button>
            </div>
            <div className="int-info">
              <span className="int-nome">{p.nome}</span>
              <span className="int-meta">
                <span className="int-papel">{p.papel}</span>
                <select aria-label={'Meio de intimação de ' + p.nome} value={p.meio} onChange={e => salvar(alterar(lista, p.id, { meio: e.target.value }))}>
                  {!p.meio && <option value="">Meio…</option>}
                  {opcoes(MEIOS, p.meio).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {p.situacao === 'intimada' && <span>intimado em <span className="int-data">{quando(p.em)}</span></span>}
                {p.situacao === 'nao' && <>
                  <select className="int-motivo" aria-label={'Motivo de não ter intimado ' + p.nome} value={p.motivo} onChange={e => salvar(alterar(lista, p.id, { motivo: e.target.value }))}>
                    <option value="">Motivo…</option>
                    {opcoes(MOTIVOS, p.motivo).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <span className="int-data">{quando(p.em)}</span>
                </>}
                {p.situacao === 'dispensada' && <span>dispensado</span>}
              </span>
            </div>
            <div className="int-acoes">
              <button type="button" className="int-mini" onClick={() => sit('dispensada')} title={p.situacao === 'dispensada' ? 'Volta a contar como pendente' : 'Não precisa mais intimar (ex.: testemunha desistida). Não conta no total.'}>
                {p.situacao === 'dispensada' ? 'Reativar' : 'Dispensar'}
              </button>
              {remover1 === p.id
                ? <button type="button" className="int-mini armed" onClick={() => { setRemover1(null); salvar(remover(lista, p.id)); }} onBlur={() => setRemover1(null)}>Remover?</button>
                : <button type="button" className="int-mini" title="Tirar da lista" aria-label={'Tirar ' + p.nome + ' da lista'} onClick={() => setRemover1(p.id)}><IconeX t={13} /></button>}
            </div>
          </div>
        );
      })}
      {!lista.length && <p className="int-dica">Ninguém na lista ainda. Adicione as partes e testemunhas que precisam ser intimadas.</p>}
      <form className="int-add" onSubmit={e => { e.preventDefault(); incluir(nome); }}>
        <input id={idBase + '-nome'} aria-label="Nome de quem intimar" placeholder="Nome (pode colar vários, um por linha)" maxLength={2000} autoComplete="off"
          value={nome} onChange={e => setNome(e.target.value)}
          onPaste={e => { const t = e.clipboardData.getData('text'); if (/\n/.test(t.trim())){ e.preventDefault(); incluir(t); } }} />
        <select aria-label="Papel" value={papel} onChange={e => setPapel(e.target.value)}>
          {PAPEIS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <button type="submit" className="btn primary">Adicionar</button>
      </form>
    </div>
  );
}
