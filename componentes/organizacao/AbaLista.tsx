'use client';
// Aba "Tarefas e mural": a lista de tarefas por prazo (com edição, ordem pela alça) e o mural de notas
import { Fragment, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import {
  CORES, PRIO, RESPONSAVEIS, ROTACAO, corrige, diaMes, diferenca, gruposDaLista, prioNome, separaProcesso, type Nota, type Prioridade, type Tarefa
} from '@/lib/organizacao';
import { chaveDoDia, formatarDataHora } from '@/lib/datas';
import { formatarProcesso, soDigitos } from '@/lib/processo';
import { useAviso } from '@/componentes/Avisos';
import { CampoProcesso } from '@/componentes/CampoProcesso';
import { CopiarProcesso } from '@/componentes/CopiarProcesso';
import { Editavel } from './Editavel';
import type { Sessao } from './sessao';

const IconeCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconeLapis = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
const IconeAlca = () => <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/><circle cx="3" cy="7" r="1.4"/><circle cx="9" cy="7" r="1.4"/><circle cx="3" cy="11" r="1.4"/><circle cx="9" cy="11" r="1.4"/></svg>;
const IconePino = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>;
const IconeX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconeDoc = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type AbrirNoSistemaAtual = (aba: string) => void;

// ---- tarefas ----
function Linha({ t, s, agora, movendo, editar, alternar, salvarTitulo, abrirModelo, arrastar }: {
  t: Tarefa; s: Sessao; movendo: boolean; agora: Date; editar: () => void; alternar: () => void; salvarTitulo: (t: Tarefa, txt: string, el: HTMLElement, orig: string) => void;
  abrirModelo: () => void; arrastar: { inicio: (e: DragEvent, t: Tarefa) => void; tecla: (e: KeyboardEvent, t: Tarefa) => void };
}){
  const d = s.dados!;
  const late = !t.feitaEm && !!t.prazo && diferenca(t.prazo, agora) < 0;
  const meta = [];
  if (t.prazo){
    const dd = diferenca(t.prazo, agora);
    meta.push(late ? <span key="p" className="late">Atrasada {-dd}{dd === -1 ? ' dia' : ' dias'} ({diaMes(t.prazo)})</span>
      : dd === 0 ? <span key="p">Vence hoje</span> : dd === 1 ? <span key="p">Vence amanhã</span> : <span key="p">Prazo {diaMes(t.prazo)}</span>);
  }
  if (t.processo) meta.push(<CopiarProcesso key="c" proc={t.processo} />);
  const modelo = t.modeloTexto && d.txtTem ? d.txtModelos.find(m => m.id === t.modeloTexto) : null;
  if (modelo) meta.push(<button key="m" type="button" className="kmodelo" data-act="abrir-modelo" data-id={t.id} title={'Abrir o modelo de texto: ' + modelo.nome} onClick={abrirModelo}><IconeDoc />Modelo</button>);
  if (t.feitaEm) meta.push(<span key="f" className="doneat">Feita em {formatarDataHora(t.feitaEm)}</span>);
  const conf = t.conferencia === 'enviada' ? <span className="tag conf">Em conferência</span>
    : t.conferencia === 'devolvida' && t.etapa !== 'feito' ? <span className="tag devolv">Devolvida</span>
    : t.conferencia === 'aprovada' ? <span className="tag conferida">Conferida ✓</span> : null;
  const agendada = !!t.apareceEm && t.etapa !== 'feito' && diferenca(t.apareceEm, agora) > 0 && s.modo === 'gestor';
  const daEquipe = t.enviadaPor && s.modo === 'gestor' && !s.ver ? (d.pessoas.find(p => p.id === t.enviadaPor) || { nome: '' }).nome : null;
  return (
    <div className={'task' + (late ? ' overdue' : '') + (t.urgente && !t.feitaEm ? ' urgent' : '') + (t.feitaEm ? ' done' : '') + (movendo ? ' t-movendo' : '')} data-tid={t.id}>
      <button type="button" className="check" role="checkbox" aria-checked={!!t.feitaEm} data-act="feita" data-id={t.id} aria-label="Marcar como feita" onClick={alternar}>{t.feitaEm ? <IconeCheck /> : null}</button>
      <div style={{ minWidth: 0 }}>
        <div className="t-title"><Editavel className="editable" tipo="tarefa" id={t.id} texto={t.titulo} title="Clique para editar o texto" salvar={(txt, el, orig) => salvarTitulo(t, txt, el, orig)} /></div>
        {meta.length > 0 && <div className="t-meta">{meta}</div>}
      </div>
      <div className="t-side">
        {conf}
        {!t.feitaEm && t.prioridade !== 'normal' && <span className={'tag ' + (t.prioridade === 'urgente' ? 'urg' : t.prioridade)}>{prioNome(t.prioridade)}</span>}
        {agendada && <span className="tag agend" title="A pessoa ainda não vê esta tarefa">Aparece em {diaMes(t.apareceEm!)}</span>}
        {t.doGestor && s.modo === 'pessoa' && <span className="tag gestor">Do gestor</span>}
        {daEquipe !== null && <span className="tag da-equipe" title={t.recadoGestor ? 'Recado: ' + t.recadoGestor : 'Mandada por alguém da equipe'}>De {daEquipe ? daEquipe.split(' ')[0] : 'alguém da equipe'}</span>}
        {t.responsavel && !s.alheia && <span className="tag resp">{t.responsavel}</span>}
        <button type="button" className="icon-btn" data-act="editar" data-id={t.id} title="Editar prazo, prioridade, responsável…" aria-label="Editar tarefa" onClick={editar}><IconeLapis /></button>
        {d.temOrdemLista && !t.feitaEm && (
          <span className="t-grip" draggable tabIndex={0} role="button" data-tgrip={t.id} title="Arraste para mudar a ordem (ou use as setas ↑ ↓)"
            aria-label={'Mudar a ordem de ' + t.titulo + ' com as setas para cima e para baixo'}
            onDragStart={e => arrastar.inicio(e, t)} onKeyDown={e => arrastar.tecla(e, t)}><IconeAlca /></span>
        )}
      </div>
    </div>
  );
}

function Edicao({ t, s, salvar, cancelar, excluir }: {
  t: Tarefa; s: Sessao; salvar: (x: { titulo: string; prazo: string; prioridade: Prioridade; responsavel: string; processo: string }) => void;
  cancelar: () => void; excluir: () => void;
}){
  const [v, setV] = useState({ titulo: t.titulo, prazo: t.prazo ? chaveDoDia(t.prazo) : '', prioridade: t.prioridade, responsavel: t.responsavel, processo: t.processo });
  const [armado, setArmado] = useState(false);
  const resps = RESPONSAVEIS.includes(t.responsavel) || !t.responsavel ? RESPONSAVEIS : [...RESPONSAVEIS, t.responsavel];
  const protegida = s.modo === 'pessoa' && t.doGestor;
  return (
    <form className="task editing" data-form="editar" data-id={t.id} onSubmit={e => { e.preventDefault(); salvar(v); }}>
      <div className="task-edit">
        <label className="ttl">Tarefa<input className="org-in" id="oeTitulo" value={v.titulo} maxLength={160} required autoFocus onChange={e => setV(x => ({ ...x, titulo: e.target.value }))} /></label>
        <label>Prazo<input className="org-in" type="date" id="oePrazo" value={v.prazo} onChange={e => setV(x => ({ ...x, prazo: e.target.value }))} /></label>
        <label>Prioridade<select className="org-in" id="oeUrg" value={v.prioridade} onChange={e => setV(x => ({ ...x, prioridade: e.target.value as Prioridade }))}>
          {PRIO.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select></label>
        <label className="so-proprio">Responsável<select className="org-in" id="oeResp" value={v.responsavel} onChange={e => setV(x => ({ ...x, responsavel: e.target.value }))}>
          <option value="">Ninguém</option>{resps.map(r => <option key={r} value={r}>{r}</option>)}
        </select></label>
        <label>Nº do processo<CampoProcesso className="org-in mono-in" id="oeProc" value={v.processo} maxLength={40} placeholder="opcional" style={{ fontFamily: 'var(--font-data)' }} onChange={x => setV(s => ({ ...s, processo: x }))} /></label>
        <div className="row-btns">
          {protegida ? <span className="field-hint">Mandada pelo gestor: não pode ser excluída.</span>
            : <button type="button" className={'btn danger-text' + (armado ? ' armed' : '')} data-act="excluir-tarefa" data-id={t.id} onClick={() => { if (!armado){ setArmado(true); return; } excluir(); }}>{armado ? 'Confirmar exclusão' : 'Excluir'}</button>}
          <span style={{ display: 'flex', gap: 8 }}><button type="button" className="btn" data-act="cancelar" onClick={cancelar}>Cancelar</button><button type="submit" className="btn primary">Salvar</button></span>
        </div>
      </div>
    </form>
  );
}

function Tarefas({ s, agora, confereProcesso, abrirNoSistemaAtual }: { s: Sessao; agora: Date; confereProcesso: (proc: string, ignorar?: string) => Promise<boolean>; abrirNoSistemaAtual: AbrirNoSistemaAtual }){
  const avisar = useAviso();
  const d = s.dados!;
  const [f, setF] = useState({ titulo: '', proc: '', prazo: '', prio: 'normal' as Prioridade, resp: '' });
  const [editando, setEditando] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Record<string, number>>({});   // ordem nova, até o banco confirmar
  const [arrasto, setArrasto] = useState<{ id: string; grupo: string; antesDe: string | null; dentro: boolean } | null>(null);
  const tituloRef = useRef<HTMLInputElement>(null);

  const tarefas = d.tarefas.map(t => (ordem[t.id] !== undefined ? { ...t, ordemLista: ordem[t.id] } : t));
  const salvarTarefa = (t: Partial<Tarefa> & { titulo: string }) => s.chamar('org_salvar_tarefa', {
    p_id: t.id || null, p_titulo: corrige(t.titulo), p_prazo: t.prazo ? chaveDoDia(t.prazo) : null, p_prioridade: t.prioridade || 'normal',
    p_responsavel: t.responsavel || '', p_processo: t.processo || '', p_feita_em: t.feitaEm ? t.feitaEm.toISOString() : null,
    p_etapa: t.etapa || (t.feitaEm ? 'feito' : 'afazer')
  });
  const recarregar = async () => { await s.carregar(); setOrdem({}); };

  async function acrescentar(){
    let titulo = f.titulo.trim(), proc = f.proc;
    if (!titulo) return;
    if (!soDigitos(proc)){ const sp = separaProcesso(titulo); if (sp.processo){ titulo = sp.titulo; proc = sp.processo; setF(x => ({ ...x, proc: sp.processo })); } }
    if (!(await confereProcesso(proc))) return;
    const r = await salvarTarefa({ titulo, prazo: f.prazo ? new Date(f.prazo + 'T00:00') : null, prioridade: f.prio, responsavel: s.alheia ? '' : f.resp, processo: formatarProcesso(proc), feitaEm: null });
    if (!s.ok(r)) return;
    setF(x => ({ ...x, titulo: '', prazo: '', prio: 'normal', proc: '' }));
    avisar('Tarefa adicionada');
    await recarregar();
    tituloRef.current?.focus();
  }

  async function alternar(t: Tarefa){
    if (s.modo === 'pessoa' && t.conferencia === 'enviada'){ avisar('Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.'); return; }
    // tarefa do gestor pede o fechamento (respostas da conclusão), que ainda fica no sistema atual
    if (!t.feitaEm && s.modo === 'pessoa' && t.doGestor && !t.conclusao){ abrirNoSistemaAtual('quadro'); return; }
    const feitaEm = t.feitaEm ? null : new Date();
    const r = await salvarTarefa({ ...t, feitaEm, etapa: feitaEm ? 'feito' : 'afazer' });
    if (s.ok(r)){ if (feitaEm) avisar('Feita em ' + formatarDataHora(feitaEm)); await recarregar(); }
  }

  async function salvarTitulo(t: Tarefa, txt: string, el: HTMLElement, orig: string){
    if (!txt){ el.innerText = orig; return; }
    if (txt === orig.trim()) return;
    const r = await salvarTarefa({ ...t, titulo: corrige(txt) });
    if (s.ok(r)) avisar('Tarefa atualizada');
    await recarregar();
  }

  // ---- ordem dentro do grupo: arrastar pela alça, ou setas com a alça em foco ----
  const grupos = gruposDaLista(tarefas, agora);
  async function gravarOrdem(ids: string[]){
    setOrdem(o => { const n = { ...o }; ids.forEach((id, i) => { n[id] = (i + 1) * 10; }); return n; });
    const r = await s.chamar('org_ordenar_lista', { p_ids: ids });
    if (!s.ok(r)) await recarregar();
  }
  const idsDoGrupo = (nome: string) => (grupos.find(g => g.nome === nome)?.itens || []).map(t => t.id);
  const grupoDe = (t: Tarefa) => grupos.find(g => g.itens.some(x => x.id === t.id))?.nome || '';
  const arrastar = {
    inicio(e: DragEvent, t: Tarefa){
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', 'tarefa:' + t.id); } catch { /* navegador sem dados de arrasto */ }
      setArrasto({ id: t.id, grupo: grupoDe(t), antesDe: null, dentro: false });
    },
    tecla(e: KeyboardEvent, t: Tarefa){
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const ids = idsDoGrupo(grupoDe(t)), i = ids.indexOf(t.id), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (i === -1 || j < 0 || j >= ids.length) return;
      const vizinha = tarefas.find(x => x.id === ids[j]); if (vizinha && vizinha.feitaEm) return;
      ids[i] = ids[j]; ids[j] = t.id;
      gravarOrdem(ids).then(() => (document.querySelector('[data-tgrip="' + t.id + '"]') as HTMLElement | null)?.focus());
      setTimeout(() => (document.querySelector('[data-tgrip="' + t.id + '"]') as HTMLElement | null)?.focus(), 0);
    }
  };
  function sobre(e: DragEvent, grupo: string){
    if (!arrasto) return;
    if (grupo !== arrasto.grupo){ if (arrasto.dentro) setArrasto({ ...arrasto, dentro: false }); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const linhas = Array.from((e.currentTarget as HTMLElement).querySelectorAll('.task[data-tid]')).filter(el => el.getAttribute('data-tid') !== arrasto.id);
    let antesDe: string | null = null;
    for (const el of linhas){ const rc = el.getBoundingClientRect(); if (e.clientY < rc.top + rc.height / 2){ antesDe = el.getAttribute('data-tid'); break; } }
    if (antesDe !== arrasto.antesDe || !arrasto.dentro) setArrasto({ ...arrasto, antesDe, dentro: true });
  }
  function soltar(e: DragEvent){
    if (!arrasto) return;
    const a = arrasto; setArrasto(null);
    if (!a.dentro) return;
    e.preventDefault();
    const antes = idsDoGrupo(a.grupo), ids = antes.filter(id => id !== a.id);
    const i = a.antesDe ? ids.indexOf(a.antesDe) : -1;
    ids.splice(i === -1 ? ids.length : i, 0, a.id);
    if (ids.join() !== antes.join()) gravarOrdem(ids);
  }

  const abertas = d.tarefas.filter(t => !t.feitaEm && !t.arquivadaEm).length;
  return (
    <div className="panel">
      <div className="panel-head"><h2>Tarefas</h2><span id="orgTasksInfo">{d.tarefas.length ? abertas + ' em aberto · clique no título ou no lápis para editar' : ''}</span></div>
      <form className="org-add" id="orgTaskForm" autoComplete="off" onSubmit={e => { e.preventDefault(); acrescentar(); }}>
        <input className="org-in grow full" id="orgTaskTitle" ref={tituloRef} maxLength={160} placeholder="Nova tarefa…" required value={f.titulo} onChange={e => setF(x => ({ ...x, titulo: e.target.value }))} />
        <CampoProcesso className="org-in grow proc-in" id="orgTaskProc" maxLength={40} placeholder="Nº do processo (opcional)" aria-label="Número do processo" value={f.proc} onChange={x => setF(s => ({ ...s, proc: x }))} />
        <input className="org-in" id="orgTaskDue" type="date" aria-label="Prazo" value={f.prazo} onChange={e => setF(x => ({ ...x, prazo: e.target.value }))} />
        <select className="org-in" id="orgTaskUrg" aria-label="Prioridade" value={f.prio} onChange={e => setF(x => ({ ...x, prio: e.target.value as Prioridade }))}>
          {PRIO.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <select className="org-in so-proprio" id="orgTaskResp" aria-label="Responsável" value={f.resp} onChange={e => setF(x => ({ ...x, resp: e.target.value }))}>
          <option value="">Responsável</option>{RESPONSAVEIS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" className="btn primary">Adicionar</button>
      </form>
      <div id="orgTasks" className={'tgroup' + (arrasto ? ' arrastando' : '')} onDragEnd={() => setArrasto(null)}>
        {!d.tarefas.length ? <div className="org-empty">Nenhuma tarefa ainda. Escreva acima e clique em &quot;Adicionar&quot;.</div> : grupos.map(g => (
          <Fragment key={g.nome}>
            <div className="tgroup-title">{g.nome} <span className="n">{g.itens.length}</span></div>
            <div className="tgroup-itens" data-grupo={g.nome} onDragOver={e => sobre(e, g.nome)} onDrop={soltar}>
              {g.itens.flatMap(t => {
                const linha = [];
                if (arrasto && arrasto.dentro && arrasto.grupo === g.nome && arrasto.antesDe === t.id) linha.push(<div key="linha" className="kdrop-line" />);
                linha.push(editando === t.id
                  ? <Edicao key={t.id} t={t} s={s} cancelar={() => setEditando(null)}
                      excluir={async () => { const r = await s.chamar('org_excluir_tarefa', { p_id: t.id }); if (s.ok(r)){ setEditando(null); avisar('Tarefa excluída'); await recarregar(); } }}
                      salvar={async v => {
                        const mudou = soDigitos(v.processo).length === 20 && soDigitos(t.processo) !== soDigitos(v.processo);
                        if (mudou && !(await confereProcesso(v.processo, t.id))) return;
                        const r = await salvarTarefa({ ...t, titulo: v.titulo.trim() || t.titulo, prazo: v.prazo ? new Date(v.prazo + 'T00:00') : null,
                          prioridade: v.prioridade, responsavel: v.responsavel, processo: formatarProcesso(v.processo) });
                        if (!s.ok(r)) return;
                        setEditando(null); avisar('Tarefa atualizada'); await recarregar();
                      }} />
                  : <Linha key={t.id} t={t} s={s} agora={agora} movendo={!!arrasto && arrasto.id === t.id} editar={() => setEditando(t.id)} alternar={() => alternar(t)}
                      salvarTitulo={salvarTitulo} abrirModelo={() => abrirNoSistemaAtual('modelos')} arrastar={arrastar} />);
                return linha;
              })}
              {arrasto && arrasto.dentro && arrasto.grupo === g.nome && arrasto.antesDe === null && <div className="kdrop-line" />}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ---- mural ----
function Mural({ s }: { s: Sessao }){
  const avisar = useAviso();
  const d = s.dados!;
  const [cor, setCor] = useState('amarelo');
  const [texto, setTexto] = useState('');
  const [titulo, setTitulo] = useState('');
  const salvarNota = (n: Partial<Nota> & { texto: string; cor: string; fixada: boolean }) =>
    s.chamar('org_salvar_nota', { p_id: n.id || null, p_texto: corrige(n.texto), p_cor: n.cor, p_fixada: !!n.fixada });

  const lista = d.notas.slice().sort((a, b) => (Number(b.fixada) - Number(a.fixada)) || (b.criada.getTime() - a.criada.getTime()));
  const fix = lista.filter(n => n.fixada).length;
  return (
    <div className="panel">
      <div className="panel-head"><h2>Mural</h2><span id="orgNotesInfo">{lista.length ? fix + (fix === 1 ? ' fixada · ' : ' fixadas · ') + lista.length + (lista.length === 1 ? ' nota' : ' notas') + ' · clique no texto para editar' : ''}</span></div>
      <form className="org-add" id="orgNoteForm" autoComplete="off" onSubmit={async e => {
        e.preventDefault();
        const t = texto.trim(); if (!t) return;
        const tit = d.temNotaTitulo ? titulo.trim() : '';
        const r = await salvarNota({ texto: t, cor, fixada: false });
        if (!s.ok(r)) return;
        if (tit && r.id){ const r2 = await s.chamar('org_titulo_nota', { p_id: r.id, p_titulo: corrige(tit) }); s.ok(r2); }
        setTexto(''); setTitulo('');
        avisar('Nota colada no mural');
        await s.carregar();
      }}>
        <input className="org-in" id="orgNoteTitulo" maxLength={80} placeholder="Título (opcional)" aria-label="Título da nota" hidden={!d.temNotaTitulo} value={titulo} onChange={e => setTitulo(e.target.value)} />
        <input className="org-in grow" id="orgNoteText" maxLength={300} placeholder="Escreva um aviso ou lembrete rápido…" required value={texto} onChange={e => setTexto(e.target.value)} />
        <div className="swatches" id="orgSwatches" role="group" aria-label="Cor da nota">
          {CORES.map(c => <button key={c} type="button" className={'sw c-' + c} data-cor={c} aria-pressed={cor === c} aria-label={'Nota ' + c} title={maiuscula(c)} onClick={() => setCor(c)} />)}
        </div>
        <button type="submit" className="btn primary">Colar nota</button>
      </form>
      <div className="board" id="orgBoard">
        {!lista.length ? <div className="org-empty">Nenhuma nota ainda. Escreva um aviso acima e clique em &quot;Colar nota&quot;.</div> : lista.map((n, i) => (
          <div key={n.id} className={'note c-' + n.cor + (n.fixada ? ' pinned' : '')} style={{ ['--r' as string]: ROTACAO[i % ROTACAO.length] }}>
            {n.fixada && <span className="pin-badge">Fixado</span>}
            {d.temNotaTitulo && <Editavel como="div" className="note-titulo" tipo="nota-titulo" id={n.id} texto={n.titulo} data-ph="Título" role="textbox" aria-label="Título da nota" title="Clique para escrever o título" limite={80}
              salvar={async (txt, el) => {
                txt = txt.replace(/\s+/g, ' ').slice(0, 80);
                if (txt === n.titulo){ el.innerText = txt; return; }
                const novo = txt ? corrige(txt) : '';
                el.innerText = novo;
                const r = await s.chamar('org_titulo_nota', { p_id: n.id, p_titulo: novo });
                if (s.ok(r)) avisar(novo ? 'Título da nota atualizado' : 'Título da nota tirado');
                await s.carregar();
              }} />}
            <Editavel como="div" className="note-text" tipo="nota" id={n.id} texto={n.texto} multilinha role="textbox" aria-multiline="true" aria-label="Texto da nota" title="Clique para editar"
              salvar={async (txt, el, orig) => {
                if (!txt){ el.innerText = orig; return; }
                if (txt === orig.trim()) return;
                const r = await salvarNota({ ...n, texto: corrige(txt) });
                if (s.ok(r)) avisar('Nota atualizada');
                await s.carregar();
              }} />
            <div className="note-foot"><span>{diaMes(n.criada)}</span><span className="note-actions">
              <button type="button" className="icon-btn" data-act="fixar" data-id={n.id} title={n.fixada ? 'Desafixar' : 'Fixar no topo'} aria-label={n.fixada ? 'Desafixar nota' : 'Fixar nota'}
                onClick={async () => { const r = await salvarNota({ ...n, fixada: !n.fixada }); if (s.ok(r)) await s.carregar(); }}><IconePino /></button>
              <button type="button" className="icon-btn" data-act="excluir-nota" data-id={n.id} title="Remover nota" aria-label="Remover nota"
                onClick={async () => { const r = await s.chamar('org_excluir_nota', { p_id: n.id }); if (s.ok(r)){ avisar('Nota removida'); await s.carregar(); } }}><IconeX /></button>
            </span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AbaLista({ s, agora, visivel, confereProcesso, abrirNoSistemaAtual }: {
  s: Sessao; agora: Date; visivel: boolean; confereProcesso: (proc: string, ignorar?: string) => Promise<boolean>; abrirNoSistemaAtual: AbrirNoSistemaAtual;
}){
  return (
    <div className="org-split" id="orgPaneLista" hidden={!visivel}>
      <Tarefas s={s} agora={agora} confereProcesso={confereProcesso} abrirNoSistemaAtual={abrirNoSistemaAtual} />
      <Mural s={s} />
    </div>
  );
}
