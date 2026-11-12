'use client';
// Conferir: o que a planilha deixou em dúvida, para resolver na hora (anotar a prateleira, escolher
// o lugar certo, dizer em que caixa o processo está, dar por resolvida uma anotação estranha).
import { useState } from 'react';
import { localValido, ordemCaixa, type Caixa, type Processo } from '@/lib/arquivo';
import { useArq } from './Arquivo';
import type { ArquivoDados } from './useArquivo';
import { Icone } from './Pecas';

export function pendencias(d: ArquivoDados){
  const semLocal = d.caixas.filter(c => !c.secretaria && !c.locais.length && (d.porCaixa.get(c.id) || []).length).sort(ordemCaixa);
  const doisLugares = d.caixas.filter(c => c.locais.length > 1).sort(ordemCaixa);
  const repetidos = [...d.indice.entries()].filter(([, ps]) => ps.length > 1 && !ps.every(p => p.volumes_ok))
    .sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0));
  const notas = d.notas.filter(n => !n.resolvida);
  return { semLocal, doisLugares, repetidos, notas };
}
export function contarPendencias(d: ArquivoDados){
  const p = pendencias(d);
  return p.semLocal.length + p.doisLugares.length + p.repetidos.length + p.notas.length;
}

const CHAVE_INICIO = 'arquivo-pendencias-inicio';
const LIMITE = 80;

