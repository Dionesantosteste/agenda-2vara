'use client';
// Fichário: "Onde está o processo?" (busca) e, sem busca, o Livro de saídas e os números do arquivo.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buscar, destaque, pendenciasDe, ordemCaixa, ARQUIVADO, DESARQUIVADO, PARA_DESARQUIVAR, REMETIDO, type Processo } from '@/lib/arquivo';
import { useArq } from './Arquivo';
import { contarPendencias } from './Conferir';
import { Carimbo, Icone, LinhasFicha, Vazio, linhasDoLocal } from './Pecas';

const CHAVE_RECENTES = 'arquivo-buscas-recentes';
const lerRecentes = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]'); } catch (e) { return []; } };
const TITULOS = ['Igual a ', 'Começam com ', 'Contêm ', 'Nas partes, classe ou observação: '];

export function Buscar(){
  const { d, abrirProc, aviso, setPreCadastro } = useArq();
  const [q, setQ] = useState('');
  const [recentes, setRecentes] = useState<string[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { setRecentes(lerRecentes()); if (matchMedia('(min-width: 821px)').matches) campo.current?.focus(); }, []);
  // "/" leva para a busca
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName || '') && !document.querySelector('.aq-app dialog[open]')){ e.preventDefault(); campo.current?.focus(); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);

  const r = useMemo(() => buscar(q, d.indice, d.caixas.filter(c => !c.secretaria || (d.porCaixa.get(c.id) || []).length)), [q, d.indice, d.caixas, d.porCaixa]);
  const lembrar = () => {
    const t = q.trim(); if (!t) return;
    const l = [t, ...recentes.filter(x => x !== t)].slice(0, 6); setRecentes(l);
    try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(l)); } catch (e) { /* sem armazenamento: só não lembra */ }
  };
  const devolver = async (p: Processo) => {
    const cx = d.caixasM.get(p.caixa_id);
    const texto = (p.situacao === PARA_DESARQUIVAR ? 'Desarquivamento cancelado: fica na caixa ' : 'Voltou para a caixa ') + (cx?.nome || '');
    const desf = await d.mudarProcessos([{ p, novo: { situacao: ARQUIVADO, com_quem: '', destino: '' }, texto }]);
    if (desf) aviso('Processo ' + p.codigo + ' de volta à caixa ' + (cx?.nome || ''), desf);
  };

  const ex = recentes.length ? recentes : ['30208', '224/87', 'cx 1320'];
  return (
    <section className="aq-pilha" style={{ gap: 24 }} aria-labelledby="aq-titulo-busca">
      <div className="aq-heroi">
        <span className="aq-sobrelinha">Fichário</span>
        <h1 id="aq-titulo-busca">Onde está o <em>processo</em>?</h1>
        <p className="aq-sub">Digite o código da capa, a numeração antiga ou o número da caixa.</p>
        <label className="aq-busca" htmlFor="aq-q">
          <Icone n="busca" t={22} />
          <input id="aq-q" ref={campo} type="search" inputMode="search" autoComplete="off" spellCheck={false} placeholder="Ex.: 30208, 224/87 ou cx 1320" aria-label="Buscar processo ou caixa"
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter'){ const b = document.querySelector<HTMLButtonElement>('#aq-resultados .aq-res'); b?.click(); } if (e.key === 'Escape') setQ(''); }} />
          {q ? <button type="button" className="aq-limpar" aria-label="Limpar busca" onClick={() => { setQ(''); campo.current?.focus(); }}><Icone n="x" t={16} /></button> : <kbd>/</kbd>}
        </label>
        <div className="aq-chips"><span>{recentes.length ? 'Buscas recentes:' : 'Experimente:'}</span>
          {ex.map(t => <button key={t} type="button" className="aq-chip" onClick={() => { setQ(t); campo.current?.focus(); }}>{t}</button>)}
        </div>
      </div>

      <div id="aq-resultados" className="aq-resultados" aria-live="polite">
        {r.modo === 'caixas' && (r.caixas.length ? r.caixas.map(c => (
          <button key={c.id} type="button" className="aq-res aq-caixa-res" onClick={() => { lembrar(); location.hash = 'cx-' + c.id; }}>
            <div className="aq-topo-ficha"><span className="aq-cod">{c.secretaria ? c.nome : 'Caixa ' + c.nome}</span>{c.locais.length > 1 && <span className="aq-pill aq-dup">2 lugares</span>}</div>
            <LinhasFicha linhas={[...linhasDoLocal(c), ['Processos', (d.porCaixa.get(c.id) || []).length.toLocaleString('pt-BR')]]} />
          </button>
        )) : <Vazio titulo={'Nenhuma caixa ' + r.alvo + '.'}>Confira o número ou veja as <a className="aq-link" href="#prateleiras">prateleiras</a>.</Vazio>)}
        {r.modo === 'processos' && (r.total ? (
          <>
            {r.total > 1 && <div className="aq-contagem">{r.total > 40 ? r.total.toLocaleString('pt-BR') + ' códigos encontrados · mostrando os 40 mais próximos. Continue digitando para filtrar.' : r.total + ' encontrados'}</div>}
            {r.grupos.map(g => [
              <div key={'g' + g.tipo} className="aq-contagem aq-grupo-busca">{TITULOS[g.tipo]}<b className="aq-mono">{q.trim()}</b></div>,
              ...g.codigos.flatMap(cod => (d.indice.get(cod) || []).map(p => {
                const cx = d.caixasM.get(p.caixa_id);
                const pend = pendenciasDe(p, cx, d.indice);
                const dz = destaque(cod, r.trecho, r.exato);
                const orig = p.origem_id ? d.caixasM.get(p.origem_id) : undefined;
                const extras: [string, string][] = [];
                if (orig) extras.push(['Veio da', 'caixa ' + orig.nome]);
                if (p.classe) extras.push(['Classe', p.classe]);
                if (p.obs) extras.push(['Obs.', p.obs]);
                return (
                  <button key={p.id} type="button" className={'aq-res' + (pend.length ? ' aq-pendente' : '')} onClick={() => { lembrar(); abrirProc(p.id); }}>
                    <div className="aq-topo-ficha"><span className="aq-cod">{dz ? <>{dz[0]}<mark>{dz[1]}</mark>{dz[2]}</> : cod}</span><Carimbo s={p.situacao} /></div>
                    <LinhasFicha linhas={[...linhasDoLocal(cx), ...extras]} />
                    {(pend.length > 0 || p.com_quem || (p.situacao === REMETIDO && p.destino)) && (
                      <div className="aq-meta">
                        {pend.length > 0 && <span className="aq-aviso-ficha"><Icone n="alerta" t={13} />Conferir: {pend.join(' · ')}</span>}
                        {p.com_quem && <span>com {p.com_quem}</span>}
                        {p.situacao === REMETIDO && p.destino && <span>{p.destino}</span>}
                      </div>
                    )}
                  </button>
                );
              }))
            ])}
          </>
        ) : (
          <Vazio titulo={<>Nenhum processo com <span className="aq-mono">{q.trim()}</span>.</>}>
            Se ele está numa caixa e ainda não foi cadastrado, <a className="aq-link" href="#cadastrar" onClick={() => {
              const t = q.trim(); setPreCadastro(/^\d+$/.test(t) ? { cod: t } : t.includes('/') ? { num: t } : {});
            }}>cadastre agora</a>.
          </Vazio>
        ))}
      </div>

      {r.modo === 'vazio' && <Inicio devolver={devolver} />}
    </section>
  );
}

