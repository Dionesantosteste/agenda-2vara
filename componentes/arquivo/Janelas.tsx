'use client';
// Janelas pequenas do Arquivo: mudar a caixa de lugar, renomear, trocar processos de caixa,
// remeter a outra vara e mandar para outra secretaria. E o campo Caixa + Prateleira + Fileira.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ARQUIVADO, EM_SECRETARIA, REMETIDO, NAO_INFORMADA, localValido, norm, ordemCaixa, textoLocal, type Caixa, type Processo } from '@/lib/arquivo';
import type { ArquivoDados, Desfazer, Mudanca } from './useArquivo';
import { useArq } from './Arquivo';

export type Janela =
  | { tipo: 'lugar'; caixa: Caixa } | { tipo: 'nome'; caixa: Caixa }
  | { tipo: 'mover' | 'remeter' | 'secretaria'; lista: Processo[]; depois?: () => void };

// ---------- campo Caixa + Prateleira + Fileira ----------
export type ValorCaixa = { nome: string; p: string; f: string };
export function CampoCaixa({ id, valor, mudar }: { id: string; valor: ValorCaixa; mudar: (v: ValorCaixa) => void }){
  const { d } = useArq();
  const normais = d.caixas.filter(c => !c.secretaria);
  const achar = (n: string) => normais.find(c => c.nome.toUpperCase() === n.trim().toUpperCase());
  const c = valor.nome.trim() ? achar(valor.nome) : undefined;
  const l = c?.locais[0];
  const p = valor.p.trim(), f = valor.f.trim().toUpperCase();
  let prev: ReactNode = null;
  if (valor.nome.trim()){
    if (!c) prev = <><b>Caixa nova.</b> {p && f ? 'Vai ficar na prateleira ' + p + ', fileira ' + f + '.' : 'Diga a prateleira e a fileira onde ela vai ficar.'}</>;
    else if (l && p && f && (String(l[0]) !== p || l[1] !== f)) prev = <span style={{ color: 'var(--c3)' }}><b>Atenção:</b> a caixa {c.nome} está anotada na prateleira {l[0]}, fileira {l[1]}. Salvando, a caixa inteira ({(d.porCaixa.get(c.id) || []).length} processos) passa para P.{p} F.{f}.</span>;
    else prev = <>Caixa {c.nome} · {(d.porCaixa.get(c.id) || []).length} processos{c.locais.length > 1 ? ' · anotada em dois lugares, confira' : !c.locais.length ? ' · ainda sem prateleira anotada: se souber, preencha' : ''}</>;
  }
  return (
    <>
      <div className="aq-grade-campos aq-cx-campos">
        <div className="aq-campo"><label htmlFor={id}>Caixa</label>
          <input id={id} className="aq-mono" list={id + '-lista'} placeholder="Ex.: 1320" autoComplete="off" value={valor.nome}
            onChange={e => { const n = e.target.value; const nc = achar(n); const antes = achar(valor.nome);
              // ao escolher uma caixa que já existe, o lugar dela vem junto
              if (nc && nc !== antes && nc.locais[0]) mudar({ nome: n, p: String(nc.locais[0][0]), f: nc.locais[0][1] });
              else if (!nc && antes) mudar({ nome: n, p: '', f: '' });
              else mudar({ ...valor, nome: n }); }} />
          <datalist id={id + '-lista'}>{normais.filter(c => (d.porCaixa.get(c.id) || []).length || c.locais.length).sort(ordemCaixa).map(c => <option key={c.id} value={c.nome} />)}</datalist>
        </div>
        <div className="aq-campo"><label htmlFor={id + '-p'}>Prateleira</label><input id={id + '-p'} className="aq-mono" inputMode="numeric" placeholder="Ex.: 5" value={valor.p} onChange={e => mudar({ ...valor, p: e.target.value })} /></div>
        <div className="aq-campo"><label htmlFor={id + '-f'}>Fileira</label><input id={id + '-f'} className="aq-mono" maxLength={2} placeholder="Ex.: B" value={valor.f} onChange={e => mudar({ ...valor, f: e.target.value.toUpperCase() })} /></div>
      </div>
      <div className="aq-previa" id={id + '-prev'}>{prev}</div>
    </>
  );
}

