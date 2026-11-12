'use client';
// Ficha do processo (gaveta lateral; no celular sobe de baixo): dados datilografados, carimbo da
// situação, pendências com o botão para resolver, ações e as movimentações deste processo.
import { useEffect, useRef, useState } from 'react';
import { ARQUIVADO, DESARQUIVADO, EM_SECRETARIA, PARA_DESARQUIVAR, REMETIDO, SITUACOES, textoLocal, type Processo } from '@/lib/arquivo';
import { useArq } from './Arquivo';
import { lerMovimentos, type Movimento } from './useArquivo';
import { Icone } from './Pecas';

const DESTINOS = ['Secretaria da vara', 'Gabinete do juiz', 'Carga para advogado', 'Digitalização', 'Outro'];
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Ficha({ id, modo: modoInicial, fechar }: { id: string; modo?: string; fechar: () => void }){
  const { d, aviso, abrir, abrirProc } = useArq();
  const ref = useRef<HTMLDialogElement>(null);
  const [modo, setModo] = useState(modoInicial || '');
  const [movs, setMovs] = useState<Movimento[] | null>(null);
  const p = d.procsM.get(id);
  useEffect(() => { const dl = ref.current; if (dl && !dl.open) dl.showModal(); }, []);
  useEffect(() => { setModo(modoInicial || ''); }, [id, modoInicial]);
  useEffect(() => { let vivo = true; setMovs(null); lerMovimentos(id, 50).then(m => { if (vivo) setMovs(m); }); return () => { vivo = false; }; }, [id, p?.situacao, p?.caixa_id, p?.codigo]);
  if (!p || p.excluido) return null;

  const cx = d.caixasM.get(p.caixa_id);
  const orig = p.origem_id ? d.caixasM.get(p.origem_id) : undefined;
  const volta = cx?.secretaria && orig ? orig : cx;
  const outros = (d.indice.get(p.codigo) || []).filter(x => x.id !== p.id);
  const l = cx?.locais[0];
  const mudar = async (novo: Partial<Processo>, texto: string, msg: string) => { const desf = await d.mudarProcessos([{ p, novo, texto }]); if (desf){ aviso(msg, desf); setModo(''); } };

  const devolver = () => {
    if (cx?.secretaria && orig) return mudar({ situacao: ARQUIVADO, caixa_id: orig.id, origem_id: null }, 'Voltou de ' + cx.nome + ' para a caixa ' + orig.nome, 'Processo ' + p.codigo + ' de volta à caixa ' + orig.nome);
    if (cx?.secretaria) return abrir({ tipo: 'mover', lista: [p] });
    return mudar({ situacao: ARQUIVADO, com_quem: '', destino: '' }, (p.situacao === PARA_DESARQUIVAR ? 'Desarquivamento cancelado: fica na caixa ' : 'Voltou para a caixa ') + (cx?.nome || ''), 'Processo ' + p.codigo + ' de volta à caixa ' + (cx?.nome || ''));
  };

  return (
    <dialog className="aq-gaveta" ref={ref} aria-labelledby="aq-gav-cod" onClose={fechar} onClick={e => { if (e.target === ref.current) fechar(); }}>
      <div className="aq-gav"><div className="aq-gav-corpo">
        <div className="aq-ficha-grande">
          <div className="aq-topo-ficha"><div><span className="aq-rot">Código</span><div className="aq-cod" id="aq-gav-cod">{p.codigo}</div></div>
            <button type="button" className="aq-fechar" aria-label="Fechar" onClick={fechar}><Icone n="x" t={20} /></button></div>
          <span className={'aq-carimbo aq-s' + p.situacao}>{SITUACOES[p.situacao]}</span>
          <dl className="aq-dados">
            {cx?.secretaria
              ? <><dt>Estante</dt><dd>Outra Secretaria</dd><dt>Secretaria</dt><dd><a className="aq-link" href={'#cx-' + cx.id}>{cx.nome}</a></dd></>
              : <><dt>Prateleira</dt><dd>{l ? l[0] : <span className="aq-nada">não anotada</span>}</dd><dt>Fileira</dt><dd>{l ? l[1] : <span className="aq-nada">não anotada</span>}</dd>
                <dt>Caixa</dt><dd><a className="aq-link" href={'#cx-' + p.caixa_id}>{cx?.nome}</a></dd></>}
            {orig && <><dt>Veio da</dt><dd><a className="aq-link" href={'#cx-' + orig.id}>caixa {orig.nome}</a>{orig.locais[0] ? ' · P.' + orig.locais[0][0] + ' F.' + orig.locais[0][1] : ''}</dd></>}
            {p.com_quem ? <><dt>Com</dt><dd>{p.com_quem}{p.destino ? ' · ' + p.destino : ''}</dd></> : p.situacao === REMETIDO && p.destino ? <><dt>Remetido</dt><dd>{p.destino}</dd></> : null}
            {([['Número', p.numero], ['Classe', p.classe], ['Partes', p.partes], ['Ano', p.ano]] as [string, string][]).map(([r, v]) => <Dado key={r} r={r} v={v} />)}
            {p.obs && <Dado r="Obs." v={p.obs} />}
          </dl>
        </div>

        {cx && !cx.secretaria && !cx.locais.length && (
          <div className="aq-aviso aq-amarelo"><Icone n="alerta" t={16} /><span><b>Conferir:</b> a planilha não diz em que prateleira está a caixa {cx.nome}. Quem achar, anota aqui.
            <span className="aq-acoes-aviso"><button type="button" className="aq-btn aq-peq" onClick={() => abrir({ tipo: 'lugar', caixa: cx })}>Anotar onde a caixa está</button></span></span></div>
        )}
        {cx && cx.locais.length > 1 && (
          <div className="aq-aviso aq-amarelo"><Icone n="alerta" t={16} /><span><b>Conferir:</b> a caixa {cx.nome} está anotada em dois lugares ({textoLocal(cx)}). Qual é o certo?
            <span className="aq-acoes-aviso">{cx.locais.map(lc => (
              <button key={lc.join()} type="button" className="aq-btn aq-peq" onClick={async () => { const desf = await d.mudarCaixa(cx, { locais: [lc] }, 'Caixa ' + cx.nome + ' confirmada na prateleira ' + lc[0] + ', fileira ' + lc[1]); if (desf) aviso('Caixa ' + cx.nome + ' confirmada em P.' + lc[0] + ' F.' + lc[1], desf); }}>P.{lc[0]} · F.{lc[1]}</button>
            ))}</span></span></div>
        )}
        {outros.length > 0 && !p.volumes_ok && (
          <div className="aq-aviso aq-amarelo"><Icone n="alerta" t={16} /><span><b>Conferir:</b> este código também aparece na{outros.length > 1 ? 's caixas ' : ' caixa '}
            {outros.map((o, i) => <span key={o.id}>{i ? ', ' : ''}<button type="button" className="aq-link" onClick={() => abrirProc(o.id)}>{d.caixasM.get(o.caixa_id)?.nome}</button></span>)}. Onde ele está de verdade?
            <span className="aq-acoes-aviso">
              <button type="button" className="aq-btn aq-peq" onClick={async () => {
                const desf = await d.mudarProcessos(outros.map(o => ({ p: o, novo: { excluido: true }, texto: 'Repetido: o processo ' + p.codigo + ' está na caixa ' + (cx?.nome || '') + ', não na ' + (d.caixasM.get(o.caixa_id)?.nome || '') })));
                if (desf) aviso('Processo ' + p.codigo + ' fica na caixa ' + (cx?.nome || ''), desf);
              }}>Está na caixa {cx?.nome}</button>
              <button type="button" className="aq-btn aq-peq" onClick={async () => {
                const desf = await d.mudarProcessos([p, ...outros].map(o => ({ p: o, novo: { volumes_ok: true }, texto: 'Processo ' + p.codigo + ': volumes em caixas diferentes' })));
                if (desf) aviso('Marcado como volumes diferentes', desf);
              }}>São volumes diferentes</button>
            </span></span></div>
        )}

        {modo === 'saida' ? <FormSaida p={p} voltar={() => setModo('')} salvar={(quem, dest) => mudar({ situacao: DESARQUIVADO, com_quem: quem, destino: dest }, 'Saiu do arquivo com ' + quem + ' (' + dest + ')', 'Saída do ' + p.codigo + ' registrada')} />
          : modo === 'editar' ? <FormEditar p={p} voltar={() => setModo('')} salvar={novo => mudar(novo, 'Dados do processo ' + (novo.codigo || p.codigo) + ' editados', 'Dados salvos')} />
          : modo === 'excluir' ? (
            <div className="aq-sub-form"><h3>Excluir o cadastro do processo {p.codigo}?</h3>
              <p className="aq-sub" style={{ fontSize: 13.5 }}>Use só se o processo foi cadastrado por engano. Para processo que saiu, use “Registrar saída” ou “Remeter”.</p>
              <div className="aq-acoes"><button type="button" className="aq-btn" onClick={() => setModo('')}>Cancelar</button>
                <button type="button" className="aq-btn aq-perigo aq-cheio" onClick={async () => { const desf = await d.mudarProcessos([{ p, novo: { excluido: true }, texto: 'Cadastro do processo ' + p.codigo + ' excluído' }]); if (desf){ aviso('Processo ' + p.codigo + ' excluído', desf); fechar(); } }}>Excluir o processo {p.codigo}</button></div>
            </div>)
          : (
            <div className="aq-menu-acoes">
              {p.situacao === ARQUIVADO || p.situacao === PARA_DESARQUIVAR
                ? <button type="button" className="aq-btn aq-prim" onClick={() => setModo('saida')}>Registrar saída (desarquivar)</button>
                : <button type="button" className="aq-btn aq-prim" onClick={devolver}>{p.situacao === REMETIDO ? 'Voltou: devolver' : 'Devolver'} à caixa {volta?.nome}</button>}
              {p.situacao === PARA_DESARQUIVAR && <button type="button" className="aq-btn" onClick={devolver}>Devolver à caixa {cx?.nome}</button>}
              <button type="button" className="aq-btn" onClick={() => setModo('editar')}>Editar dados</button>
              <button type="button" className="aq-btn" onClick={() => abrir({ tipo: 'mover', lista: [p] })}>Trocar de caixa</button>
              {p.situacao !== REMETIDO && <button type="button" className="aq-btn" onClick={() => abrir({ tipo: 'remeter', lista: [p] })}>Remeter a outra vara</button>}
              <button type="button" className="aq-btn" onClick={() => abrir({ tipo: 'secretaria', lista: [p] })}>{p.situacao === EM_SECRETARIA ? 'Trocar de secretaria' : 'Mandar para outra secretaria'}</button>
              <button type="button" className="aq-btn aq-perigo" onClick={() => setModo('excluir')}>Excluir cadastro</button>
            </div>
          )}

        <div className="aq-pilha" style={{ gap: 8 }}><span className="aq-rot">Movimentações deste processo</span>
          <div className="aq-linha-tempo">
            {movs === null ? <div><time /> <span>Carregando…</span></div>
              : movs.length ? movs.map(m => <div key={m.id}><time>{m.quem === 'planilha' ? 'planilha' : quando(m.created_at)}</time><span>{m.texto}{m.quem && m.quem !== 'planilha' ? <span className="aq-sub"> · {m.quem}</span> : null}</span></div>)
              : <div><time>planilha</time><span>Importado da planilha{p.situacao ? ' (' + SITUACOES[p.situacao].toLowerCase() + ')' : ''}</span></div>}
          </div></div>
      </div></div>
    </dialog>
  );
}

