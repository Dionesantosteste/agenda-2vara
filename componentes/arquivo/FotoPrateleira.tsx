'use client';
// Conferir uma prateleira por foto: a IA lê as caixas de cada fileira, a tela compara com o que está anotado
// no sistema e, depois de a pessoa conferir e corrigir, grava o lugar e a SEQUÊNCIA das caixas (com histórico
// e Desfazer). A fileira A é a de BAIXO; a IA lê de cima para baixo e a conversão fica em letraFileira.
import { useState } from 'react';
import { compararFoto, letraFileira, letraMais, posicaoEm, sugerirLetras, type Caixa, type ItemFoto, type Local } from '@/lib/arquivo';
import { supabase } from '@/lib/supabase';
import { useArq } from './Arquivo';
import { Icone } from './Pecas';

type Linha = { id: number; nome: string; f: string; duvida: string };   // duvida: '' ou o que a IA achou duvidoso
type Leitura = { etiqueta_estante?: string; niveis?: { caixas?: { nome?: string; legivel?: string; observacao?: string }[] }[]; observacao?: string };

let seq = 0;
const LETRA = /^[A-Z]{1,2}$/;
const lugares = (ls: Local[]) => ls.map(l => 'P.' + l[0] + ' F.' + l[1]).join(' e ');
const LIMITE_ENVIO = 4_200_000;   // caracteres em base64, somando as fotos (limite de ~4,5 MB por pedido na Vercel)

