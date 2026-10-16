'use client';
// Aba Lembretes: atrasados, hoje (com o próximo e os de horário passado) e próximos dias
import { useState } from 'react';
import { corrige, diaMes, diferenca, horaDe, quadroDeLembretes, type Lembrete } from '@/lib/organizacao';
import { chaveDoDia } from '@/lib/datas';
import { useAviso } from '@/componentes/Avisos';
import { Editavel } from './Editavel';
import type { Sessao } from './sessao';

const IconeX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function AbaLembretes({ s, agora, visivel }: { s: Sessao; agora: Date; visivel: boolean }){
  const avisar = useAviso();
  const d = s.dados!;
  const [texto, setTexto] = useState('');
  const [data, setData] = useState(() => chaveDoDia(new Date()));
  const [hora, setHora] = useState('');
  const salvar = (l: Partial<Lembrete> & { texto: string; data: Date }) => s.chamar('org_salvar_lembrete', {
    p_id: l.id || null, p_texto: corrige(l.texto), p_data: chaveDoDia(l.data), p_hora: l.hora || null, p_processo: l.processo || '', p_feito_em: l.feitoEm ? l.feitoEm.toISOString() : null
  });

  const q = quadroDeLembretes(d.lembretes, agora);
  function linha(l: Lembrete, o: { comData?: boolean; late?: boolean; next?: boolean }){
    const meta = [];
    if (o.next) meta.push(<span key="n" className="next">Próximo</span>);
    if (o.late && !o.comData) meta.push(<span key="l" className="late">Horário passou</span>);
    if (o.late && o.comData){ const dd = diferenca(l.data, agora); meta.push(<span key="l" className="late">Atrasado {-dd}{dd === -1 ? ' dia' : ' dias'}</span>); }
    if (o.comData && !o.late){ const dd = diferenca(l.data, agora); meta.push(<span key="d">{dd === 1 ? 'Amanhã' : 'Em ' + dd + ' dias'}</span>); }
    if (l.feitoEm) meta.push(<span key="f" className="doneat">Feito às {horaDe(l.feitoEm)}</span>);
    return (
      <div key={l.id} className={'rem' + (l.feitoEm ? ' done' : '') + (o.next ? ' now' : '') + (o.late ? ' late' : '')}>
        <time>{o.comData ? <>{diaMes(l.data)}{l.hora && <small>{l.hora}</small>}</> : (l.hora || <small>sem hora</small>)}</time>
        <div style={{ minWidth: 0 }}>
          <div className="t-title"><Editavel className="editable" tipo="lembrete" id={l.id} texto={l.texto} title="Clique para editar"
            salvar={async (txt, el, orig) => {
              if (!txt){ el.innerText = orig; return; }
              if (txt === orig.trim()) return;
              const r = await salvar({ ...l, texto: corrige(txt) });
              if (s.ok(r)) avisar('Lembrete atualizado');
              await s.carregar();
            }} /></div>
          {meta.length > 0 && <div className="t-meta">{meta}</div>}
        </div>
        <div className="t-side">
          <button type="button" className="btn" data-act="lem-feito" data-id={l.id}
            onClick={async () => { const r = await salvar({ ...l, feitoEm: l.feitoEm ? null : new Date() }); if (s.ok(r)) await s.carregar(); }}>{l.feitoEm ? 'Desfazer' : 'Concluir'}</button>
          <button type="button" className="icon-btn" data-act="lem-excluir" data-id={l.id} title="Excluir lembrete" aria-label="Excluir lembrete"
            onClick={async () => { const r = await s.chamar('org_excluir_lembrete', { p_id: l.id }); if (s.ok(r)){ avisar('Lembrete excluído'); await s.carregar(); } }}><IconeX /></button>
        </div>
      </div>
    );
  }

  return (
    <div id="orgPaneLembretes" className="org-pane" hidden={!visivel}>
      <div className="org-stats" id="orgLemStats">
        <div className="ostat"><b>{q.pendHoje}</b><span>para hoje</span></div>
        <div className={'ostat' + (q.passou ? ' alert' : '')}><b>{q.passou}</b><span>horário passou</span></div>
        <div className="ostat"><b>{q.proximos.length}</b><span>próximos dias</span></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>Lembretes</h2><span>clique no texto para editar</span></div>
        <form className="org-add" id="orgLemForm" autoComplete="off" onSubmit={async e => {
          e.preventDefault();
          const t = texto.trim(); if (!t || !data) return;
          const r = await salvar({ texto: t, data: new Date(data + 'T00:00'), hora, processo: '', feitoEm: null });
          if (!s.ok(r)) return;
          setTexto(''); setHora('');
          avisar('Lembrete adicionado');
          await s.carregar();
          document.getElementById('orgLemTexto')?.focus();
        }}>
          <input className="org-in grow" id="orgLemTexto" maxLength={200} placeholder="Lembrar de…" required value={texto} onChange={e => setTexto(e.target.value)} />
          <input className="org-in" id="orgLemData" type="date" aria-label="Data" required value={data} onChange={e => setData(e.target.value)} />
          <input className="org-in" id="orgLemHora" type="time" aria-label="Hora (opcional)" value={hora} onChange={e => setHora(e.target.value)} />
          <button type="submit" className="btn primary">Adicionar</button>
        </form>
        <div className="tgroup" id="orgLemList">
          {q.atrasados.length > 0 && <>
            <div className="tgroup-title">Atrasados <span className="n">{q.atrasados.length}</span></div>
            {q.atrasados.map(l => linha(l, { comData: true, late: true }))}
          </>}
          <div className="tgroup-title">Hoje <span className="n">{maiuscula(agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></div>
          {q.hoje.length ? q.hoje.map(l => linha(l, { next: l === q.proximo, late: !l.feitoEm && !!l.hora && l.hora < q.hm })) : <div className="org-empty">Nenhum lembrete para hoje.</div>}
          {q.proximos.length > 0 && <>
            <div className="tgroup-title">Próximos dias <span className="n">{q.proximos.length}</span></div>
            {q.proximos.map(l => linha(l, { comData: true }))}
          </>}
        </div>
      </div>
    </div>
  );
}
