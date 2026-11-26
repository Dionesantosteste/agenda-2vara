'use client';
// Conferir uma prateleira por foto: a IA lê as caixas de cada fileira, a tela compara com o que está
// anotado no sistema e, depois de a pessoa conferir e corrigir, grava os lugares (com histórico e Desfazer).
// A fileira A é a de BAIXO; a IA lê de cima para baixo e a conversão fica em letraFileira (lib/arquivo).
import { useState } from 'react';
import { compararFoto, letraFileira, type ItemFoto, type Local } from '@/lib/arquivo';
import { supabase } from '@/lib/supabase';
import { useArq } from './Arquivo';
import { reduzir } from './Cadastrar';
import { juntar } from './Janelas';
import { Icone } from './Pecas';
import type { Desfazer } from './useArquivo';

type Linha = { id: number; nome: string; f: string; duvida: string };   // duvida: '' ou o que a IA achou duvidoso
type Leitura = { etiqueta_estante?: string; niveis?: { caixas?: { nome?: string; legivel?: string; observacao?: string }[] }[]; observacao?: string };

let seq = 0;
const lugares = (ls: Local[]) => ls.map(l => 'P.' + l[0] + ' F.' + l[1]).join(' e ');

function situacao(it: ItemFoto): string {
  if (it.estado === 'certo') return 'no lugar';
  if (it.estado === 'mudou') return it.caixa?.locais.length ? 'estava em ' + lugares(it.caixa.locais) : 'sem lugar anotado';
  if (it.estado === 'nova') return 'caixa nova';
  if (it.estado === 'repetida') return 'repetida na foto';
  return it.nome ? 'fileira inválida' : 'falta o número';
}

