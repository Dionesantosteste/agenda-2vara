'use client';
// Seção Assistente (só o gestor): conversa com a IA sobre rotina de secretaria, movimentação de
// processo e redação de certidões; salva rotinas (passo a passo) e modelos de texto.
// A senha é a mesma da Organização e fica guardada na aba, como lá.
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ModeloTexto, Proposta, Rotina } from '@/lib/assistente';
import { anonimizar, desanonimizar, desanonimizarTudo, resumoTrocados, type Mapa } from '@/lib/anonimizar';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';
import { chamar, copiar, gravarPin, lerPin, problema } from './comum';
import { DialogoMandar, DialogoModelo, DialogoRotina, type RascunhoModelo, type RascunhoRotina } from './Dialogos';
import { AbaRotinas } from './Rotinas';
import { TextoIA, semMarcas } from './TextoIA';

// protegidos: o que foi trocado por marcador antes de ir para a IA (ex.: "1 CPF e 1 telefone")
type Balao = { id: number; papel: 'eu' | 'ia' | 'erro'; texto: string; propostas?: Proposta[]; protegidos?: string };
// historico vai para a IA (com marcadores); mapa (marcador → dado real) fica só nesta aba
type Conversa = { baloes: Balao[]; historico: unknown[]; mapa: Mapa; versao?: string };

const SUGESTOES = [
  'Qual a rotina de processo de INSS depois da decisão?',
  'Escreva uma certidão de decurso de prazo sem manifestação.',
  'Como movimentar o processo depois do trânsito em julgado?',
  'Salve uma rotina: alvará — conferir a conta, expedir o alvará, intimar o advogado.'
];

const CONVERSA_VAZIA: Conversa = { baloes: [], historico: [], mapa: {} };
function lerConversa(): Conversa {
  try { const c = JSON.parse(sessionStorage.getItem('astConversa') || 'null'); if (c && Array.isArray(c.baloes) && Array.isArray(c.historico)) return { mapa: {}, ...c }; } catch { /* nada guardado */ }
  return CONVERSA_VAZIA;
}
function gravarConversa(c: Conversa){
  try { sessionStorage.setItem('astConversa', JSON.stringify(c)); } catch { /* sem espaço: segue só na memória */ }
}

// embutido: dentro do painel do botão flutuante (sem o título da página)
export function Assistente({ embutido = false }: { embutido?: boolean }){
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return (
    <section id="view-assistente" className={embutido ? 'ast-embutido' : undefined} aria-labelledby={embutido ? undefined : 'astTitulo'} aria-label={embutido ? 'Assistente' : undefined}>
      {!embutido && (
        <header>
          <div>
            <h1 id="astTitulo">Assistente</h1>
            <div className="tagline">Rotina de secretaria, movimentação de processo e redação de certidões, com IA</div>
          </div>
        </header>
      )}
      {pronto && <Corpo embutido={embutido} />}
    </section>
  );
}

