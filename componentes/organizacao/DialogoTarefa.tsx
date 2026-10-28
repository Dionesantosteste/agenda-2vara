'use client';
// Janela da tarefa do quadro: título, etapa, prazo, prioridade, responsável, processo e etiquetas
// (gravados em "Salvar") e checklist e anotações (gravados na hora). Excluir pede confirmação.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { PRIO, RESPS, corDaEtiqueta, paraSalvar, pedeFechamento, protegida, travada, type Conclusao, type Dados, type Item, type Tarefa } from '@/lib/organizacao';
import { chaveDoDia, formatarDataHora } from '@/lib/datas';
import { formatarProcesso, soDigitos } from '@/lib/processo';
import { useAviso } from '@/componentes/Avisos';
import { CampoProcesso } from '@/componentes/CampoProcesso';
import { useJanela } from '@/componentes/useJanela';
import type { Banco } from './Organizacao';
import { BarraFormato, TextoNota, atalhoDeFormato } from './FormatoNota';

const dois = (n: number) => (n < 10 ? '0' : '') + n;
const CONFORMIDADE: Record<string, string> = { sim: 'Sim', parcialmente: 'Parcialmente', nao: 'Não' };
const Check = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const X = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

function Fechamento({ c }: { c: Conclusao }){
  const h = Number(c.horas) || 0, m = Number(c.minutos) || 0;
  return (
    <>
      <div className="vinc-t">Fechamento da tarefa{c.em ? ' · ' + formatarDataHora(new Date(c.em)) : ''}</div>
      <div className="fech-l"><span>Tempo levado</span><b>{h}h {dois(m)}min</b></div>
      <div className="fech-l"><span>Concluiu conforme o pedido?</span><b>{CONFORMIDADE[c.conformidade || ''] || 'Sim'}</b></div>
      <div className="fech-l"><span>Precisa de ação do gestor?</span><b style={c.precisa_acao ? { color: 'var(--danger)' } : undefined}>{c.precisa_acao ? 'Sim' : 'Não'}</b></div>
      {c.dificuldade
        ? <div className="fech-dif"><b>Dificuldade:</b> {c.dificuldade_desc || 'não descreveu'}</div>
        : <div className="fech-l"><span>Teve dificuldade?</span><b>Não</b></div>}
    </>
  );
}

const Lapis = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;

function ExcluirAnotacao({ excluir }: { excluir: () => void }){
  const [armado, setArmado] = useState(false);
  return (
    <button type="button" className={'icon-btn' + (armado ? ' armed' : '')} title="Excluir anotação" aria-label="Excluir anotação"
      onClick={() => { if (!armado){ setArmado(true); return; } excluir(); }}>{armado ? 'Excluir?' : <X />}</button>
  );
}

type Props = {
  tarefa: Tarefa | null; dados: Dados; setDados: Dispatch<SetStateAction<Dados | null>>; pessoa: boolean; banco: Banco;
  confereDup: (proc: string, ignorarId?: string) => Promise<boolean>; abrirFechamento: (t: Tarefa) => void; fechar: () => void;
};

export function DialogoTarefa(props: Props){
  const { ref, cliqueFora, aoFechar } = useJanela(!!props.tarefa, props.fechar);
  return (
    <dialog id="orgCardDialog" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      {/* o formulário nasce já preenchido com a tarefa (e nasce de novo a cada tarefa aberta) */}
      {props.tarefa && <FormTarefa key={props.tarefa.id} {...props} tarefa={props.tarefa} />}
    </dialog>
  );
}

