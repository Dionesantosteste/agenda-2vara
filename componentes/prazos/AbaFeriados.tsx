'use client';
// Aba "Feriados e suspensões": recesso, suspensões do tribunal, feriados da comarca e a lista do ano.
import { useState } from 'react';
import { OPCIONAIS, type Calendario, type ConfigCalendario } from '@/lib/prazos/calendario';
import { D, diaDaSemana, fmt, hoje, lerData } from '@/lib/prazos/datas';
import { useAviso } from '@/componentes/Avisos';

export type ErroCalendario = { message?: string; code?: string } | null;

function novoId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export function AbaFeriados({ cfg, cal, erro, mudar }: {
  cfg: ConfigCalendario; cal: Calendario; erro: ErroCalendario;
  mudar: (novo: ConfigCalendario, chave: string, valor?: unknown) => void;
}){
  const avisar = useAviso();
  const anoAtual = hoje().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [data, setData] = useState('');
  const [nome, setNome] = useState('');
  const [todoAno, setTodoAno] = useState(false);

  function acrescentar(){
    if (!data){ avisar('Escolha a data'); return; }
    const x = { id: novoId(), data, nome: nome.trim() || 'Feriado local', anual: todoAno };
    const extras = [...cfg.extras, x].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    setData(''); setNome(''); setTodoAno(false);
    mudar({ ...cfg, extras }, 'extra.' + x.id, { data: x.data, nome: x.nome, anual: x.anual });
    avisar('Acrescentado');
  }

  const mapa = cal.feriadosDoAno(ano);
  const itens = Object.keys(mapa).sort().map(k => { const d = lerData(k)!; return { d, nome: mapa[k].nome, o: mapa[k].tipo + ' · ' + diaDaSemana(d) }; });
  if (cfg.recesso) itens.push({ d: D(ano, 11, 20), nome: 'Recesso forense até 20/01/' + (ano + 1), o: 'CPC, art. 220 · prazos suspensos' });
  itens.sort((a, b) => a.d.getTime() - b.d.getTime());

  const m = erro ? (erro.message || '') + ' ' + (erro.code || '') : '';
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2];

  return (
    <div className="grid2">
      <div className="panel">
        <h2>O que não conta como dia útil</h2>
        <label className="ck"><input type="checkbox" id="pzFRecesso" checked={cfg.recesso} onChange={e => mudar({ ...cfg, recesso: e.target.checked }, 'recesso', e.target.checked)} /> <span>Recesso forense de 20/12 a 20/01<small>Suspende os prazos processuais (CPC, art. 220).</small></span></label>
        <h3>Suspensões que dependem do tribunal</h3>
        <div id="pzFOpc" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPCIONAIS.map(o => (
            <label className="ck" key={o.id}><input type="checkbox" data-opc={o.id} checked={!!cfg.opc[o.id]}
              onChange={e => mudar({ ...cfg, opc: { ...cfg.opc, [o.id]: e.target.checked } }, 'opc.' + o.id, e.target.checked)} /> <span>{o.nome}<small>{o.obs}</small></span></label>
          ))}
        </div>
        <p className="field-hint" style={{ margin: 0 }}>Confiram a portaria anual do TJMT com o calendário de expediente e marquem só o que ela suspende.</p>
        <h3>Feriados da comarca e suspensões avulsas</h3>
        <div className="row">
          <div className="field"><label htmlFor="pzFData">Data</label><input id="pzFData" type="date" value={data} onChange={e => setData(e.target.value)} /></div>
          <div className="field"><label htmlFor="pzFNome">Motivo</label><input id="pzFNome" maxLength={80} placeholder="Ex.: aniversário do município" value={nome} onChange={e => setNome(e.target.value)} /></div>
        </div>
        <label className="ck"><input type="checkbox" id="pzFTodoAno" checked={todoAno} onChange={e => setTodoAno(e.target.checked)} /> <span>Repete todo ano</span></label>
        <div className="acts"><button type="button" className="btn primary" id="pzFAdd" onClick={acrescentar}>Acrescentar</button></div>
        <div id="pzFExtras">
          {cfg.extras.length ? (
            <div className="fer-list" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
              {cfg.extras.map(x => {
                const d = lerData(x.data)!;
                return (
                  <div className="fer" style={{ gridTemplateColumns: '96px minmax(0,1fr) auto' }} key={x.id}>
                    <span className="d">{x.anual ? fmt(d).slice(0, 5) : fmt(d)}</span>
                    <span>{x.nome}<span className="o"> · {x.anual ? 'todo ano' : 'só nesta data'}</span></span>
                    <button type="button" className="x" data-del={x.id} aria-label={'Remover ' + x.nome}
                      onClick={() => mudar({ ...cfg, extras: cfg.extras.filter(y => y.id !== x.id) }, 'extra.' + x.id)}>×</button>
                  </div>
                );
              })}
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>Nenhum feriado local cadastrado.</p>}
        </div>
        <p className="field-hint" style={{ margin: 0 }}>A lista vale para toda a equipe e também para o prazo do laudo em Perícias.</p>
        <div className="aviso" id="pzFAviso" hidden={!erro}>
          {/prazos_config|42P01|PGRST205/.test(m)
            ? <><b>Falta a tabela do calendário no Supabase.</b> Rode o <code>sql/prazos.sql</code> (veja o LEIA-ME.md). Até lá, as mudanças ficam só neste navegador.</>
            : <><b>Calendário indisponível:</b> {m}. As mudanças ficam só neste navegador.</>}
        </div>
      </div>
      <div className="panel">
        <div className="acts" style={{ justifyContent: 'space-between' }}>
          <h2 id="pzFAnoTit">Dias sem expediente em {ano}</h2>
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><label htmlFor="pzFAno">Ano</label>
            <select id="pzFAno" style={{ width: 100 }} value={ano} onChange={e => setAno(+e.target.value)}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select></div>
        </div>
        <div className="fer-list" id="pzFLista">
          {itens.map((x, i) => <div className="fer" key={i}><span className="d">{fmt(x.d).slice(0, 5)}</span><span>{x.nome}<span className="o"> · {x.o}</span></span></div>)}
        </div>
      </div>
    </div>
  );
}
