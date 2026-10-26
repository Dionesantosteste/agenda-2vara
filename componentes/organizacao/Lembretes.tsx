'use client';
// Aba Lembretes: o que lembrar hoje, o que ficou atrasado e o que vem nos próximos dias
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { chaveDoDia, dataPorExtenso } from '@/lib/datas';
import { corrige, diaMes, diasAte, gruposDeLembretes, horaDe, paraSalvarLembrete, type Dados, type Lembrete } from '@/lib/organizacao';
import { useAviso } from '@/componentes/Avisos';
import { Editavel } from './Editavel';
import type { Banco } from './Organizacao';

const X = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const dois = (n: number) => (n < 10 ? '0' : '') + n;

type Opcoes = { comData?: boolean; late?: boolean; next?: boolean };

export function Lembretes({ dados, setDados, hoje, banco }: { dados: Dados; setDados: Dispatch<SetStateAction<Dados | null>>; hoje: Date; banco: Banco }){
  const avisar = useAviso();
  const [v, setV] = useState({ texto: '', data: chaveDoDia(new Date()), hora: '' });
  const textoRef = useRef<HTMLInputElement>(null);
  const g = gruposDeLembretes(dados.lembretes, hoje);

  const salvar = (l: Omit<Lembrete, 'id'> & { id?: string }) => banco.chamar('org_salvar_lembrete', paraSalvarLembrete(l));
  const mudar = (id: string, patch: Partial<Lembrete>) => setDados(d => d && { ...d, lembretes: d.lembretes.map(x => (x.id === id ? { ...x, ...patch } : x)) });

  async function adicionar(){
    const texto = v.texto.trim();
    if (!texto || !v.data) return;
    const r = await salvar({ texto, data: new Date(v.data + 'T00:00'), hora: v.hora, processo: '', feitoEm: null });
    if (!banco.ok(r)) return;
    setV(s => ({ ...s, texto: '', hora: '' }));
    avisar('Lembrete adicionado');
    await banco.recarregar();
    textoRef.current?.focus();
  }

  // função comum (e não componente), para a linha não ser recriada enquanto a pessoa edita o texto
  function linha(l: Lembrete, o: Opcoes){
    const quando = o.comData ? <>{diaMes(l.data)}{l.hora && <small>{l.hora}</small>}</> : (l.hora || <small>sem hora</small>);
    const dd = diasAte(l.data, hoje);
    return (
      <div key={l.id} className={'rem' + (l.feitoEm ? ' done' : '') + (o.next ? ' now' : '') + (o.late ? ' late' : '')}>
        <time>{quando}</time>
        <div style={{ minWidth: 0 }}>
          <div className="t-title">
            <Editavel className="editable" dataEdit="lembrete" titulo="Clique para editar" texto={l.texto}
              aoSalvar={async novo => {
                const texto = corrige(novo);
                mudar(l.id, { texto });
                const r = await salvar({ ...l, texto });
                if (banco.ok(r)) avisar('Lembrete atualizado'); else await banco.recarregar();
              }} />
          </div>
          {(o.next || o.late || l.feitoEm || o.comData) && (
            <div className="t-meta">
              {o.next && <span className="next">Próximo</span>}
              {o.late && !o.comData && <span className="late">Horário passou</span>}
              {o.late && o.comData && <span className="late">Atrasado {-dd} {dd === -1 ? 'dia' : 'dias'}</span>}
              {o.comData && !o.late && <span>{dd === 1 ? 'Amanhã' : 'Em ' + dd + ' dias'}</span>}
              {l.feitoEm && <span className="doneat">Feito às {dois(l.feitoEm.getHours())}:{dois(l.feitoEm.getMinutes())}</span>}
            </div>
          )}
        </div>
        <div className="t-side">
          <button type="button" className="btn" data-act="lem-feito" onClick={async () => {
            const r = await salvar({ ...l, feitoEm: l.feitoEm ? null : new Date() });
            if (banco.ok(r)) await banco.recarregar();
          }}>{l.feitoEm ? 'Desfazer' : 'Concluir'}</button>
          <button type="button" className="icon-btn" data-act="lem-excluir" title="Excluir lembrete" aria-label="Excluir lembrete" onClick={async () => {
            const r = await banco.chamar('org_excluir_lembrete', { p_id: l.id });
            if (banco.ok(r)){ avisar('Lembrete excluído'); await banco.recarregar(); }
          }}><X /></button>
        </div>
      </div>
    );
  }

  return (
    <div id="orgPaneLembretes" className="org-pane">
      <div className="org-stats" id="orgLemStats">
        <div className="ostat"><b>{g.pendentesHoje.length}</b><span>para hoje</span></div>
        <div className={'ostat' + (g.passou ? ' alert' : '')}><b>{g.passou}</b><span>horário passou</span></div>
        <div className="ostat"><b>{g.proximos.length}</b><span>próximos dias</span></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>Lembretes</h2><span>clique no texto para editar</span></div>
        <form className="org-add" id="orgLemForm" autoComplete="off" onSubmit={e => { e.preventDefault(); adicionar(); }}>
          <input className="org-in grow" id="orgLemTexto" ref={textoRef} maxLength={200} placeholder="Lembrar de…" required value={v.texto} onChange={e => setV(s => ({ ...s, texto: e.target.value }))} />
          <input className="org-in" id="orgLemData" type="date" aria-label="Data" required value={v.data} onChange={e => setV(s => ({ ...s, data: e.target.value }))} />
          <input className="org-in" id="orgLemHora" type="time" aria-label="Hora (opcional)" value={v.hora} onChange={e => setV(s => ({ ...s, hora: e.target.value }))} />
          <button type="submit" className="btn primary">Adicionar</button>
        </form>
        <div className="tgroup" id="orgLemList">
          {g.atrasados.length > 0 && <>
            <div className="tgroup-title">Atrasados <span className="n">{g.atrasados.length}</span></div>
            {g.atrasados.map(l => linha(l, { comData: true, late: true }))}
          </>}
          <div className="tgroup-title">Hoje <span className="n">{dataPorExtenso(hoje)}</span></div>
          {g.deHoje.length
            ? g.deHoje.map(l => linha(l, { next: l === g.proximo, late: g.horarioPassou(l) }))
            : <div className="org-empty">Nenhum lembrete para hoje.</div>}
          {g.proximos.length > 0 && <>
            <div className="tgroup-title">Próximos dias <span className="n">{g.proximos.length}</span></div>
            {g.proximos.map(l => linha(l, { comData: true }))}
          </>}
        </div>
      </div>
    </div>
  );
}