function FormTarefa({ tarefa: t, dados, setDados, pessoa, banco, confereDup, abrirFechamento, fechar }: Props & { tarefa: Tarefa }){
  const avisar = useAviso();
  // O checklist e as anotações são lidos direto da tarefa (gravados na hora); o resto vira rascunho até "Salvar"
  const [v, setV] = useState(() => ({ titulo: t.titulo, etapa: t.etapa, prazo: t.prazo ? chaveDoDia(t.prazo) : '', prio: t.prioridade as string, resp: t.responsavel, proc: t.processo, etq: t.etiquetas.slice(), novoItem: '', nota: '' }));
  const [armado, setArmado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [edNota, setEdNota] = useState<{ id: string; txt: string } | null>(null);   // anotação em edição
  useEffect(() => { const t = setTimeout(() => document.getElementById('ocTitulo')?.focus(), 30); return () => clearTimeout(t); }, []);

  const mudarTarefa = (tid: string, patch: Partial<Tarefa>) => setDados(d => d && { ...d, tarefas: d.tarefas.map(x => (x.id === tid ? { ...x, ...patch } : x)) });
  const resps = t && t.responsavel && !RESPS.includes(t.responsavel) ? [...RESPS, t.responsavel] : RESPS;
  const notas = t ? dados.anotacoes.filter(a => a.tarefa === t.id) : [];

  async function salvarChecklist(lista: Item[]){
    if (!t) return;
    mudarTarefa(t.id, { checklist: lista, atualizada: new Date() });
    const r = await banco.chamar('org_checklist_tarefa', { p_id: t.id, p_itens: lista });
    if (!banco.ok(r) && r.status === 'erro') await banco.recarregar();
  }
  function adicionarItem(){
    if (!t) return;
    const txt = v.novoItem.trim().replace(/\s+/g, ' ');
    if (!txt){ document.getElementById('ocCheckNovo')?.focus(); return; }
    if (t.checklist.length >= 100){ avisar('O checklist aceita até 100 itens.'); return; }
    setV(s => ({ ...s, novoItem: '' }));
    salvarChecklist(t.checklist.concat([{ t: txt, ok: false }]));
    document.getElementById('ocCheckNovo')?.focus();
  }
  async function salvarNotaEditada(){
    if (!edNota) return;
    const txt = edNota.txt.trim();
    if (!txt){ avisar('A anotação não pode ficar vazia.'); document.getElementById('ocNotaEdit')?.focus(); return; }
    const r = await banco.chamar('org_editar_anotacao', { p_id: edNota.id, p_texto: txt });
    if (!banco.ok(r)) return;
    setDados(d => d && { ...d, anotacoes: d.anotacoes.map(x => (x.id === edNota.id ? { ...x, texto: txt.slice(0, 2000) } : x)),
      tarefas: d.tarefas.map(x => (x.id === t.id ? { ...x, atualizada: new Date() } : x)) });
    setEdNota(null);
    avisar('Anotação atualizada');
  }
  // junto = chamada pelo "Salvar" da tarefa: só grava (a janela fecha e o quadro recarrega em seguida)
  async function anotar(junto: boolean): Promise<boolean> {
    const txt = v.nota.trim();
    if (!t || !txt){ if (!junto) document.getElementById('ocNotaTxt')?.focus(); return false; }
    const r = await banco.chamar('org_anotar', { p_tarefa: t.id, p_texto: txt });
    if (!banco.ok(r)) return false;
    setDados(d => d && { ...d, anotacoes: [{ id: r.id, tarefa: t.id, texto: txt.slice(0, 2000), criada: new Date() }, ...d.anotacoes],
      tarefas: d.tarefas.map(x => (x.id === t.id ? { ...x, atualizada: new Date() } : x)) });
    setV(s => ({ ...s, nota: '' }));
    if (junto) return true;
    avisar('Anotação registrada');
    document.getElementById('ocNotaTxt')?.focus();
    return true;
  }

  async function salvar(){
    if (!t) return;
    setGravando(true);
    try {
      let etapa = v.etapa;
      const procMudou = soDigitos(v.proc).length === 20 && soDigitos(t.processo) !== soDigitos(v.proc);
      if (procMudou && !(await confereDup(v.proc, t.id))) return;
      // tarefa do gestor indo para Feito: grava o resto e pede o fechamento antes de concluir
      const fecharDepois = etapa === 'feito' && t.etapa !== 'feito' && pedeFechamento(t, pessoa);
      if (fecharDepois) etapa = t.etapa;
      // texto deixado em Anotações ou no item novo do checklist, sem clicar em Anotar/Adicionar: grava junto
      let anotou = false;
      if (dados.temChecklist && v.nota.trim()){ if (!(await anotar(true))) return; anotou = true; }
      const itemNovo = dados.temChecklist ? v.novoItem.trim().replace(/\s+/g, ' ') : '';
      if (itemNovo && t.checklist.length < 100){
        const lista = t.checklist.map(x => ({ t: x.t, ok: x.ok })).concat([{ t: itemNovo, ok: false }]);
        const rc = await banco.chamar('org_checklist_tarefa', { p_id: t.id, p_itens: lista });
        if (!banco.ok(rc)) return;
        mudarTarefa(t.id, { checklist: lista });
        setV(s => ({ ...s, novoItem: '' }));
      }
      let r = await banco.chamar('org_salvar_tarefa', paraSalvar({
        ...t, titulo: v.titulo.trim() || t.titulo, prazo: v.prazo ? new Date(v.prazo + 'T00:00') : null, prioridade: v.prio, responsavel: v.resp,
        processo: formatarProcesso(v.proc), etapa, feitaEm: etapa === 'feito' ? (t.feitaEm || new Date()) : null
      }));
      if (!banco.ok(r)) return;
      if (dados.temCadastro && v.etq.slice().sort().join() !== t.etiquetas.slice().sort().join()){
        r = await banco.chamar('org_etiquetar_tarefa', { p_id: t.id, p_etiquetas: v.etq });
        if (!banco.ok(r)) return;
      }
      fechar();
      avisar(anotou ? 'Tarefa e anotação salvas' : 'Tarefa atualizada');
      await banco.recarregar();
      if (fecharDepois) abrirFechamento({ ...t, etapa: t.etapa });
    } finally { setGravando(false); }
  }

  async function excluir(){
    if (!t) return;
    if (!armado){ setArmado(true); return; }
    const r = await banco.chamar('org_excluir_tarefa', { p_id: t.id });
    if (!banco.ok(r)) return;
    fechar();
    avisar('Tarefa excluída');
    await banco.recarregar();
  }

  const info: string[] = [];
  if (t){
    if (t.criada) info.push('Criada em ' + formatarDataHora(t.criada));
    if (t.atualizada) info.push('última mudança em ' + formatarDataHora(t.atualizada));
    if (t.feitaEm) info.push('feita em ' + formatarDataHora(t.feitaEm));
    if (t.doGestor) info.unshift('Mandada pelo gestor');
  }
  const feitos = t ? t.checklist.filter(i => i.ok).length : 0, total = t ? t.checklist.length : 0;
  const bloqueada = !!t && travada(t, pessoa);

  return (
      <form className="sheet" id="orgCardForm" autoComplete="off" onSubmit={e => { e.preventDefault(); salvar(); }}>
      <h2>Tarefa do quadro</h2>
      <div className="field">
        <label htmlFor="ocTitulo">Tarefa</label>
        <input id="ocTitulo" maxLength={160} required value={v.titulo} onChange={e => setV(s => ({ ...s, titulo: e.target.value }))} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ocEtapa">Etapa</label>
          <select id="ocEtapa" value={v.etapa} disabled={bloqueada} title={bloqueada ? 'Em conferência com o gestor: a etapa fica parada até a resposta' : ''}
            onChange={e => setV(s => ({ ...s, etapa: e.target.value }))}>
            {dados.colunas.map(c => <option key={c.chave} value={c.chave}>{c.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ocPrazo">Prazo</label>
          <input id="ocPrazo" type="date" value={v.prazo} onChange={e => setV(s => ({ ...s, prazo: e.target.value }))} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ocUrg">Prioridade</label>
          <select id="ocUrg" value={v.prio} onChange={e => setV(s => ({ ...s, prio: e.target.value }))}>
            {PRIO.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
          </select>
        </div>
        <div className="field so-proprio">
          <label htmlFor="ocResp">Responsável</label>
          <select id="ocResp" value={v.resp} onChange={e => setV(s => ({ ...s, resp: e.target.value }))}>
            <option value="">Ninguém</option>
            {resps.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="oc-fech" id="ocFech" hidden={!t?.conclusao}>{t?.conclusao && <Fechamento c={t.conclusao} />}</div>
      <div className="field">
        <label htmlFor="ocProc">Nº do processo</label>
        <CampoProcesso id="ocProc" className="mono" maxLength={40} placeholder="opcional" value={v.proc} onChange={x => setV(s => ({ ...s, proc: x }))} />
      </div>
      <div className="field" id="ocEtiqWrap" hidden={!dados.temCadastro}>
        <label>Etiquetas</label>
        <div className="kchips" id="ocEtiq" role="group" aria-label="Etiquetas da tarefa">
          {dados.etiquetas.length
            ? dados.etiquetas.map(e => (
              <button key={e.id} type="button" className="klabel" data-etq={e.id} aria-pressed={v.etq.includes(e.id)} style={{ '--lc': corDaEtiqueta(e.cor) } as React.CSSProperties}
                onClick={() => setV(s => ({ ...s, etq: s.etq.includes(e.id) ? s.etq.filter(x => x !== e.id) : [...s.etq, e.id] }))}>{e.nome}</button>))
            : <span className="field-hint">Nenhuma etiqueta ainda. Crie no sistema atual, no botão “Etiquetas” acima do quadro.</span>}
        </div>
      </div>
      <div className="field oc-extra" id="ocCheckWrap" hidden={!dados.temChecklist}>
        <label htmlFor="ocCheckNovo">Checklist <span className="oc-n" id="ocCheckN">{total ? feitos + '/' + total : ''}</span></label>
        <div className="progress" id="ocCheckBar" hidden={!total}><i style={{ width: total ? Math.round(feitos / total * 100) + '%' : '0' }} /></div>
        <div className="ck-list" id="ocCheckList">
          {t?.checklist.map((it, i) => (
            <div key={i + '|' + it.t} className={'ck-row' + (it.ok ? ' ok' : '')}>
              <button type="button" className="check" role="checkbox" aria-checked={it.ok} aria-label={'Marcar: ' + it.t}
                onClick={() => salvarChecklist(t.checklist.map((x, k) => (k === i ? { t: x.t, ok: !x.ok } : { t: x.t, ok: x.ok })))}><Check /></button>
              <input maxLength={200} defaultValue={it.t} aria-label="Item do checklist"
                onKeyDown={e => { if (e.key === 'Enter'){ e.preventDefault(); e.currentTarget.blur(); } }}
                onBlur={e => {
                  const txt = e.target.value.trim().replace(/\s+/g, ' ');
                  if (!txt){ e.target.value = it.t; return; }
                  if (txt === it.t) return;
                  salvarChecklist(t.checklist.map((x, k) => (k === i ? { t: txt, ok: x.ok } : { t: x.t, ok: x.ok })));
                }} />
              <button type="button" className="icon-btn" title="Remover item" aria-label={'Remover: ' + it.t}
                onClick={() => salvarChecklist(t.checklist.filter((_, k) => k !== i).map(x => ({ t: x.t, ok: x.ok })))}><X /></button>
            </div>
          ))}
        </div>
        <div className="ck-add">
          <input id="ocCheckNovo" maxLength={200} placeholder="Novo item (Enter para adicionar)" value={v.novoItem}
            onChange={e => setV(s => ({ ...s, novoItem: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter'){ e.preventDefault(); adicionarItem(); } }} />
          <button type="button" className="btn" id="ocCheckAdd" onClick={adicionarItem}>Adicionar</button>
        </div>
      </div>
      <div className="field oc-extra" id="ocNotasWrap" hidden={!dados.temChecklist}>
        <label htmlFor="ocNotaTxt">Anotações <span className="oc-n" id="ocNotasN">{notas.length ? notas.length : ''}</span></label>
        <BarraFormato alvo="ocNotaTxt" valor={v.nota} gravar={x => setV(s => ({ ...s, nota: x }))} />
        <div className="ck-add">
          <textarea id="ocNotaTxt" rows={2} maxLength={2000} placeholder="Ex.: ofício enviado por malote; aguardando resposta" aria-describedby="ocNotaDica" value={v.nota}
            onChange={e => setV(s => ({ ...s, nota: e.target.value }))}
            onKeyDown={e => { if (atalhoDeFormato(e, 'ocNotaTxt', v.nota, x => setV(s => ({ ...s, nota: x })))) return; if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing){ e.preventDefault(); anotar(false); } }} />
          <button type="button" className="btn" id="ocNotaAdd" onClick={() => anotar(false)}>Anotar</button>
        </div>
        <span className="field-hint" id="ocNotaDica">Enter registra a anotação (Shift+Enter pula linha). Se clicar em Salvar com algo escrito aqui, ela é salva junto.</span>
        <div className="anot-list" id="ocNotasList">
          {notas.map(a => edNota?.id === a.id ? (
            <div key={a.id} className="anot edit">
              <time>{formatarDataHora(a.criada)}</time>
              <BarraFormato alvo="ocNotaEdit" valor={edNota.txt} gravar={x => setEdNota(e => e && { ...e, txt: x })} />
              <textarea id="ocNotaEdit" rows={4} maxLength={2000} aria-label="Editar anotação" autoFocus value={edNota.txt}
                onChange={e => setEdNota({ id: a.id, txt: e.target.value })}
                onKeyDown={e => {
                  if (atalhoDeFormato(e, 'ocNotaEdit', edNota.txt, x => setEdNota(en => en && { ...en, txt: x }))) return;
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); salvarNotaEditada(); }
                  if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); setEdNota(null); }
                }} />
              <div className="anot-edit-acts">
                <button type="button" className="btn" onClick={() => setEdNota(null)}>Cancelar</button>
                <button type="button" className="btn primary" onClick={salvarNotaEditada}>Salvar</button>
              </div>
            </div>
          ) : (
            <div key={a.id} className="anot">
              <time>{formatarDataHora(a.criada)}</time><p><TextoNota texto={a.texto} /></p>
              <div className="anot-acts">
                <button type="button" className="icon-btn" title="Editar anotação" aria-label="Editar anotação" onClick={() => setEdNota({ id: a.id, txt: a.texto })}><Lapis /></button>
                <ExcluirAnotacao excluir={async () => {
                  const r = await banco.chamar('org_excluir_anotacao', { p_id: a.id });
                  if (!banco.ok(r)) return;
                  setDados(d => d && { ...d, anotacoes: d.anotacoes.filter(x => x.id !== a.id) });
                  avisar('Anotação excluída');
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="field-hint" id="ocExtraDica" hidden={!dados.temChecklist}>O checklist e as anotações são salvos na hora.</span>
      <span className="field-hint" id="ocInfo">{info.join(' · ')}</span>
      <div className="sheet-actions">
        <button type="button" className={'btn ghost' + (armado ? ' armed' : '')} id="ocExcluir" hidden={!!t && protegida(t, pessoa)} onClick={excluir}>{armado ? 'Confirmar exclusão' : 'Excluir'}</button>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button type="button" className="btn" id="ocCancelar" onClick={fechar}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={gravando}>Salvar</button>
        </div>
      </div>
    </form>
  );
}