// Acha (ou cria) a caixa do campo; muda o lugar dela se a pessoa trocou a prateleira/fileira.
export async function resolverCaixa(d: ArquivoDados, v: ValorCaixa): Promise<{ caixa: Caixa; desfazerLugar: Desfazer | null } | { erro: string }> {
  const nome = v.nome.trim().toUpperCase();
  if (!nome) return { erro: 'Diga em qual caixa o processo vai ficar' };
  const loc = localValido(v.p, v.f);
  const c = d.caixas.find(x => !x.secretaria && x.nome.toUpperCase() === nome);
  if (!c){
    if (!loc) return { erro: 'Caixa nova: preencha a prateleira e a fileira' };
    const nova = await d.criarCaixa(nome, [loc]);
    return nova ? { caixa: nova, desfazerLugar: null } : { erro: 'Não foi possível criar a caixa' };
  }
  const l = c.locais[0];
  if (loc && (!l || c.locais.length > 1 || l[0] !== loc[0] || l[1] !== loc[1])){
    const desf = await d.mudarCaixa(c, { locais: [loc] }, 'Caixa ' + c.nome + ' agora na prateleira ' + loc[0] + ', fileira ' + loc[1]);
    return { caixa: { ...c, locais: [loc] }, desfazerLugar: desf };
  }
  return { caixa: c, desfazerLugar: null };
}

// junta vários "desfazer" num só
export const juntar = (...fs: (Desfazer | null | undefined)[]): Desfazer | null => { const l = fs.filter(Boolean) as Desfazer[]; return l.length ? () => l.slice().reverse().forEach(f => f()) : null; };
const hojeBR = () => new Date().toLocaleDateString('pt-BR');

export function Janelas({ janela, fechar }: { janela: Janela; fechar: () => void }){
  const { d, aviso } = useArq();
  const ref = useRef<HTMLDialogElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { const dl = ref.current; if (dl && !dl.open) dl.showModal(); }, []);
  const enviar = (fn: () => Promise<string | void>) => async (e: FormEvent) => {
    e.preventDefault(); if (ocupado) return;
    setOcupado(true); setMsg('');
    const erro = await fn();
    setOcupado(false);
    if (erro) setMsg(erro); else fechar();
  };
  const botoes = (rot: string) => (
    <>
      {msg && <div className="aq-aviso aq-vermelho" role="alert">{msg}</div>}
      <div className="aq-acoes"><button type="button" className="aq-btn" onClick={fechar}>Cancelar</button><button type="submit" className="aq-btn aq-prim" disabled={ocupado}>{ocupado ? 'Salvando…' : rot}</button></div>
    </>
  );

  let corpo: ReactNode = null;
  if (janela.tipo === 'lugar'){
    const c = janela.caixa;
    corpo = <FormLugar c={c} botoes={botoes} enviar={enviar} />;
  } else if (janela.tipo === 'nome'){
    corpo = <FormNome c={janela.caixa} botoes={botoes} enviar={enviar} />;
  } else if (janela.tipo === 'mover'){
    corpo = <FormMover lista={janela.lista} depois={janela.depois} botoes={botoes} enviar={enviar} />;
  } else if (janela.tipo === 'remeter'){
    corpo = <FormRemeter lista={janela.lista} depois={janela.depois} botoes={botoes} enviar={enviar} />;
  } else {
    corpo = <FormSecretaria lista={janela.lista} depois={janela.depois} botoes={botoes} enviar={enviar} />;
  }
  void d; void aviso;
  return (
    <dialog className="aq-janela" ref={ref} onClose={fechar} onClick={e => { if (e.target === ref.current) fechar(); }}>
      {corpo}
    </dialog>
  );
}

type FormProps = { botoes: (rot: string) => ReactNode; enviar: (fn: () => Promise<string | void>) => (e: FormEvent) => void };

function FormLugar({ c, botoes, enviar }: FormProps & { c: Caixa }){
  const { d, aviso } = useArq();
  const l = c.locais[0];
  const [p, setP] = useState(l ? String(l[0]) : ''), [f, setF] = useState(l ? l[1] : '');
  return (
    <form className="aq-jan" id="aq-jan" onSubmit={enviar(async () => {
      const loc = localValido(p, f); if (!loc) return 'Preencha prateleira e fileira';
      const desf = await d.mudarCaixa(c, { locais: [loc] }, 'Caixa ' + c.nome + ' agora na prateleira ' + loc[0] + ', fileira ' + loc[1] + (l ? ' (estava em P.' + l[0] + ' F.' + l[1] + ')' : ''));
      if (!desf) return 'Não foi possível salvar';
      aviso('Caixa ' + c.nome + ' agora em P.' + loc[0] + ' F.' + loc[1], desf);
    })}>
      <h2>Mudar a caixa {c.nome} de lugar</h2>
      {c.locais.length > 1 && <p className="aq-sub">Anotada hoje em {textoLocal(c)}.</p>}
      <div className="aq-grade-campos">
        <div className="aq-campo"><label htmlFor="aq-j-p">Prateleira</label><input id="aq-j-p" className="aq-mono" inputMode="numeric" value={p} onChange={e => setP(e.target.value)} autoFocus /></div>
        <div className="aq-campo"><label htmlFor="aq-j-f">Fileira</label><input id="aq-j-f" className="aq-mono" maxLength={2} value={f} onChange={e => setF(e.target.value.toUpperCase())} /></div>
      </div>
      <p className="aq-sub" style={{ fontSize: 13 }}>Os {(d.porCaixa.get(c.id) || []).length} processos vão junto com a caixa.</p>
      {botoes('Salvar lugar')}
    </form>
  );
}

