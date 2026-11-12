'use client';
// Caixa aberta: frente da caixa com a etiqueta, "Fora desta caixa" (devolver) e as pastas dentro dela.
import { useState } from 'react';
import { ARQUIVADO, DESARQUIVADO, PARA_DESARQUIVAR, REMETIDO, SITUACOES, textoLocal, type Processo } from '@/lib/arquivo';
import { useArq } from './Arquivo';
import { Carimbo, Icone, Vazio } from './Pecas';

export function TelaCaixa({ id }: { id: string }){
  const { d, abrirProc, abrir, aviso, setPreCadastro } = useArq();
  const [sel, setSel] = useState<Set<string> | null>(null);
  const c = d.caixasM.get(id);
  if (!c) return <Vazio titulo="Caixa não encontrada."><a className="aq-link" href="#prateleiras">Voltar às prateleiras</a></Vazio>;
  const ps = (d.porCaixa.get(c.id) || []).slice().sort((a, b) => (parseInt(a.codigo) || 0) - (parseInt(b.codigo) || 0) || a.codigo.localeCompare(b.codigo));
  const foraLista = c.secretaria ? [] : ps.filter(p => p.situacao === PARA_DESARQUIVAR || p.situacao === DESARQUIVADO || p.situacao === REMETIDO);
  const emprestados = d.processos.filter(p => !p.excluido && p.origem_id === c.id).length;
  const l = c.locais[0];
  const lista = () => [...(sel || [])].map(x => d.procsM.get(x)).filter(Boolean) as Processo[];

  const devolver = async (p: Processo) => {
    const desf = await d.mudarProcessos([{ p, novo: { situacao: ARQUIVADO, com_quem: '', destino: '' }, texto: (p.situacao === PARA_DESARQUIVAR ? 'Desarquivamento cancelado: fica na caixa ' : 'Voltou para a caixa ') + c.nome }]);
    if (desf) aviso('Processo ' + p.codigo + ' de volta à caixa ' + c.nome, desf);
  };
  const devolverVarios = async () => {
    const ls = lista().filter(p => p.situacao === DESARQUIVADO || p.situacao === REMETIDO);
    const desf = await d.mudarProcessos(ls.map(p => ({ p, novo: { situacao: ARQUIVADO, com_quem: '', destino: '' }, texto: 'Voltou para a caixa ' + c.nome })));
    if (desf){ aviso(ls.length + ' processo' + (ls.length === 1 ? '' : 's') + ' de volta à caixa ' + c.nome, desf); setSel(null); }
  };
  const devolverOrigem = async () => {
    const ls = lista().filter(p => p.origem_id);
    const desf = await d.mudarProcessos(ls.map(p => ({ p, novo: { situacao: ARQUIVADO, caixa_id: p.origem_id!, origem_id: null }, texto: 'Voltou de ' + c.nome + ' para a caixa ' + (d.caixasM.get(p.origem_id!)?.nome || '') })));
    if (desf){ aviso(ls.length + ' processo' + (ls.length === 1 ? '' : 's') + ' devolvido' + (ls.length === 1 ? '' : 's') + ' às caixas de origem', desf); setSel(null); }
  };

  return (
    <section className="aq-pilha" aria-labelledby="aq-titulo-cx">
      <a className="aq-voltar" href="#prateleiras"><Icone n="volta" t={16} />Prateleiras</a>
      <div className="aq-cab-caixa">
        <div className="aq-frente-caixa">
          <div className={'aq-caixa-desenho' + (c.secretaria ? ' aq-sec' : '')} aria-hidden="true"><div className="aq-jan"><small>{c.secretaria ? 'SECRETARIA' : 'CAIXA'}</small>{c.nome}</div><span className="aq-furo" /></div>
          <div className="aq-pilha" style={{ gap: 6 }}>
            <span className="aq-sobrelinha">{c.secretaria ? 'Estante da Outra Secretaria' : l ? 'Prateleira ' + l[0] + ' · Fileira ' + l[1] : 'Sem prateleira anotada'}</span>
            <h1 id="aq-titulo-cx">{c.secretaria ? (c.nome === 'Não informada' ? 'Secretaria não informada' : c.nome) : 'Caixa ' + c.nome}</h1>
            <p className="aq-sub">{c.secretaria
              ? ps.length + ' processos emprestados' + (c.nome === 'Não informada' ? ' sem secretaria anotada na planilha. Selecione e use “Trocar de secretaria” para separar.' : ' a esta secretaria.') + ' Cada um volta para a caixa de onde veio.'
              : <>{ps.length} processos{foraLista.length ? ' · ' + foraLista.length + ' fora da caixa' : ''}{emprestados ? <> · <a className="aq-link" href="#prateleiras">{emprestados} em outra secretaria</a></> : null}</>}</p>
          </div>
        </div>
        <div className="aq-fila">
          {!c.secretaria && <button type="button" className="aq-btn" onClick={() => abrir({ tipo: 'lugar', caixa: c })}><Icone n="estante" t={16} />Mudar de lugar</button>}
          {(!c.secretaria || c.nome !== 'Não informada') && <button type="button" className="aq-btn" onClick={() => abrir({ tipo: 'nome', caixa: c })}>{c.secretaria ? 'Renomear secretaria' : 'Renomear'}</button>}
          {!c.secretaria && <button type="button" className="aq-btn aq-prim" onClick={() => { setPreCadastro({ cx: c.nome }); location.hash = 'cadastrar'; }}><Icone n="camera" t={16} />Cadastrar aqui</button>}
        </div>
      </div>
      {c.locais.length > 1 && <div className="aq-aviso aq-amarelo"><Icone n="alerta" t={16} /><span>A planilha anota esta caixa em dois lugares: {textoLocal(c)}. Confira e toque em “Mudar de lugar” para deixar o certo.</span></div>}
      {!c.locais.length && !c.secretaria && <div className="aq-aviso aq-amarelo"><Icone n="alerta" t={16} /><span>A planilha não diz em que prateleira esta caixa está. Quem achar, toque em “Mudar de lugar” e anote.</span></div>}

      {foraLista.length > 0 && (
        <div className="aq-livro" id="aq-cx-fora">
          <div className="aq-cab-card"><h2>Fora desta caixa</h2><span className="aq-sub" style={{ fontSize: 13 }}>Quando a pasta voltar, toque em Devolver.</span></div>
          <div className="aq-linhas">
            {foraLista.map(p => (
              <div key={p.id} className="aq-saida-item">
                <button type="button" className="aq-abre" onClick={() => abrirProc(p.id)}><span className="aq-t">{p.codigo}</span><div className="aq-d">{p.com_quem ? 'com ' + p.com_quem + (p.destino ? ' · ' + p.destino : '') : p.destino || SITUACOES[p.situacao]}</div></button>
                <Carimbo s={p.situacao} />
                {p.situacao === PARA_DESARQUIVAR && <button type="button" className="aq-btn aq-peq" onClick={() => abrirProc(p.id, 'saida')}>Registrar saída</button>}
                <button type="button" className="aq-btn aq-peq aq-prim" onClick={() => devolver(p)}>Devolver</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={'aq-gaveta-pastas' + (sel ? ' aq-selecionando' : '')} id="aq-cx-card">
        <div className="aq-cab-card"><h2>{c.secretaria ? 'Pastas emprestadas' : 'Pastas dentro da caixa'}</h2>
          <div className="aq-fila">
            {!c.secretaria && <div className="aq-legenda"><span><i style={{ background: 'var(--c0)' }} />Arquivado</span><span><i style={{ background: 'var(--c3)' }} />Fora da caixa</span></div>}
            {ps.length > 0 && <button type="button" className="aq-btn aq-peq" onClick={() => setSel(sel ? null : new Set())}>{sel ? 'Cancelar seleção' : 'Selecionar vários'}</button>}
          </div>
        </div>
        {ps.length ? (
          <div className="aq-grade-procs">
            {ps.map(p => {
              const orig = p.origem_id ? d.caixasM.get(p.origem_id) : undefined;
              return (
                <button key={p.id} type="button" className={'aq-proc aq-s' + p.situacao + (sel?.has(p.id) ? ' aq-marcado' : '')} title={SITUACOES[p.situacao] + (orig ? ' · veio da caixa ' + orig.nome : '')}
                  onClick={() => { if (sel){ const s = new Set(sel); if (s.has(p.id)) s.delete(p.id); else s.add(p.id); setSel(s); } else abrirProc(p.id); }}>
                  <span className="aq-chk" /><i />{p.codigo}
                  {c.secretaria && orig && <small style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 11, opacity: .75 }}>cx {orig.nome}</small>}
                </button>
              );
            })}
          </div>
        ) : <div className="aq-vazio">Caixa vazia.{!c.secretaria && ' Toque em “Cadastrar aqui” para pôr o primeiro processo.'}</div>}
      </div>

      {sel && (
        <div className="aq-barra-lote">
          <b>{sel.size} selecionado{sel.size === 1 ? '' : 's'}</b><span style={{ flex: 1 }} />
          <button type="button" className="aq-btn aq-peq" onClick={() => setSel(new Set(ps.map(p => p.id)))}>Todos</button>
          <button type="button" className="aq-btn aq-peq" disabled={!sel.size} onClick={() => abrir({ tipo: 'remeter', lista: lista(), depois: () => setSel(null) })}>Remeter</button>
          {c.secretaria
            ? <>
              <button type="button" className="aq-btn aq-peq" disabled={!sel.size} onClick={devolverOrigem}>Devolver às caixas</button>
              <button type="button" className="aq-btn aq-peq" disabled={!sel.size} onClick={() => abrir({ tipo: 'secretaria', lista: lista(), depois: () => setSel(null) })}>Trocar de secretaria</button>
            </>
            : <>
              <button type="button" className="aq-btn aq-peq" disabled={!lista().some(p => p.situacao === DESARQUIVADO || p.situacao === REMETIDO)} onClick={devolverVarios}>Devolver à caixa</button>
              <button type="button" className="aq-btn aq-peq" disabled={!sel.size} onClick={() => abrir({ tipo: 'secretaria', lista: lista(), depois: () => setSel(null) })}>Mandar para secretaria</button>
            </>}
          <button type="button" className="aq-btn aq-peq aq-prim" disabled={!sel.size} onClick={() => abrir({ tipo: 'mover', lista: lista(), depois: () => setSel(null) })}>Trocar de caixa</button>
        </div>
      )}
    </section>
  );
}

export { Carimbo };
