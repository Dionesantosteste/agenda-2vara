'use client';
// Quadro da Organização: filtros, colunas e cartões das tarefas. Mover entre colunas (← →) e na coluna (↑ ↓),
// adicionar tarefa direto na coluna, renomear coluna (dois cliques), abrir a tarefa e concluir tarefa do gestor.
// Ainda no sistema atual: arrastar, calendário, histórico e arquivo, etiquetas/colunas/modelos, estrelas e bichinhos.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import {
  CHIPS_PRAZO, FEITO_VISIVEIS, LIMITE_FAZENDO, SEM_FILTRO, aberta, agendada, arquivada, corDaEtiqueta, diaMes, diasParado, emConferencia, filtroAtivo,
  novaOrdem, ordenaColuna, paraSalvar, passaNoFiltro, podeOrdenar, prioNome, responsaveisDoFiltro, separaProcesso, seloPrazo, travada,
  pedeFechamento, type Dados, type FiltroQuadro, type Tarefa, type Util
} from '@/lib/organizacao';
import { corPorId } from '@/lib/aparencia';
import { formatarDataHora } from '@/lib/datas';
import { useAviso } from '@/componentes/Avisos';
import { CopiarProcesso } from '@/componentes/pericias/Cartao';
import { DialogoFechamento } from './DialogoFechamento';
import { useDuplicado } from './DialogoDuplicado';
import { DialogoTarefa } from './DialogoTarefa';
import type { Banco } from './Organizacao';

const Lapis = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
const Xis = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconeCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="8 12 11 15 16 9"/></svg>;
const IconeNota = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;

// Cor que cada pessoa escolheu para as colunas (guardada no navegador pela Aparência do sistema atual)
function coresDasColunas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('aparColunas') || '{}') || {}; } catch { return {}; }
}

type Props = {
  dados: Dados; setDados: Dispatch<SetStateAction<Dados | null>>; pessoa: boolean; alheia: boolean; eu?: string | null;
  hoje: Date; util: Util; banco: Banco;
};

