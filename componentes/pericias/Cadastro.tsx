'use client';
// Cadastro de perícia: uma de cada vez (com aviso de processo repetido) ou várias de uma vez (colando uma lista)
import { useRef, useState } from 'react';
import {
  descrever, duplicadasDe, especialidadeDoPerito, peritoCadastrado, previaDoLote, resumoDoLote, type Pericia, type Perito
} from '@/lib/pericias';
import { formatarProcesso } from '@/lib/processo';
import { useAviso } from '@/componentes/Avisos';
import { CampoProcesso } from '@/componentes/CampoProcesso';
import { NOVO_PERITO, SelectEspecialidade, SelectPerito } from './SelectPerito';

export type NovaPericia = Omit<Pericia, 'id'> & { id?: string };
export type Gravar = (p: NovaPericia, antes: Pericia | null, semRecarregar?: boolean) => Promise<boolean>;

const VAZIO = { proc: '', autor: '', perito: '', novoPerito: '', esp: '', data: '', hora: '', local: '', obs: '' };

export function Cadastro({ itens, peritos, nomes, gravar, salvarPerito, recarregar }: {
  itens: Pericia[]; peritos: Perito[]; nomes: string[]; gravar: Gravar;
  salvarPerito: (x: { nome: string; especialidade: string }) => Promise<boolean>; recarregar: () => Promise<void>;
}){
  const avisar = useAviso();
  const formRef = useRef<HTMLFormElement>(null);
  const [modo, setModo] = useState<'uma' | 'varias'>('uma');
  const [v, setV] = useState(VAZIO);
  // aviso de processo que já tem perícia em andamento; "confirmar" pede o botão "Cadastrar mesmo assim"
  const [dup, setDup] = useState<{ proc: string; texto: string; confirmar: boolean } | null>(null);
  const confirmouDup = useRef(false);
  // várias de uma vez
  const [l, setL] = useState({ perito: '', esp: '', data: '', hora: '08:00', intervalo: '10', local: '', texto: '' });
  const [forcar, setForcar] = useState<Record<number, boolean>>({});
  const [cadastrando, setCadastrando] = useState(false);

  const mostrarDup = (proc: string, confirmar: boolean) => {
    const d = duplicadasDe(itens, proc);
    if (d.length) setDup({ proc, texto: d.map(descrever).join('; '), confirmar });
    return d.length > 0;
  };
  const esconderDup = () => { setDup(null); confirmouDup.current = false; };
  const focarProc = () => document.getElementById('pProcesso')?.focus();

  async function cadastrar(){
    let data: Date | null = null;
    if (v.data){
      data = new Date(v.data + 'T' + (v.hora || '09:00'));
      if (isNaN(data.getTime())){ avisar('Data ou hora inválida'); return; }
    }
    const proc = formatarProcesso(v.proc);
    if (!confirmouDup.current && mostrarDup(proc, true)) return;
    let nomePerito = v.perito === NOVO_PERITO ? v.novoPerito.trim() : v.perito.trim();
    if (v.perito === NOVO_PERITO && nomePerito){
      const existente = peritoCadastrado(peritos, nomePerito);
      if (existente) nomePerito = existente.nome;
      else if (!(await salvarPerito({ nome: nomePerito, especialidade: v.esp }))) return;
    }
    confirmouDup.current = false;
    const p: NovaPericia = { processo: proc, autor: v.autor.trim(), perito: nomePerito, especialidade: v.esp, status: data ? 'agendada' : 'nao_agendada',
      data, local: v.local.trim(), realizadaEm: null, laudoEm: null, observacoes: v.obs.trim(), conferidaEm: null };
    if (!p.processo || !p.autor || !p.perito){ avisar('Informe o processo, o autor e o perito'); return; }
    if (!(await gravar(p, null))) return;
    avisar(data ? 'Perícia cadastrada como Agendada' : 'Perícia cadastrada como Não agendada');
    esconderDup();
    setV(VAZIO);
    focarProc();
  }

  const previa = previaDoLote(l.texto, itens, forcar, l.hora, parseInt(l.intervalo, 10));
  const semPerito = !l.perito;
  async function cadastrarLote(){
    const alvo = previa.linhas.filter(r => r.incluir);
    if (!alvo.length || !l.perito) return;
    setCadastrando(true);
    let ok = 0;
    for (const r of alvo){
      const h = r.horaCalc || l.hora || '08:00';
      const data = l.data ? new Date(l.data + 'T' + h) : null;
      const p: NovaPericia = { processo: r.processo, autor: r.autor, perito: l.perito, especialidade: l.esp, status: data ? 'agendada' : 'nao_agendada',
        data, local: l.local.trim(), realizadaEm: null, laudoEm: null, observacoes: '', conferidaEm: null };
      if (await gravar(p, null, true)) ok++;
      else break;
    }
    const ignoradas = previa.linhas.length - alvo.length;
    await recarregar();
    // tira da caixa só as que foram cadastradas; as repetidas ou com problema ficam para corrigir
    const feitas: Record<string, number> = {};
    alvo.slice(0, ok).forEach(r => { feitas[r.texto] = (feitas[r.texto] || 0) + 1; });
    const resto = l.texto.split(/\r?\n/).filter(t => {
      const k = t.trim(); if (!k) return false;
      if (feitas[k]){ feitas[k]--; return false; }
      return true;
    }).join('\n');
    setL(x => ({ ...x, texto: resto }));
    setForcar({});
    setCadastrando(false);
    if (ok === alvo.length)
      avisar(ok + (ok === 1 ? ' perícia cadastrada' : ' perícias cadastradas') + (ignoradas ? ' · ' + ignoradas + (ignoradas === 1 ? ' linha ficou' : ' linhas ficaram') + ' na caixa (repetidas ou com problema)' : ''));
    else avisar('Cadastradas ' + ok + ' de ' + alvo.length + '. As demais continuam na caixa para tentar de novo.');
  }

  return (
    <form className="quick" id="perForm" ref={formRef} autoComplete="off" aria-labelledby="perFormTitle" noValidate={modo === 'varias'}
      onSubmit={e => { e.preventDefault(); if (modo === 'uma') cadastrar(); }}>
      <div className="quick-head">
        <h2 id="perFormTitle">Cadastrar perícia</h2>
        <div className="per-modos" role="tablist" aria-label="Forma de cadastro">
          <button type="button" className="per-modo" role="tab" data-modo="uma" aria-selected={modo === 'uma'} onClick={() => { setModo('uma'); esconderDup(); }}>Uma perícia</button>
          <button type="button" className="per-modo" role="tab" data-modo="varias" aria-selected={modo === 'varias'}
            onClick={() => { setModo('varias'); esconderDup(); setTimeout(() => document.getElementById('lTexto')?.focus(), 0); }}>Várias de uma vez</button>
        </div>
      </div>
      <div className="per-grid" id="perModoUma" hidden={modo !== 'uma'}>
        <div className="field pg-proc">
          <label htmlFor="pProcesso">Nº do processo</label>
          <CampoProcesso id="pProcesso" className="mono" maxLength={40} placeholder="0000000-00.0000.0.00.0000" required value={v.proc}
            onChange={x => { if (x !== v.proc) esconderDup(); setV(s => ({ ...s, proc: x })); }}
            onBlur={e => mostrarDup(formatarProcesso(e.target.value), false)} />
        </div>
        <div className="field pg-autor">
          <label htmlFor="pAutor">Nome do autor</label>
          <input id="pAutor" maxLength={160} placeholder="Parte autora do processo" required value={v.autor} onChange={e => setV(s => ({ ...s, autor: e.target.value }))} />
        </div>
        <div className="field pg-perito">
          <label htmlFor="pPerito">Perito</label>
          <SelectPerito id="pPerito" required comNovo nomes={nomes} peritos={peritos} value={v.perito} onChange={x => {
            if (x === NOVO_PERITO){ setV(s => ({ ...s, perito: x })); setTimeout(() => document.getElementById('pNovoPerito')?.focus(), 0); return; }
            const esp = especialidadeDoPerito(peritos, itens, x);
            setV(s => ({ ...s, perito: x, esp: esp || s.esp }));
          }} />
          <input id="pNovoPerito" maxLength={120} placeholder="Nome do novo perito" hidden={v.perito !== NOVO_PERITO} required={v.perito === NOVO_PERITO}
            value={v.novoPerito} onChange={e => setV(s => ({ ...s, novoPerito: e.target.value }))} />
        </div>
        <div className="field pg-esp">
          <label htmlFor="pEsp">Especialidade</label>
          <SelectEspecialidade id="pEsp" value={v.esp} onChange={x => setV(s => ({ ...s, esp: x }))} />
        </div>
        <div className="field pg-data">
          <label htmlFor="pData">Data da perícia</label>
          <input id="pData" type="date" value={v.data} onChange={e => setV(s => ({ ...s, data: e.target.value }))} />
        </div>
        <div className="field pg-hora">
          <label htmlFor="pHora">Hora</label>
          <input id="pHora" type="time" value={v.hora} onChange={e => setV(s => ({ ...s, hora: e.target.value }))} />
        </div>
        <div className="field pg-local">
          <label htmlFor="pLocal">Local</label>
          <input id="pLocal" maxLength={160} placeholder="Endereço, consultório ou virtual" value={v.local} onChange={e => setV(s => ({ ...s, local: e.target.value }))} />
        </div>
        <div className="field pg-obs">
          <label htmlFor="pObs">Observações</label>
          <input id="pObs" maxLength={2000} placeholder="Ex.: periciando com mobilidade reduzida" value={v.obs} onChange={e => setV(s => ({ ...s, obs: e.target.value }))} />
        </div>
        <button type="submit" className="btn primary pg-save">Cadastrar</button>
        <div className="dup-aviso pg-dup" id="perDupAviso" hidden={!dup} role="alert">
          {dup && <>
            <span><b>Atenção:</b> o processo {dup.proc} já tem perícia {dup.texto}.</span>
            {dup.confirmar && <span className="btns">
              <button type="button" className="btn" data-dup="cancelar" onClick={() => { esconderDup(); focarProc(); }}>Cancelar</button>
              <button type="button" className="btn primary" data-dup="confirmar" onClick={() => { confirmouDup.current = true; setDup(null); formRef.current?.requestSubmit(); }}>Cadastrar mesmo assim</button>
            </span>}
          </>}
        </div>
      </div>

      <div id="perModoVarias" className="lote" hidden={modo !== 'varias'}>
        <div className="lote-grid">
          <div className="field lt-perito"><label htmlFor="lPerito">Perito</label>
            <SelectPerito id="lPerito" nomes={nomes} peritos={peritos} value={l.perito} onChange={x => {
              const c = peritoCadastrado(peritos, x);
              setL(s => ({ ...s, perito: x, esp: c && c.especialidade ? c.especialidade : s.esp }));
            }} /></div>
          <div className="field lt-esp"><label htmlFor="lEsp">Especialidade</label><SelectEspecialidade id="lEsp" value={l.esp} onChange={x => setL(s => ({ ...s, esp: x }))} /></div>
          <div className="field lt-data"><label htmlFor="lData">Data da perícia</label><input id="lData" type="date" value={l.data} onChange={e => setL(s => ({ ...s, data: e.target.value }))} /></div>
          <div className="field lt-hora"><label htmlFor="lHora">Hora da primeira</label><input id="lHora" type="time" value={l.hora} onChange={e => setL(s => ({ ...s, hora: e.target.value }))} /></div>
          <div className="field lt-int"><label htmlFor="lIntervalo">Intervalo (min)</label><input id="lIntervalo" type="number" min={0} max={240} step={5} value={l.intervalo} onChange={e => setL(s => ({ ...s, intervalo: e.target.value }))} /></div>
          <div className="field lt-local"><label htmlFor="lLocal">Local</label><input id="lLocal" maxLength={160} placeholder="Igual para todas (opcional)" value={l.local} onChange={e => setL(s => ({ ...s, local: e.target.value }))} /></div>
        </div>
        <div className="field">
          <label htmlFor="lTexto">Processos (um por linha: nº do processo, nome do autor e, se quiser, a hora)</label>
          <textarea id="lTexto" rows={7} spellCheck={false} value={l.texto} onChange={e => { setL(s => ({ ...s, texto: e.target.value })); setForcar({}); }}
            placeholder={'1002345-67.2026.8.11.0041; Maria Aparecida dos Santos; 08:00\n1002346-50.2026.8.11.0041; José Carlos Ferreira; 08:30\n10023471220268110041 Ana Beatriz Lima 09:00'} />
          <span className="field-hint">Pode colar de uma planilha ou de um e-mail. Sem data, entram como &quot;Não agendada&quot;. As horas seguem em sequência a partir da primeira, com o intervalo escolhido; se a linha trouxer a hora, vale a da linha e a sequência continua dela.</span>
        </div>
        <div className="lote-previa" id="lPrevia">
          {previa.linhas.map((r, i) => (
            <div key={i} className={'lrow' + (r.erro ? ' bad' : '') + (!r.incluir ? ' skip' : '')}>
              <span className="n">{i + 1}</span>
              <span className="proc">{r.processo || <i>{r.texto.slice(0, 40)}</i>}</span>
              <span className="autor">{r.autor || '—'}</span>
              <span className="hora">{l.data && r.horaCalc ? r.horaCalc : ''}</span>
              {r.erro ? <span className="st bad">{r.erro}</span>
                : r.aviso ? <span className="st warn">{r.aviso}<br /><label><input type="checkbox" data-forcar={i} checked={!!forcar[i]}
                    onChange={e => setForcar(f => { const n = { ...f }; if (e.target.checked) n[i] = true; else delete n[i]; return n; })} /> cadastrar mesmo assim</label></span>
                : <span className="st ok">Pronta{l.data ? '' : ' · entra como Não agendada'}</span>}
            </div>
          ))}
        </div>
        <div className="lote-acoes">
          <span className="lote-resumo" id="lResumo">{resumoDoLote(previa, semPerito)}</span>
          <button type="button" className="btn primary" id="lCadastrar" disabled={cadastrando || !previa.prontas || semPerito} onClick={cadastrarLote}>
            {cadastrando ? 'Cadastrando…' : previa.prontas ? 'Cadastrar ' + previa.prontas + (previa.prontas === 1 ? ' perícia' : ' perícias') : 'Cadastrar perícias'}
          </button>
        </div>
      </div>
    </form>
  );
}