// A foto inteira e as metades de cima e de baixo (com um pedaço repetido no meio), para a IA ler as etiquetas
// pequenas de perto. Tenta a resolução máxima que a IA aproveita (2576 px) e reduz só se passar do limite.
async function prepararFotos(arq: File): Promise<string[]> {
  const img = await createImageBitmap(arq);
  const W = img.width, H = img.height, meio = Math.round(H * 0.45);
  const cortes: [number, number, number, number][] = [[0, 0, W, H], [0, 0, W, H - meio], [0, meio, W, H - meio]];
  const jpeg = (c: [number, number, number, number], lado: number, q: number, ampliar: number) => {
    const esc = Math.min(ampliar, lado / Math.max(c[2], c[3]));
    const cv = document.createElement('canvas'); cv.width = Math.round(c[2] * esc); cv.height = Math.round(c[3] * esc);
    const g = cv.getContext('2d')!; g.imageSmoothingQuality = 'high';
    g.drawImage(img, c[0], c[1], c[2], c[3], 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', q).split(',')[1];
  };
  for (const [lado, q] of [[2576, 0.85], [2576, 0.72], [2000, 0.72], [1568, 0.7]] as const){
    const fotos = cortes.map((c, i) => jpeg(c, lado, q, i ? 2 : 1));   // as metades podem ser ampliadas até 2x
    if (fotos.reduce((n, x) => n + x.length, 0) <= LIMITE_ENVIO) return fotos;
  }
  return [jpeg(cortes[0], 1568, 0.7, 1)];
}

function situacao(it: ItemFoto, p: number): string {
  const c = it.caixa;
  if (it.estado === 'certo') return 'no lugar';
  if (it.estado === 'ordem'){ const era = c ? posicaoEm(c, p, it.f) : null; return era ? 'era a ' + era + 'ª, na foto é a ' + it.pos + 'ª' : 'sequência anotada: ' + it.pos + 'ª'; }
  if (it.estado === 'fileira') return 'sistema: F.' + c!.locais[0][1] + ' → foto: F.' + it.f;
  if (it.estado === 'mudou') return c?.locais.length ? 'estava em ' + lugares(c.locais) : 'sem lugar anotado';
  if (it.estado === 'nova') return 'caixa nova';
  if (it.estado === 'repetida') return 'repetida na foto';
  return it.nome ? 'fileira inválida' : 'falta o número';
}

export function FotoPrateleira({ pInicial, fechar }: { pInicial: number | null; fechar: (p?: number) => void }){
  const { d, aviso } = useArq();
  const [p, setP] = useState(pInicial ? String(pInicial) : '');
  const [foto, setFoto] = useState<{ arq: File; url: string } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [msg, setMsg] = useState({ cls: '', txt: 'Tire a foto de frente, com a estante inteira, do topo até a fileira de baixo, sem cortar as laterais.' });
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [nFil, setNFil] = useState(0);   // quantas fileiras a IA contou (inclusive as vazias)
  const [etiqueta, setEtiqueta] = useState('');
  const [criarNovas, setCriarNovas] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const pn = parseInt(p, 10) > 0 ? parseInt(p, 10) : 0;

  async function ler(arq: File){
    setLendo(true); setMsg({ cls: '', txt: 'Lendo as etiquetas… leva de 20 a 60 segundos.' });
    try {
      const sessao = (await supabase().auth.getSession()).data.session;
      const imagens = await prepararFotos(arq);
      const r = await fetch('/api/arquivo/ler-prateleira', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (sessao?.access_token || '') }, body: JSON.stringify({ imagens, tipo: 'image/jpeg' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok){ setMsg({ cls: r.status === 503 ? '' : 'aq-erro', txt: j.erro || 'Não consegui ler a foto. Tente de novo.' }); return; }
      const l: Leitura = j.leitura || {};
      const niveis = l.niveis || [];   // prateleira vazia também conta: é ela que acerta as letras
      const novas: Linha[] = niveis.flatMap((n, i) => (n.caixas || []).map(c => ({
        id: ++seq, nome: String(c.nome || '').trim().toUpperCase(), f: letraFileira(i, niveis.length),
        duvida: c.legivel === 'duvida' ? (c.observacao || 'etiqueta difícil de ler') : ''
      })));
      setLinhas(novas); setNFil(Math.min(niveis.length, 26)); setEtiqueta(String(l.etiqueta_estante || '').trim());
      if (!p && /^\d+$/.test(String(l.etiqueta_estante || '').trim())) setP(String(l.etiqueta_estante).trim());
      const vazias = niveis.filter(n => !n.caixas?.length).length;
      setMsg({ cls: 'aq-ok', txt: 'Li ' + novas.length + ' caixas em ' + niveis.length + ' fileiras' + (vazias ? ' (' + vazias + ' vazia' + (vazias > 1 ? 's' : '') + ')' : '') + '. Confira os números e as letras antes de gravar.' + (l.observacao ? ' ' + l.observacao : '') });
    } catch (e){
      setMsg({ cls: 'aq-erro', txt: 'Não consegui ler a foto (sem conexão?). Tente de novo.' });
    } finally { setLendo(false); }
  }

  const mudarLinha = (id: number, novo: Partial<Linha>) => setLinhas(ls => ls && ls.map(x => (x.id === id ? { ...x, ...novo } : x)));
  const tirar = (id: number) => setLinhas(ls => ls && ls.filter(x => x.id !== id));
  const somar = (f: string) => setLinhas(ls => [...(ls || []), { id: ++seq, nome: '', f, duvida: '' }]);
  // troca a letra de uma fileira inteira (se a nova letra já tiver caixas, as desta vão para o fim dela)
  const trocarLetra = (de: string, para: string) => setLinhas(ls => ls && [...ls.filter(x => x.f !== de), ...ls.filter(x => x.f === de).map(x => ({ ...x, f: para }))]);
  // desloca todas as letras uma para cima ou para baixo (quando a IA contou uma fileira a mais ou a menos)
  const deslocar = (dl: number) => {
    if (!linhas || linhas.some(x => LETRA.test(x.f) && !letraMais(x.f, dl))){ aviso(dl < 0 ? 'A fileira A já é a de baixo' : 'Não há letra acima'); return; }
    setLinhas(linhas.map(x => (LETRA.test(x.f) ? { ...x, f: letraMais(x.f, dl) } : x)));
    setNFil(n => Math.max(1, n + dl));
  };

  const cmp = linhas && pn ? compararFoto(pn, linhas, d.caixas) : null;
  const itens = cmp?.itens || [];
  const conta = (...es: ItemFoto['estado'][]) => itens.filter(i => es.includes(i.estado)).length;
  const nMuda = conta('mudou', 'fileira'), nOrdem = conta('ordem'), nNova = conta('nova'), nCorrigir = conta('invalida', 'repetida');
  const sugestoes = sugerirLetras(itens);
  const letras = new Set<string>(Array.from({ length: nFil }, (_, i) => letraFileira(i, nFil)));
  for (const l of linhas || []) if (LETRA.test(l.f)) letras.add(l.f);
  const fileiras = [...letras].sort((a, b) => b.length - a.length || b.localeCompare(a));
  const opcoes = Array.from({ length: Math.min(26, Math.max(nFil, ...fileiras.map(f => f.charCodeAt(0) - 64)) + 1) }, (_, i) => String.fromCharCode(65 + i));
  const etiquetaDiferente = !!etiqueta && /^\d+$/.test(etiqueta) && pn > 0 && +etiqueta !== pn;
  const aGravar = nMuda + nOrdem + (criarNovas ? nNova : 0);

  async function gravar(){
    if (!cmp || salvando) return;
    if (!pn){ aviso('Diga qual é a prateleira da foto'); return; }
    if (nCorrigir){ aviso('Corrija ou tire as caixas sem número, repetidas ou com fileira inválida'); return; }
    if (!aGravar){ aviso('Nada para gravar: todas as caixas já estão no lugar e na sequência'); fechar(pn); return; }
    setSalvando(true);
    const lista: { c: Caixa; novo: Partial<Caixa>; texto?: string }[] = [];
    for (const it of cmp.itens){
      if (!it.caixa || !['mudou', 'fileira', 'ordem'].includes(it.estado)) continue;
      const c = d.caixasM.get(it.caixa.id) || it.caixa;
      lista.push({ c, novo: { locais: [[pn, it.f, it.pos]] },
        texto: it.estado === 'ordem' ? undefined : 'Caixa ' + c.nome + ' conferida por foto: prateleira ' + pn + ', fileira ' + it.f + ', ' + it.pos + 'ª' + (c.locais.length ? ' (estava em ' + lugares(c.locais) + ')' : '') });
    }
    const desf = await d.mudarCaixas(lista, 'Prateleira ' + pn + ' conferida por foto: ' + nMuda + ' caixa(s) mudaram de lugar, ' + nOrdem + ' com a sequência anotada');
    if (lista.length && !desf){ setSalvando(false); return; }
    let criadas = 0;
    if (criarNovas) for (const it of cmp.itens) if (it.estado === 'nova' && await d.criarCaixa(it.nome, [[pn, it.f, it.pos]])) criadas++;
    setSalvando(false);
    const partes = [nMuda && nMuda + (nMuda === 1 ? ' caixa mudou' : ' caixas mudaram') + ' de lugar', nOrdem && nOrdem + ' com a sequência ajustada', criadas && criadas + (criadas === 1 ? ' caixa criada' : ' caixas criadas')].filter(Boolean);
    aviso('Prateleira ' + pn + ' conferida: ' + partes.join(', '), desf);
    fechar(pn);
  }

  const cartao = (l: Linha, it: ItemFoto | undefined) => (
    <div key={l.id} className={'aq-fp-cx aq-fp-' + (it?.estado || 'certo') + (l.duvida ? ' aq-fp-duvida' : '')} title={l.duvida || undefined}>
      <div className="aq-fila" style={{ gap: 4, flexWrap: 'nowrap' }}>
        {it?.pos ? <span className="aq-fp-pos" aria-hidden="true">{it.pos}</span> : null}
        <input className="aq-mono aq-fp-nome" aria-label={'Número da caixa na fileira ' + l.f} value={l.nome} placeholder="nº" onChange={e => mudarLinha(l.id, { nome: e.target.value.toUpperCase(), duvida: '' })} />
        <input className="aq-mono aq-fp-f" aria-label={'Fileira da caixa ' + l.nome} maxLength={2} value={l.f} onChange={e => mudarLinha(l.id, { f: e.target.value.toUpperCase() })} />
        <button type="button" className="aq-fp-tirar" aria-label={'Tirar a caixa ' + l.nome + ' da lista'} onClick={() => tirar(l.id)}><Icone n="x" t={14} /></button>
      </div>
      <small>{it ? situacao(it, pn) : ''}{l.duvida ? ' · conferir etiqueta' : ''}</small>
    </div>
  );

  return (
    <div className="aq-card aq-pad aq-pilha aq-fp" id="aq-fp">
      <div className="aq-fila" style={{ justifyContent: 'space-between' }}>
        <div><h2>Conferir prateleira por foto</h2><p className="aq-sub" style={{ fontSize: 13.5 }}>A IA lê as etiquetas; você confere e grava o lugar e a sequência. A fileira <b>A</b> é a de baixo.</p></div>
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
          <details className="aq-fp-dicas"><summary>Dicas para a foto</summary>
            <ul><li>De frente, na altura do meio da estante, sem inclinar o celular.</li><li>Com luz: acenda a sala e evite reflexo da janela nas etiquetas.</li>
              <li>Estante alta: tire uma foto da metade de cima e outra da de baixo e confira cada uma.</li><li>Não use o zoom digital: chegue mais perto.</li></ul></details>
        </div>

        {linhas && (
          <div className="aq-pilha">
            {etiquetaDiferente && <div className="aq-aviso aq-amarelo" role="alert"><Icone n="alerta" t={16} /><span>A plaquinha da foto diz <b>{etiqueta}</b>, mas você escolheu a prateleira <b>{pn}</b>. Confira antes de gravar.</span></div>}
            {!pn && <div className="aq-aviso aq-amarelo" role="alert"><Icone n="alerta" t={16} /><span>Diga qual é a prateleira da foto para comparar com o sistema.</span></div>}
            {sugestoes.map(s => (
              <div key={s.foto} className="aq-aviso aq-amarelo aq-fp-sugestao" role="alert"><Icone n="alerta" t={16} />
                <span><b>A fileira {s.foto} da foto parece ser a {s.sistema} do sistema:</b> {s.caixas} caixas dela estão anotadas na fileira {s.sistema}. Pode ser que a leitura tenha contado uma fileira a mais ou a menos.
                  <span className="aq-acoes-aviso"><button type="button" className="aq-btn aq-peq" onClick={() => trocarLetra(s.foto, s.sistema)}>Usar a letra {s.sistema} nesta fileira</button></span></span></div>
            ))}
            <div className="aq-fila aq-fp-letras"><span className="aq-sub" style={{ fontSize: 13 }}>Letras das fileiras:</span>
              <button type="button" className="aq-btn aq-peq" onClick={() => deslocar(1)}>Subir todas uma letra</button>
              <button type="button" className="aq-btn aq-peq" onClick={() => deslocar(-1)}>Descer todas uma letra</button></div>
            {fileiras.map(f => {
              const daFileira = linhas.map((l, i) => [l, itens[i]] as const).filter(([l]) => l.f === f);
              return (
                <div key={f} className="aq-fp-fileira" data-f={f}>
                  <select className="aq-fp-letra" aria-label={'Letra da fileira ' + f} value={f} onChange={e => trocarLetra(f, e.target.value)}>
                    {opcoes.map(o => <option key={o} value={o}>{o}</option>)}</select>
                  <div className="aq-fp-caixas">
                    {daFileira.length ? daFileira.map(([l, it]) => cartao(l, it)) : <span className="aq-sub" style={{ fontSize: 13, padding: '6px 0' }}>fileira vazia</span>}
                    <button type="button" className="aq-btn aq-peq aq-leve" onClick={() => somar(f)}>+ caixa</button>
                  </div>
                </div>
              );
            })}
            {linhas.some(l => !LETRA.test(l.f)) && (
              <div className="aq-fp-fileira"><b className="aq-fp-letra">?</b><div className="aq-fp-caixas">
                {linhas.map((l, i) => (LETRA.test(l.f) ? null : cartao(l, itens[i])))}</div></div>
            )}
            {cmp && (
              <div className="aq-fp-resumo" id="aq-fp-resumo">
                <span><i className="aq-fp-bola aq-fp-certo" />{conta('certo')} no lugar</span>
                <span><i className="aq-fp-bola aq-fp-ordem" />{nOrdem} só a sequência</span>
                <span><i className="aq-fp-bola aq-fp-mudou" />{nMuda} {nMuda === 1 ? 'muda' : 'mudam'} de lugar</span>
                <span><i className="aq-fp-bola aq-fp-nova" />{nNova} {nNova === 1 ? 'nova' : 'novas'}</span>
                {nCorrigir > 0 && <span><i className="aq-fp-bola aq-fp-invalida" />{nCorrigir} para corrigir</span>}
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