function FormNome({ c, botoes, enviar }: FormProps & { c: Caixa }){
  const { d, aviso } = useArq();
  const [n, setN] = useState(c.nome);
  return (
    <form className="aq-jan" id="aq-jan" onSubmit={enviar(async () => {
      const novo = c.secretaria ? n.trim() : n.trim().toUpperCase();
      if (!novo || novo === c.nome) return;
      const outra = d.caixas.find(x => x !== c && x.secretaria === c.secretaria && norm(x.nome) === norm(novo));
      if (outra) return (c.secretaria ? 'Já existe a secretaria ' : 'Já existe a caixa ') + novo + '. Use “' + (c.secretaria ? 'Trocar de secretaria' : 'Trocar de caixa') + '” nos processos.';
      const desf = await d.mudarCaixa(c, { nome: novo }, (c.secretaria ? 'Secretaria ' : 'Caixa ') + c.nome + ' renomeada para ' + novo);
      if (!desf) return 'Não foi possível salvar';
      aviso((c.secretaria ? 'Secretaria' : 'Caixa') + ' renomeada para ' + novo, desf);
    })}>
      <h2>{c.secretaria ? 'Renomear a secretaria' : 'Renomear a caixa ' + c.nome}</h2>
      <div className="aq-campo"><label htmlFor="aq-j-n">{c.secretaria ? 'Nome da secretaria' : 'Número da caixa'}</label>
        <input id="aq-j-n" className={c.secretaria ? '' : 'aq-mono'} value={n} onChange={e => setN(e.target.value)} autoFocus />
        {!c.secretaria && <span className="aq-dica">Use quando o número da etiqueta foi anotado errado.</span>}</div>
      {botoes('Renomear')}
    </form>
  );
}

function FormMover({ lista, depois, botoes, enviar }: FormProps & { lista: Processo[]; depois?: () => void }){
  const { d, aviso } = useArq();
  const [v, setV] = useState<ValorCaixa>({ nome: '', p: '', f: '' });
  const um = lista.length === 1;
  return (
    <form className="aq-jan" id="aq-jan" onSubmit={enviar(async () => {
      const r = await resolverCaixa(d, v); if ('erro' in r) return r.erro;
      const alvo = r.caixa;
      const mud: Mudanca[] = lista.filter(p => p.caixa_id !== alvo.id).map(p => {
        const de = d.caixasM.get(p.caixa_id);
        const novo: Partial<Processo> = { caixa_id: alvo.id };
        if (de?.secretaria){ novo.origem_id = null; if (p.situacao === EM_SECRETARIA) novo.situacao = ARQUIVADO; }
        return { p, novo, texto: 'Trocado da caixa ' + (de?.nome || '') + ' para a caixa ' + alvo.nome };
      });
      const desf = await d.mudarProcessos(mud);
      if (mud.length && !desf) return 'Não foi possível salvar';
      aviso((um ? 'Processo ' + lista[0].codigo : lista.length + ' processos') + ' agora na caixa ' + alvo.nome, juntar(desf, r.desfazerLugar));
      depois?.();
    })}>
      <h2>{um ? 'Trocar o processo ' + lista[0].codigo + ' de caixa' : 'Trocar ' + lista.length + ' processos de caixa'}</h2>
      {um && <p className="aq-sub">Hoje está na caixa {d.caixasM.get(lista[0].caixa_id)?.nome}.</p>}
      <CampoCaixa id="aq-j-cx" valor={v} mudar={setV} />
      {botoes('Trocar de caixa')}
    </form>
  );
}

