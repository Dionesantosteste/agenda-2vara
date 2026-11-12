'use client';
// Arquivo de processos físicos: página própria (/arquivo), com a lateral do arquivo no lugar da do
// portal e o botão "Voltar ao portal". As telas ficam no endereço depois do # (#prateleiras etc.).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ARQUIVADO, EM_SECRETARIA, PARA_DESARQUIVAR, DESARQUIVADO, type Processo } from '@/lib/arquivo';
import { useSessao } from '@/componentes/Porteiro';
import { apagarCopia, useArquivo, type ArquivoDados, type Desfazer } from './useArquivo';
import { Icone, Sprite } from './Pecas';
import { Buscar } from './Buscar';
import { Prateleiras } from './Prateleiras';
import { TelaCaixa } from './TelaCaixa';
import { Cadastrar } from './Cadastrar';
import { Conferir, contarPendencias } from './Conferir';
import { Historico } from './Historico';
import { Ficha } from './Ficha';
import { Janelas, type Janela } from './Janelas';

type Ctx = {
  d: ArquivoDados;
  aviso: (msg: string, desfazer?: Desfazer | null) => void;
  abrirProc: (id: string, modo?: string) => void;
  abrir: (j: Janela) => void;
  cadastradosAgora: string[];
  marcarCadastrado: (id: string) => void;
  preCadastro: { cx?: string; cod?: string; num?: string } | null;
  setPreCadastro: (v: { cx?: string; cod?: string; num?: string } | null) => void;
};
const Contexto = createContext<Ctx | null>(null);
export function useArq(): Ctx { const c = useContext(Contexto); if (!c) throw new Error('fora do Arquivo'); return c; }

const TELAS = [['buscar', 'Buscar', 'busca'], ['prateleiras', 'Prateleiras', 'estante'], ['cadastrar', 'Cadastrar', 'camera'], ['conferir', 'Conferir', 'conf'], ['historico', 'Histórico', 'hist']] as const;
type Tela = typeof TELAS[number][0] | 'caixa';

function lerRota(): { tela: Tela; caixa: string } {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('cx-')) return { tela: 'caixa', caixa: h.slice(3) };
  return { tela: (TELAS.some(t => t[0] === h) ? h : 'buscar') as Tela, caixa: '' };
}

// Para onde o "Voltar ao portal" leva: a página do portal de onde a pessoa veio (ou o início)
const CHAVE_VOLTA = 'arquivo-volta';
function guardarVolta(){
  try {
    const r = document.referrer ? new URL(document.referrer) : null;
    if (r && r.origin === location.origin && !r.pathname.startsWith('/arquivo') && !r.pathname.startsWith('/entrar')) sessionStorage.setItem(CHAVE_VOLTA, r.pathname + r.hash);
  } catch (e) { /* sem sessionStorage: volta para o início */ }
}
function enderecoVolta(){ try { return sessionStorage.getItem(CHAVE_VOLTA) || '/'; } catch (e) { return '/'; } }

