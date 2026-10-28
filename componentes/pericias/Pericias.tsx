'use client';
// Seção Perícias do sistema novo: cadastro (uma ou várias), resumo, abas, filtros, cartões com andamentos,
// edição, alteração em lote, peritos e impressão. Usa as tabelas pericias, pericias_andamentos e peritos,
// e o calendário de dias úteis da vara (o da seção Prazos) para o prazo de 30 dias úteis do laudo.
import { useCallback, useEffect, useState } from 'react';
import {
  CONCLUIDAS, PER_NOME, SITUACOES, aberta, aplicarStatus, andamentoAoSalvar, chaveNome, dataBr, dataLocal, deLinha, deMinutos, hora, inicioDoDia,
  diasUteisEntre, laudoAtrasado, listaDePeritos, marcada, nomesDePeritos, ordemDoLote, paraGravar, paraMinutos, peritoCadastrado, peritoDeLinha, prazoLaudo, agrupar, resumo,
  textoDoFiltro, type Aba, type Andamento, type Concluidas, type Filtros, type Pericia, type Perito, type Situacao, type Status
} from '@/lib/pericias';
import { formatarDataHora } from '@/lib/datas';
import { lerPeriodoDoHash } from '@/lib/proximos';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';
import { useImpressao } from '@/componentes/Impressao';
import { useCalendario } from '@/componentes/useCalendario';
import { BarraLote, type Lote } from './BarraLote';
import { Cadastro, type Gravar } from './Cadastro';
import { Cartao, type AcoesCartao } from './Cartao';
import { DialogoPericia, type Edicao } from './DialogoPericia';
import { Peritos } from './Peritos';

type Erro = { message?: string; code?: string } | null;
const diaDoFiltro = (k?: string) => (k ? k.slice(8, 10) + '/' + k.slice(5, 7) : '');

export function Pericias(){
  // A tela depende do relógio e do navegador: só aparece depois de carregar no navegador
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto ? <Corpo /> : null;
}

