'use client';
// "Concluir tarefa": a pessoa que termina uma tarefa mandada pelo gestor responde o fechamento
import { useEffect, useState } from 'react';
import type { Tarefa } from '@/lib/organizacao';
import { useAviso } from '@/componentes/Avisos';
import { useJanela } from '@/componentes/useJanela';
import type { Banco } from './Organizacao';

type Props = { tarefa: Tarefa | null; banco: Banco; fechar: () => void };

export function DialogoFechamento(props: Props){
  const { ref, cliqueFora, aoFechar } = useJanela(!!props.tarefa, props.fechar);
  return (
    <dialog id="orgFechDialog" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      {/* o formulário nasce em branco a cada tarefa a concluir */}
      {props.tarefa && <Formulario key={props.tarefa.id} {...props} tarefa={props.tarefa} />}
    </dialog>
  );
}

function Formulario({ tarefa, banco, fechar }: Props & { tarefa: Tarefa }){
  const avisar = useAviso();
  const [v, setV] = useState({ horas: '0', minutos: '0', conf: 'sim', dif: 'nao', difDesc: '', acao: 'nao' });
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { const t = setTimeout(() => (document.getElementById('ofHoras') as HTMLInputElement | null)?.select(), 30); return () => clearTimeout(t); }, []);

  async function concluir(){
    if (!tarefa) return;
    const dif = v.dif === 'sim';
    if (dif && !v.difDesc.trim()){ avisar('Conte rapidamente qual foi a dificuldade.'); return; }
    const conclusao = {
      horas: Math.max(0, Math.min(999, parseInt(v.horas, 10) || 0)),
      minutos: Math.max(0, Math.min(59, parseInt(v.minutos, 10) || 0)),
      conformidade: v.conf || 'sim', dificuldade: dif, dificuldade_desc: dif ? v.difDesc.trim() : '', precisa_acao: v.acao === 'sim'
    };
    setEnviando(true);
    const r = await banco.chamar('org_concluir_tarefa', { p_id: tarefa.id, p_conclusao: conclusao });
    setEnviando(false);
    if (!banco.ok(r)) return;
    fechar();
    avisar('Tarefa concluída. O gestor já vê o fechamento.');
    await banco.recarregar();
  }
  const radio = (nome: 'conf' | 'dif' | 'acao', campo: string, valor: string, rotulo: string) => (
    <label><input type="radio" name={campo} value={valor} checked={v[nome] === valor} onChange={() => setV(s => ({ ...s, [nome]: valor }))} /> {rotulo}</label>
  );

  return (
      <form className="sheet" id="orgFechForm" autoComplete="off" onSubmit={e => { e.preventDefault(); concluir(); }}>
      <h2>Concluir tarefa</h2>
      <p className="field-hint" id="orgFechTitulo" style={{ margin: '-6px 0 0' }}>{tarefa.titulo}</p>
      <div className="field">
        <label>Quanto tempo você levou?</label>
        <div className="field-row">
          <input id="ofHoras" type="number" min={0} max={999} inputMode="numeric" aria-label="Horas" value={v.horas} onChange={e => setV(s => ({ ...s, horas: e.target.value }))} onFocus={e => e.target.select()} />
          <input id="ofMinutos" type="number" min={0} max={59} inputMode="numeric" aria-label="Minutos" value={v.minutos} onChange={e => setV(s => ({ ...s, minutos: e.target.value }))} />
        </div>
        <span className="field-hint">horas e minutos</span>
      </div>
      <fieldset className="field of-radios">
        <legend>Conseguiu concluir conforme o pedido?</legend>
        {radio('conf', 'ofConf', 'sim', 'Sim')}{radio('conf', 'ofConf', 'parcialmente', 'Parcialmente')}{radio('conf', 'ofConf', 'nao', 'Não')}
      </fieldset>
      <fieldset className="field of-radios">
        <legend>Teve alguma dificuldade?</legend>
        {radio('dif', 'ofDif', 'nao', 'Não')}{radio('dif', 'ofDif', 'sim', 'Sim')}
      </fieldset>
      <div className="field" id="ofDifWrap" hidden={v.dif !== 'sim'}>
        <label htmlFor="ofDifDesc">O que aconteceu?</label>
        <textarea id="ofDifDesc" rows={3} maxLength={1000} placeholder="Ex.: faltou uma informação para concluir…" value={v.difDesc} onChange={e => setV(s => ({ ...s, difDesc: e.target.value }))} />
      </div>
      <fieldset className="field of-radios">
        <legend>Precisa de alguma ação do gestor?</legend>
        {radio('acao', 'ofAcao', 'nao', 'Não')}{radio('acao', 'ofAcao', 'sim', 'Sim')}
      </fieldset>
      <div className="sheet-actions">
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button type="button" className="btn" id="ofCancelar" onClick={fechar}>Cancelar</button>
          <button type="submit" className="btn primary" id="ofConcluir" disabled={enviando}>Concluir tarefa</button>
        </div>
      </div>
    </form>
  );
}