export function Quadro({ dados, setDados, pessoa, alheia, eu = null, hoje, util, banco }: Props){
  const avisar = useAviso();
  const [f, setF] = useState<FiltroQuadro>(SEM_FILTRO);
  const [kadd, setKadd] = useState<{ chave: string; txt: string } | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [fechId, setFechId] = useState<string | null>(null);
  const [renomear, setRenomear] = useState<string | null>(null);
  const cores = useMemo(coresDasColunas, []);
  const { confere, janela } = useDuplicado(banco, dados, pessoa, eu);

  const chaves = dados.colunas.map(c => c.chave);
  const nomeColuna = (k: string) => dados.colunas.find(c => c.chave === k)?.nome || k;
  const fe = { ...f, q: f.q.trim() };   // a busca ignora espaços nas pontas
  const ativo = filtroAtivo(fe);
  const etqAtiva = dados.etiquetas.some(e => e.id === f.etq) ? f.etq : '';
  const mudar = (x: Partial<FiltroQuadro>) => setF(v => ({ ...v, ...x }));
  const achar = (id: string | null) => dados.tarefas.find(t => t.id === id) || null;
  const mudarTarefa = (id: string, patch: Partial<Tarefa>) => setDados(d => d && { ...d, tarefas: d.tarefas.map(x => (x.id === id ? { ...x, ...patch } : x)) });

  // Muda a etapa já na tela e depois confirma no banco
  async function mover(t: Tarefa, etapa: string){
    if (t.etapa === etapa || !chaves.includes(etapa)) return;
    if (travada(t, pessoa)){ avisar('Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.'); return; }
    if (etapa === 'feito' && pedeFechamento(t, pessoa)){ setFechId(t.id); return; }
    const feitaEm = etapa === 'feito' ? (t.feitaEm || new Date()) : null;
    mudarTarefa(t.id, { etapa, feitaEm, atualizada: new Date(), posicao: null });
    const r = await banco.chamar('org_salvar_tarefa', paraSalvar({ ...t, etapa, feitaEm }));
    if (!banco.ok(r)){ await banco.recarregar(); return; }
    const fazendo = dados.tarefas.filter(x => x.etapa === 'fazendo').length + (etapa === 'fazendo' ? 1 : 0);
    if (etapa === 'feito') avisar('Feita em ' + formatarDataHora(feitaEm!));
    else if (etapa === 'fazendo' && fazendo > LIMITE_FAZENDO) avisar(nomeColuna('fazendo') + ' passou do limite de ' + LIMITE_FAZENDO + ' tarefas');
    await banco.recarregar();
  }

  // Muda a posição do cartão dentro da mesma coluna
  async function reordenar(t: Tarefa, antesDe: string | null){
    if (!podeOrdenar(dados.temOrdem, t.etapa)) return;
    const antes = ordenaColuna(dados.tarefas.filter(x => x.etapa === t.etapa), t.etapa).map(x => x.id).join();
    const ids = novaOrdem(dados.tarefas, t, antesDe);
    if (ids.join() === antes) return;
    setDados(d => d && { ...d, tarefas: d.tarefas.map(x => { const k = ids.indexOf(x.id); return k === -1 ? x : { ...x, posicao: (k + 1) * 10 }; }) });
    const r = await banco.chamar('org_ordenar_tarefas', { p_ids: ids });
    if (!banco.ok(r)){ await banco.recarregar(); return; }
    await banco.recarregar();
  }

  // Botões ↑ ↓: troca de lugar com o cartão vizinho que está à vista
  async function subirDescer(t: Tarefa, dir: -1 | 1){
    const todos = ordenaColuna(dados.tarefas.filter(x => x.etapa === t.etapa && !arquivada(x)), t.etapa);
    const vis = ativo ? todos.filter(x => passaNoFiltro(x, fe, hoje)) : todos;
    const viz = vis[vis.indexOf(t) + dir];
    if (!viz) return;
    let antesDe: string | null;
    if (dir < 0) antesDe = viz.id;
    else { const semT = todos.filter(x => x.id !== t.id), j = semT.findIndex(x => x.id === viz.id); antesDe = semT[j + 1] ? semT[j + 1].id : null; }
    await reordenar(t, antesDe);
    setTimeout(() => (document.querySelector('.kcard[data-id="' + t.id + '"] [data-act=' + (dir < 0 ? 'subir' : 'descer') + ']:not([disabled])') as HTMLElement | null)?.focus(), 0);
  }

  async function criar(etapa: string, texto: string, input: HTMLInputElement | null){
    const sp = separaProcesso(texto);
    const titulo = texto.trim() ? sp.titulo : '';
    if (!titulo){ input?.focus(); return; }
    if (sp.processo && !(await confere(sp.processo))){ input?.focus(); return; }
    const r = await banco.chamar('org_salvar_tarefa', paraSalvar({ titulo, prazo: null, prioridade: 'normal', responsavel: '', processo: sp.processo, feitaEm: null, etapa }));
    if (!banco.ok(r)) return;
    avisar('Tarefa adicionada em ' + nomeColuna(etapa));
    setKadd({ chave: etapa, txt: '' });
    await banco.recarregar();
  }

  async function renomearColuna(chave: string, valor: string, salvar: boolean){
    setRenomear(null);
    const novo = valor.trim().replace(/\s+/g, ' ');
    if (!salvar || !novo || novo === nomeColuna(chave)) return;
    const r = await banco.chamar('org_salvar_coluna', { p_chave: chave, p_nome: novo });
    if (!banco.ok(r)) return;
    avisar('Coluna renomeada');
    await banco.recarregar();
  }

  const ultima = dados.colunas.length - 1;
  return (
    <div id="orgPaneQuadro" className="org-pane">
      <div className="kfilters" id="orgKFiltros">
        <input className="org-in kbusca" id="orgKBusca" type="search" maxLength={80} placeholder="Filtrar por título ou nº do processo…" aria-label="Filtrar tarefas do quadro"
          value={f.q} onChange={e => mudar({ q: e.target.value })} />
        <select className="org-in so-proprio" id="orgKResp" aria-label="Filtrar por responsável" value={f.resp} onChange={e => mudar({ resp: e.target.value })}>
          <option value="">Todos os responsáveis</option>
          {responsaveisDoFiltro(dados.tarefas).map(r => <option key={r}>{r}</option>)}
          <option value="-">Sem responsável</option>
        </select>
        <select className="org-in" id="orgKEtq" aria-label="Filtrar por etiqueta" hidden={!dados.etiquetas.length} value={etqAtiva} onChange={e => mudar({ etq: e.target.value })}>
          <option value="">Todas as etiquetas</option>
          {dados.etiquetas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <div className="kchips" id="orgKChips" role="group" aria-label="Filtrar por prazo">
          {CHIPS_PRAZO.map(c => <button key={c[0]} type="button" className="chip" data-kprazo={c[0]} aria-pressed={f.prazo === c[0]} onClick={() => mudar({ prazo: f.prazo === c[0] ? '' : c[0] })}>{c[1]}</button>)}
        </div>
        <button type="button" className="clear-btn" id="orgKLimpar" hidden={!ativo} onClick={() => setF(SEM_FILTRO)}>Limpar filtros</button>
      </div>
      <div className="kanban" id="orgKanban">
        {dados.colunas.map((c, ci) => {
          const todas = dados.tarefas.filter(t => t.etapa === c.chave && !arquivada(t));
          const vis = ativo ? todas.filter(t => passaNoFiltro(t, fe, hoje)) : todas;
          let itens = ordenaColuna(vis, c.chave);
          const ordena = podeOrdenar(dados.temOrdem, c.chave);
          let ocultas = 0;
          if (c.chave === 'feito' && itens.length > FEITO_VISIVEIS){ ocultas = itens.length - FEITO_VISIVEIS; itens = itens.slice(0, FEITO_VISIVEIS); }
          const passou = c.chave === 'fazendo' && todas.length > LIMITE_FAZENDO;
          const n = ativo ? vis.length + ' de ' + todas.length : (c.chave === 'fazendo' ? todas.length + ' / ' + LIMITE_FAZENDO : String(todas.length));
          const renomeia = dados.temCadastro && c.chave !== 'afazer' && c.chave !== 'feito';
          const cor = corPorId(cores[c.chave]);
          const estiloCor = cor ? { '--cor-c': cor.col[0], '--cor-e': cor.col[1], '--cor-v': cor.col[2] } as CSSProperties : undefined;
          return (
            <section key={c.chave} className={'col' + (passou ? ' over' : '') + (cor ? ' tingida' : '')} data-etapa={c.chave} aria-label={c.nome}
              {...(cor ? { 'data-cor': '' } : {})} style={estiloCor}>
              <h3>
                {renomear === c.chave
                  ? <input className="col-nome-in" maxLength={40} defaultValue={c.nome} aria-label="Novo nome da coluna" autoFocus onFocus={e => e.target.select()}
                      onKeyDown={e => { if (e.key === 'Enter'){ e.preventDefault(); renomearColuna(c.chave, e.currentTarget.value, true); } if (e.key === 'Escape'){ e.preventDefault(); renomearColuna(c.chave, '', false); } }}
                      onBlur={e => renomearColuna(c.chave, e.target.value, true)} />
                  : <span className="col-nome" title={renomeia ? 'Clique duas vezes para renomear' : undefined}
                      {...(renomeia ? { 'data-coluna': c.chave, onDoubleClick: () => setRenomear(c.chave) } : {})}>{c.nome}</span>}
                {' '}<span title={c.chave === 'fazendo' ? 'Limite de ' + LIMITE_FAZENDO + ' tarefas em andamento' : undefined}>{n}</span>
              </h3>
              {passou && <div className="wip-aviso">Mais de {LIMITE_FAZENDO} tarefas em andamento. Vale terminar algumas antes de puxar novas.</div>}
              {!itens.length && kadd?.chave !== c.chave && <div className="org-empty">{ativo && todas.length ? 'Nenhuma com este filtro.' : 'Nada aqui.'}</div>}
              {itens.map((t, ii) => {
                const abre = aberta(t), selo = seloPrazo(t, hoje, util), parado = diasParado(t, hoje);
                const atrasada = !!selo && selo.cls === 'late', trava = travada(t, pessoa);
                const etqs = dados.etiquetas.filter(e => t.etiquetas.includes(e.id));
                const feitos = t.checklist.filter(i => i.ok).length, notas = dados.anotacoes.filter(a => a.tarefa === t.id).length;
                const doEquipe = !!t.enviadaPor && !pessoa && !alheia;
                const quem = dados.pessoas.find(p => p.id === t.enviadaPor)?.nome;
                return (
                  <div key={t.id} className={'kcard' + (atrasada ? ' overdue' : '') + (t.urgente && abre ? ' urgent' : '') + (parado ? ' stale' : '') + (emConferencia(t) ? ' em-conf' : '')}
                    data-id={t.id} onClick={e => { if (!(e.target as HTMLElement).closest('button, a, input, [data-act]')) setAbertoId(t.id); }}>
                    <div className="khead">
                      <div className="kmain">
                        {etqs.length > 0 && <div className="klabels">{etqs.map(e => <span key={e.id} className="klabel" style={{ '--lc': corDaEtiqueta(e.cor) } as CSSProperties}>{e.nome}</span>)}</div>}
                        <div className="t-title"><button type="button" className="ktitle" data-act="abrir-card" title="Abrir a tarefa" onClick={() => setAbertoId(t.id)}>{t.titulo}</button></div>
                      </div>
                      <span className="kacts">
                        <button type="button" className="icon-btn" data-act="abrir-card" title="Editar prazo, prioridade, responsável…" aria-label="Editar tarefa" onClick={() => setAbertoId(t.id)}><Lapis /></button>
                      </span>
                    </div>
                    <div className="t-meta">
                      {emConferencia(t) ? <span className="tag conf">Em conferência</span>
                        : t.conferencia === 'devolvida' && abre ? <span className="tag devolv">Devolvida</span>
                        : t.conferencia === 'aprovada' ? <span className="tag conferida">Conferida ✓</span> : null}
                      {selo && <span className={'kprazo' + (selo.cls ? ' ' + selo.cls : '')}>{selo.txt}</span>}
                      {abre && t.prioridade !== 'normal' && <span className={'tag ' + (t.prioridade === 'urgente' ? 'urg' : t.prioridade)}>{prioNome(t.prioridade)}</span>}
                      {agendada(t, hoje) && !pessoa && <span className="tag agend" title="A pessoa ainda não vê esta tarefa">Aparece em {diaMes(t.apareceEm!)}</span>}
                      {t.doGestor && pessoa && <span className="tag gestor">Do gestor</span>}
                      {doEquipe && <span className="tag da-equipe" title={t.recadoGestor ? 'Recado: ' + t.recadoGestor : 'Mandada por alguém da equipe'}>De {quem ? quem.split(' ')[0] : 'alguém da equipe'}</span>}
                      {t.responsavel && !alheia && <span className="tag resp">{t.responsavel}</span>}
                      {t.processo && <CopiarProcesso proc={t.processo} />}
                      {t.checklist.length > 0 && <span className={'kcheck' + (feitos === t.checklist.length ? ' ok' : '')} title={'Checklist: ' + feitos + ' de ' + t.checklist.length + ' feitos'}><IconeCheck />{feitos}/{t.checklist.length}</span>}
                      {notas > 0 && <span className="knotas" title={notas + (notas === 1 ? ' anotação' : ' anotações')}><IconeNota />{notas}</span>}
                      {doEquipe && t.recadoGestor && abre && <span className="krecado" title={t.recadoGestor}>“{t.recadoGestor}”</span>}
                      {parado > 0 && <span className="kparado" title={'Sem mudança desde ' + formatarDataHora(t.atualizada!)}>Parada há {parado} dias</span>}
                      {t.feitaEm && !abre && <span className="doneat">Feita em {formatarDataHora(t.feitaEm)}</span>}
                    </div>
                    {trava ? <div className="kconf-espera">Aguardando o gestor conferir</div> : (
                      <div className="kmove">
                        {ci > 0 ? <button type="button" className="mv" data-act="mover" data-dir="-1" title={'Mover para ' + dados.colunas[ci - 1].nome} onClick={() => mover(t, dados.colunas[ci - 1].chave)}>← {dados.colunas[ci - 1].nome}</button> : <span />}
                        {ordena && (
                          <span className="kmid">
                            <button type="button" className="icon-btn kord" data-act="subir" title="Subir na coluna" aria-label="Subir na coluna" disabled={ii === 0} onClick={() => subirDescer(t, -1)}>↑</button>
                            <button type="button" className="icon-btn kord" data-act="descer" title="Descer na coluna" aria-label="Descer na coluna" disabled={ii === itens.length - 1} onClick={() => subirDescer(t, 1)}>↓</button>
                          </span>
                        )}
                        {ci < ultima ? <button type="button" className="mv" data-act="mover" data-dir="1" title={'Mover para ' + dados.colunas[ci + 1].nome} onClick={() => mover(t, dados.colunas[ci + 1].chave)}>{dados.colunas[ci + 1].nome} →</button> : <span />}
                      </div>
                    )}
                  </div>
                );
              })}
              {ocultas > 0 && <div className="org-empty">+ {ocultas} {ocultas === 1 ? 'mais antiga' : 'mais antigas'}</div>}
              {c.chave !== 'feito' && (kadd?.chave !== c.chave
                ? <button type="button" className="kadd-btn" data-act="kadd" onClick={() => setKadd({ chave: c.chave, txt: '' })}>+ Adicionar tarefa</button>
                : <FormAdicionar nome={c.nome} texto={kadd.txt} mudar={txt => setKadd({ chave: c.chave, txt })} fechar={() => setKadd(null)} enviar={(txt, el) => criar(c.chave, txt, el)} />)}
            </section>
          );
        })}
      </div>
      <DialogoTarefa tarefa={achar(abertoId)} dados={dados} setDados={setDados} pessoa={pessoa} banco={banco} confereDup={confere}
        abrirFechamento={t => setFechId(t.id)} fechar={() => setAbertoId(null)} />
      <DialogoFechamento tarefa={achar(fechId)} banco={banco} fechar={() => setFechId(null)} />
      {janela}
    </div>
  );
}

// Campo "Adicionar tarefa" no fim da coluna. Fecha com Esc ou quando o foco sai dele vazio.
function FormAdicionar({ nome, texto, mudar, fechar, enviar }: { nome: string; texto: string; mudar: (t: string) => void; fechar: () => void; enviar: (t: string, el: HTMLInputElement | null) => Promise<void> }){
  const ref = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { const el = ref.current; if (el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []);
  return (
    <form className="kadd" autoComplete="off" onKeyDown={e => { if (e.key === 'Escape'){ e.preventDefault(); fechar(); } }}
      onBlur={() => setTimeout(() => { if (!texto.trim() && !(ref.current && ref.current.closest('.kadd')?.contains(document.activeElement))) fechar(); }, 150)}
      onSubmit={async e => { e.preventDefault(); setEnviando(true); await enviar(texto, ref.current); setEnviando(false); ref.current?.focus(); }}>
      <input ref={ref} className="org-in kadd-in" maxLength={160} placeholder="Título da tarefa (Enter para adicionar)" aria-label={'Nova tarefa em ' + nome} value={texto} onChange={e => mudar(e.target.value)} />
      <div className="kadd-acts">
        <button type="submit" className="btn primary" disabled={enviando}>Adicionar</button>
        <button type="button" className="icon-btn" data-act="kadd-fechar" title="Fechar (Esc)" aria-label="Fechar" onClick={fechar}><Xis /></button>
      </div>
    </form>
  );
}