function FormRemeter({ lista, depois, botoes, enviar }: FormProps & { lista: Processo[]; depois?: () => void }){
  const { d, aviso } = useArq();
  const [dest, setDest] = useState(''), [of, setOf] = useState(''), [dt, setDt] = useState(new Date().toISOString().slice(0, 10));
  const um = lista.length === 1;
  return (
    <form className="aq-jan" id="aq-jan" onSubmit={enviar(async () => {
      const destino = dest.trim(); if (!destino) return 'Diga para onde vai';
      const quando = dt ? dt.split('-').reverse().join('/') : hojeBR();
      const desf = await d.mudarProcessos(lista.map(p => ({ p, novo: { situacao: REMETIDO, destino, com_quem: '' }, texto: 'Remetido a ' + destino + ' em ' + quando + (of.trim() ? ' (' + of.trim() + ')' : '') })));
      if (!desf) return 'Não foi possível salvar';
      aviso((um ? 'Processo remetido' : lista.length + ' processos remetidos') + ' a ' + destino, desf);
      depois?.();
    })}>
      <h2>{um ? 'Remeter o processo ' + lista[0].codigo : 'Remeter ' + lista.length + ' processos'} a outra vara</h2>
      <div className="aq-campo"><label htmlFor="aq-j-vara">Para onde</label><input id="aq-j-vara" list="aq-lista-varas" placeholder="Ex.: 1ª Vara Cível de Várzea Grande" value={dest} onChange={e => setDest(e.target.value)} autoFocus /></div>
      <datalist id="aq-lista-varas"><option value="1ª Vara Cível" /><option value="3ª Vara Cível" /><option value="Vara da Família" /><option value="Juizado Especial" /><option value="Outra comarca" /><option value="Tribunal (recurso)" /></datalist>
      <div className="aq-grade-campos">
        <div className="aq-campo"><label htmlFor="aq-j-of">Ofício / malote</label><input id="aq-j-of" placeholder="Opcional" value={of} onChange={e => setOf(e.target.value)} /></div>
        <div className="aq-campo"><label htmlFor="aq-j-dt">Data</label><input id="aq-j-dt" type="date" value={dt} onChange={e => setDt(e.target.value)} /></div>
      </div>
      <p className="aq-sub" style={{ fontSize: 13 }}>O processo fica na lista “Remetidos” do Livro de saídas. Se voltar, é só devolver.</p>
      {botoes('Remeter')}
    </form>
  );
}

const SUGESTOES = ['Secretaria da 1ª Vara Cível', 'Secretaria da 3ª Vara Cível', 'Gabinete do juiz', 'Central de Mandados', 'Contadoria', 'Distribuição'];
function FormSecretaria({ lista, depois, botoes, enviar }: FormProps & { lista: Processo[]; depois?: () => void }){
  const { d, aviso } = useArq();
  const [nome, setNome] = useState('');
  const um = lista.length === 1;
  const ja = lista.every(p => d.caixasM.get(p.caixa_id)?.secretaria);
  const secs = d.caixas.filter(c => c.secretaria && c.nome !== NAO_INFORMADA);
  const existe = nome.trim() ? secs.find(c => norm(c.nome) === norm(nome.trim())) : undefined;
  return (
    <form className="aq-jan" id="aq-jan" onSubmit={enviar(async () => {
      const n = nome.trim(); if (!n) return 'Diga para qual secretaria vai';
      const alvo = existe || await d.criarCaixa(n, [], true);
      if (!alvo) return 'Não foi possível criar a secretaria';
      const mud: Mudanca[] = lista.filter(p => p.caixa_id !== alvo.id).map(p => {
        const de = d.caixasM.get(p.caixa_id);
        return de?.secretaria
          ? { p, novo: { caixa_id: alvo.id }, texto: 'Trocado de ' + de.nome + ' para ' + alvo.nome }
          : { p, novo: { situacao: EM_SECRETARIA, caixa_id: alvo.id, origem_id: p.caixa_id }, texto: 'Foi para ' + alvo.nome + ' (saiu da caixa ' + (de?.nome || '') + ')' };
      });
      const desf = await d.mudarProcessos(mud);
      if (mud.length && !desf) return 'Não foi possível salvar';
      aviso((um ? 'Processo ' + lista[0].codigo : lista.length + ' processos') + ' agora em ' + alvo.nome, desf);
      depois?.();
    })}>
      <h2>{ja ? 'Trocar de secretaria' : 'Mandar para outra secretaria'}</h2>
      <p className="aq-sub">{um ? 'Processo ' + lista[0].codigo : lista.length + ' processos'}{ja ? '' : '. Cada um guarda a caixa de onde saiu, para voltar depois.'}</p>
      <div className="aq-campo"><label htmlFor="aq-j-sec">Secretaria</label><input id="aq-j-sec" list="aq-lista-sec" placeholder="Escolha ou digite o nome" autoComplete="off" value={nome} onChange={e => setNome(e.target.value)} autoFocus /></div>
      <datalist id="aq-lista-sec">{[...new Set([...secs.map(c => c.nome), ...SUGESTOES])].map(n => <option key={n} value={n} />)}</datalist>
      <div className="aq-previa">{nome.trim() ? existe ? 'Já tem ' + (d.porCaixa.get(existe.id) || []).length + ' processos nesta secretaria.' : <><b>Secretaria nova.</b> Uma caixa com esse nome vai aparecer na estante da Outra Secretaria.</> : null}</div>
      {botoes(ja ? 'Trocar' : 'Mandar')}
    </form>
  );
}