function Dado({ r, v }: { r: string; v: string }){
  return <><dt>{r}</dt><dd className={v ? '' : 'aq-nada'}>{v || '—'}</dd></>;
}

function FormSaida({ p, voltar, salvar }: { p: Processo; voltar: () => void; salvar: (quem: string, dest: string) => void }){
  const [quem, setQuem] = useState(''), [dest, setDest] = useState(DESTINOS[0]);
  const [erro, setErro] = useState('');
  return (
    <form className="aq-sub-form" onSubmit={e => { e.preventDefault(); if (!quem.trim()){ setErro('Diga quem levou o processo'); return; } salvar(quem.trim(), dest); }}>
      <h3>Registrar saída do {p.codigo}</h3>
      <div className="aq-grade-campos">
        <div className="aq-campo"><label htmlFor="aq-g-quem">Quem levou</label><input id="aq-g-quem" placeholder="Nome de quem pegou" value={quem} onChange={e => { setQuem(e.target.value); setErro(''); }} autoFocus /></div>
        <div className="aq-campo"><label htmlFor="aq-g-dest">Para quê / para onde</label><select id="aq-g-dest" value={dest} onChange={e => setDest(e.target.value)}>{DESTINOS.map(x => <option key={x}>{x}</option>)}</select></div>
      </div>
      {erro && <div className="aq-aviso aq-vermelho" role="alert">{erro}</div>}
      <div className="aq-acoes"><button type="button" className="aq-btn" onClick={voltar}>Cancelar</button><button type="submit" className="aq-btn aq-prim">Registrar saída</button></div>
    </form>
  );
}