function Inicio({ devolver }: { devolver: (p: Processo) => void }){
  const { d, abrirProc } = useArq();
  const ativos = d.processos.filter(p => !p.excluido);
  const ordem = (a: Processo, b: Processo) => (parseInt(a.codigo) || 0) - (parseInt(b.codigo) || 0);
  const grupos: [string, Processo[]][] = [
    ['Desarquivados', ativos.filter(p => p.situacao === DESARQUIVADO).sort(ordem)],
    ['Para desarquivar', ativos.filter(p => p.situacao === PARA_DESARQUIVAR).sort(ordem)],
    ['Remetidos a outra vara', ativos.filter(p => p.situacao === REMETIDO).sort(ordem)]
  ];
  const temLivro = grupos.some(g => g[1].length);
  const normais = d.caixas.filter(c => !c.secretaria && (d.porCaixa.get(c.id) || []).length);
  const prats = new Set(normais.flatMap(c => c.locais.map(l => l[0]))).size + 1;
  const gaveta = (n: string, t: string, href?: string) => {
    const corpo = <><span className="aq-janela">{n}</span><span>{t}</span><i className="aq-puxador" /></>;
    return href ? <a className="aq-gaveta-num" href={href}>{corpo}</a> : <div className="aq-gaveta-num">{corpo}</div>;
  };
  return (
    <div id="aq-inicio" className={'aq-painel-inicio' + (temLivro ? '' : ' aq-so-numeros')}>
      {temLivro && (
        <div className="aq-livro" id="aq-livro">
          <div className="aq-cab-card"><h2>Livro de saídas</h2><span className="aq-sub" style={{ fontSize: 13 }}>Processos fora da caixa. Toque para devolver.</span></div>
          <div className="aq-linhas">
            {grupos.map(([t, ps]) => ps.length > 0 && [
              <div key={t} className="aq-grupo-rot aq-rot">{t} · {ps.length}</div>,
              ...ps.map(p => {
                const cx = d.caixasM.get(p.caixa_id);
                return (
                  <div key={p.id} className="aq-saida-item">
                    <button type="button" className="aq-abre" onClick={() => abrirProc(p.id)} title="Abrir a ficha do processo">
                      <span className="aq-t">{p.codigo}</span>
                      <div className="aq-d">caixa {cx?.nome}{cx?.locais[0] ? ' · P.' + cx.locais[0][0] + ' F.' + cx.locais[0][1] : ''}{p.com_quem ? ' · com ' + p.com_quem : ''}{p.destino ? ' · ' + p.destino : ''}</div>
                    </button>
                    <Carimbo s={p.situacao} />
                    {p.situacao === PARA_DESARQUIVAR && <button type="button" className="aq-btn aq-peq" onClick={() => abrirProc(p.id, 'saida')}>Registrar saída</button>}
                    <button type="button" className="aq-btn aq-peq aq-prim" onClick={() => devolver(p)}>{p.situacao === REMETIDO ? 'Voltou: devolver' : 'Devolver à caixa ' + (cx?.nome || '')}</button>
                  </div>
                );
              })
            ])}
          </div>
        </div>
      )}
      <div className="aq-card">
        <div className="aq-cab-card"><h2>O arquivo hoje</h2></div>
        <div className="aq-gaveteiro">
          {gaveta(d.indice.size.toLocaleString('pt-BR'), 'processos')}
          {gaveta(normais.length.toLocaleString('pt-BR'), 'caixas', '#prateleiras')}
          {gaveta(String(prats), 'prateleiras', '#prateleiras')}
          {gaveta(contarPendencias(d).toLocaleString('pt-BR'), 'para conferir', '#conferir')}
        </div>
      </div>
    </div>
  );
}

export { ordemCaixa };
