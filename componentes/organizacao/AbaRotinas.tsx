'use client';
// Aba Rotinas (só na tela do gestor): tarefas que se repetem toda semana, mês ou trimestre
import { useState } from 'react';
import { FREQ, PERIODO, corrige, diaMes, ordenarRotinas, rotinaFeita, type Frequencia, type Rotina } from '@/lib/organizacao';
import { formatarDataHora } from '@/lib/datas';
import { useAviso } from '@/componentes/Avisos';
import { Editavel } from './Editavel';
import type { Sessao } from './sessao';

const IconeCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconeX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

function Excluir({ excluir }: { excluir: () => void }){
  const [armado, setArmado] = useState(false);
  return (
    <button type="button" className={'icon-btn' + (armado ? ' armed' : '')} data-act="rot-excluir" title="Excluir rotina" aria-label="Excluir rotina"
      style={armado ? { width: 'auto', color: 'var(--danger)' } : undefined} onClick={() => { if (!armado){ setArmado(true); return; } excluir(); }}>
      {armado ? <span style={{ fontSize: 12, padding: '0 4px', whiteSpace: 'nowrap' }}>Excluir?</span> : <IconeX />}
    </button>
  );
}

export function AbaRotinas({ s, agora, visivel }: { s: Sessao; agora: Date; visivel: boolean }){
  const avisar = useAviso();
  const d = s.dados!;
  const [titulo, setTitulo] = useState('');
  const [freq, setFreq] = useState<Frequencia>('mensal');
  const salvar = (x: Partial<Rotina> & { titulo: string; frequencia: Frequencia }) =>
    s.chamar('org_salvar_rotina', { p_id: x.id || null, p_titulo: corrige(x.titulo), p_frequencia: x.frequencia, p_feita_em: x.feitaEm ? x.feitaEm.toISOString() : null });

  const lista = ordenarRotinas(d.rotinas, agora);
  const feitas = lista.filter(r => rotinaFeita(r, agora)).length;
  const pct = lista.length ? Math.round(feitas / lista.length * 100) : 0;
  return (
    <div id="orgPaneRotinas" className="org-pane" hidden={!visivel}>
      <div className="panel">
        <div className="panel-head"><h2>Rotinas</h2><span id="orgRotInfo">{lista.length ? feitas + ' de ' + lista.length + ' feitas no período · clique no título para editar' : ''}</span></div>
        <div className="progress" id="orgRotProg" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} hidden={!lista.length}><i style={{ width: pct + '%' }}></i></div>
        <form className="org-add" id="orgRotForm" autoComplete="off" onSubmit={async e => {
          e.preventDefault();
          const t = titulo.trim(); if (!t) return;
          const r = await salvar({ titulo: t, frequencia: freq, feitaEm: null });
          if (!s.ok(r)) return;
          setTitulo('');
          avisar('Rotina adicionada');
          await s.carregar();
          document.getElementById('orgRotTitulo')?.focus();
        }}>
          <input className="org-in grow" id="orgRotTitulo" maxLength={160} placeholder="Nova rotina (ex.: estatística mensal ao CNJ)…" required value={titulo} onChange={e => setTitulo(e.target.value)} />
          <select className="org-in" id="orgRotFreq" aria-label="Frequência" value={freq} onChange={e => setFreq(e.target.value as Frequencia)}>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
          </select>
          <button type="submit" className="btn primary">Adicionar</button>
        </form>
        <div className="tgroup" id="orgRotList">
          {!lista.length ? <div className="org-empty">Nenhuma rotina ainda. Cadastre as tarefas que se repetem toda semana, mês ou trimestre.</div> : lista.map(x => {
            const ok = rotinaFeita(x, agora);
            return (
              <div key={x.id} className={'task' + (ok ? ' rot-done' : '')}>
                <button type="button" className="check" role="checkbox" aria-checked={ok} data-act="rot-feita" data-id={x.id} aria-label="Marcar rotina como feita"
                  onClick={async () => {
                    const quando = ok ? null : new Date();
                    const r = await salvar({ ...x, feitaEm: quando });
                    if (s.ok(r)){ if (quando) avisar('Rotina feita em ' + formatarDataHora(quando)); await s.carregar(); }
                  }}>{ok ? <IconeCheck /> : null}</button>
                <div style={{ minWidth: 0 }}>
                  <div className="t-title"><Editavel className="editable" tipo="rotina" id={x.id} texto={x.titulo} title="Clique para editar"
                    salvar={async (txt, el, orig) => {
                      if (!txt){ el.innerText = orig; return; }
                      if (txt === orig.trim()) return;
                      const r = await salvar({ ...x, titulo: corrige(txt) });
                      if (s.ok(r)) avisar('Rotina atualizada');
                      await s.carregar();
                    }} /></div>
                  <div className="t-meta">{ok ? <span className="doneat">Feita em {formatarDataHora(x.feitaEm!)}</span>
                    : <><span>Pendente {PERIODO[x.frequencia]}</span>{x.feitaEm && <span>Última vez em {diaMes(x.feitaEm)}/{x.feitaEm.getFullYear()}</span>}</>}</div>
                </div>
                <div className="t-side"><span className="freq">{FREQ[x.frequencia]}</span>
                  <Excluir excluir={async () => { const r = await s.chamar('org_excluir_rotina', { p_id: x.id }); if (s.ok(r)){ avisar('Rotina excluída'); await s.carregar(); } }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