function FormEditar({ p, voltar, salvar }: { p: Processo; voltar: () => void; salvar: (novo: Partial<Processo>) => void }){
  const [v, setV] = useState({ codigo: p.codigo, ano: p.ano, numero: p.numero, classe: p.classe, partes: p.partes, obs: p.obs });
  const [erro, setErro] = useState('');
  const campo = (k: keyof typeof v, rot: string, mono = false, area = false) => (
    <div className="aq-campo"><label htmlFor={'aq-e-' + k}>{rot}</label>
      {area ? <textarea id={'aq-e-' + k} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} />
        : <input id={'aq-e-' + k} className={mono ? 'aq-mono' : ''} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} />}</div>
  );
  return (
    <form className="aq-sub-form" onSubmit={e => {
      e.preventDefault();
      const novo = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()])) as Partial<Processo>;
      if (!novo.codigo){ setErro('O código não pode ficar vazio'); return; }
      const mudou = Object.fromEntries(Object.entries(novo).filter(([k, x]) => x !== p[k as keyof Processo])) as Partial<Processo>;
      if (!Object.keys(mudou).length){ voltar(); return; }
      salvar(mudou);
    }}>
      <h3>Editar dados</h3>
      <div className="aq-grade-campos">{campo('codigo', 'Código', true)}{campo('ano', 'Ano', true)}</div>
      {campo('numero', 'Número do processo', true)}{campo('classe', 'Classe')}{campo('partes', 'Partes', false, true)}{campo('obs', 'Observação', false, true)}
      {erro && <div className="aq-aviso aq-vermelho" role="alert">{erro}</div>}
      <div className="aq-acoes"><button type="button" className="aq-btn" onClick={voltar}>Cancelar</button><button type="submit" className="aq-btn aq-prim">Salvar dados</button></div>
    </form>
  );
}
