'use client';
// Seção Organização do sistema novo. Já migradas: a entrada (senha do gestor ou nome da pessoa), o cabeçalho,
// as abas e as abas Tarefas e mural, Quadro, Lembretes e Rotinas. As outras abas ainda estão no sistema atual.
// Usa as mesmas funções do Supabase (org_*) e guarda o acesso do mesmo jeito que o sistema atual
// (senha na aba do navegador, pessoa no navegador), então quem entra num sistema já entra no outro.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { diasAte, iniciais, lerDados, mensagemDoStatus, rotinaFeita, type Dados } from '@/lib/organizacao';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';
import { useCalendario } from '@/componentes/useCalendario';
import { Lembretes } from './Lembretes';
import { ListaMural } from './ListaMural';
import { Quadro } from './Quadro';
import { Rotinas } from './Rotinas';

export type Resposta = { status: string; message?: string; codigo?: string; [campo: string]: any };
export type Sessao = { modo: 'gestor' | 'pessoa'; pin: string | null; eu: string | null; ver: string | null };
export type Banco = {
  chamar: (fn: string, args?: Record<string, unknown>) => Promise<Resposta>;
  ok: (r: Resposta) => boolean;            // trata a resposta; true quando deu certo
  recarregar: () => Promise<boolean>;
};

const ABAS: { id: string; nome: string; classe?: string }[] = [
  { id: 'equipe', nome: 'Tarefas da equipe', classe: 'so-gestor' },
  { id: 'lista', nome: 'Tarefas e mural' },
  { id: 'quadro', nome: 'Quadro' },
  { id: 'lembretes', nome: 'Lembretes' },
  { id: 'modelos', nome: 'Modelos de texto' },
  { id: 'rotinas', nome: 'Rotinas', classe: 'so-proprio' },
  { id: 'aniver', nome: 'Aniversariantes', classe: 'so-proprio so-gestor' }
];

const lerSessao = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const gravarSessao = (k: string, v: string | null) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* sem armazenamento */ } };
const lerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLocal = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

export function Organizacao(){
  // A tela depende do navegador (armazenamento, relógio): só aparece depois de carregar nele
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return pronto ? <Corpo /> : null;
}

