'use client';
// Seção Audiências do sistema novo: pauta, cadastro rápido, filtros, resumo, conferência, tipos e impressão.
// Usa as mesmas tabelas do Supabase (audiencias e audiencias_tipos).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CONF_FILTROS, JANELA_DIAS, PERIODOS, STATUSES, STATUS_PADRAO, TODOS, dataDaImpressao, deLinha, diaMes, erroDosTipos, hora,
  descreverAudiencia, nomesTipos, pauta, pendente, repetidasDe, resumo, rotuloDoDia, somaDias, textoDoFiltro, type Audiencia, type Conf, type Filtros, type Periodo
} from '@/lib/audiencias';
import { destaque } from '@/lib/agenda';
import { chaveDoDia, formatarDataHora } from '@/lib/datas';
import { formatarProcesso, soDigitos } from '@/lib/processo';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';
import { CampoProcesso } from '@/componentes/CampoProcesso';
import { useImpressao } from '@/componentes/Impressao';
import { IconeEngrenagem } from '@/componentes/Icones';
import { DialogoAudiencia } from './DialogoAudiencia';
import { DialogoTipos, type Tipo } from './DialogoTipos';
import { SelectTipo } from './SelectTipo';

export type Salvar = (id: string | null, d: { processo: string; date: Date; tipo: string; status: string; observacoes: string }) => Promise<boolean>;

export function Destacado({ texto, busca }: { texto: string; busca: string }){
  const d = destaque(texto, busca);
  return d ? <>{d[0]}<mark>{d[1]}</mark>{d[2]}</> : <>{texto}</>;
}
const IconeCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;

function Chip({ pressionado, onClick, children }: { pressionado: boolean; onClick: () => void; children: ReactNode }){
  return <button type="button" className="chip" aria-pressed={pressionado} onClick={onClick}>{children}</button>;
}

// Botão de conferência: desmarcar pede um segundo clique (some sozinho em 4 s)
function BotaoConferir({ a, alternar }: { a: Audiencia; alternar: () => void }){
  const [armado, setArmado] = useState(false);
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);
  const clique = () => { if (a.conferidaEm && !armado){ setArmado(true); return; } setArmado(false); alternar(); };
  if (a.conferidaEm) return (
    <button type="button" className={'conf-btn done' + (armado ? ' armed' : '')} onClick={clique} title={'Conferida em ' + formatarDataHora(a.conferidaEm) + '. Clique para desmarcar.'}>
      {armado ? <span>Desmarcar conferência?</span> : <><IconeCheck /><span>Conferida</span><span className="conf-date">{formatarDataHora(a.conferidaEm).replace(' às ', ' ')}</span></>}
    </button>
  );
  return <button type="button" className="conf-btn" onClick={clique} title="Marcar como conferida (grava a data e a hora de agora)"><IconeCheck /><span>Conferir</span></button>;
}