function Corpo({ embutido }: { embutido: boolean }){
  const avisar = useAviso();
  const [pin, setPinEstado] = useState<string | null>(() => lerPin());
  const [aba, setAba] = useState<'conversa' | 'rotinas'>('conversa');
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [modelos, setModelos] = useState<ModeloTexto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [conversa, setConversa] = useState<Conversa>(() => lerConversa());
  const [pergunta, setPergunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const [rotinaAberta, setRotinaAberta] = useState<RascunhoRotina | null>(null);
  const [modeloAberto, setModeloAberto] = useState<RascunhoModelo | null>(null);
  const [mandarRotina, setMandarRotina] = useState<Rotina | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const perguntaRef = useRef<HTMLTextAreaElement>(null);

  const trancar = useCallback((msg: string) => { gravarPin(null); setPinEstado(null); if (msg) avisar(msg); }, [avisar]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await chamar('ast_dados');
    setCarregando(false);
    if (r.status === 'ok'){ setRotinas(r.rotinas || []); setModelos(r.modelos || []); return; }
    if (r.status === 'erro') avisar(problema(r)); else trancar(problema(r));
  }, [avisar, trancar]);

  useEffect(() => { if (pin) carregar(); }, [pin, carregar]);
  useEffect(() => { gravarConversa(conversa); fimRef.current?.scrollIntoView({ block: 'end' }); }, [conversa]);

  if (!pin) return <Tranca entrou={p => { gravarPin(p); setPinEstado(p); }} />;

  async function enviar(texto: string){
    const mensagem = texto.trim();
    if (!mensagem || pensando) return;
    const antes = conversa;
    // anonimização (Res. CNJ 615/2025): CPF, CNPJ, NB, e-mail, telefone e CEP viram marcadores antes de sair do navegador
    const seguro = anonimizar(mensagem, antes.mapa);
    const protegidos = resumoTrocados(seguro.trocados);
    const comPergunta: Conversa = { ...antes, mapa: seguro.mapa, baloes: [...antes.baloes, { id: Date.now(), papel: 'eu', texto: mensagem, protegidos }] };
    setConversa(comPergunta);
    setPergunta('');
    setPensando(true);
    try {
      const { data } = await supabase().auth.getSession();
      const res = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') },
        body: JSON.stringify({ pin: lerPin(), historico: antes.historico, versao: antes.versao, mensagem: seguro.texto })
      });
      const corpo = await res.json().catch(() => ({ erro: 'O servidor respondeu de um jeito inesperado.' }));
      if (!res.ok){
        if (corpo.senha){ trancar(corpo.erro); return; }
        setConversa({ ...comPergunta, baloes: [...comPergunta.baloes, { id: Date.now() + 1, papel: 'erro', texto: corpo.erro || 'Algo deu errado.' }] });
        setPergunta(p => p || mensagem);   // devolve a pergunta para tentar de novo
        return;
      }
      setConversa({
        historico: corpo.historico, versao: corpo.versao, mapa: seguro.mapa,
        baloes: [...comPergunta.baloes, { id: Date.now() + 1, papel: 'ia', texto: desanonimizar(corpo.resposta, seguro.mapa), propostas: desanonimizarTudo(corpo.propostas, seguro.mapa) }]
      });
    } catch {
      setConversa({ ...comPergunta, baloes: [...comPergunta.baloes, { id: Date.now() + 1, papel: 'erro', texto: 'Sem conexão com o servidor. Confira a internet e tente de novo.' }] });
      setPergunta(p => p || mensagem);
    } finally {
      setPensando(false);
      setTimeout(() => perguntaRef.current?.focus(), 30);
    }
  }

  function aoDigitar(e: KeyboardEvent<HTMLTextAreaElement>){
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); enviar(pergunta); }
  }

  function abrirProposta(p: Proposta){
    if (p.tipo === 'rotina') setRotinaAberta({ id: null, titulo: p.titulo, assunto: p.assunto, quando: p.quando, passos: p.passos, observacoes: p.observacoes });
    else setModeloAberto({ nome: p.nome, categoria: p.categoria, texto: p.texto });
  }

  const categorias = [...new Set(modelos.map(m => m.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return (
    <>
      <div className="ast-topo">
        <div className="abas" role="tablist" aria-label="Assistente">
          <button type="button" className="aba" role="tab" id="asttab-conversa" aria-selected={aba === 'conversa'} onClick={() => setAba('conversa')}>Conversa</button>
          <button type="button" className="aba" role="tab" id="asttab-rotinas" aria-selected={aba === 'rotinas'} onClick={() => setAba('rotinas')}>
            Rotinas de secretaria{rotinas.length ? ' (' + rotinas.length + ')' : ''}
          </button>
        </div>
        {/* no painel, quem tranca é o Trancar da Organização (fecha o painel junto) */}
        {!embutido && <button type="button" className="btn sm" onClick={() => trancar('')}>Trancar</button>}
      </div>

      <section role="tabpanel" aria-labelledby="asttab-conversa" hidden={aba !== 'conversa'} className="ast-conversa">
        {!conversa.baloes.length && (
          <div className="ast-inicio">
            <p>Pergunte sobre a rotina da secretaria, peça um texto ou dite uma rotina para salvar. Exemplos:</p>
            <div className="ast-sugestoes">
              {SUGESTOES.map(s => <button key={s} type="button" className="ast-sugestao" onClick={() => enviar(s)}>{s}</button>)}
            </div>
          </div>
        )}
        <div className="ast-baloes" aria-live="polite">
          {conversa.baloes.map(b => (
            <div key={b.id} className={'ast-balao ' + b.papel}>
              {b.papel === 'ia' ? <TextoIA texto={b.texto} /> : <div className="ast-texto"><p>{b.texto}</p></div>}
              {b.protegidos && <div className="ast-protegido">Protegido antes de enviar à IA: {b.protegidos}</div>}
              {b.papel === 'ia' && (
                <div className="ast-acoes">
                  <button type="button" className="btn sm" onClick={async () => avisar(await copiar(semMarcas(b.texto)) ? 'Texto copiado' : 'Não foi possível copiar')}>Copiar</button>
                  <button type="button" className="btn sm" onClick={() => setModeloAberto({ nome: '', categoria: '', texto: semMarcas(b.texto) })}>Salvar como modelo de texto</button>
                </div>
              )}
              {b.propostas?.map((p, i) => (
                <div key={i} className="ast-proposta">
                  <div className="ast-proposta-tipo">{p.tipo === 'rotina' ? 'Rotina para salvar' : 'Modelo de texto para salvar'}</div>
                  {p.tipo === 'rotina' ? (
                    <>
                      <strong>{p.assunto ? p.assunto + ' · ' : ''}{p.titulo}</strong>
                      {p.quando && <div className="ast-rot-quando">{p.quando}</div>}
                      <ol className="ast-rot-passos">{p.passos.map((x, j) => <li key={j}>{x}</li>)}</ol>
                    </>
                  ) : (
                    <>
                      <strong>{p.nome}{p.categoria ? ' · ' + p.categoria : ''}</strong>
                      <pre className="ast-pre">{p.texto}</pre>
                    </>
                  )}
                  <div className="ast-acoes">
                    <button type="button" className="btn sm primary" onClick={() => abrirProposta(p)}>{p.tipo === 'rotina' ? 'Conferir e salvar rotina' : 'Conferir e salvar modelo'}</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {pensando && <div className="ast-balao ia ast-pensando" role="status">Pensando…</div>}
          <div ref={fimRef} />
        </div>

        <form className="ast-envio" onSubmit={(e: FormEvent) => { e.preventDefault(); enviar(pergunta); }}>
          <label htmlFor="astPergunta" className="ast-rotulo">Sua pergunta ou pedido</label>
          <textarea id="astPergunta" ref={perguntaRef} rows={3} value={pergunta} onChange={e => setPergunta(e.target.value)} onKeyDown={aoDigitar}
            placeholder="Ex.: escreva uma certidão de intimação do INSS para implantar o benefício" />
          <div className="ast-envio-pe">
            <span className="field-hint">O que você escrever vai para a IA (Anthropic). CPF, CNPJ, nº de benefício, e-mail, telefone e CEP são trocados por marcadores antes de sair do navegador; nomes, endereços e dados de saúde não, então use só o necessário. Confira o texto antes de usar.</span>
            <div className="ast-envio-btns">
              {!!conversa.baloes.length && <button type="button" className="btn" disabled={pensando} onClick={() => setConversa(CONVERSA_VAZIA)}>Nova conversa</button>}
              <button type="submit" className="btn primary" disabled={pensando || !pergunta.trim()} title="Ctrl+Enter">{pensando ? 'Aguarde…' : 'Enviar'}</button>
            </div>
          </div>
        </form>
      </section>

      <section role="tabpanel" aria-labelledby="asttab-rotinas" hidden={aba !== 'rotinas'}>
        <AbaRotinas rotinas={rotinas} carregando={carregando} editar={setRotinaAberta} mandar={setMandarRotina} recarregar={carregar} />
      </section>

      <DialogoMandar rotina={mandarRotina} fechar={() => setMandarRotina(null)} />
      <DialogoRotina rascunho={rotinaAberta} fechar={() => setRotinaAberta(null)} salvo={carregar} />
      <DialogoModelo rascunho={modeloAberto} categorias={categorias} fechar={() => { setModeloAberto(null); carregar(); }} />
    </>
  );
}

// Entrada do gestor: a mesma senha de 6 dígitos da Organização
function Tranca({ entrou }: { entrou: (pin: string) => void }){
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [entrando, setEntrando] = useState(false);
  async function conferir(v: string){
    if (v.length !== 6 || entrando) return;
    setEntrando(true);
    const r = await chamar('ast_dados', { p_pin: v });
    setEntrando(false);
    if (r.status === 'ok') entrou(v);
    else { setMsg(problema(r)); setPin(''); }
  }
  return (
    <div className="lock">
      <div className="lock-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></div>
      <h2>Assistente do gestor</h2>
      <p>Digite a senha de 6 dígitos da Organização.</p>
      <form autoComplete="off" onSubmit={(e: FormEvent) => { e.preventDefault(); conferir(pin); }}>
        <input className="pin-input" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label="Senha de 6 dígitos" placeholder="••••••" autoFocus
          value={pin} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(v); setMsg(''); if (v.length === 6) conferir(v); }} />
        <div className="lock-msg" role="alert">{msg}</div>
        <button type="submit" className="btn primary" disabled={entrando}>{entrando ? 'Conferindo…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