function Corpo(){
  const avisar = useAviso();
  const { cal } = useCalendario();
  const util = useCallback((d: Date) => cal.util(d), [cal]);
  const [hoje, setHoje] = useState(() => new Date());
  const [dados, setDados] = useState<Dados | null>(null);
  const [sessao, setSessaoEstado] = useState<Sessao>({ modo: 'gestor', pin: null, eu: null, ver: null });
  const sessaoRef = useRef(sessao);
  const [aba, setAba] = useState('lista');
  const [msg, setMsg] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [publicas, setPublicas] = useState<{ id: string; nome: string }[]>([]);
  const [pin, setPin] = useState('');
  const [versao, setVersao] = useState(0);   // muda ao trocar de tela, para o Quadro recomeçar limpo
  const semCarregar = useRef(false);
  const entrandoRef = useRef(false);
  const pinRef = useRef<HTMLInputElement>(null);

  const mudarSessao = useCallback((s: Sessao) => { sessaoRef.current = s; setSessaoEstado(s); }, []);

  useEffect(() => { const t = setInterval(() => setHoje(new Date()), 60000); return () => clearInterval(t); }, []);

  // Toda chamada leva a senha (gestor) e a tela em uso: a da pessoa que entrou ou a que o gestor escolheu
  const chamar = useCallback(async (fn: string, args: Record<string, unknown> = {}): Promise<Resposta> => {
    const s = sessaoRef.current;
    const base = { p_pin: s.modo === 'pessoa' ? null : s.pin, p_pessoa: s.modo === 'pessoa' ? s.eu : s.ver };
    const res = await supabase().rpc(fn, { ...base, ...args });
    if (res.error){
      const m = (res.error.code || '') + ' ' + (res.error.message || '');
      return { status: 'erro', codigo: res.error.code || '', message: /PGRST202|org_|function/i.test(m)
        ? 'A Organização no Supabase está desatualizada ou não foi instalada. Rode o arquivo sql/organizacao.sql inteiro de novo (veja o LEIA-ME.md).'
        : 'Erro no banco de dados: ' + res.error.message };
    }
    return (res.data as Resposta) || { status: 'erro', message: 'O banco não respondeu.' };
  }, []);

  const carregarEntrada = useCallback(async () => {
    const res = await supabase().rpc('org_pessoas_publico');
    setPublicas(!res.error && res.data && Array.isArray(res.data.pessoas) ? res.data.pessoas : []);
  }, []);

  const trancar = useCallback((mensagem: string) => {
    mudarSessao({ modo: 'gestor', pin: null, eu: null, ver: null });
    setDados(null); setMsg(mensagem); setPin('');
    gravarSessao('orgPin', null); gravarSessao('orgVer', null); gravarLocal('orgPessoa', null);
    carregarEntrada();
    setTimeout(() => pinRef.current?.focus(), 30);
  }, [carregarEntrada, mudarSessao]);

  const verTela = useCallback(async (id: string | null) => {
    const s = { ...sessaoRef.current, ver: id || null };
    mudarSessao(s);
    gravarSessao('orgVer', s.ver);
    setVersao(v => v + 1);
    if (s.ver) setAba(a => (a === 'rotinas' ? 'quadro' : a));
    await recarregarRef.current();
  }, [mudarSessao]);

  // Trata a resposta; devolve true quando deu certo
  const ok = useCallback((r: Resposta) => {
    if (r.status === 'ok') return true;
    if (r.status === 'erro'){ avisar(r.message || 'Erro'); return false; }
    // o gestor estava vendo a tela de alguém que foi excluído: volta para a dele
    const s = sessaoRef.current;
    if (r.status === 'sem_pessoa' && s.modo === 'gestor' && s.ver){ verTela(null); avisar('Essa pessoa não está mais cadastrada.'); return false; }
    trancar(mensagemDoStatus(r.status, s.modo === 'pessoa'));
    return false;
  }, [avisar, trancar, verTela]);

  // Se o Supabase ainda não tem org_carregar (SQL não atualizado), usa org_listar, que traz tudo.
  const buscar = useCallback(async () => {
    let r: Resposta = semCarregar.current ? { status: 'erro', codigo: 'PGRST202' } : await chamar('org_carregar', { p_equipe: 0 });
    if (r.status === 'erro' && r.codigo === 'PGRST202'){ semCarregar.current = true; r = await chamar('org_listar'); }
    return r;
  }, [chamar]);

  const carregar = useCallback(async (): Promise<Dados | null> => {
    const r = await buscar();
    if (!ok(r)) return null;
    const d = lerDados(r);
    setDados(d);
    return d;
  }, [buscar, ok]);
  const recarregar = useCallback(async () => !!(await carregar()), [carregar]);
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;

  // Ao abrir: segue com a senha da aba ou com a pessoa lembrada neste navegador
  useEffect(() => {
    const pinSalvo = lerSessao('orgPin'), ver = lerSessao('orgVer') || null, eu = pinSalvo ? null : lerLocal('orgPessoa');
    const modo = eu ? 'pessoa' : 'gestor';
    setAba(modo === 'pessoa' ? 'quadro' : lerSessao('orgTab') || 'lista');
    if (pinSalvo || eu){
      mudarSessao({ modo, pin: pinSalvo, eu, ver });
      recarregar();
    } else carregarEntrada();
    // só ao abrir a tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrarComSenha(senha: string){
    if (entrandoRef.current) return;
    if (!/^\d{6}$/.test(senha)){ setMsg('A senha tem 6 números.'); return; }
    entrandoRef.current = true; setEntrando(true);
    mudarSessao({ modo: 'gestor', pin: senha, eu: null, ver: null });
    const r = await buscar();
    entrandoRef.current = false; setEntrando(false);
    if (r.status === 'ok'){
      gravarSessao('orgPin', senha);
      setDados(lerDados(r)); setPin('');
      return;
    }
    mudarSessao({ modo: 'gestor', pin: null, eu: null, ver: null });
    setPin('');
    setMsg(r.status === 'erro' ? r.message || '' : mensagemDoStatus(r.status, false));
    pinRef.current?.focus();
  }

  async function entrarComoPessoa(id: string){
    mudarSessao({ modo: 'pessoa', pin: null, eu: id, ver: null });
    setAba('quadro'); gravarSessao('orgTab', 'quadro');
    const d = await carregar();
    if (!d) return;
    gravarLocal('orgPessoa', id);
    avisar('Olá, ' + (d.euNome.split(' ')[0] || d.euNome) + '!');
  }

  // ---- entrada ----
  if (!dados){
    return (
      <section id="view-organizacao" aria-labelledby="orgTitle">
        <div className="lock" id="orgLock">
          <div className="lock-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></div>
          <h2 id="orgTitle">Organização</h2>
          <p>Área do gestor. Digite a senha de 6 dígitos.</p>
          <form id="orgPinForm" autoComplete="off" onSubmit={(e: FormEvent) => { e.preventDefault(); entrarComSenha(pin); }}>
            <input className="pin-input" id="orgPin" ref={pinRef} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label="Senha de 6 dígitos" placeholder="••••••" required
              value={pin} onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPin(v); setMsg('');
                if (v.length === 6) entrarComSenha(v);   // digitar os 6 números já envia a senha
              }} />
            <div className="lock-msg" id="orgMsg" role="alert">{msg}</div>
            <button type="submit" className="btn primary" id="orgEnter" disabled={entrando}>{entrando ? 'Conferindo…' : 'Entrar'}</button>
          </form>
          <div className="lock-pessoas" id="orgEntrarPessoas" hidden={!publicas.length}>
            <div className="lock-sep">É da equipe? Entre na sua tela</div>
            <div className="lock-lista" id="orgEntrarLista">
              {publicas.map(p => (
                <button key={p.id} type="button" className="pessoa-btn" data-entrar={p.id} onClick={() => entrarComoPessoa(p.id)}>
                  <span className="avatar" aria-hidden="true">{iniciais(p.nome)}</span><span>{p.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---- tela aberta ----
  const pessoa = sessao.modo === 'pessoa', alheia = pessoa || !!sessao.ver;
  const gestorNaPropria = !pessoa && !sessao.ver;
  const visivel = (id: string) => (id === 'equipe' ? !pessoa && dados.temEquipe : id === 'rotinas' ? !alheia : id === 'aniver' ? gestorNaPropria && !!dados.aniversarios : true);
  const abaAtual = visivel(aba) ? aba : 'lista';
  const mesAtual = hoje.getMonth() + 1;
  const contagem: Record<string, number> = {
    equipe: dados.aConferir,
    lembretes: dados.lembretes.filter(l => !l.feitoEm && diasAte(l.data, hoje) <= 0).length,
    rotinas: dados.rotinas.filter(r => !rotinaFeita(r, hoje)).length,
    aniver: dados.aniversarios ? dados.aniversarios.filter(a => a.mes === mesAtual).length : 0
  };
  const primeiroNome = dados.euNome.split(' ')[0] || dados.euNome;
  const devolvidas = dados.tarefas.filter(t => t.conferencia === 'devolvida' && t.etapa !== 'feito' && !t.arquivadaEm).length;
  const banco: Banco = { chamar, ok, recarregar };

  return (
    <section id="view-organizacao" aria-labelledby="orgTitle">
      <div id="orgContent" className={(pessoa ? 'org-modo-pessoa' : '') + (alheia ? ' org-alheia' : '')}>
        <header>
          <div>
            <h1 id="orgH1">{pessoa ? 'Olá, ' + (primeiroNome || 'tudo bem') + '!' : 'Organização'}</h1>
            <div className="tagline" id="orgTagline">
              {pessoa
                ? 'Seu quadro, mural e lembretes. Tarefas do gestor chegam na primeira coluna.' + (devolvidas ? ' Você tem ' + devolvidas + (devolvidas === 1 ? ' tarefa devolvida' : ' tarefas devolvidas') + ' na conferência.' : '')
                : sessao.ver ? 'Tela de ' + dados.euNome : 'Tarefas, mural, lembretes e rotinas da gestão'}
            </div>
          </div>
          <div className="org-head-actions">
            <select className="org-in so-gestor" id="orgVer" aria-label="Ver a tela de" hidden={pessoa || !dados.temEquipe || !dados.pessoas.length}
              value={sessao.ver || ''} onChange={e => verTela(e.target.value)}>
              <option value="">Minha tela (gestor)</option>
              {dados.pessoas.map(p => <option key={p.id} value={p.id}>Tela de {p.nome}{p.ativo ? '' : ' (desativada)'}</option>)}
            </select>
            <button type="button" className="btn" id="orgLockBtn" title={pessoa ? 'Sair da sua tela neste navegador' : 'Trancar a Organização neste navegador'}
              onClick={() => { trancar(''); avisar(pessoa ? 'Você saiu da sua tela' : 'Organização trancada'); }}>{pessoa ? 'Sair' : 'Trancar'}</button>
          </div>
        </header>
        <div className="org-ver-aviso" id="orgVerAviso" hidden={pessoa || !sessao.ver}>
          <span id="orgVerAvisoTxt">Você está na tela de <b>{dados.euNome}</b>. O que mudar aqui aparece para essa pessoa.</span>
          <button type="button" className="btn" id="orgVerVoltar" onClick={() => verTela(null)}>Voltar para a minha tela</button>
        </div>
        <div className="org-tabs-scroll">
          <div className="org-tabs" id="orgTabs" role="tablist" aria-label="Partes da Organização">
            {ABAS.filter(a => visivel(a.id)).map(a => (
              <button key={a.id} type="button" className={'org-tab' + (a.classe ? ' ' + a.classe : '')} role="tab" data-tab={a.id} aria-selected={abaAtual === a.id}
                title={a.id === 'equipe' && contagem.equipe ? 'Tarefas esperando a sua conferência' : a.id === 'aniver' ? 'Aniversariantes deste mês' : undefined}
                onClick={() => { setAba(a.id); gravarSessao('orgTab', a.id); }}>
                {a.nome}{contagem[a.id] ? <> <span className="org-tab-n">{contagem[a.id]}</span></> : null}
              </button>
            ))}
          </div>
        </div>
        {abaAtual === 'quadro' && <Quadro key={versao} dados={dados} setDados={setDados} pessoa={pessoa} alheia={alheia} eu={sessao.eu} hoje={hoje} util={util} banco={banco} />}
        {abaAtual === 'lista' && <ListaMural key={versao} dados={dados} setDados={setDados} pessoa={pessoa} alheia={alheia} eu={sessao.eu} hoje={hoje} banco={banco} />}
        {abaAtual === 'lembretes' && <Lembretes key={versao} dados={dados} setDados={setDados} hoje={hoje} banco={banco} />}
        {abaAtual === 'rotinas' && <Rotinas key={versao} dados={dados} setDados={setDados} hoje={hoje} banco={banco} />}
        {!['quadro', 'lista', 'lembretes', 'rotinas'].includes(abaAtual) && <AindaNoAtual aba={ABAS.find(a => a.id === abaAtual)?.nome || ''} />}
      </div>
    </section>
  );
}

// As outras abas ainda não foram migradas: levam para o sistema atual, que guarda o mesmo acesso
function AindaNoAtual({ aba }: { aba: string }){
  return (
    <div className="org-pane" id="orgPaneAindaAtual">
      <div className="panel">
        <div className="org-empty">
          A aba “{aba}” ainda está no sistema atual. <a href="/#organizacao">Abrir no sistema atual</a>
        </div>
      </div>
    </div>
  );
}