function Corpo(){
  const avisar = useAviso();
  const { imprimir, area } = useImpressao();
  const { cal } = useCalendario();
  const util = useCallback((d: Date) => cal.util(d), [cal]);
  const [itens, setItens] = useState<Pericia[]>([]);
  const [peritos, setPeritos] = useState<Perito[]>([]);
  const [peritosErro, setPeritosErro] = useState(false);
  const [andamentos, setAndamentos] = useState<Record<string, Andamento[]>>({});
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<Erro>(null);
  const [f, setF] = useState<Filtros>({ aba: 'andamento', situacao: 'andamento', concl: 'todas', perito: '', busca: '' });
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [sugestao, setSugestao] = useState(0);
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [agora, setAgora] = useState(() => new Date());
  const mudar = (x: Partial<Filtros>) => setF(v => ({ ...v, ...x }));
  // vindo do card "Próximos 7 dias" (/novo/pericias#2026-11-02): mostra só as perícias daquele dia (ou dos 7 dias)
  useEffect(() => {
    const aplicar = () => {
      const p = lerPeriodoDoHash(location.hash);
      if (!p) return;
      setF(v => ({ ...v, aba: 'andamento', situacao: 'andamento', perito: '', busca: '', de: p.de, ate: p.ate }));
      setSel({});
    };
    aplicar();
    window.addEventListener('hashchange', aplicar);
    return () => window.removeEventListener('hashchange', aplicar);
  }, []);

  const carregar = useCallback(async () => {
    const res = await supabase().from('pericias').select('*').order('created_at', { ascending: true });
    setCarregado(true);
    if (res.error){ setErro(res.error); return; }
    setErro(null);
    const lista = (res.data || []).map(deLinha);
    const pt = await supabase().from('peritos').select('*').order('nome', { ascending: true });
    setPeritosErro(!!pt.error);
    const an = await supabase().from('pericias_andamentos').select('*').order('created_at', { ascending: false });
    const porPericia: Record<string, Andamento[]> = {};
    (an.data || []).forEach(a => { (porPericia[a.pericia_id] ||= []).push({ id: String(a.id), texto: a.texto || '', em: new Date(a.created_at) }); });
    Object.values(porPericia).forEach(xs => xs.sort((x, y) => y.em.getTime() - x.em.getTime()));
    setItens(lista);
    setPeritos((pt.data || []).map(peritoDeLinha));
    setAndamentos(porPericia);
    setSel(s => Object.fromEntries(Object.entries(s).filter(([id]) => lista.some(p => p.id === id))));
    setAgora(new Date());
  }, []);
  useEffect(() => {
    carregar();
    const canal = supabase().channel('pericias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pericias' }, () => { carregar(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pericias_andamentos' }, () => { carregar(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'peritos' }, () => { carregar(); })
      .subscribe();
    const t = setInterval(() => setAgora(new Date()), 60000);
    return () => { supabase().removeChannel(canal); clearInterval(t); };
  }, [carregar]);

  // Quando a barra de lote aparece, a página ganha espaço embaixo para ela
  const selecionadas = itens.filter(p => sel[p.id]);
  useEffect(() => {
    const main = document.querySelector('.main');
    main?.classList.toggle('has-batch', selecionadas.length > 0);
    return () => main?.classList.remove('has-batch');
  }, [selecionadas.length]);

  // ---- gravação ----
  async function registrarAndamento(id: string, texto: string){
    if (!texto) return;
    const res = await supabase().from('pericias_andamentos').insert({ pericia_id: id, texto });
    if (res.error) avisar('Não foi possível registrar o andamento: ' + res.error.message);
  }
  const gravar: Gravar = async (p, antes, semRecarregar) => {
    const res = p.id
      ? await supabase().from('pericias').update(paraGravar(p as Pericia)).eq('id', p.id).select('id')
      : await supabase().from('pericias').insert(paraGravar(p as Pericia)).select('id');
    if (res.error){
      avisar(/autor/.test(res.error.message || '')
        ? 'Falta a coluna "autor" no Supabase. Rode o SQL do LEIA-ME.md (Passo 2.4) e tente de novo.'
        : 'Não foi possível salvar: ' + res.error.message);
      return false;
    }
    const id = p.id || (res.data && res.data[0] && String(res.data[0].id));
    if (id){
      const t = andamentoAoSalvar(p as Pericia, antes, !p.id, util);
      if (t) await registrarAndamento(id, t);
    }
    if (!semRecarregar) await carregar();
    return true;
  };
  async function salvarPerito(x: { id?: string | null; nome: string; especialidade?: string; telefone?: string; email?: string; observacoes?: string }){
    const payload = { nome: x.nome, especialidade: x.especialidade || '', telefone: x.telefone || '', email: x.email || '', observacoes: x.observacoes || '', updated_at: new Date().toISOString() };
    const res = x.id ? await supabase().from('peritos').update(payload).eq('id', x.id) : await supabase().from('peritos').insert(payload);
    if (res.error){
      const m = (res.error.message || '') + (res.error.code || '');
      avisar(/duplicate|peritos_nome_idx|23505/.test(m) ? 'Já existe um perito com esse nome.'
        : /peritos|42P01|PGRST205/.test(m) ? 'Falta a tabela de peritos no Supabase. Rode o SQL do LEIA-ME.md (Passo 2.4).'
        : 'Não foi possível salvar o perito: ' + (res.error.message || ''));
      return false;
    }
    return true;
  }

  // ---- ações dos cartões ----
  const acoes: AcoesCartao = {
    async mudarSituacao(p, st){
      const antes = { ...p }, novo = aplicarStatus(p, st, new Date());
      if (marcada(novo.status) && !novo.data){ avisar('Informe a data da perícia'); setEdicao({ base: novo, antes }); return; }
      if (await gravar(novo, antes)) avisar(novo.status === 'realizada' ? 'Realizada. Laudo até ' + dataBr(prazoLaudo(novo, util)!)
        : !aberta(novo) ? 'Perícia ' + (novo.status === 'cancelada' ? 'cancelada' : 'concluída') + ' e movida para Concluídas' : 'Situação: ' + PER_NOME[novo.status]);
    },
    async conferir(p){
      const novo = { ...p, conferidaEm: p.conferidaEm ? null : new Date() };
      if (await gravar(novo, null)) avisar(novo.conferidaEm ? 'Conferida em ' + formatarDataHora(novo.conferidaEm) : 'Conferência desmarcada');
    },
    editar(p){ setEdicao({ base: { ...p }, antes: { ...p } }); },
    async concluir(p){
      const fim: Pericia = { ...p, status: 'laudo_juntado', laudoEm: inicioDoDia(new Date()) };
      if (!fim.realizadaEm) fim.realizadaEm = fim.data && inicioDoDia(fim.data) <= fim.laudoEm! ? inicioDoDia(fim.data) : null;
      if (await gravar(fim, { ...p })) avisar('Perícia concluída e movida para Concluídas');
    },
    async registrar(p, texto){ await registrarAndamento(p.id, texto); avisar('Andamento registrado'); await carregar(); },
    async atalho(p, texto){ await registrarAndamento(p.id, texto); avisar('Andamento registrado'); await carregar(); },
    async apagarAndamento(id){
      const res = await supabase().from('pericias_andamentos').delete().eq('id', id);
      if (res.error) avisar('Não foi possível apagar: ' + res.error.message); else { avisar('Andamento apagado'); await carregar(); }
    },
    selecionar(p, sim){
      setSel(s => { const n = { ...s }; if (sim) n[p.id] = true; else delete n[p.id]; return n; });
      if (sim) setSugestao(x => Math.abs(x) + 1);
    }
  };

  // ---- alteração em lote ----
  async function aplicarLote(l: Lote): Promise<boolean> {
    const lista = ordemDoLote(selecionadas);
    if (!lista.length) return false;
    const horaSeq = paraMinutos(l.hora || '08:00'), passoSeq = Math.max(0, parseInt(l.intervalo, 10) || 0);
    const st = l.st as Status | '', texto = l.andamento.trim();
    const data = l.data ? dataLocal(l.data) : null;
    if ((st === 'realizada' || st === 'laudo_juntado' || st === 'agendada') && !data){ avisar('Informe a data'); document.getElementById('perBatchData')?.focus(); return false; }
    if (!st && !texto){ avisar('Escreva o andamento a registrar'); document.getElementById('perBatchAnd')?.focus(); return false; }
    let ok = 0, semData = 0;
    for (let i = 0; i < lista.length; i++){
      const p = lista[i], antes = { ...p };
      let novo: Pericia = { ...p }, salvou = true;
      if ((st === 'intimacoes_feitas' || st === 'pronta') && !p.data){ semData++; continue; }
      if (st){
        if (st === 'realizada') novo = { ...novo, status: 'realizada', realizadaEm: data, laudoEm: null };
        else if (st === 'laudo_juntado') novo = { ...novo, status: 'laudo_juntado', laudoEm: data };
        else if (st === 'agendada') novo = { ...novo, status: 'agendada', data: new Date(l.data + 'T' + deMinutos(horaSeq + i * passoSeq)), realizadaEm: null, laudoEm: null };
        else novo = aplicarStatus(novo, st, new Date());
        salvou = await gravar(novo, antes, true);
      }
      if (salvou && texto) await registrarAndamento(p.id, texto);
      if (salvou) ok++;
    }
    setSel({});
    await carregar();
    const quando = data ? ' em ' + dataBr(data) : '';
    avisar(ok + (ok === 1 ? ' perícia alterada' : ' perícias alteradas') + (st ? ': ' + PER_NOME[st] + (marcada(st) ? '' : quando) : ' (andamento registrado)') +
      (semData ? ' · ' + semData + (semData === 1 ? ' sem data ficou de fora' : ' sem data ficaram de fora') + ' (agende primeiro)' : ''));
    return true;
  }

  // ---- tela ----
  const nomes = nomesDePeritos(peritos, itens);
  const naAbaPeritos = f.aba === 'peritos';
  const { total, grupos } = agrupar(itens, f, agora, util);
  const r = resumo(itens, agora, util);
  const nAnd = itens.filter(aberta).length, nConc = itens.length - nAnd;
  let vazio = '';
  if (!naAbaPeritos && !total){
    if (!carregado) vazio = 'Carregando perícias…';
    else if (erro) vazio = /pericias|42P01|PGRST205/.test((erro.code || '') + ' ' + (erro.message || ''))
      ? 'A tabela de perícias ainda não existe no Supabase. Rode o arquivo sql/pericias.sql (veja o LEIA-ME.md) e recarregue a página.'
      : 'Erro ao carregar perícias: ' + erro.message;
    else if (!itens.length) vazio = 'Nenhuma perícia cadastrada ainda. Use o formulário acima para cadastrar a primeira.';
    else if (f.aba === 'concluidas') vazio = 'Nenhuma perícia concluída ainda. Ao juntar o laudo, a perícia vem para cá.';
    else vazio = 'Nenhuma perícia nesta situação.';
  }

  function imprimirLista(){
    if (naAbaPeritos){ avisar('Abra "Em andamento" ou "Concluídas" para imprimir a lista de perícias.'); return; }
    if (!total){ avisar('Nada para imprimir neste filtro.'); return; }
    const nomePerito = nomes.find(n => chaveNome(n) === f.perito) || '';
    imprimir('Perícias', textoDoFiltro(f, nomePerito), total + (total === 1 ? ' perícia' : ' perícias'), (
      <table className="pr-tab">
        <thead><tr><th style={{ width: '13%' }}>Data e hora</th><th style={{ width: '27%' }}>Autor e processo</th><th style={{ width: '24%' }}>Perito</th><th style={{ width: '15%' }}>Situação</th><th>Laudo</th></tr></thead>
        <tbody>{grupos.flatMap((g, gi) => [
          <tr className="pr-dia" key={'g' + gi}><td colSpan={5}>{g.titulo}{g.rel && <> <span className="pr-rel">({g.rel})</span></>}</td></tr>,
          ...g.itens.map(p => {
            const pr = prazoLaudo(p, util);
            const laudo = p.status === 'realizada' && pr ? <>até {dataBr(pr)}{laudoAtrasado(p, agora, util) && (() => { const da = diasUteisEntre(pr, agora, util); return <> <b>({da} {da === 1 ? 'dia útil' : 'dias úteis'} de atraso)</b></>; })()}</>
              : p.status === 'laudo_juntado' && p.laudoEm ? 'juntado em ' + dataBr(p.laudoEm) : '—';
            return (
              <tr key={p.id}>
                <td className="pr-hora">{p.data ? <>{dataBr(p.data)}<div className="pr-sub">{hora(p.data)}</div></> : '—'}</td>
                <td><b>{p.autor || 'Autor não informado'}</b><div className="pr-proc">{p.processo}</div></td>
                <td>{p.perito || '—'}{p.especialidade && <> <span className="pr-sub">({p.especialidade})</span></>}</td>
                <td className="pr-st">{PER_NOME[p.status] || ''}{p.realizadaEm && <div className="pr-sub">realizada em {dataBr(p.realizadaEm)}</div>}</td>
                <td>{laudo}</td>
              </tr>
            );
          })
        ])}</tbody>
      </table>
    ));
  }

  const resumoCards: [Situacao, number, string, string][] = [
    ['agendada', r.proximas, 'agendadas nos próximos 15 dias', ''],
    ['nao_agendada', r.naoAgendadas, 'aguardando data do perito', r.naoAgendadas ? 'warn' : ''],
    ['realizada', r.aguardando, 'aguardando laudo', ''],
    ['atrasado', r.atrasados, 'laudos atrasados', r.atrasados ? 'danger' : '']
  ];
  const nPeritos = naAbaPeritos ? listaDePeritos(peritos, nomes, f.busca).length : 0;

  return (
    <>
      <section id="view-pericias" aria-labelledby="perTitle">
        <header>
          <div>
            <h1 id="perTitle">Perícias</h1>
            <div className="tagline">Da nomeação do perito ao laudo juntado · prazo de 30 dias úteis após a realização</div>
          </div>
          <div className="head-acts"><div className="count" id="perCount">{naAbaPeritos ? nPeritos + (nPeritos === 1 ? ' perito' : ' peritos') : total + (total === 1 ? ' perícia' : ' perícias')}</div>
            <button type="button" className="btn print-btn" id="perPrint" title="Imprime a lista que está na tela, com os filtros aplicados" onClick={imprimirLista}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir</button></div>
        </header>

        <Cadastro itens={itens} peritos={peritos} nomes={nomes} gravar={gravar} recarregar={carregar}
          salvarPerito={x => salvarPerito({ nome: x.nome, especialidade: x.especialidade })} />

        <div className="summary per-summary" id="perSummary">
          {resumoCards.map(([sit, n, rotulo, cls]) => (
            <button key={sit} type="button" className={'stat ' + cls + (n === 0 ? ' zero' : '')} data-sit={sit} aria-pressed={f.situacao === sit}
              onClick={() => mudar({ aba: 'andamento', situacao: f.situacao === sit ? 'andamento' : sit })}>
              <span className="stat-num">{n}</span><span className="stat-lbl">{rotulo}</span>
            </button>
          ))}
        </div>

        <div className="per-abas" id="perAbas" role="tablist" aria-label="Perícias em andamento ou concluídas">
          {([['andamento', 'Em andamento', 'perAbaAnd', nAnd], ['concluidas', 'Concluídas', 'perAbaConc', nConc], ['peritos', 'Peritos', 'perAbaPeritos', peritos.length]] as [Aba, string, string, number][]).map(([a, nome, id, n]) => (
            <button key={a} type="button" className="per-aba" role="tab" data-aba={a} aria-selected={f.aba === a} onClick={() => { mudar({ aba: a }); setSel({}); }}>
              {nome} <span className="n" id={id}>{n || ''}</span>
            </button>
          ))}
        </div>

        <div className="searchbar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="perSearch" type="text" autoComplete="off" value={f.busca} onChange={e => mudar({ busca: e.target.value })}
            placeholder={naAbaPeritos ? 'Buscar perito por nome, especialidade ou contato…' : 'Buscar por autor, processo, perito ou observação…'} />
          <button className="clear-btn" id="perClearSearch" hidden={!f.busca} onClick={() => { mudar({ busca: '' }); document.getElementById('perSearch')?.focus(); }}>limpar</button>
        </div>
        <div className="filter-row" id="perDiaRow" hidden={naAbaPeritos || !(f.de || f.ate)}>
          <span className="filter-label">Data</span>
          <span id="perDiaTxt">{diaDoFiltro(f.de)}{f.ate && f.ate !== f.de ? ' a ' + diaDoFiltro(f.ate) : ''}</span>
          <button type="button" className="chip" id="perDiaLimpar" onClick={() => mudar({ de: '', ate: '' })}>Limpar data</button>
        </div>
        <div className="filter-row" id="perSituacao" role="group" aria-label="Situação" hidden={naAbaPeritos}>
          <span className="filter-label">Situação</span>
          {f.aba === 'concluidas'
            ? CONCLUIDAS.map(([k, n]) => <button key={k} type="button" className="chip" aria-pressed={f.concl === k} onClick={() => mudar({ concl: k as Concluidas })}>{n}</button>)
            : SITUACOES.map(([k, n]) => <button key={k} type="button" className="chip" aria-pressed={f.situacao === k} onClick={() => mudar({ situacao: k })}>{n}</button>)}
        </div>
        <div className="filter-row" id="perFiltroPeritoRow" hidden={naAbaPeritos}>
          <span className="filter-label">Perito</span>
          <select className="per-select" id="perFiltroPerito" aria-label="Filtrar por perito" value={f.perito} onChange={e => mudar({ perito: e.target.value })}>
            <option value="">Todos os peritos</option>
            {nomes.map(n => <option key={n} value={chaveNome(n)}>{n}</option>)}
          </select>
        </div>

        <div className="groups" id="perGroups">
          {!naAbaPeritos && grupos.map((g, gi) => {
            const todos = g.itens.every(p => sel[p.id]);
            return (
              <div className="day" key={g.titulo + gi}>
                <div className="day-label"><span className="d">{g.titulo}</span>{g.rel && <span className="rel">{g.rel}</span>}
                  <button type="button" className="day-sel" data-pgrp={gi} onClick={() => {
                    setSel(s => { const n = { ...s }; g.itens.forEach(p => { if (todos) delete n[p.id]; else n[p.id] = true; }); return n; });
                    setSugestao(x => -(Math.abs(x) + 1));
                  }}>{(todos ? 'Desmarcar ' : 'Selecionar ') + (g.itens.length === 1 ? 'esta' : 'as ' + g.itens.length)}</button></div>
                <div className="cards">
                  {g.itens.map(p => <Cartao key={p.id} p={p} agora={agora} util={util} perito={peritoCadastrado(peritos, p.perito)} andamentos={andamentos[p.id] || []}
                    aberto={!!abertos[p.id]} alternar={() => setAbertos(a => ({ ...a, [p.id]: !a[p.id] }))} selecionada={!!sel[p.id]} acoes={acoes} />)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="empty" id="perEmpty" hidden={naAbaPeritos || total > 0}>{vazio}</div>

        {naAbaPeritos && <Peritos peritos={peritos} itens={itens} nomes={nomes} erro={peritosErro} busca={f.busca} agora={agora} util={util}
          salvar={async (x, nomeAntigo) => {
            if (!(await salvarPerito(x))) return false;
            // renomeou: as perícias desse perito passam a usar o nome novo
            if (x.id && nomeAntigo && chaveNome(nomeAntigo) !== chaveNome(x.nome)){
              for (const p of itens.filter(p => chaveNome(p.perito) === chaveNome(nomeAntigo)))
                await supabase().from('pericias').update({ perito: x.nome, updated_at: new Date().toISOString() }).eq('id', p.id);
            }
            return true;
          }}
          excluir={async id => {
            const res = await supabase().from('peritos').delete().eq('id', id);
            if (res.error){ avisar('Não foi possível excluir: ' + res.error.message); return false; }
            avisar('Perito excluído do cadastro');
            await carregar();
            return true;
          }}
          verPericias={nome => {
            setF({ aba: 'andamento', situacao: 'andamento', concl: 'todas', perito: chaveNome(nome), busca: '' });
            setTimeout(() => document.getElementById('perGroups')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0);
          }}
          recarregar={carregar} />}
        {!naAbaPeritos && <div id="perPeritosView" hidden />}

        <BarraLote sel={selecionadas} aplicar={aplicarLote} limpar={() => setSel({})} sugestao={sugestao} />
      </section>

      <DialogoPericia edicao={edicao} itens={itens} nomes={nomes} peritos={peritos} util={util} fechar={() => setEdicao(null)}
        salvar={(p, antes) => gravar(p, antes)}
        excluir={async id => {
          const res = await supabase().from('pericias').delete().eq('id', id);
          if (res.error){ avisar('Não foi possível excluir: ' + res.error.message); return; }
          setEdicao(null);
          avisar('Perícia excluída');
          await carregar();
        }} />
      {area}
    </>
  );
}