export function Conferir(){
  const { d, aviso, abrirProc } = useArq();
  const [aba, setAba] = useState<'semLocal' | 'doisLugares' | 'repetidos' | 'notas'>('semLocal');
  const [locais, setLocais] = useState<Record<string, { p: string; f: string }>>({});
  const pend = pendencias(d);
  const falta = pend.semLocal.length + pend.doisLugares.length + pend.repetidos.length + pend.notas.length;
  let inicio = falta;
  try { const s = Number(localStorage.getItem(CHAVE_INICIO)); if (s >= falta) inicio = s; else localStorage.setItem(CHAVE_INICIO, String(falta)); } catch (e) { /* sem armazenamento: barra começa agora */ }
  const feito = inicio - falta;

  const anotar = async (c: Caixa) => {
    const v = locais[c.id] || { p: '', f: '' }; const loc = localValido(v.p, v.f);
    if (!loc){ aviso('Preencha prateleira e fileira'); return; }
    const desf = await d.mudarCaixa(c, { locais: [loc] }, 'Caixa ' + c.nome + ' anotada na prateleira ' + loc[0] + ', fileira ' + loc[1]);
    if (desf) aviso('Caixa ' + c.nome + ' anotada em P.' + loc[0] + ' F.' + loc[1], desf);
  };
  const ficaEm = async (cod: string, p: Processo, outros: Processo[]) => {
    const cx = d.caixasM.get(p.caixa_id)?.nome || '';
    const desf = await d.mudarProcessos(outros.map(o => ({ p: o, novo: { excluido: true }, texto: 'Repetido: o processo ' + cod + ' está na caixa ' + cx + ', não na ' + (d.caixasM.get(o.caixa_id)?.nome || '') })));
    if (desf) aviso('Processo ' + cod + ' fica na caixa ' + cx, desf);
  };

  const abas = [['semLocal', 'caixas sem prateleira', pend.semLocal.length], ['doisLugares', 'caixas em dois lugares', pend.doisLugares.length], ['repetidos', 'processos em mais de uma caixa', pend.repetidos.length], ['notas', 'anotações estranhas', pend.notas.length]] as const;
  const mais = (n: number) => n > LIMITE ? <div className="aq-conf-item aq-sub">E mais {n - LIMITE}. Resolva estas primeiro.</div> : null;
  let lista;
  if (aba === 'semLocal') lista = <>{pend.semLocal.slice(0, LIMITE).map(c => (
    <div key={c.id} className="aq-conf-item"><a className="aq-quem" href={'#cx-' + c.id}>Caixa {c.nome}</a><span className="aq-sub" style={{ fontSize: 13, flex: 1 }}>{(d.porCaixa.get(c.id) || []).length} processos</span>
      <span className="aq-mini">
        <input aria-label={'Prateleira da caixa ' + c.nome} placeholder="Prat." inputMode="numeric" value={locais[c.id]?.p || ''} onChange={e => setLocais({ ...locais, [c.id]: { p: e.target.value, f: locais[c.id]?.f || '' } })} onKeyDown={e => { if (e.key === 'Enter') anotar(c); }} />
        <input aria-label={'Fileira da caixa ' + c.nome} placeholder="Fil." maxLength={2} value={locais[c.id]?.f || ''} onChange={e => setLocais({ ...locais, [c.id]: { p: locais[c.id]?.p || '', f: e.target.value.toUpperCase() } })} onKeyDown={e => { if (e.key === 'Enter') anotar(c); }} />
        <button type="button" className="aq-btn aq-peq" onClick={() => anotar(c)}>Anotar</button></span>
    </div>))}{mais(pend.semLocal.length)}</>;
  else if (aba === 'doisLugares') lista = pend.doisLugares.map(c => (
    <div key={c.id} className="aq-conf-item"><a className="aq-quem" href={'#cx-' + c.id}>Caixa {c.nome}</a><span className="aq-sub" style={{ fontSize: 13, flex: 1 }}>Está em qual?</span>
      {c.locais.map(l => <button key={l.join()} type="button" className="aq-btn aq-peq" onClick={async () => { const desf = await d.mudarCaixa(c, { locais: [l] }, 'Caixa ' + c.nome + ' confirmada na prateleira ' + l[0] + ', fileira ' + l[1]); if (desf) aviso('Caixa ' + c.nome + ' confirmada', desf); }}>Prat. {l[0]} · Fil. {l[1]}</button>)}
    </div>));
  else if (aba === 'repetidos') lista = <>{pend.repetidos.slice(0, LIMITE).map(([cod, ps]) => (
    <div key={cod} className="aq-conf-item"><button type="button" className="aq-link aq-quem" onClick={() => abrirProc(ps[0].id)}>{cod}</button><span className="aq-sub" style={{ fontSize: 13, flex: 1 }}>Está na caixa:</span>
      {ps.map(p => <button key={p.id} type="button" className="aq-btn aq-peq" onClick={() => ficaEm(cod, p, ps.filter(o => o !== p))}>{d.caixasM.get(p.caixa_id)?.nome}</button>)}
      <button type="button" className="aq-btn aq-peq aq-leve" onClick={async () => { const desf = await d.mudarProcessos(ps.map(o => ({ p: o, novo: { volumes_ok: true }, texto: 'Processo ' + cod + ': volumes em caixas diferentes' }))); if (desf) aviso('Marcado como volumes diferentes', desf); }}>São volumes diferentes</button>
    </div>))}{mais(pend.repetidos.length)}</>;
  else lista = pend.notas.map(n => (
    <div key={n.celula} className="aq-conf-item"><span className="aq-quem aq-sub">célula {n.celula}</span><b>“{n.texto}”</b><span className="aq-sub" style={{ fontSize: 13, flex: 1 }}>{n.contexto}</span>
      <button type="button" className="aq-btn aq-peq" onClick={async () => { const desf = await d.resolverNota(n.celula, true); if (desf) aviso('Anotação resolvida', desf); }}>Resolvido</button></div>));
  const vazia = (aba === 'semLocal' && !pend.semLocal.length) || (aba === 'doisLugares' && !pend.doisLugares.length) || (aba === 'repetidos' && !pend.repetidos.length) || (aba === 'notas' && !pend.notas.length);

  return (
    <section className="aq-pilha" aria-labelledby="aq-titulo-conf">
      <div className="aq-topo-tela"><div><span className="aq-sobrelinha">Conferência da planilha</span><h1 id="aq-titulo-conf">Conferir</h1>
        <p className="aq-sub">O que a planilha deixou em dúvida. Confira na prateleira e resolva aqui mesmo.</p></div></div>
      <div className="aq-card aq-pad aq-pilha" style={{ gap: 10 }}>
        <div className="aq-fila" style={{ justifyContent: 'space-between' }}><b className="aq-mono">{feito.toLocaleString('pt-BR')} de {inicio.toLocaleString('pt-BR')} resolvidas</b><span className="aq-sub" style={{ fontSize: 13 }}>{falta.toLocaleString('pt-BR')} faltando</span></div>
        <div className="aq-progresso"><i style={{ width: (inicio ? 100 * feito / inicio : 100).toFixed(1) + '%' }} /></div>
      </div>
      <div className="aq-conf-grade">{abas.map(([k, t, n]) => <button key={k} type="button" className="aq-conf-aba" aria-pressed={aba === k} onClick={() => setAba(k)}><b>{n.toLocaleString('pt-BR')}</b><span>{t}</span></button>)}</div>
      <div className="aq-card" style={{ borderRadius: '0 6px 6px 6px' }}><div className="aq-conf-lista">
        {vazia ? <div className="aq-vazio"><Icone n="conf" t={28} /><b>Nada pendente aqui.</b></div> : lista}
      </div></div>
    </section>
  );
}