function Cartao({ a, agora, busca, mudarStatus, conferir, editar }: { a: Audiencia; agora: Date; busca: string; mudarStatus: (s: string) => void; conferir: () => void; editar: () => void }){
  const pend = pendente(a, agora);
  const opcoes = STATUSES.includes(a.status) ? STATUSES : [...STATUSES, a.status];
  return (
    <div className={'hcard' + (pend ? ' pending' : '') + (a.status === 'Cancelada' ? ' cancelled' : '')}>
      <div className="htime">{hora(a.date)}</div>
      <div className="hinfo">
        <div className="hproc"><Destacado texto={a.processo || 'Processo não informado'} busca={busca} /></div>
        {a.tipo && <div className="htipo"><Destacado texto={a.tipo} busca={busca} /></div>}
        {a.observacoes && <div className="hobs" title={a.observacoes}><Destacado texto={a.observacoes} busca={busca} /></div>}
        {pend && <span className="flag">Já passou — atualize o status</span>}
      </div>
      <div className="hside">
        <label className="status-pill" data-status={a.status}>
          <select aria-label={'Status da audiência do processo ' + a.processo} value={a.status} onChange={e => mudarStatus(e.target.value)}>
            {opcoes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="hactions">
          <BotaoConferir a={a} alternar={conferir} />
          <button className="icon-btn" type="button" title="Editar audiência" aria-label={'Editar audiência do processo ' + a.processo} onClick={editar}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Audiencias(){
  // A tela depende do relógio e do navegador: só aparece depois de carregar no navegador
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto ? <Corpo /> : null;
}

function Corpo(){
  const avisar = useAviso();
  const { imprimir, area } = useImpressao();
  const [itens, setItens] = useState<Audiencia[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<{ message?: string; code?: string } | null>(null);
  const [tipos, setTipos] = useState<{ lista: Tipo[]; erro: { message?: string; code?: string } | null; carregado: boolean }>({ lista: [], erro: null, carregado: false });
  const [f, setF] = useState<Filtros>({ periodo: 'proximas', de: '', ate: '', status: TODOS, tipo: TODOS, conf: 'todas', busca: '' });
  const [agora, setAgora] = useState(() => new Date());
  // cadastro rápido (a data fica para a próxima)
  const [q, setQ] = useState(() => ({ processo: '', data: chaveDoDia(new Date()), hora: '', status: STATUS_PADRAO, tipo: '', obs: '' }));
  const [editando, setEditando] = useState<Audiencia | null>(null);
  // janela de tipos: aberta, e para qual lista de tipo vai o tipo novo
  const [tiposAberto, setTiposAberto] = useState<null | { destino: null | ((nome: string) => void) }>(null);

  const mudar = (x: Partial<Filtros>) => setF(v => ({ ...v, ...x }));

  const carregar = useCallback(async () => {
    const res = await supabase().from('audiencias').select('*').order('data_hora', { ascending: true });
    setCarregado(true);
    if (res.error){ setErro(res.error); return; }
    setErro(null);
    setItens((res.data || []).map(deLinha));
  }, []);
  const carregarTipos = useCallback(async () => {
    const res = await supabase().from('audiencias_tipos').select('*').order('nome', { ascending: true });
    setTipos({ carregado: true, erro: res.error || null, lista: (res.data || []).map(t => ({ id: String(t.id), nome: (t.nome as string) || '' })) });
  }, []);
  useEffect(() => {
    carregar(); carregarTipos();
    const canal = supabase().channel('audiencias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audiencias' }, () => { carregar(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audiencias_tipos' }, () => { carregarTipos(); })
      .subscribe();
    // mantém "hoje" e os avisos de "já passou" corretos com a página aberta
    const t = setInterval(() => setAgora(new Date()), 60000);
    return () => { supabase().removeChannel(canal); clearInterval(t); };
  }, [carregar, carregarTipos]);

  const nomes = nomesTipos(tipos.carregado && !tipos.erro ? tipos.lista.map(t => t.nome) : null, itens);

  // repetida: avisa uma vez; salvar de novo a mesma coisa confirma
  const avisouRepetida = useRef('');
  const salvar: Salvar = async (id, d) => {
    const rep = repetidasDe(itens, d.processo, d.date, d.tipo, id);
    const chave = [id, soDigitos(d.processo), d.date.getTime(), d.tipo].join('|');
    if (rep.length && avisouRepetida.current !== chave){
      avisouRepetida.current = chave;
      avisar('Atenção: o processo ' + d.processo + ' já tem audiência em ' + rep.map(descreverAudiencia).join('; ') + '. Salve de novo para manter assim.');
      return false;
    }
    avisouRepetida.current = '';
    const payload = { processo: d.processo, data_hora: d.date.toISOString(), tipo: d.tipo, status: d.status, observacoes: d.observacoes, updated_at: new Date().toISOString() };
    const res = id ? await supabase().from('audiencias').update(payload).eq('id', id) : await supabase().from('audiencias').insert(payload);
    if (res.error){ avisar('Não foi possível salvar: ' + res.error.message); return false; }
    avisar(id ? 'Audiência atualizada' : 'Audiência cadastrada');
    await carregar();
    return true;
  };
  async function excluir(id: string){
    const res = await supabase().from('audiencias').delete().eq('id', id);
    if (res.error){ avisar('Não foi possível excluir: ' + res.error.message); return; }
    avisar('Audiência excluída');
    await carregar();
  }
  async function mudarStatus(a: Audiencia, status: string){
    const antes = a.status;
    setItens(xs => xs.map(x => (x.id === a.id ? { ...x, status } : x)));
    const res = await supabase().from('audiencias').update({ status, updated_at: new Date().toISOString() }).eq('id', a.id);
    if (res.error){
      setItens(xs => xs.map(x => (x.id === a.id ? { ...x, status: antes } : x)));
      avisar('Não foi possível alterar o status: ' + res.error.message);
      return;
    }
    avisar('Status: ' + status);
  }
  async function conferir(a: Audiencia){
    const antes = a.conferidaEm, depois = antes ? null : new Date();
    setItens(xs => xs.map(x => (x.id === a.id ? { ...x, conferidaEm: depois } : x)));
    const res = await supabase().from('audiencias').update({ conferida_em: depois ? depois.toISOString() : null }).eq('id', a.id);
    if (res.error){
      setItens(xs => xs.map(x => (x.id === a.id ? { ...x, conferidaEm: antes } : x)));
      const m = res.error.message || '';
      avisar(/conferida_em/.test(m) ? 'Falta a coluna "conferida_em" no Supabase. Rode o SQL do LEIA-ME.md (Passo 2.2).' : 'Não foi possível marcar: ' + m);
      return;
    }
    avisar(depois ? 'Audiência conferida em ' + formatarDataHora(depois) : 'Conferência desmarcada');
  }

  async function cadastrarRapido(){
    const date = new Date(q.data + 'T' + q.hora);
    if (isNaN(date.getTime())){ avisar('Informe data e hora válidas'); return; }
    const processo = formatarProcesso(q.processo);
    if (!processo){ avisar('Informe o número do processo'); document.getElementById('qProcesso')?.focus(); return; }
    if (!q.tipo){ avisar('Escolha o tipo da audiência'); document.getElementById('qTipo')?.focus(); return; }
    const ok = await salvar(null, { processo, date, tipo: q.tipo.trim(), status: q.status, observacoes: q.obs.trim() });
    if (!ok) return;
    setQ(v => ({ ...v, processo: '', hora: '', tipo: '', obs: '', status: STATUS_PADRAO }));
    document.getElementById('qProcesso')?.focus();
  }

  function escolherPeriodo(p: Periodo){
    if (p === 'intervalo' && !f.de && !f.ate) mudar({ periodo: p, de: chaveDoDia(new Date()), ate: chaveDoDia(somaDias(new Date(), 30)) });
    else mudar({ periodo: p });
  }

  const r = resumo(itens, agora);
  const { lista, dias } = pauta(itens, f, agora);
  let vazio = '';
  if (!lista.length){
    if (!carregado) vazio = 'Carregando audiências…';
    else if (erro) vazio = /audiencias|42P01|PGRST205/.test((erro.code || '') + ' ' + (erro.message || ''))
      ? 'A tabela de audiências ainda não existe no Supabase. Rode o SQL da seção “Audiências” do LEIA-ME.md e recarregue a página.'
      : 'Erro ao carregar audiências: ' + erro.message;
    else if (!itens.length) vazio = 'Nenhuma audiência cadastrada ainda. Use o formulário acima para cadastrar a primeira.';
    else vazio = 'Nenhuma audiência neste filtro.';
  }

  function imprimirPauta(){
    if (!lista.length){ avisar('Nada para imprimir neste filtro.'); return; }
    imprimir('Pauta de audiências', textoDoFiltro(f), lista.length + (lista.length === 1 ? ' audiência' : ' audiências'), (
      <table className="pr-tab">
        <thead><tr><th style={{ width: '9%' }}>Hora</th><th style={{ width: '24%' }}>Processo</th><th style={{ width: '22%' }}>Tipo</th><th style={{ width: '17%' }}>Situação</th><th>Observações</th></tr></thead>
        <tbody>{dias.flatMap(d => [
          <tr className="pr-dia" key={'d' + d.chave}><td colSpan={5}>{dataDaImpressao(d.date)}</td></tr>,
          ...d.itens.map(a => (
            <tr key={a.id}>
              <td className="pr-hora">{hora(a.date)}</td><td className="pr-proc">{a.processo}</td><td>{a.tipo || '—'}</td>
              <td className="pr-st">{a.status}{a.conferidaEm && <div className="pr-sub">conferida em {diaMes(a.conferidaEm)}</div>}</td>
              <td className="pr-obs">{a.observacoes || ''}</td>
            </tr>
          ))
        ])}</tbody>
      </table>
    ));
  }

  const Stat = ({ periodo, n, rotulo, idN, idL }: { periodo: Periodo; n: number; rotulo: string; idN: string; idL?: string }) => (
    <button type="button" className="stat" data-period={periodo} aria-pressed={f.periodo === periodo} onClick={() => mudar({ periodo: f.periodo === periodo ? 'proximas' : periodo })}>
      <span className="stat-num" id={idN}>{n}</span><span className="stat-lbl" id={idL}>{rotulo}</span>
    </button>
  );

  return (
    <>
      <section id="view-audiencias" aria-labelledby="audTitle">
        <header>
          <div>
            <h1 id="audTitle">Audiências</h1>
            <div className="tagline">Pauta e acompanhamento por processo</div>
          </div>
          <div className="head-acts"><div className="count" id="audCount">{lista.length + (lista.length === 1 ? ' audiência' : ' audiências')}</div>
            <button type="button" className="btn print-btn" id="audPrint" title="Imprime a lista que está na tela, com os filtros aplicados" onClick={imprimirPauta}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir</button></div>
        </header>

        <form className="quick" id="quickForm" autoComplete="off" aria-labelledby="quickTitle" onSubmit={e => { e.preventDefault(); cadastrarRapido(); }}>
          <div className="quick-head">
            <h2 id="quickTitle">Cadastrar audiência</h2>
            <span className="quick-hint">Enter salva · a data fica para a próxima</span>
          </div>
          <div className="quick-grid">
            <div className="field q-proc">
              <label htmlFor="qProcesso">Nº do processo</label>
              <CampoProcesso id="qProcesso" className="mono" maxLength={40} placeholder="0000000-00.0000.0.00.0000" required value={q.processo} onChange={v => setQ(x => ({ ...x, processo: v }))} />
            </div>
            <div className="field q-data">
              <label htmlFor="qData">Data</label>
              <input id="qData" type="date" required value={q.data} onChange={e => setQ(x => ({ ...x, data: e.target.value }))} />
            </div>
            <div className="field q-hora">
              <label htmlFor="qHora">Hora</label>
              <input id="qHora" type="time" required value={q.hora} onChange={e => setQ(x => ({ ...x, hora: e.target.value }))} />
            </div>
            <div className="field q-status">
              <label htmlFor="qStatus">Status</label>
              <select id="qStatus" value={q.status} onChange={e => setQ(x => ({ ...x, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field q-tipo">
              <label htmlFor="qTipo">Tipo</label>
              <SelectTipo id="qTipo" required nomes={nomes} value={q.tipo} onChange={v => setQ(x => ({ ...x, tipo: v }))}
                novoTipo={() => setTiposAberto({ destino: nome => setQ(x => ({ ...x, tipo: nome })) })} />
            </div>
            <div className="field q-obs">
              <label htmlFor="qObs">Observações</label>
              <input id="qObs" maxLength={4000} placeholder="Ex.: intimar testemunhas; por videoconferência" value={q.obs} onChange={e => setQ(x => ({ ...x, obs: e.target.value }))} />
            </div>
            <button type="submit" className="btn primary q-save">Cadastrar</button>
          </div>
        </form>

        <div className="summary">
          <Stat periodo="hoje" n={r.hoje} rotulo="hoje" idN="statHoje" />
          <Stat periodo="semana" n={r.janela} rotulo={'próximos ' + JANELA_DIAS + ' dias'} idN="statSemana" />
          <Stat periodo="proxmes" n={r.proxMes} rotulo={'em ' + r.nomeProxMes} idN="statProxMes" idL="statProxMesLbl" />
        </div>

        <div className="searchbar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="audSearch" type="text" placeholder="Buscar por processo, tipo ou observação…" autoComplete="off" value={f.busca} onChange={e => mudar({ busca: e.target.value })} />
          <button className="clear-btn" id="audClearSearch" hidden={!f.busca} onClick={() => { mudar({ busca: '' }); document.getElementById('audSearch')?.focus(); }}>limpar</button>
        </div>

        <div className="filter-row" id="audPeriods" role="group" aria-label="Período">
          <span className="filter-label">Período</span>
          {PERIODOS.map(p => <Chip key={p.key} pressionado={f.periodo === p.key} onClick={() => escolherPeriodo(p.key)}>{p.label}</Chip>)}
        </div>
        <div className="range" id="audRange" hidden={f.periodo !== 'intervalo'}>
          <div className="field">
            <label htmlFor="rangeFrom">De</label>
            <input id="rangeFrom" type="date" value={f.de} onChange={e => mudar({ de: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="rangeTo">Até</label>
            <input id="rangeTo" type="date" value={f.ate} onChange={e => mudar({ ate: e.target.value })} />
          </div>
        </div>
        <div className="filter-row" id="audStatuses" role="group" aria-label="Status">
          <span className="filter-label">Status</span>
          {[TODOS, ...STATUSES].map(s => <Chip key={s} pressionado={f.status === s} onClick={() => mudar({ status: s })}>{s}</Chip>)}
        </div>
        <div className="filter-row" id="audTiposFiltro" role="group" aria-label="Tipo">
          <span className="filter-label">Tipo</span>
          {[TODOS, ...nomes].map(t => <Chip key={t} pressionado={f.tipo === t} onClick={() => mudar({ tipo: t })}>{t}</Chip>)}
          <button type="button" className="chip-manage" title="Cadastrar, renomear ou excluir tipos de audiência" onClick={() => setTiposAberto({ destino: null })}><IconeEngrenagem /> tipos</button>
        </div>
        <div className="filter-row" id="audConf" role="group" aria-label="Conferência">
          <span className="filter-label">Conferência</span>
          {CONF_FILTROS.map(c => <Chip key={c.key} pressionado={f.conf === c.key} onClick={() => mudar({ conf: c.key as Conf })}>{c.label}</Chip>)}
        </div>

        <div className="groups" id="audGroups">
          {dias.map(d => {
            const rot = rotuloDoDia(d.date, agora);
            return (
              <div className="day" key={d.chave}>
                <div className="day-label"><span className="d">{rot.texto}</span>{rot.rel && <span className="rel">{rot.rel}</span>}</div>
                <div className="cards">
                  {d.itens.map(a => <Cartao key={a.id} a={a} agora={agora} busca={f.busca} mudarStatus={s => mudarStatus(a, s)} conferir={() => conferir(a)} editar={() => setEditando(a)} />)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="empty" id="audEmpty" hidden={lista.length > 0}>{vazio}</div>
      </section>

      <DialogoAudiencia audiencia={editando} nomes={nomes} fechar={() => setEditando(null)} salvar={salvar} excluir={excluir}
        novoTipo={destino => setTiposAberto({ destino })} />
      <DialogoTipos aberto={!!tiposAberto} fechar={() => setTiposAberto(null)} tipos={tipos.lista} erro={tipos.erro ? erroDosTipos(tipos.erro) : null}
        usadas={nome => itens.filter(a => a.tipo === nome).length}
        recarregar={async () => { await carregarTipos(); }}
        renomeado={async (antigo, novo) => { if (f.tipo === antigo) mudar({ tipo: novo }); await carregarTipos(); await carregar(); }}
        excluido={async nome => { if (f.tipo === nome) mudar({ tipo: TODOS }); await carregarTipos(); }}
        escolhido={nome => { const d = tiposAberto?.destino; if (d){ d(nome); setTiposAberto(null); } }} />
      {area}
    </>
  );
}
