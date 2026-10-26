'use client';
// Janela de edição da audiência (excluir pede confirmação)
import { useEffect, useRef, useState } from 'react';
import { STATUSES, hora, type Audiencia } from '@/lib/audiencias';
import { chaveDoDia } from '@/lib/datas';
import { formatarProcesso } from '@/lib/processo';
import { useAviso } from '@/componentes/Avisos';
import { CampoProcesso } from '@/componentes/CampoProcesso';
import { useJanela } from '@/componentes/useJanela';
import type { Salvar } from './Audiencias';
import { SelectTipo } from './SelectTipo';

export function DialogoAudiencia({ audiencia, nomes, fechar, salvar, excluir, novoTipo }: {
  audiencia: Audiencia | null; nomes: string[]; fechar: () => void; salvar: Salvar; excluir: (id: string) => void;
  novoTipo: (destino: (nome: string) => void) => void;
}){
  const avisar = useAviso();
  const { ref, cliqueFora, aoFechar } = useJanela(!!audiencia, fechar);
  const procRef = useRef<HTMLDivElement>(null);
  const [v, setV] = useState({ processo: '', data: '', hora: '', tipo: '', status: STATUSES[0], obs: '' });
  const [armado, setArmado] = useState(false);

  useEffect(() => {
    if (!audiencia) return;
    setV({ processo: audiencia.processo, data: chaveDoDia(audiencia.date), hora: hora(audiencia.date), tipo: audiencia.tipo, status: audiencia.status, obs: audiencia.observacoes });
    setArmado(false);
    setTimeout(() => procRef.current?.querySelector('input')?.focus(), 30);
  }, [audiencia]);

  const status = STATUSES.includes(v.status) ? STATUSES : [...STATUSES, v.status];

  return (
    <dialog id="audDialog" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      <form className="sheet" id="audForm" onSubmit={e => {
        e.preventDefault();
        if (!audiencia) return;
        const date = new Date(v.data + 'T' + v.hora);
        if (isNaN(date.getTime())){ avisar('Informe data e hora válidas'); return; }
        const processo = formatarProcesso(v.processo);
        if (!processo){ avisar('Informe o número do processo'); return; }
        salvar(audiencia.id, { processo, date, tipo: v.tipo.trim(), status: v.status, observacoes: v.obs.trim() }).then(ok => { if (ok) fechar(); });
      }}>
        <h2 id="audDialogTitle">Editar audiência</h2>
        <div className="field" ref={procRef}>
          <label htmlFor="aProcesso">Nº do processo</label>
          <CampoProcesso id="aProcesso" className="mono" maxLength={40} placeholder="0000000-00.0000.0.00.0000" autoComplete="off" required
            value={v.processo} onChange={x => setV(s => ({ ...s, processo: x }))} />
          <span className="field-hint">Com 20 dígitos, o número é formatado no padrão CNJ.</span>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="aData">Data</label>
            <input id="aData" type="date" required value={v.data} onChange={e => setV(s => ({ ...s, data: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="aHora">Hora</label>
            <input id="aHora" type="time" required value={v.hora} onChange={e => setV(s => ({ ...s, hora: e.target.value }))} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="aTipo">Tipo</label>
            <SelectTipo id="aTipo" required nomes={nomes} value={v.tipo} onChange={x => setV(s => ({ ...s, tipo: x }))}
              novoTipo={() => novoTipo(nome => setV(s => ({ ...s, tipo: nome })))} />
          </div>
          <div className="field">
            <label htmlFor="aStatus">Status</label>
            <select id="aStatus" value={v.status} onChange={e => setV(s => ({ ...s, status: e.target.value }))}>
              {status.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="aObs">Observações</label>
          <textarea id="aObs" rows={4} maxLength={4000} placeholder="Ex.: intimar testemunhas; audiência por videoconferência" value={v.obs} onChange={e => setV(s => ({ ...s, obs: e.target.value }))} />
        </div>
        <div className="sheet-actions">
          <button type="button" className={'btn ghost' + (armado ? ' armed' : '')} id="audDeleteBtn" onClick={() => {
            if (!audiencia) return;
            if (!armado){ setArmado(true); return; }
            excluir(audiencia.id); fechar();
          }}>{armado ? 'Confirmar exclusão' : 'Excluir'}</button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="btn" id="audCancelBtn" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn primary">Salvar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
