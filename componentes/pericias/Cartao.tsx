'use client';
// Cartão da perícia: quando, autor, perito, processo, prazo do laudo, situação, conferência e andamentos
import { useState } from 'react';
import {
  ATALHOS, PER_FLUXO, PER_NOME, PER_STATUS, aberta, dataBr, diaMes, diasUteisEntre, hora, laudoAtrasado, laudoPerto, marcada,
  prazoLaudo, type Andamento, type Pericia, type Perito, type Status, type Util
} from '@/lib/pericias';
import { formatarDataHora } from '@/lib/datas';
import { CopiarProcesso } from '@/componentes/CopiarProcesso';

const IconeCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconeX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconeLapis = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;

function ApagarAndamento({ apagar }: { apagar: () => void }){
  const [armado, setArmado] = useState(false);
  return (
    <button type="button" className={'icon-btn' + (armado ? ' armed' : '')} data-pact="and-excluir" title="Apagar este andamento" aria-label="Apagar andamento"
      style={armado ? { width: 'auto' } : undefined} onClick={() => { if (!armado){ setArmado(true); return; } apagar(); }}>
      {armado ? <span style={{ fontSize: 12, padding: '0 4px', color: 'var(--danger)' }}>Apagar?</span> : <IconeX />}
    </button>
  );
}

export type AcoesCartao = {
  mudarSituacao: (p: Pericia, s: Status) => void; conferir: (p: Pericia) => void; editar: (p: Pericia) => void; concluir: (p: Pericia) => void;
  registrar: (p: Pericia, texto: string) => Promise<void>; atalho: (p: Pericia, texto: string) => void; apagarAndamento: (id: string) => void;
  selecionar: (p: Pericia, sim: boolean) => void;
};