export function Arquivo(){
  const [toast, setToast] = useState<{ msg: string; desfazer?: Desfazer | null; n: number } | null>(null);
  const tToast = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aviso = useCallback((msg: string, desfazer?: Desfazer | null) => {
    if (tToast.current) clearTimeout(tToast.current);
    setToast({ msg, desfazer, n: Date.now() });
    tToast.current = setTimeout(() => setToast(null), desfazer ? 6000 : 2800);
  }, []);
  const d = useArquivo(aviso);
  const { email, sair } = useSessao();
  const [rota, setRota] = useState<{ tela: Tela; caixa: string }>({ tela: 'buscar', caixa: '' });
  const [ficha, setFicha] = useState<{ id: string; modo?: string } | null>(null);
  const [janela, setJanela] = useState<Janela | null>(null);
  const [cadastradosAgora, setCad] = useState<string[]>([]);
  const [preCadastro, setPreCadastro] = useState<Ctx['preCadastro']>(null);

  // letras do arquivo (serifada dos títulos e a de máquina de escrever das fichas); se não carregarem,
  // a página usa as letras do sistema e continua funcionando
  useEffect(() => {
    if (document.getElementById('aq-fontes')) return;
    const l = document.createElement('link');
    l.id = 'aq-fontes'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Courier+Prime:wght@400;700&display=swap';
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    guardarVolta();
    const muda = () => { setRota(lerRota()); setFicha(null); setJanela(null); window.scrollTo(0, 0); };
    setRota(lerRota());
    window.addEventListener('hashchange', muda);
    return () => window.removeEventListener('hashchange', muda);
  }, []);

  const ctx: Ctx = useMemo(() => ({
    d, aviso, abrirProc: (id, modo) => setFicha({ id, modo }), abrir: setJanela,
    cadastradosAgora, marcarCadastrado: id => setCad(l => [id, ...l]), preCadastro, setPreCadastro
  }), [d, aviso, cadastradosAgora, preCadastro]);

  const ativos = d.processos.filter(p => !p.excluido);
  const fora = ativos.filter(p => p.situacao === PARA_DESARQUIVAR || p.situacao === DESARQUIVADO).length;
  const pend = d.estado === 'pronto' ? contarPendencias(d) : 0;
  const menuAtual = rota.tela === 'caixa' ? 'prateleiras' : rota.tela;
  const conta: Record<string, ReactNode> = {
    buscar: fora ? <span className="aq-cont aq-alerta" title="Processos fora da caixa">{fora}</span> : null,
    conferir: pend ? <span className="aq-cont">{pend.toLocaleString('pt-BR')}</span> : null
  };

  let conteudo: ReactNode;
  if (d.estado === 'carregando') conteudo = <div className="aq-card aq-vazio" role="status"><b>Abrindo o arquivo…</b><span>Carregando caixas e processos.</span></div>;
  else if (d.estado === 'sem-tabelas') conteudo = (
    <div className="aq-card aq-vazio"><Icone n="caixa" t={28} /><b>O arquivo ainda não foi preparado no banco.</b>
      <span>Rode o arquivo <span className="aq-mono">sql/arquivo.sql</span> no SQL Editor do Supabase e depois importe a planilha (veja o LEIA-ME).</span></div>);
  else if (d.estado === 'erro') conteudo = (
    <div className="aq-card aq-vazio"><Icone n="alerta" t={28} /><b>Não foi possível abrir o arquivo.</b><span>{d.erro}</span>
      <button type="button" className="aq-btn" onClick={() => d.carregar()}>Tentar de novo</button></div>);
  else conteudo = (
    <>
      {rota.tela === 'buscar' && <Buscar />}
      {rota.tela === 'prateleiras' && <Prateleiras />}
      {rota.tela === 'caixa' && <TelaCaixa id={rota.caixa} />}
      {rota.tela === 'cadastrar' && <Cadastrar />}
      {rota.tela === 'conferir' && <Conferir />}
      {rota.tela === 'historico' && <Historico />}
    </>
  );

  return (
    <Contexto.Provider value={ctx}>
      <div className="aq-app" id="arquivo">
        <Sprite />
        <div className="aq-quadro">
          <aside className="aq-lateral" aria-label="Menu do arquivo">
            <a className="aq-voltar-portal" href={enderecoVolta()} id="voltarPortal"><Icone n="volta" t={16} />Voltar ao portal</a>
            <div className="aq-plaqueta"><small>Arquivo geral</small><b>2ª VARA</b><small>processos físicos</small></div>
            <nav className="aq-menu" aria-label="Telas do arquivo">
              {TELAS.map(([k, nome, ic]) => (
                <a key={k} href={'#' + k} aria-current={menuAtual === k ? 'page' : undefined}><Icone n={ic} />{nome}{conta[k]}</a>
              ))}
            </nav>
            <div className="aq-rodape">
              {d.atualizando && d.estado === 'pronto' && <span className="aq-atualizando" role="status">Atualizando…</span>}
              {email && <span title={email}>{email}</span>}
              <button type="button" className="aq-link-claro" onClick={() => { apagarCopia().finally(sair); }}>Sair</button>
            </div>
          </aside>
          <main><div className="aq-conteudo">
            <a className="aq-voltar-cel" href={enderecoVolta()}><Icone n="volta" t={14} />Voltar ao portal</a>
            {conteudo}
          </div></main>
        </div>
        <nav className="aq-abas-cel" aria-label="Telas do arquivo">
          {TELAS.map(([k, nome, ic]) => (
            <a key={k} href={'#' + k} aria-current={menuAtual === k ? 'page' : undefined}><Icone n={ic} t={22} />{nome}{k === 'buscar' && fora ? <span className="aq-ponto" /> : null}</a>
          ))}
        </nav>
        {ficha && d.estado === 'pronto' && <Ficha id={ficha.id} modo={ficha.modo} fechar={() => setFicha(null)} />}
        {janela && <Janelas janela={janela} fechar={() => setJanela(null)} />}
        {toast && (
          <div className="aq-toast" role="status" key={toast.n}>
            <span>{toast.msg}</span>
            {toast.desfazer && <button type="button" onClick={() => { const f = toast.desfazer; setToast(null); f && f(); }}>Desfazer</button>}
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}

// Situações que contam como "fora da caixa" no Livro de saídas (os de outra secretaria ficam na estante deles)
export const NO_LIVRO = (p: Processo) => !p.excluido && (p.situacao === PARA_DESARQUIVAR || p.situacao === DESARQUIVADO || p.situacao === 4);
export { ARQUIVADO, EM_SECRETARIA };
