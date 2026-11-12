'use client';
// Sala do arquivo: estantes de madeira com as caixas em pé em cada fileira; filtro "P25",
// atalhos P.1…P.36 e OS, e o modo "Arrastar caixas" (mouse ou dedo) para mudar caixa de lugar.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { filtroPrateleira, ordemCaixa, norm, type Caixa } from '@/lib/arquivo';
import { useArq } from './Arquivo';
import { Icone, Vazio } from './Pecas';

type Estante = { p: number; fileiras: [string, Caixa[]][]; total: number };

export function Prateleiras(){
  const { d, aviso } = useArq();
  const [txt, setTxt] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const filtro = filtroPrateleira(txt);
  const alvoCx = filtro.tipo === 'caixa' ? filtro.alvo : '';

  // monta as estantes: prateleira -> fileira -> caixas (0 = sem prateleira anotada)
  const mapa = new Map<number, Map<string, Caixa[]>>();
  for (const c of d.caixas){
    if (c.secretaria) continue;
    const n = (d.porCaixa.get(c.id) || []).length;
    if (!n && !c.locais.length) continue;   // caixa vazia e sem lugar: não aparece
    for (const [p, f] of (c.locais.length ? c.locais : [[0, ''] as [number, string]])){
      const m = mapa.get(p) || mapa.set(p, new Map()).get(p)!;
      (m.get(f) || m.set(f, []).get(f)!).push(c);
    }
  }
  const estantes: Estante[] = [...mapa.keys()].sort((a, b) => (a || 999) - (b || 999)).map(p => {
    const fs = mapa.get(p)!;
    return { p, fileiras: [...fs.keys()].sort().map(f => [f, fs.get(f)!.sort(ordemCaixa)] as [string, Caixa[]]), total: [...fs.values()].reduce((n, l) => n + l.length, 0) };
  });
  const secs = d.caixas.filter(c => c.secretaria && (d.porCaixa.get(c.id) || []).length).sort((a, b) => a.nome.localeCompare(b.nome));
  const nSec = secs.reduce((n, c) => n + (d.porCaixa.get(c.id) || []).length, 0);
  const numeros = estantes.map(e => e.p).filter(Boolean);

  useEffect(() => {
    if (filtro.tipo === 'prateleira' && filtro.f){ const f = raiz.current?.querySelector('.aq-fileira.aq-foco'); f?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    else if (alvoCx){ const a = raiz.current?.querySelector('.aq-cxb.aq-achou'); a?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }, [txt]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- arrastar (Pointer Events: mouse, caneta e dedo) ----------
  const arr = useRef<{ c: Caixa; b: HTMLElement; g: HTMLElement; x: number; y: number; alvo: HTMLElement | null; id: number; raf: number } | null>(null);
  useEffect(() => {
    if (!arrastando) return;
    const alvoEm = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.aq-fileira[data-p]') || null;
    const marcar = () => { const a = arr.current!; const n = alvoEm(a.x, a.y); if (n !== a.alvo){ a.alvo?.classList.remove('aq-alvo'); a.alvo = n; n?.classList.add('aq-alvo'); } };
    const rolar = () => { const a = arr.current; if (!a) return; const m = 70, h = innerHeight; if (a.y < m) scrollBy(0, -Math.ceil((m - a.y) / 4)); else if (a.y > h - m) scrollBy(0, Math.ceil((a.y - (h - m)) / 4)); marcar(); a.raf = requestAnimationFrame(rolar); };
    const baixo = (e: PointerEvent) => {
      if (e.button > 0) return;
      const b = (e.target as HTMLElement).closest<HTMLElement>('.aq-cxb[data-cx]'); if (!b || !raiz.current?.contains(b)) return;
      const c = d.caixasM.get(b.dataset.cx!); if (!c || c.secretaria) return;
      e.preventDefault();
      const g = b.cloneNode(true) as HTMLElement; g.classList.add('aq-fantasma'); g.classList.remove('aq-achou');
      g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; raiz.current!.appendChild(g);
      b.classList.add('aq-arrastando');
      arr.current = { c, b, g, x: e.clientX, y: e.clientY, alvo: null, id: e.pointerId, raf: requestAnimationFrame(rolar) };
    };
    const mover = (e: PointerEvent) => { const a = arr.current; if (!a || e.pointerId !== a.id) return; a.x = e.clientX; a.y = e.clientY; a.g.style.left = e.clientX + 'px'; a.g.style.top = e.clientY + 'px'; marcar(); };
    const soltar = async (e: PointerEvent) => {
      const a = arr.current; if (!a || e.pointerId !== a.id) return;
      arr.current = null; cancelAnimationFrame(a.raf); a.g.remove(); a.b.classList.remove('aq-arrastando'); a.alvo?.classList.remove('aq-alvo');
      if (e.type === 'pointercancel' || !a.alvo) return;
      const P = Number(a.alvo.dataset.p), F = a.alvo.dataset.f || '', l = a.c.locais[0];
      if (a.c.locais.length === 1 && l[0] === P && l[1] === F) return;
      const desf = await d.mudarCaixa(a.c, { locais: [[P, F]] }, 'Caixa ' + a.c.nome + ' arrastada para a prateleira ' + P + ', fileira ' + F + (l ? ' (estava em P.' + l[0] + ' F.' + l[1] + ')' : ''));
      if (desf) aviso('Caixa ' + a.c.nome + ' agora em P.' + P + ' F.' + F, desf);
    };
    const el = raiz.current!;
    el.addEventListener('pointerdown', baixo);
    addEventListener('pointermove', mover); addEventListener('pointerup', soltar); addEventListener('pointercancel', soltar);
    return () => { el.removeEventListener('pointerdown', baixo); removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); removeEventListener('pointercancel', soltar); };
  }, [arrastando, d, aviso]);

  const abrirCaixa = (id: string) => { if (!arrastando) location.hash = 'cx-' + id; };
  const caixaBtn = (c: Caixa, extra = '') => {
    const n = (d.porCaixa.get(c.id) || []).length;
    const achou = alvoCx && (c.secretaria ? norm(c.nome).toUpperCase().includes(norm(alvoCx).toUpperCase()) : c.nome.toUpperCase().startsWith(alvoCx));
    return (
      <button key={c.id} type="button" className={'aq-cxb' + (achou ? ' aq-achou' : '') + (c.locais.length > 1 ? ' aq-conf' : '') + (!n ? ' aq-vazia' : '') + extra}
        data-cx={c.id} title={(c.secretaria ? c.nome : 'Caixa ' + c.nome) + ' · ' + n + ' processos'} aria-label={c.secretaria ? 'Caixa da secretaria ' + c.nome : 'Caixa ' + c.nome}
        onClick={() => abrirCaixa(c.id)}>
        <span className="aq-jan">{c.nome}</span>{c.secretaria && <span className="aq-qt">{n}</span>}<span className="aq-furo" />
      </button>
    );
  };
  const estanteHtml = (e: Estante) => (
    <div key={e.p} className={'aq-estante' + (e.p ? '' : ' aq-sem-lugar')}>
      <div className="aq-estante-cab"><h3>{e.p ? <><span className="aq-num">P.{e.p}</span>Prateleira {e.p}</> : 'Caixas sem prateleira anotada'}</h3><span>{e.total} caixas</span></div>
      {e.fileiras.map(([f, cs]) => (
        <div key={f} className={'aq-fileira' + (filtro.tipo === 'prateleira' && filtro.f === f ? ' aq-foco' : '')} {...(e.p ? { 'data-p': e.p, 'data-f': f } : {})}>
          <b>{f || '—'}</b><div className="aq-caixas">{cs.map(c => caixaBtn(c))}</div>
        </div>
      ))}
    </div>
  );
  const estanteSec = (
    <div key="os" className="aq-estante aq-secretaria">
      <div className="aq-estante-cab"><h3><span className="aq-num">OS</span>Outra Secretaria</h3><span>{nSec} processos em {secs.length} secretaria{secs.length === 1 ? '' : 's'}</span></div>
      <div className="aq-fileira"><b>—</b><div className="aq-caixas">{secs.length ? secs.map(c => caixaBtn(c, c.nome === 'Não informada' ? ' aq-indef' : '')) : <span style={{ color: '#E6ECEF', fontSize: 13, padding: '14px 0' }}>Nenhum processo emprestado.</span>}</div></div>
    </div>
  );

  let corpo: ReactNode;
  let filtroAtivo: ReactNode = null;
  if (filtro.tipo === 'prateleira'){
    const e = estantes.find(x => x.p === filtro.p);
    corpo = e ? estanteHtml(e) : <Vazio titulo={'Não há prateleira ' + filtro.p + '.'} icone="estante">As prateleiras com caixas vão de P.{numeros[0]} a P.{numeros[numeros.length - 1]}. Toque num atalho acima.</Vazio>;
    filtroAtivo = <>Mostrando só a <b>Prateleira {filtro.p}{filtro.f ? ', fileira ' + filtro.f : ''}</b></>;
  } else if (filtro.tipo === 'secretaria'){
    corpo = estanteSec; filtroAtivo = <>Mostrando só a <b>Outra Secretaria</b></>;
  } else corpo = <>{estantes.map(estanteHtml)}{estanteSec}</>;

  const umaSo = filtro.tipo === 'prateleira' || filtro.tipo === 'secretaria';
  return (
    <section className="aq-pilha" aria-labelledby="aq-titulo-prat">
      <div className="aq-topo-tela">
        <div><span className="aq-sobrelinha">Sala do arquivo</span><h1 id="aq-titulo-prat">Prateleiras</h1><p className="aq-sub">Cada caixa na sua fileira, como na estante. Toque numa caixa para abrir.</p></div>
        <div className="aq-fila">
          <button type="button" className={'aq-btn' + (arrastando ? ' aq-ligado' : '')} aria-pressed={arrastando} id="aq-arrastar" onClick={() => setArrastando(!arrastando)}><Icone n="caixa" t={16} />Arrastar caixas</button>
          <label className="aq-busca-mini" htmlFor="aq-fcx"><Icone n="busca" t={16} /><input id="aq-fcx" placeholder="Caixa ou prateleira (P25)" aria-label="Achar caixa ou prateleira" value={txt} onChange={e => setTxt(e.target.value)} /></label>
        </div>
      </div>
      {arrastando && <div className="aq-barra-arrastar"><span><b>Modo arrastar.</b> Pegue uma caixa e solte em outra fileira. As caixas sem prateleira também podem ser arrastadas para o lugar certo.</span><button type="button" className="aq-btn" onClick={() => setArrastando(false)}>Concluir</button></div>}
      <div className="aq-legenda"><span><b style={{ color: 'var(--c2)' }}>!</b> caixa anotada em dois lugares na planilha</span></div>
      <div className="aq-atalhos-prat" aria-label="Ir para a prateleira">
        <span className="aq-rot" style={{ marginRight: 4 }}>Ir para</span>
        {numeros.map(p => <button key={p} type="button" aria-pressed={filtro.tipo === 'prateleira' && filtro.p === p} onClick={() => { setTxt(filtro.tipo === 'prateleira' && filtro.p === p ? '' : 'P' + p); window.scrollTo({ top: 0 }); }}>P.{p}</button>)}
        <button type="button" className="aq-os" aria-pressed={filtro.tipo === 'secretaria'} title="Outra Secretaria" onClick={() => setTxt(filtro.tipo === 'secretaria' ? '' : 'OS')}>OS</button>
      </div>
      {filtroAtivo && <div className="aq-filtro-ativo">{filtroAtivo}<button type="button" className="aq-btn aq-peq" onClick={() => setTxt('')}>Ver todas</button></div>}
      <div ref={raiz} id="aq-estantes" className={'aq-estantes' + (umaSo ? ' aq-uma' : '') + (arrastando ? ' aq-organizando' : '')}>{corpo}</div>
    </section>
  );
}