export function Cartao({ p, agora, util, perito, andamentos, aberto, alternar, selecionada, acoes }: {
  p: Pericia; agora: Date; util: Util; perito: Perito | null; andamentos: Andamento[]; aberto: boolean; alternar: () => void; selecionada: boolean; acoes: AcoesCartao;
}){
  const [novoAnd, setNovoAnd] = useState('');
  const pr = prazoLaudo(p, util), atrasado = laudoAtrasado(p, agora, util), perto = laudoPerto(p, agora, util);
  let quando;
  if (p.status === 'realizada' && pr) quando = <><span className="lbl">laudo até</span><b>{diaMes(pr)}</b></>;
  else if (p.status === 'laudo_juntado' && p.laudoEm) quando = <><span className="lbl">concluída em</span><b>{diaMes(p.laudoEm)}</b><small>{p.laudoEm.getFullYear()}</small></>;
  else if (p.data) quando = <><b>{hora(p.data)}</b><small>{diaMes(p.data)}</small></>;
  else quando = <span className="lbl">sem data marcada</span>;

  const meta = [];
  if (marcada(p.status) && p.data) meta.push(<span key="d">Perícia em {dataBr(p.data)} às {hora(p.data)}</span>);
  if (p.realizadaEm) meta.push(<span key="r">Realizada em {dataBr(p.realizadaEm)}</span>);
  if (p.status === 'realizada' && pr){
    if (atrasado){ const da = diasUteisEntre(pr, agora, util); meta.push(<span key="l" className="bad">Laudo atrasado {da}{da === 1 ? ' dia útil' : ' dias úteis'} (venceu {dataBr(pr)})</span>); }
    else { const rest = diasUteisEntre(agora, pr, util); meta.push(<span key="l" className={perto ? 'soonx' : ''}>{rest === 0 ? 'Laudo vence hoje' : 'Faltam ' + rest + (rest === 1 ? ' dia útil' : ' dias úteis')} para o laudo (até {dataBr(pr)})</span>); }
  }
  if (p.status === 'laudo_juntado' && p.laudoEm) meta.push(<span key="j" className="good">Laudo juntado em {dataBr(p.laudoEm)}</span>);
  if (p.local) meta.push(<span key="o">{p.local}</span>);
  const passo = PER_FLUXO.indexOf(p.status);

  return (
    <article className={'pcard' + (atrasado ? ' late' : perto ? ' soon' : '') + (aberta(p) ? '' : ' closed') + (selecionada ? ' sel' : '')}>
      <div className="pwhen">
        <label className="psel" title="Selecionar para alterar em lote">
          <input type="checkbox" data-psel={p.id} checked={selecionada} aria-label={'Selecionar a perícia do processo ' + p.processo} onChange={e => acoes.selecionar(p, e.target.checked)} />
        </label>
        {quando}
      </div>
      <div className="pinfo">
        <div className={'pautor' + (p.autor ? '' : ' vazio')}>{p.autor || 'Autor não informado'}</div>
        <div className="prow"><span className="pperito">Perito: <b>{p.perito}</b></span>{p.especialidade && <span className="pesp">{p.especialidade}</span>}</div>
        {perito && (perito.telefone || perito.email) && <div className="pcontact">{perito.telefone && <span>{perito.telefone}</span>}{perito.email && <span>{perito.email}</span>}</div>}
        <div className="prow"><CopiarProcesso proc={p.processo} /></div>
        {meta.length > 0 && <div className="pmeta">{meta}</div>}
        {p.observacoes && <div className="pobs">{p.observacoes}</div>}
        {atrasado && <span className="pflag">Cobrar laudo do perito</span>}
        {passo !== -1 && <div className="stepper" title={PER_FLUXO.map(k => PER_NOME[k]).join(' → ')}>{PER_FLUXO.map((k, i) => <i key={k} className={i <= passo ? 'on' : ''}></i>)}</div>}
      </div>
      <div className="pside">
        <label className="pst" data-st={p.status}>
          <select data-pst={p.id} aria-label="Situação da perícia" value={p.status} onChange={e => acoes.mudarSituacao(p, e.target.value as Status)}>
            {PER_STATUS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <div className="hactions">
          {p.conferidaEm
            ? <button type="button" className="conf-btn done" data-pact="conferir" data-id={p.id} title={'Conferida em ' + formatarDataHora(p.conferidaEm) + '. Clique para desmarcar.'} onClick={() => acoes.conferir(p)}><IconeCheck /><span>Conferida</span><span className="conf-date">{diaMes(p.conferidaEm)} {hora(p.conferidaEm)}</span></button>
            : <button type="button" className="conf-btn" data-pact="conferir" data-id={p.id} title="Marcar como conferida" onClick={() => acoes.conferir(p)}><IconeCheck /><span>Conferir</span></button>}
          <button type="button" className="and-btn" data-pact="andamento" data-id={p.id} aria-expanded={aberto} onClick={alternar}>Andamento <span className="n">{andamentos.length}</span></button>
          <button type="button" className="icon-btn" data-pact="editar" data-id={p.id} title="Editar perícia" aria-label="Editar perícia" onClick={() => acoes.editar(p)}><IconeLapis /></button>
        </div>
      </div>
      {aberto && (
        <div className="andamento">
          <form className="and-add" data-pform="andamento" data-id={p.id} onSubmit={async e => {
            e.preventDefault();
            const t = novoAnd.trim(); if (!t) return;
            await acoes.registrar(p, t);
            setNovoAnd('');
          }}>
            <input maxLength={300} placeholder="Registrar andamento (ex.: perito intimado por e-mail)" aria-label="Novo andamento" required value={novoAnd} onChange={e => setNovoAnd(e.target.value)} />
            <button type="submit" className="btn primary">Registrar</button>
          </form>
          <div className="and-quick">
            {ATALHOS.map(t => <button key={t} type="button" data-pact="atalho" data-id={p.id} data-txt={t} onClick={() => acoes.atalho(p, t)}>{t}</button>)}
            {aberta(p) && <button type="button" className="concluir" data-pact="concluir" data-id={p.id} title="Marca o laudo como juntado hoje e move a perícia para Concluídas" onClick={() => acoes.concluir(p)}>✓ Laudo juntado (concluir)</button>}
          </div>
          {andamentos.length
            ? <ol className="timeline">{andamentos.map(a => (
                <li key={a.id}><time>{formatarDataHora(a.em)}</time><span className="txt">{a.texto}</span><ApagarAndamento apagar={() => acoes.apagarAndamento(a.id)} /></li>
              ))}</ol>
            : <div className="timeline-empty">Nenhum andamento registrado ainda.</div>}
        </div>
      )}
    </article>
  );
}