export function FotoPrateleira({ pInicial, fechar }: { pInicial: number | null; fechar: (p?: number) => void }){
  const { d, aviso } = useArq();
  const [p, setP] = useState(pInicial ? String(pInicial) : '');
  const [foto, setFoto] = useState<{ arq: File; url: string } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [msg, setMsg] = useState({ cls: '', txt: 'Tire a foto de frente, com a estante inteira, do topo até a fileira de baixo.' });
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [etiqueta, setEtiqueta] = useState('');
  const [criarNovas, setCriarNovas] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const pn = parseInt(p, 10) > 0 ? parseInt(p, 10) : 0;

  async function ler(arq: File){
    setLendo(true); setMsg({ cls: '', txt: 'Lendo as etiquetas… leva de 20 a 50 segundos.' });
    try {
      const sessao = (await supabase().auth.getSession()).data.session;
      const img = await reduzir(arq);
      const r = await fetch('/api/arquivo/ler-prateleira', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (sessao?.access_token || '') }, body: JSON.stringify({ imagem: img, tipo: 'image/jpeg' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok){ setMsg({ cls: r.status === 503 ? '' : 'aq-erro', txt: j.erro || 'Não consegui ler a foto. Tente de novo.' }); return; }
      const l: Leitura = j.leitura || {};
      const niveis = (l.niveis || []).filter(n => n.caixas?.length);
      const novas: Linha[] = niveis.flatMap((n, i) => (n.caixas || []).map(c => ({
        id: ++seq, nome: String(c.nome || '').trim().toUpperCase(), f: letraFileira(i, niveis.length),
        duvida: c.legivel === 'duvida' ? (c.observacao || 'etiqueta difícil de ler') : ''
      })));
      setLinhas(novas); setEtiqueta(String(l.etiqueta_estante || '').trim());
      if (!p && /^\d+$/.test(String(l.etiqueta_estante || '').trim())) setP(String(l.etiqueta_estante).trim());
      setMsg({ cls: 'aq-ok', txt: 'Li ' + novas.length + ' caixas em ' + niveis.length + ' fileiras. Confira os números antes de gravar.' + (l.observacao ? ' ' + l.observacao : '') });
    } catch (e){
      setMsg({ cls: 'aq-erro', txt: 'Não consegui ler a foto (sem conexão?). Tente de novo.' });
    } finally { setLendo(false); }
  }

  const mudarLinha = (id: number, novo: Partial<Linha>) => setLinhas(ls => ls && ls.map(x => (x.id === id ? { ...x, ...novo } : x)));
  const tirar = (id: number) => setLinhas(ls => ls && ls.filter(x => x.id !== id));
  const somar = (f: string) => setLinhas(ls => [...(ls || []), { id: ++seq, nome: '', f, duvida: '' }]);

  const cmp = linhas && pn ? compararFoto(pn, linhas, d.caixas) : null;
  const itens = cmp?.itens || [];
  const conta = (e: ItemFoto['estado']) => itens.filter(i => i.estado === e).length;
  const nMudou = conta('mudou'), nNova = conta('nova'), nInval = conta('invalida');
  const fileiras = linhas ? [...new Set(linhas.map(l => l.f).filter(f => /^[A-Z]{1,2}$/.test(f)))].sort().reverse() : [];
  const etiquetaDiferente = !!etiqueta && /^\d+$/.test(etiqueta) && pn > 0 && +etiqueta !== pn;
  const aGravar = nMudou + (criarNovas ? nNova : 0);

  async function gravar(){
    if (!cmp || salvando) return;
    if (!pn){ aviso('Diga qual é a prateleira da foto'); return; }
    if (nInval){ aviso('Corrija ou tire as caixas sem número ou com fileira inválida'); return; }
    if (!aGravar){ aviso('Nada para gravar: todas as caixas já estão no lugar'); fechar(pn); return; }
    setSalvando(true);
    const desfs: (Desfazer | null)[] = [];
    let criadas = 0;
    for (const it of cmp.itens){
      if (it.estado === 'mudou' && it.caixa){
        const c = d.caixasM.get(it.caixa.id) || it.caixa;
        desfs.push(await d.mudarCaixa(c, { locais: [[pn, it.f]] }, 'Caixa ' + c.nome + ' conferida por foto: prateleira ' + pn + ', fileira ' + it.f + (c.locais.length ? ' (estava em ' + lugares(c.locais) + ')' : '')));
      } else if (it.estado === 'nova' && criarNovas){
        if (await d.criarCaixa(it.nome, [[pn, it.f]])) criadas++;
      }
    }
    setSalvando(false);
    const partes = [nMudou && nMudou + (nMudou === 1 ? ' caixa mudou' : ' caixas mudaram') + ' de lugar', criadas && criadas + (criadas === 1 ? ' caixa criada' : ' caixas criadas')].filter(Boolean);
    aviso('Prateleira ' + pn + ' conferida: ' + partes.join(', '), juntar(...desfs));
    fechar(pn);
  }

  return (
    <div className="aq-card aq-pad aq-pilha aq-fp" id="aq-fp">
      <div className="aq-fila" style={{ justifyContent: 'space-between' }}>
        <div><h2>Conferir prateleira por foto</h2><p className="aq-sub" style={{ fontSize: 13.5 }}>A IA lê as etiquetas; você confere e grava. A fileira <b>A</b> é a de baixo.</p></div>
        <button type="button" className="aq-btn aq-leve" onClick={() => fechar()}><Icone n="x" t={16} />Fechar</button>
      </div>
      <div className="aq-fp-grade">
        <div className="aq-pilha">
          <div className="aq-campo" style={{ maxWidth: 160 }}><label htmlFor="aq-fp-p">Prateleira</label>
            <input id="aq-fp-p" className="aq-mono" inputMode="numeric" placeholder="Ex.: 24" value={p} onChange={e => setP(e.target.value.replace(/\D/g, ''))} /></div>
          <label className="aq-camera aq-fp-camera" htmlFor="aq-fotoprat">
            <div className="aq-chamada"><Icone n="camera" t={32} /><b>Fotografar a estante</b><span>No celular abre a câmera.</span></div>
            {foto && <img src={foto.url} alt="Foto da estante" />}
            {lendo && <div className="aq-lendo">Lendo as etiquetas…</div>}
          </label>
          <input id="aq-fotoprat" type="file" accept="image/*" capture="environment" hidden onChange={e => {
            const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
            if (foto) URL.revokeObjectURL(foto.url);
            setFoto({ arq: f, url: URL.createObjectURL(f) }); ler(f);
          }} />
          <div className="aq-fila" style={{ justifyContent: 'space-between' }}>
            <div id="aq-fp-estado" className={'aq-estado-ia ' + msg.cls}>{msg.txt}</div>
            {foto && !lendo && <button type="button" className="aq-btn aq-peq" onClick={() => ler(foto.arq)}>Ler de novo</button>}
          </div>
        </div>

        {linhas && (
          <div className="aq-pilha">
            {etiquetaDiferente && <div className="aq-aviso aq-amarelo" role="alert"><Icone n="alerta" t={16} /><span>A plaquinha da foto diz <b>{etiqueta}</b>, mas você escolheu a prateleira <b>{pn}</b>. Confira antes de gravar.</span></div>}
            {!pn && <div className="aq-aviso aq-amarelo" role="alert"><Icone n="alerta" t={16} /><span>Diga qual é a prateleira da foto para comparar com o sistema.</span></div>}
            {fileiras.map(f => (
              <div key={f} className="aq-fp-fileira" data-f={f}>
                <b className="aq-fp-letra" title={'Fileira ' + f}>{f}</b>
                <div className="aq-fp-caixas">
                  {linhas.map((l, i) => l.f !== f ? null : (
                    <div key={l.id} className={'aq-fp-cx aq-fp-' + (itens[i]?.estado || 'certo') + (l.duvida ? ' aq-fp-duvida' : '')} title={l.duvida || undefined}>
                      <div className="aq-fila" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <input className="aq-mono aq-fp-nome" aria-label={'Número da caixa na fileira ' + f} value={l.nome} placeholder="nº" onChange={e => mudarLinha(l.id, { nome: e.target.value.toUpperCase(), duvida: '' })} />
                        <input className="aq-mono aq-fp-f" aria-label={'Fileira da caixa ' + l.nome} maxLength={2} value={l.f} onChange={e => mudarLinha(l.id, { f: e.target.value.toUpperCase() })} />
                        <button type="button" className="aq-fp-tirar" aria-label={'Tirar a caixa ' + l.nome + ' da lista'} onClick={() => tirar(l.id)}><Icone n="x" t={14} /></button>
                      </div>
                      <small>{itens[i] ? situacao(itens[i]) : ''}{l.duvida ? ' · conferir etiqueta' : ''}</small>
                    </div>
                  ))}
                  <button type="button" className="aq-btn aq-peq aq-leve" onClick={() => somar(f)}>+ caixa</button>
                </div>
              </div>
            ))}
            {linhas.some(l => !/^[A-Z]{1,2}$/.test(l.f)) && (
              <div className="aq-fp-fileira"><b className="aq-fp-letra">?</b><div className="aq-fp-caixas">
                {linhas.map((l, i) => /^[A-Z]{1,2}$/.test(l.f) ? null : (
                  <div key={l.id} className="aq-fp-cx aq-fp-invalida"><div className="aq-fila" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <input className="aq-mono aq-fp-nome" aria-label="Número da caixa" value={l.nome} onChange={e => mudarLinha(l.id, { nome: e.target.value.toUpperCase() })} />
                    <input className="aq-mono aq-fp-f" aria-label={'Fileira da caixa ' + l.nome} maxLength={2} value={l.f} onChange={e => mudarLinha(l.id, { f: e.target.value.toUpperCase() })} />
                    <button type="button" className="aq-fp-tirar" aria-label={'Tirar a caixa ' + l.nome + ' da lista'} onClick={() => tirar(l.id)}><Icone n="x" t={14} /></button>
                  </div><small>{itens[i] ? situacao(itens[i]) : 'fileira inválida'}</small></div>
                ))}</div></div>
            )}
            {cmp && (
              <div className="aq-fp-resumo" id="aq-fp-resumo">
                <span><i className="aq-fp-bola aq-fp-certo" />{conta('certo')} no lugar</span>
                <span><i className="aq-fp-bola aq-fp-mudou" />{nMudou} {nMudou === 1 ? 'muda' : 'mudam'} de lugar</span>
                <span><i className="aq-fp-bola aq-fp-nova" />{nNova} {nNova === 1 ? 'nova' : 'novas'}</span>
                {(nInval + conta('repetida')) > 0 && <span><i className="aq-fp-bola aq-fp-invalida" />{nInval + conta('repetida')} para corrigir</span>}
              </div>
            )}
            {cmp && cmp.ausentes.length > 0 && (
              <div className="aq-aviso" id="aq-fp-ausentes"><Icone n="alerta" t={16} /><span><b>Anotadas na prateleira {pn}, mas não aparecem na foto:</b>{' '}
                {cmp.ausentes.map((c, i) => <span key={c.id}>{i ? ', ' : ''}<a href={'#cx-' + c.id}>{c.nome}</a> ({c.locais.filter(l => l[0] === pn).map(l => 'F.' + l[1]).join('/')})</span>)}.
                {' '}Nada será mudado nelas. Se saíram desta prateleira, anote o novo lugar na caixa.</span></div>
            )}
            {nNova > 0 && <label className="aq-fila" style={{ fontSize: 14 }}><input type="checkbox" checked={criarNovas} onChange={e => setCriarNovas(e.target.checked)} />Criar as {nNova} caixas novas nesta prateleira</label>}
            <div className="aq-acoes">
              <button type="button" className="aq-btn" onClick={() => fechar()}>Cancelar</button>
              <button type="button" className="aq-btn aq-prim" id="aq-fp-gravar" disabled={salvando || !pn} onClick={gravar}>
                {salvando ? 'Gravando…' : aGravar ? 'Gravar ' + aGravar + (aGravar === 1 ? ' mudança' : ' mudanças') : 'Concluir'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
