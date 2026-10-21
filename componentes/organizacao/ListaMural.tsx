'use client';
// Aba "Tarefas e mural": a lista de tarefas (por prazo) e o mural de notas coloridas.
// A ordem dentro de cada grupo se muda com as setas ↑ ↓ na alça da tarefa (arrastar fica no sistema atual).
import { useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { formatarDataHora, chaveDoDia } from '@/lib/datas';
import { formatarProcesso, soDigitos } from '@/lib/processo';
import {
  CORES_NOTA, PRIO, RESPS, ROTACAO_NOTA, corrige, diaMes, diasAte, emAberto, emConferencia, gruposDeTarefas, ordenaNotas, paraSalvar, paraSalvarNota,
  pedeFechamento, prioNome, protegida, separaProcesso, travada, agendada, type Dados, type Nota, type Tarefa
} from '@/lib/organizacao';
import { useAviso } from '@/componentes/Avisos';
import { CampoProcesso } from '@/componentes/CampoProcesso';
import { CopiarProcesso } from '@/componentes/pericias/Cartao';
import { DialogoFechamento } from './DialogoFechamento';
import { useDuplicado } from './DialogoDuplicado';
import { Editavel } from './Editavel';
import type { Banco } from './Organizacao';

const Check = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const X = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const Lapis = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
const Alfinete = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/></svg>;
const Alca = () => <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/><circle cx="3" cy="7" r="1.4"/><circle cx="9" cy="7" r="1.4"/><circle cx="3" cy="11" r="1.4"/><circle cx="9" cy="11" r="1.4"/></svg>;

type Props = {
  dados: Dados; setDados: Dispatch<SetStateAction<Dados | null>>; pessoa: boolean; alheia: boolean; eu?: string | null; hoje: Date; banco: Banco;
};

export function ListaMural({ dados, setDados, pessoa, alheia, eu = null, hoje, banco }: Props){
  const avisar = useAviso();
  const { confere, janela } = useDuplicado(banco, dados, pessoa, eu);
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', proc: '', prazo: '', prio: 'normal', resp: '' });
  const [novaNota, setNovaNota] = useState({ titulo: '', texto: '' });
  const [cor, setCor] = useState('amarelo');
  const [editando, setEditando] = useState<string | null>(null);
  const [fechId, setFechId] = useState<string | null>(null);

  const salvarTarefa = (t: Parameters<typeof paraSalvar>[0]) => banco.chamar('org_salvar_tarefa', paraSalvar(t));
  const salvarNota = (n: Parameters<typeof paraSalvarNota>[0]) => banco.chamar('org_salvar_nota', paraSalvarNota(n));
  const mudarTarefa = (id: string, patch: Partial<Tarefa>) => setDados(d => d && { ...d, tarefas: d.tarefas.map(x => (x.id === id ? { ...x, ...patch } : x)) });
  const mudarNota = (id: string, patch: Partial<Nota>) => setDados(d => d && { ...d, notas: d.notas.map(x => (x.id === id ? { ...x, ...patch } : x)) });

  async function adicionarTarefa(){
    let titulo = novaTarefa.titulo.trim(), proc = novaTarefa.proc;
    if (!titulo) return;
    if (!soDigitos(proc)){ const sp = separaProcesso(titulo); if (sp.processo){ titulo = sp.titulo; proc = sp.processo; } }
    if (!(await confere(proc))) return;
    const r = await salvarTarefa({ titulo, prazo: novaTarefa.prazo ? new Date(novaTarefa.prazo + 'T00:00') : null, prioridade: novaTarefa.prio,
      responsavel: alheia ? '' : novaTarefa.resp, processo: formatarProcesso(proc), feitaEm: null, etapa: '' });
    if (!banco.ok(r)) return;
    setNovaTarefa({ titulo: '', proc: '', prazo: '', prio: 'normal', resp: novaTarefa.resp });
    avisar('Tarefa adicionada');
    await banco.recarregar();
    document.getElementById('orgTaskTitle')?.focus();
  }

  async function marcarFeita(t: Tarefa){
    if (travada(t, pessoa)){ avisar('Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.'); return; }
    if (!t.feitaEm && pedeFechamento(t, pessoa)){ setFechId(t.id); return; }
    const feitaEm = t.feitaEm ? null : new Date();
    const r = await salvarTarefa({ ...t, feitaEm, etapa: feitaEm ? 'feito' : 'afazer' });
    if (banco.ok(r)){ if (feitaEm) avisar('Feita em ' + formatarDataHora(feitaEm)); await banco.recarregar(); }
  }

  // ↑ ↓ na alça: troca a tarefa de lugar com a vizinha do mesmo grupo e grava a ordem do grupo
  async function mexer(ids: string[], id: string, dir: -1 | 1){
    const i = ids.indexOf(id), j = i + dir;
    if (i === -1 || j < 0 || j >= ids.length) return;
    const novo = ids.slice(); novo[i] = ids[j]; novo[j] = id;
    setDados(d => d && { ...d, tarefas: d.tarefas.map(x => { const k = novo.indexOf(x.id); return k === -1 ? x : { ...x, ordemLista: (k + 1) * 10 }; }) });
    const r = await banco.chamar('org_ordenar_lista', { p_ids: novo });
    if (!banco.ok(r) && r.status === 'erro') await banco.recarregar();
    setTimeout(() => (document.querySelector('[data-tgrip="' + id + '"]') as HTMLElement | null)?.focus(), 0);
  }

  async function colarNota(){
    const texto = novaNota.texto.trim();
    if (!texto) return;
    const titulo = dados.temNotaTitulo ? novaNota.titulo.trim() : '';
    const r = await salvarNota({ texto, cor, fixada: false });
    if (!banco.ok(r)) return;
    if (titulo && r.id){ const r2 = await banco.chamar('org_titulo_nota', { p_id: r.id, p_titulo: corrige(titulo) }); banco.ok(r2); }
    setNovaNota({ titulo: '', texto: '' });
    avisar('Nota colada no mural');
    await banco.recarregar();
  }

  const grupos = gruposDeTarefas(dados.tarefas, hoje);
  const notas = ordenaNotas(dados.notas);
  const fixadas = notas.filter(n => n.fixada).length;
  const abertas = emAberto(dados.tarefas);
  const resps = RESPS;

  function linha(t: Tarefa, idsDoGrupo: string[]){
    if (editando === t.id) return <FormEdicao key={t.id} t={t} pessoa={pessoa} banco={banco} confere={confere} fechar={() => setEditando(null)} />;
    const dd = t.prazo ? diasAte(t.prazo, hoje) : 0;
    const atrasada = !t.feitaEm && !!t.prazo && dd < 0;
    const quem = dados.pessoas.find(p => p.id === t.enviadaPor)?.nome;
    const doEquipe = !!t.enviadaPor && !pessoa && !alheia;
    const meta = !!t.prazo || !!t.processo || !!t.feitaEm;
    return (
      <div key={t.id} className={'task' + (atrasada ? ' overdue' : '') + (t.urgente && !t.feitaEm ? ' urgent' : '') + (t.feitaEm ? ' done' : '')} data-tid={t.id}>
        <button type="button" className="check" role="checkbox" aria-checked={!!t.feitaEm} data-act="feita" aria-label="Marcar como feita" onClick={() => marcarFeita(t)}>{t.feitaEm && <Check />}</button>
        <div style={{ minWidth: 0 }}>
          <div className="t-title">
            <Editavel className="editable" dataEdit="tarefa" titulo="Clique para editar o texto" texto={t.titulo} aoSalvar={async novo => {
              const titulo = corrige(novo);
              mudarTarefa(t.id, { titulo });
              const r = await salvarTarefa({ ...t, titulo });
              if (banco.ok(r)) avisar('Tarefa atualizada'); else await banco.recarregar();
            }} />
          </div>
          {meta && (
            <div className="t-meta">
              {t.prazo && (atrasada ? <span className="late">Atrasada {-dd} {dd === -1 ? 'dia' : 'dias'} ({diaMes(t.prazo)})</span>
                : dd === 0 ? <span>Vence hoje</span> : dd === 1 ? <span>Vence amanhã</span> : <span>Prazo {diaMes(t.prazo)}</span>)}
              {t.processo && <CopiarProcesso proc={t.processo} />}
              {t.feitaEm && <span className="doneat">Feita em {formatarDataHora(t.feitaEm)}</span>}
            </div>
          )}
        </div>
        <div className="t-side">
          {emConferencia(t) ? <span className="tag conf">Em conferência</span>
            : t.conferencia === 'devolvida' && !t.feitaEm ? <span className="tag devolv">Devolvida</span>
            : t.conferencia === 'aprovada' ? <span className="tag conferida">Conferida ✓</span> : null}
          {!t.feitaEm && t.prioridade !== 'normal' && <span className={'tag ' + (t.prioridade === 'urgente' ? 'urg' : t.prioridade)}>{prioNome(t.prioridade)}</span>}
          {agendada(t, hoje) && !pessoa && <span className="tag agend" title="A pessoa ainda não vê esta tarefa">Aparece em {diaMes(t.apareceEm!)}</span>}
          {t.doGestor && pessoa && <span className="tag gestor">Do gestor</span>}
          {doEquipe && <span className="tag da-equipe" title={t.recadoGestor ? 'Recado: ' + t.recadoGestor : 'Mandada por alguém da equipe'}>De {quem ? quem.split(' ')[0] : 'alguém da equipe'}</span>}
          {t.responsavel && !alheia && <span className="tag resp">{t.responsavel}</span>}
          <button type="button" className="icon-btn" data-act="editar" title="Editar prazo, prioridade, responsável…" aria-label="Editar tarefa" onClick={() => setEditando(t.id)}><Lapis /></button>
          {dados.temOrdemLista && !t.feitaEm && (
            <span className="t-grip" tabIndex={0} role="button" data-tgrip={t.id} title="Mude a ordem com as setas ↑ ↓" aria-label={'Mudar a ordem de ' + t.titulo + ' com as setas para cima e para baixo'}
              onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); mexer(idsDoGrupo, t.id, e.key === 'ArrowUp' ? -1 : 1); } }}><Alca /></span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="org-split" id="orgPaneLista">
      <div className="panel">
        <div className="panel-head"><h2>Tarefas</h2><span id="orgTasksInfo">{dados.tarefas.length ? abertas + ' em aberto · clique no título ou no lápis para editar' : ''}</span></div>
        <form className="org-add" id="orgTaskForm" autoComplete="off" onSubmit={e => { e.preventDefault(); adicionarTarefa(); }}>
          <input className="org-in grow full" id="orgTaskTitle" maxLength={160} placeholder="Nova tarefa…" required value={novaTarefa.titulo} onChange={e => setNovaTarefa(s => ({ ...s, titulo: e.target.value }))} />
          <CampoProcesso className="org-in grow proc-in" id="orgTaskProc" maxLength={40} placeholder="Nº do processo (opcional)" aria-label="Número do processo" value={novaTarefa.proc} onChange={x => setNovaTarefa(s => ({ ...s, proc: x }))} />
          <input className="org-in" id="orgTaskDue" type="date" aria-label="Prazo" value={novaTarefa.prazo} onChange={e => setNovaTarefa(s => ({ ...s, prazo: e.target.value }))} />
          <select className="org-in" id="orgTaskUrg" aria-label="Prioridade" value={novaTarefa.prio} onChange={e => setNovaTarefa(s => ({ ...s, prio: e.target.value }))}>
            {PRIO.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
          </select>
          <select className="org-in so-proprio" id="orgTaskResp" aria-label="Responsável" value={novaTarefa.resp} onChange={e => setNovaTarefa(s => ({ ...s, resp: e.target.value }))}>
            <option value="">Responsável</option>{resps.map(r => <option key={r}>{r}</option>)}
          </select>
          <button type="submit" className="btn primary">Adicionar</button>
        </form>
        <div id="orgTasks" className="tgroup">
          {!dados.tarefas.length && <div className="org-empty">Nenhuma tarefa ainda. Escreva acima e clique em &quot;Adicionar&quot;.</div>}
          {grupos.map(g => {
            const ids = g.itens.map(t => t.id);
            return (
              <div key={g.nome}>
                <div className="tgroup-title">{g.nome} <span className="n">{g.itens.length}</span></div>
                <div className="tgroup-itens" data-grupo={g.nome}>{g.itens.map(t => linha(t, g.concluidas ? [] : ids))}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>Mural</h2><span id="orgNotesInfo">{notas.length ? fixadas + (fixadas === 1 ? ' fixada · ' : ' fixadas · ') + notas.length + (notas.length === 1 ? ' nota' : ' notas') + ' · clique no texto para editar' : ''}</span></div>
        <form className="org-add" id="orgNoteForm" autoComplete="off" onSubmit={e => { e.preventDefault(); colarNota(); }}>
          <input className="org-in" id="orgNoteTitulo" maxLength={80} placeholder="Título (opcional)" aria-label="Título da nota" hidden={!dados.temNotaTitulo} value={novaNota.titulo} onChange={e => setNovaNota(s => ({ ...s, titulo: e.target.value }))} />
          <input className="org-in grow" id="orgNoteText" maxLength={300} placeholder="Escreva um aviso ou lembrete rápido…" required value={novaNota.texto} onChange={e => setNovaNota(s => ({ ...s, texto: e.target.value }))} />
          <div className="swatches" id="orgSwatches" role="group" aria-label="Cor da nota">
            {CORES_NOTA.map(c => <button key={c} type="button" className={'sw c-' + c} data-cor={c} aria-pressed={cor === c} aria-label={'Nota ' + c} title={c.charAt(0).toUpperCase() + c.slice(1)} onClick={() => setCor(c)} />)}
          </div>
          <button type="submit" className="btn primary">Colar nota</button>
        </form>
        <div className="board" id="orgBoard">
          {!notas.length && <div className="org-empty">Nenhuma nota ainda. Escreva um aviso acima e clique em &quot;Colar nota&quot;.</div>}
          {notas.map((n, i) => (
            <div key={n.id} className={'note c-' + n.cor + (n.fixada ? ' pinned' : '')} style={{ '--r': ROTACAO_NOTA[i % ROTACAO_NOTA.length] } as CSSProperties}>
              {n.fixada && <span className="pin-badge">Fixado</span>}
              {dados.temNotaTitulo && (
                <Editavel como="div" className="note-titulo" dataEdit="nota-titulo" rotulo="Título da nota" titulo="Clique para escrever o título" texto={n.titulo} permiteVazio maxLetras={80}
                  aoSalvar={async novo => {
                    const titulo = novo ? corrige(novo) : '';
                    mudarNota(n.id, { titulo });
                    const r = await banco.chamar('org_titulo_nota', { p_id: n.id, p_titulo: titulo });
                    if (banco.ok(r)) avisar(titulo ? 'Título da nota atualizado' : 'Título da nota tirado'); else await banco.recarregar();
                  }} />
              )}
              <Editavel como="div" className="note-text" dataEdit="nota" rotulo="Texto da nota" titulo="Clique para editar" texto={n.texto} multilinha
                aoSalvar={async novo => {
                  const texto = corrige(novo);
                  mudarNota(n.id, { texto });
                  const r = await salvarNota({ ...n, texto });
                  if (banco.ok(r)) avisar('Nota atualizada'); else await banco.recarregar();
                }} />
              <div className="note-foot"><span>{diaMes(n.criada)}</span>
                <span className="note-actions">
                  <button type="button" className="icon-btn" data-act="fixar" title={n.fixada ? 'Desafixar' : 'Fixar no topo'} aria-label={n.fixada ? 'Desafixar nota' : 'Fixar nota'} onClick={async () => {
                    const r = await salvarNota({ ...n, fixada: !n.fixada });
                    if (banco.ok(r)) await banco.recarregar();
                  }}><Alfinete /></button>
                  <button type="button" className="icon-btn" data-act="excluir-nota" title="Remover nota" aria-label="Remover nota" onClick={async () => {
                    const r = await banco.chamar('org_excluir_nota', { p_id: n.id });
                    if (banco.ok(r)){ avisar('Nota removida'); await banco.recarregar(); }
                  }}><X /></button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <DialogoFechamento tarefa={dados.tarefas.find(t => t.id === fechId) || null} banco={banco} fechar={() => setFechId(null)} />
      {janela}
    </div>
  );
}

// Edição da tarefa na própria linha: prazo, prioridade, responsável e processo
function FormEdicao({ t, pessoa, banco, confere, fechar }: { t: Tarefa; pessoa: boolean; banco: Banco; confere: (p: string, ignorar?: string) => Promise<boolean>; fechar: () => void }){
  const avisar = useAviso();
  const [v, setV] = useState(() => ({ titulo: t.titulo, prazo: t.prazo ? chaveDoDia(t.prazo) : '', prio: t.prioridade as string, resp: t.responsavel, proc: t.processo }));
  const [armado, setArmado] = useState(false);
  const resps = t.responsavel && !RESPS.includes(t.responsavel) ? [...RESPS, t.responsavel] : RESPS;
  return (
    <form className="task editing" data-form="editar" onSubmit={async e => {
      e.preventDefault();
      if (soDigitos(v.proc).length === 20 && soDigitos(t.processo) !== soDigitos(v.proc) && !(await confere(v.proc, t.id))) return;
      const r = await banco.chamar('org_salvar_tarefa', paraSalvar({ ...t, titulo: v.titulo.trim() || t.titulo, prazo: v.prazo ? new Date(v.prazo + 'T00:00') : null,
        prioridade: v.prio, responsavel: v.resp, processo: formatarProcesso(v.proc) }));
      if (!banco.ok(r)) return;
      fechar();
      avisar('Tarefa atualizada');
      await banco.recarregar();
    }}>
      <div className="task-edit">
        <label className="ttl">Tarefa<input className="org-in" id="oeTitulo" value={v.titulo} maxLength={160} required autoFocus onChange={e => setV(s => ({ ...s, titulo: e.target.value }))} /></label>
        <label>Prazo<input className="org-in" type="date" id="oePrazo" value={v.prazo} onChange={e => setV(s => ({ ...s, prazo: e.target.value }))} /></label>
        <label>Prioridade
          <select className="org-in" id="oeUrg" value={v.prio} onChange={e => setV(s => ({ ...s, prio: e.target.value }))}>{PRIO.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}</select>
        </label>
        <label className="so-proprio">Responsável
          <select className="org-in" id="oeResp" value={v.resp} onChange={e => setV(s => ({ ...s, resp: e.target.value }))}><option value="">Ninguém</option>{resps.map(r => <option key={r}>{r}</option>)}</select>
        </label>
        <label>Nº do processo<CampoProcesso className="org-in mono-in" id="oeProc" maxLength={40} placeholder="opcional" style={{ fontFamily: 'var(--font-data)' }} value={v.proc} onChange={x => setV(s => ({ ...s, proc: x }))} /></label>
        <div className="row-btns">
          {protegida(t, pessoa)
            ? <span className="field-hint">Mandada pelo gestor: não pode ser excluída.</span>
            : <button type="button" className={'btn danger-text' + (armado ? ' armed' : '')} data-act="excluir-tarefa" onClick={async () => {
                if (!armado){ setArmado(true); return; }
                const r = await banco.chamar('org_excluir_tarefa', { p_id: t.id });
                if (banco.ok(r)){ fechar(); avisar('Tarefa excluída'); await banco.recarregar(); }
              }}>{armado ? 'Confirmar exclusão' : 'Excluir'}</button>}
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" data-act="cancelar" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn primary">Salvar</button>
          </span>
        </div>
      </div>
    </form>
  );
}
