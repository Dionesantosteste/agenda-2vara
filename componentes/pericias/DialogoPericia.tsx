'use client';
// Janela de edição da perícia (datas, situação, prazo do laudo; excluir pede confirmação)
import { useEffect, useRef, useState } from 'react';
import { PER_STATUS, PRAZO_LAUDO, dataBr, dataLocal, hora, duplicadasDe, descrever, marcada, peritoCadastrado, somarDiasUteis, type Pericia, type Perito, type Status, type Util } from '@/lib/pericias';
import { chaveDoDia } from '@/lib/datas';
import { formatarProcesso } from '@/lib/processo';
import { useAviso } from '@/componentes/Avisos';
import { CampoProcesso } from '@/componentes/CampoProcesso';
import { useJanela } from '@/componentes/useJanela';
import { SelectEspecialidade, SelectPerito } from './SelectPerito';

export type Edicao = { base: Pericia; antes: Pericia } | null;

export function DialogoPericia({ edicao, itens, nomes, peritos, util, fechar, salvar, excluir }: {
  edicao: Edicao; itens: Pericia[]; nomes: string[]; peritos: Perito[]; util: Util; fechar: () => void;
  salvar: (p: Pericia, antes: Pericia) => Promise<boolean>; excluir: (id: string) => Promise<void>;
}){
  const avisar = useAviso();
  const { ref, cliqueFora, aoFechar } = useJanela(!!edicao, fechar);
  const [v, setV] = useState({ proc: '', autor: '', perito: '', esp: '', status: 'nao_agendada' as Status, data: '', hora: '', local: '', real: '', laudo: '', obs: '' });
  const [armado, setArmado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmouDup = useRef(false);

  useEffect(() => {
    if (!edicao) return;
    const p = edicao.base;
    setV({ proc: p.processo, autor: p.autor || '', perito: p.perito, esp: p.especialidade, status: p.status,
      data: p.data ? chaveDoDia(p.data) : '', hora: p.data ? hora(p.data) : '', local: p.local,
      real: p.realizadaEm ? chaveDoDia(p.realizadaEm) : '', laudo: p.laudoEm ? chaveDoDia(p.laudoEm) : '', obs: p.observacoes });
    setArmado(false);
    confirmouDup.current = false;
    setTimeout(() => document.getElementById(marcada(p.status) && !p.data ? 'peData' : 'peProcesso')?.focus(), 30);
  }, [edicao]);

  const real = v.real ? dataLocal(v.real) : null;
  const prazoInfo = real
    ? 'Prazo do laudo: ' + dataBr(somarDiasUteis(real, PRAZO_LAUDO, util)) + ' (' + PRAZO_LAUDO + ' dias úteis após a realização, sem fins de semana, feriados nacionais e recesso de 20/12 a 20/01).'
    : 'O prazo de ' + PRAZO_LAUDO + ' dias úteis do laudo começa a contar quando a perícia é marcada como realizada.';

  async function enviar(){
    if (!edicao) return;
    const p: Pericia = { ...edicao.base,
      processo: formatarProcesso(v.proc), autor: v.autor.trim(), perito: v.perito.trim(), especialidade: v.esp,
      data: v.data ? new Date(v.data + 'T' + (v.hora || '09:00')) : null, local: v.local.trim(), observacoes: v.obs.trim(),
      realizadaEm: v.real ? dataLocal(v.real) : null, laudoEm: v.laudo ? dataLocal(v.laudo) : null, status: v.status };
    if (marcada(p.status) && !p.data){ avisar('Informe a data da perícia'); document.getElementById('peData')?.focus(); return; }
    if (p.status === 'realizada' && !p.realizadaEm){ avisar('Informe a data em que a perícia foi realizada'); document.getElementById('peRealizada')?.focus(); return; }
    if (p.status === 'laudo_juntado' && !p.laudoEm){ avisar('Informe a data em que o laudo foi juntado'); document.getElementById('peLaudo')?.focus(); return; }
    if (p.processo !== edicao.base.processo && !confirmouDup.current){
      const d = duplicadasDe(itens, p.processo, p.id);
      if (d.length){ confirmouDup.current = true; avisar('Atenção: o processo ' + p.processo + ' já tem perícia ' + d.map(descrever).join('; ') + '. Clique em Salvar de novo para manter assim.'); return; }
    }
    if (!(await salvar(p, edicao.antes))) return;
    fechar();
    avisar('Perícia atualizada');
  }

  const campo = (k: keyof typeof v) => (e: { target: { value: string } }) => setV(s => ({ ...s, [k]: e.target.value }));
  return (
    <dialog id="perDialog" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      <form className="sheet" id="perEditForm" ref={formRef} onSubmit={e => { e.preventDefault(); enviar(); }}>
        <h2>Editar perícia</h2>
        <div className="field">
          <label htmlFor="peProcesso">Nº do processo</label>
          <CampoProcesso id="peProcesso" className="mono" maxLength={40} required value={v.proc} onChange={x => { confirmouDup.current = false; setV(s => ({ ...s, proc: x })); }} />
        </div>
        <div className="field">
          <label htmlFor="peAutor">Nome do autor</label>
          <input id="peAutor" maxLength={160} value={v.autor} onChange={campo('autor')} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="pePerito">Perito</label>
            <SelectPerito id="pePerito" required nomes={nomes} peritos={peritos} value={v.perito} onChange={x => {
              const c = peritoCadastrado(peritos, x);
              setV(s => ({ ...s, perito: x, esp: c && c.especialidade ? c.especialidade : s.esp }));
            }} />
          </div>
          <div className="field">
            <label htmlFor="peEsp">Especialidade</label>
            <SelectEspecialidade id="peEsp" value={v.esp} onChange={x => setV(s => ({ ...s, esp: x }))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="peStatus">Situação</label>
          <select id="peStatus" value={v.status} onChange={e => {
            const st = e.target.value as Status, hoje = chaveDoDia(new Date());
            setV(s => ({ ...s, status: st,
              real: st === 'realizada' && !s.real ? (s.data && s.data <= hoje ? s.data : hoje) : s.real,
              laudo: st === 'laudo_juntado' && !s.laudo ? hoje : s.laudo }));
          }}>
            {PER_STATUS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="peData">Data da perícia</label>
            <input id="peData" type="date" value={v.data} onChange={campo('data')} />
          </div>
          <div className="field">
            <label htmlFor="peHora">Hora</label>
            <input id="peHora" type="time" value={v.hora} onChange={campo('hora')} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="peRealizada">Realizada em</label>
            <input id="peRealizada" type="date" value={v.real} onChange={campo('real')} />
          </div>
          <div className="field">
            <label htmlFor="peLaudo">Laudo juntado em</label>
            <input id="peLaudo" type="date" value={v.laudo} onChange={campo('laudo')} />
          </div>
        </div>
        <span className="field-hint" id="pePrazoInfo">{prazoInfo}</span>
        <div className="field">
          <label htmlFor="peObs">Observações</label>
          <textarea id="peObs" rows={3} maxLength={2000} value={v.obs} onChange={campo('obs')} />
        </div>
        <div className="sheet-actions">
          <button type="button" className={'btn ghost' + (armado ? ' armed' : '')} id="peDelete" onClick={async () => {
            if (!edicao) return;
            if (!armado){ setArmado(true); return; }
            await excluir(edicao.base.id);
          }}>{armado ? 'Confirmar exclusão' : 'Excluir'}</button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="btn" id="peCancel" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn primary">Salvar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
