'use client';
// Barra de alteração em lote: aparece quando há perícias selecionadas
import { useEffect, useState } from 'react';
import { dataSugerida, type Pericia } from '@/lib/pericias';

export type Lote = { st: string; data: string; hora: string; intervalo: string; andamento: string };

export function BarraLote({ sel, aplicar, limpar, sugestao }: {
  sel: Pericia[]; aplicar: (l: Lote) => Promise<boolean>; limpar: () => void;
  sugestao: number;   // muda quando a seleção pede uma nova data sugerida (marcou um cartão ou um grupo)
}){
  const [l, setL] = useState<Lote>({ st: 'realizada', data: '', hora: '08:00', intervalo: '10', andamento: '' });
  const [aplicando, setAplicando] = useState(false);
  const n = sel.length, visivel = n > 0;
  // Ao aparecer, e quando a seleção muda, sugere a data
  useEffect(() => { if (visivel) setL(x => ({ ...x, data: dataSugerida(x.st, sel, new Date()) })); }, [visivel]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sugestao) setL(x => ({ ...x, data: x.st === 'realizada' || sugestao < 0 ? dataSugerida(x.st, sel, new Date()) : x.data })); }, [sugestao]);   // eslint-disable-line react-hooks/exhaustive-deps

  const st = l.st;
  return (
    <div className="batch" id="perBatch" hidden={!visivel} role="region" aria-label="Alterar as perícias selecionadas">
      <div className="batch-in">
        <span className="batch-n" id="perBatchN">{n === 1 ? '1 perícia selecionada' : n + ' perícias selecionadas'}</span>
        <label className="bfield">Nova situação
          <select id="perBatchSt" value={st} onChange={e => { const v = e.target.value; setL(x => ({ ...x, st: v, data: dataSugerida(v, sel, new Date()) })); }}>
            <option value="realizada">Realizada</option>
            <option value="agendada">Agendada</option>
            <option value="intimacoes_feitas">Intimações feitas</option>
            <option value="pronta">Pronta para perícia</option>
            <option value="laudo_juntado">Laudo juntado</option>
            <option value="nao_agendada">Não agendada</option>
            <option value="cancelada">Cancelada</option>
            <option value="">Manter a situação (só registrar andamento)</option>
          </select>
        </label>
        <label className="bfield" id="perBatchDataWrap" hidden={!(st === 'realizada' || st === 'agendada' || st === 'laudo_juntado')}>
          <span id="perBatchDataLbl">{st === 'agendada' ? 'Data da perícia' : st === 'laudo_juntado' ? 'Laudo juntado em' : 'Realizada em'}</span>
          <input type="date" id="perBatchData" value={l.data} onChange={e => setL(x => ({ ...x, data: e.target.value }))} />
        </label>
        <label className="bfield" id="perBatchHoraWrap" hidden={st !== 'agendada'}>Hora da primeira<input type="time" id="perBatchHora" value={l.hora} onChange={e => setL(x => ({ ...x, hora: e.target.value }))} /></label>
        <label className="bfield" id="perBatchIntWrap" hidden={st !== 'agendada'}>Intervalo (min)<input type="number" id="perBatchInt" min={0} max={240} step={5} value={l.intervalo} onChange={e => setL(x => ({ ...x, intervalo: e.target.value }))} /></label>
        <label className="bfield grow">Andamento (opcional)<input id="perBatchAnd" maxLength={300} placeholder="Ex.: perícias realizadas em mutirão" value={l.andamento} onChange={e => setL(x => ({ ...x, andamento: e.target.value }))} /></label>
        <div className="batch-btns">
          <button type="button" className="btn primary" id="perBatchApply" disabled={aplicando} onClick={async () => {
            setAplicando(true);
            const ok = await aplicar(l);
            setAplicando(false);
            if (ok) setL(x => ({ ...x, andamento: '' }));
          }}>{aplicando ? 'Aplicando…' : 'Aplicar'}</button>
          <button type="button" className="btn" id="perBatchClear" onClick={limpar}>Limpar seleção</button>
        </div>
      </div>
    </div>
  );
}
