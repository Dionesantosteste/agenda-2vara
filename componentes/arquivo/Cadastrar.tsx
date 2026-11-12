'use client';
// Cadastro: foto da capa (lida pela IA quando a chave estiver configurada), conferência dos dados,
// aviso de processo já cadastrado (em vermelho, pede confirmação) e Caixa + Prateleira + Fileira.
import { useEffect, useRef, useState } from 'react';
import { jaCadastrados, SITUACOES } from '@/lib/arquivo';
import { supabase } from '@/lib/supabase';
import { useArq } from './Arquivo';
import { CampoCaixa, juntar, resolverCaixa, type ValorCaixa } from './Janelas';
import { Icone } from './Pecas';

const VAZIO = { codigo: '', numero: '', classe: '', partes: '', ano: '', obs: '' };
type Leitura = { codigo?: string | null; numero?: string | null; classe?: string | null; partes?: string[] | null; ano?: string | null; confianca?: string | null; observacao?: string | null };

// Reduz a foto antes de enviar (mais rápido e mais barato): lado maior com até 1568 px, em JPEG
async function reduzir(arq: File): Promise<string> {
  const img = await createImageBitmap(arq);
  const esc = Math.min(1, 1568 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(img.width * esc); cv.height = Math.round(img.height * esc);
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export function Cadastrar(){
  const { d, aviso, abrirProc, cadastradosAgora, marcarCadastrado, preCadastro, setPreCadastro } = useArq();
  const [v, setV] = useState(VAZIO);
  const [cx, setCx] = useState<ValorCaixa>({ nome: '', p: '', f: '' });
  const [foto, setFoto] = useState<{ arq: File; url: string } | null>(null);
  const [ia, setIa] = useState<{ cls: string; txt: string }>({ cls: '', txt: 'A IA lê código, número, classe, partes e ano.' });
  const [lendo, setLendo] = useState(false);
  const [preenchidos, setPreenchidos] = useState<Set<string>>(new Set());
  const [confirma, setConfirma] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const dupRef = useRef<HTMLDivElement>(null);
  const cxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preCadastro) return;
    if (preCadastro.cod || preCadastro.num) setV(x => ({ ...x, codigo: preCadastro.cod || '', numero: preCadastro.num || '' }));
    if (preCadastro.cx){ const c = d.caixas.find(x => !x.secretaria && x.nome === preCadastro.cx); setCx({ nome: preCadastro.cx, p: c?.locais[0] ? String(c.locais[0][0]) : '', f: c?.locais[0]?.[1] || '' }); }
    setPreCadastro(null);
  }, [preCadastro]);   // eslint-disable-line react-hooks/exhaustive-deps

  const dups = jaCadastrados(v.codigo, v.numero, d.processos);
  const campo = (k: keyof typeof VAZIO, mudar: string) => { setV({ ...v, [k]: mudar }); setConfirma(false); };

  async function ler(arq: File){
    setLendo(true); setIa({ cls: '', txt: 'Lendo a capa… leva de 10 a 30 segundos.' });
    try {
      const sessao = (await supabase().auth.getSession()).data.session;
      const img = await reduzir(arq);
      const r = await fetch('/api/arquivo/ler-capa', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (sessao?.access_token || '') }, body: JSON.stringify({ imagem: img, tipo: 'image/jpeg' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok){ setIa({ cls: r.status === 503 ? '' : 'aq-erro', txt: j.erro || 'Não consegui ler a capa. Preencha os campos.' }); return; }
      const l: Leitura = j.leitura || {};
      const novo = { ...v };
      const marcados = new Set<string>();
      const por = (k: keyof typeof VAZIO, val: string | null | undefined) => { if (val){ novo[k] = val; marcados.add(k); } };
      por('codigo', l.codigo ? String(l.codigo).replace(/\D/g, '') : ''); por('numero', l.numero); por('classe', l.classe); por('ano', l.ano);
      por('partes', Array.isArray(l.partes) ? l.partes.join('\n') : '');
      setV(novo); setPreenchidos(marcados); setConfirma(false);
      setIa({ cls: 'aq-ok', txt: 'Lido' + (l.confianca ? ', confiança ' + ({ alta: 'alta', media: 'média', baixa: 'baixa' } as Record<string, string>)[l.confianca] : '') + '. Confira antes de salvar.' + (l.observacao ? ' ' + l.observacao : '') });
      setTimeout(() => setPreenchidos(new Set()), 1500);
      cxRef.current?.querySelector('input')?.focus();
    } catch (e){
      setIa({ cls: 'aq-erro', txt: 'Não consegui ler a capa (sem conexão?). Tente de novo ou preencha os campos.' });
    } finally { setLendo(false); }
  }

  function limpar(manterCaixa: boolean){
    setV(VAZIO); setConfirma(false); setPreenchidos(new Set());
    if (foto) URL.revokeObjectURL(foto.url);
    setFoto(null); setIa({ cls: '', txt: manterCaixa ? 'Pronto para a próxima capa.' : 'A IA lê código, número, classe, partes e ano.' });
    if (!manterCaixa) setCx({ nome: '', p: '', f: '' });
  }

  async function salvar(e: React.FormEvent){
    e.preventDefault(); if (salvando) return;
    const codigo = v.codigo.trim(), numero = v.numero.trim();
    if (!codigo && !numero){ aviso('Preencha o código ou o número do processo'); return; }
    if (dups.length && !confirma){ setConfirma(true); dupRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); aviso('Este processo já está cadastrado. Confira o aviso antes de salvar.'); return; }
    setSalvando(true);
    const r = await resolverCaixa(d, cx);
    if ('erro' in r){ setSalvando(false); aviso(r.erro); return; }
    const texto = 'Processo ' + (codigo || numero) + ' cadastrado' + (foto ? ' por foto da capa' : '') + ' na caixa ' + r.caixa.nome;
    const res = await d.criarProcesso({ codigo: codigo || numero, caixa_id: r.caixa.id, numero, classe: v.classe.trim(), partes: v.partes.trim(), ano: v.ano.trim(), obs: v.obs.trim() }, texto);
    setSalvando(false);
    if (!res) return;
    marcarCadastrado(res.p.id);
    aviso('Processo ' + res.p.codigo + ' salvo na caixa ' + r.caixa.nome, juntar(res.desfazer, r.desfazerLugar));
    const caixa = d.caixasM.get(r.caixa.id) || r.caixa;
    setCx({ nome: caixa.nome, p: caixa.locais[0] ? String(caixa.locais[0][0]) : cx.p, f: caixa.locais[0]?.[1] || cx.f });
    limpar(true);
  }

  const inp = (k: keyof typeof VAZIO, rot: string, extra: { mono?: boolean; area?: boolean; ph?: string; modo?: 'numeric'; max?: number } = {}) => (
    <div className="aq-campo"><label htmlFor={'aq-c-' + k}>{rot}</label>
      {extra.area
        ? <textarea id={'aq-c-' + k} className={preenchidos.has(k) ? 'aq-preenchido' : ''} placeholder={extra.ph} value={v[k]} onChange={e => campo(k, e.target.value)} />
        : <input id={'aq-c-' + k} className={(extra.mono ? 'aq-mono' : '') + (preenchidos.has(k) ? ' aq-preenchido' : '')} inputMode={extra.modo} maxLength={extra.max} placeholder={extra.ph} value={v[k]} onChange={e => campo(k, e.target.value)} />}
    </div>
  );
  const recentes = cadastradosAgora.map(id => d.procsM.get(id)).filter(p => p && !p.excluido);

  return (
    <section className="aq-pilha" aria-labelledby="aq-titulo-cad">
      <div><span className="aq-sobrelinha">Entrada no arquivo</span><h1 id="aq-titulo-cad">Cadastrar processo</h1>
        <p className="aq-sub">Fotografe a capa, confira o que a IA leu e escolha a caixa. Dá para cadastrar uma caixa inteira em sequência.</p></div>
      <form id="aq-fcad" className="aq-pilha" noValidate onSubmit={salvar}>
        <div className="aq-passos">
          <div className="aq-card aq-pad aq-pilha">
            <div className="aq-passo-cab"><span className="aq-n">1</span><h2>Foto da capa</h2></div>
            <label className="aq-camera" htmlFor="aq-arqfoto">
              <div className="aq-chamada"><Icone n="camera" t={36} /><b>Fotografar capa</b><span>No celular abre a câmera. No computador, escolha uma foto.</span></div>
              {foto && <img src={foto.url} alt="Foto da capa" />}
              {lendo && <div className="aq-lendo">Lendo a capa…</div>}
            </label>
            <input id="aq-arqfoto" type="file" accept="image/*" capture="environment" hidden onChange={e => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              if (foto) URL.revokeObjectURL(foto.url);
              setFoto({ arq: f, url: URL.createObjectURL(f) }); ler(f);
            }} />
            <div className="aq-fila" style={{ justifyContent: 'space-between' }}>
              <div id="aq-estado-ia" className={'aq-estado-ia ' + ia.cls}>{ia.txt}</div>
              {foto && !lendo && <button type="button" className="aq-btn aq-peq" onClick={() => ler(foto.arq)}>Ler de novo</button>}
            </div>
          </div>
          <div className="aq-pilha">
            <div className="aq-card aq-pad aq-pilha">
              <div className="aq-passo-cab"><span className="aq-n">2</span><h2>Confira os dados</h2></div>
              <div className="aq-grade-campos">{inp('codigo', 'Código da capa', { mono: true, ph: '30208', modo: 'numeric' })}{inp('ano', 'Ano', { mono: true, ph: '1998', modo: 'numeric', max: 4 })}</div>
              {inp('numero', 'Número do processo', { mono: true, ph: '0001234-56.2005.8.11.0041 ou 224/87' })}
              {inp('classe', 'Classe', { ph: 'Ex.: Execução de alimentos' })}
              {inp('partes', 'Partes', { area: true, ph: 'Uma por linha' })}
              {inp('obs', 'Observação', { area: true, ph: 'Ex.: volume 2, capa rasgada, apenso ao 30208…' })}
              {dups.length > 0 && (
                <div ref={dupRef} id="aq-dupl" className="aq-aviso aq-vermelho" role="alert"><Icone n="alerta" t={16} /><span><b>Já cadastrado:</b>{' '}
                  {dups.map(({ p, por }, i) => { const c = d.caixasM.get(p.caixa_id); return <span key={p.id}>{i ? '; ' : ''}<span className="aq-mono">{p.codigo}</span> (pelo {por}) na caixa {c?.nome}{c?.locais[0] ? ', P.' + c.locais[0][0] + ' F.' + c.locais[0][1] : ''} · {SITUACOES[p.situacao].toLowerCase()}</span>; })}.
                  {' '}Se for o mesmo processo, não cadastre de novo: abra a ficha e use “Trocar de caixa” se ele mudou de lugar. Se for outro volume, salve e anote o volume na observação.
                  <span className="aq-acoes-aviso">{dups.map(({ p }) => <button key={p.id} type="button" className="aq-btn aq-peq" onClick={() => abrirProc(p.id)}>Abrir {p.codigo} · cx {d.caixasM.get(p.caixa_id)?.nome}</button>)}</span></span></div>
              )}
            </div>
            <div className="aq-card aq-pad aq-pilha" ref={cxRef}>
              <div className="aq-passo-cab"><span className="aq-n">3</span><h2>Onde vai ficar</h2></div>
              <CampoCaixa id="aq-c-cx" valor={cx} mudar={setCx} />
            </div>
          </div>
        </div>
        <div className="aq-acoes">
          <button type="button" className="aq-btn" onClick={() => limpar(false)}>Limpar</button>
          <button type="submit" className="aq-btn aq-prim" disabled={salvando}>{salvando ? 'Salvando…' : confirma ? 'Salvar mesmo assim (outro volume)' : 'Salvar e cadastrar o próximo'}</button>
        </div>
      </form>
      {recentes.length > 0 && (
        <div className="aq-card"><div className="aq-cab-card"><h2>Cadastrados agora</h2></div>
          <div className="aq-linhas">{recentes.slice(0, 20).map(p => p && (
            <button key={p.id} type="button" className="aq-linha-item" onClick={() => abrirProc(p.id)}>
              <span><span className="aq-t">{p.codigo}</span><div className="aq-d">{[p.classe || p.numero, p.obs].filter(Boolean).join(' · ')}</div></span>
              <span className="aq-sub" style={{ fontSize: 13 }}>caixa {d.caixasM.get(p.caixa_id)?.nome}</span>
            </button>
          ))}</div></div>
      )}
    </section>
  );
}
