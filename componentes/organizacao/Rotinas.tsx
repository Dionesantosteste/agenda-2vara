'use client';
// Aba Rotinas (só do gestor): o que se repete toda semana, mês ou trimestre
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { formatarDataHora } from '@/lib/datas';
import { FREQ, PERIODO, corrige, diaMes, ordenaRotinas, paraSalvarRotina, rotinaFeita, type Dados, type Rotina } from '@/lib/organizacao';
import { useAviso } from '@/componentes/Avisos';
import { Editavel } from './Editavel';
import type { Banco } from './Organizacao';

const Check = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const X = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

function Excluir({ excluir }: { excluir: () => void }){
  const [armado, setArmado] = useState(false);
  return (
    <button type="button" className={'icon-btn' + (armado ? ' armed' : '')} data-act="rot-excluir" title="Excluir rotina" aria-label="Excluir rotina"
      style={armado ? { width: 'auto', color: 'var(--danger)' } : undefined} onClick={() => { if (!armado){ setArmado(true); return; } excluir(); }}>
      {armado ? <span style={{ fontSize: 12, padding: '0 4px', whiteSpace: 'nowrap' }}>Excluir?</span> : <X />}
    </button>
  );
}

export function Rotinas({ dados, setDados, hoje, banco }: { dados: Dados; setDados: Dispatch<SetStateAction<Dados | null>>; hoje: Date; banco: Banco }){
  const avisar = useAviso();
  const [v, setV] = useState({ titulo: '', freq: 'mensal' });
  const tituloRef = useRef<HTMLInputElement>(null);
  const lista = ordenaRotinas(dados.rotinas, hoje);
  const feitas = lista.filter(x => rotinaFeita(x, hoje)).length;
  const pct = lista.length ? Math.round(feitas / lista.length * 100) : 0;
  const salvar = (x: Rotina) => banco.chamar('org_salvar_rotina', paraSalvarRotina(x));

  async function adicionar(){
    const titulo = v.titulo.trim();
    if (!titulo) return;
    const r = await banco.chamar('org_salvar_rotina', paraSalvarRotina({ titulo, frequencia: v.freq, feitaEm: null }));
    if (!banco.ok(r)) return;
    setV(s => ({ ...s, titulo: '' }));
    avisar('Rotina adicionada');
    await banco.recarregar();
    tituloRef.current?.focus();
  }

  return (
    <div id="orgPaneRotinas" className="org-pane">
      <div className="panel">
        <div className="panel-head"><h2>Rotinas</h2><span id="orgRotInfo">{lista.length ? feitas + ' de ' + lista.length + ' feitas no período · clique no título para editar' : ''}</span></div>
        <div className="progress" id="orgRotProg" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} hidden={!lista.length}><i style={{ width: pct + '%' }} /></div>
        <form className="org-add" id="orgRotForm" autoComplete="off" onSubmit={e => { e.preventDefault(); adicionar(); }}>
          <input className="org-in grow" id="orgRotTitulo" ref={tituloRef} maxLength={160} placeholder="Nova rotina (ex.: estatística mensal ao CNJ)…" required
            value={v.titulo} onChange={e => setV(s => ({ ...s, titulo: e.target.value }))} />
          <select className="org-in" id="orgRotFreq" aria-label="Frequência" value={v.freq} onChange={e => setV(s => ({ ...s, freq: e.target.value }))}>
            <option value="semanal">Semanal</option><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option>
          </select>
          <button type="submit" className="btn primary">Adicionar</button>
        </form>
        <div className="tgroup" id="orgRotList">
          {!lista.length && <div className="org-empty">Nenhuma rotina ainda. Cadastre as tarefas que se repetem toda semana, mês ou trimestre.</div>}
          {lista.map(x => {
            const ok = rotinaFeita(x, hoje);
            return (
              <div key={x.id} className={'task' + (ok ? ' rot-done' : '')}>
                <button type="button" className="check" role="checkbox" aria-checked={ok} data-act="rot-feita" aria-label="Marcar rotina como feita" onClick={async () => {
                  const quando = ok ? null : new Date();
                  const r = await salvar({ ...x, feitaEm: quando });
                  if (banco.ok(r)){ if (quando) avisar('Rotina feita em ' + formatarDataHora(quando)); await banco.recarregar(); }
                }}>{ok && <Check />}</button>
                <div style={{ minWidth: 0 }}>
                  <div className="t-title">
                    <Editavel className="editable" dataEdit="rotina" titulo="Clique para editar" texto={x.titulo} aoSalvar={async novo => {
                      const titulo = corrige(novo);
                      setDados(d => d && { ...d, rotinas: d.rotinas.map(y => (y.id === x.id ? { ...y, titulo } : y)) });
                      const r = await salvar({ ...x, titulo });
                      if (banco.ok(r)) avisar('Rotina atualizada'); else await banco.recarregar();
                    }} />
                  </div>
                  <div className="t-meta">
                    {ok
                      ? <span className="doneat">Feita em {formatarDataHora(x.feitaEm!)}</span>
                      : <><span>Pendente {PERIODO[x.frequencia]}</span>{x.feitaEm && <span>Última vez em {diaMes(x.feitaEm)}/{x.feitaEm.getFullYear()}</span>}</>}
                  </div>
                </div>
                <div className="t-side">
                  <span className="freq">{FREQ[x.frequencia]}</span>
                  <Excluir excluir={async () => {
                    const r = await banco.chamar('org_excluir_rotina', { p_id: x.id });
                    if (banco.ok(r)){ avisar('Rotina excluída'); await banco.recarregar(); }
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
