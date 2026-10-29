'use client';
// Tela do administrador: convidar pessoas por e-mail, ver quem já aceitou e remover acessos.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { emailValido } from '@/lib/acesso';
import { useAviso } from '../Avisos';
import { useSessao } from '../Porteiro';

type Usuario = { id: string; email: string; criadoEm: string; ultimoAcesso: string | null; ativo: boolean; admin: boolean; eu: boolean };

async function chamar(metodo: string, corpo?: unknown, consulta = ''){
  const { data } = await supabase().auth.getSession();
  const r = await fetch('/api/acesso' + consulta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.erro || 'Erro ' + r.status);
  return json;
}

const dataCurta = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' }) : '—';

export function Acessos(){
  const { admin } = useSessao();
  const avisar = useAviso();
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try { setLista((await chamar('GET')).usuarios); setErro(''); }
    catch (e) { setErro((e as Error).message); }
  }, []);
  useEffect(() => { if (admin) carregar(); }, [admin, carregar]);

  async function convidar(e: FormEvent){
    e.preventDefault();
    if (!emailValido(email)) { avisar('Digite um e-mail válido.'); return; }
    setEnviando(true);
    try { await chamar('POST', { email }); avisar('Convite enviado para ' + email.trim()); setEmail(''); await carregar(); }
    catch (er) { avisar((er as Error).message); }
    setEnviando(false);
  }
  async function reenviar(u: Usuario){
    try { await chamar('POST', { email: u.email }); avisar('Convite reenviado para ' + u.email); }
    catch (er) { avisar((er as Error).message); }
  }
  async function remover(u: Usuario){
    if (!confirm('Remover o acesso de ' + u.email + '? Ela deixa de entrar no sistema. Os dados que ela cadastrou continuam.')) return;
    try { await chamar('DELETE', undefined, '?id=' + encodeURIComponent(u.id)); avisar('Acesso removido'); await carregar(); }
    catch (er) { avisar((er as Error).message); }
  }

  if (!admin) return (
    <>
      <header><div><h1>Acessos</h1></div></header>
      <section className="panel"><p>Só o administrador gerencia os acessos.</p></section>
    </>
  );

  return (
    <>
      <header>
        <div>
          <h1>Acessos</h1>
          <div className="tagline">Quem pode entrar no sistema. Cada pessoa recebe um convite por e-mail e cria a própria senha.</div>
        </div>
      </header>
      <section className="panel" aria-labelledby="acConvTit">
        <div className="panel-head"><h2 id="acConvTit">Convidar alguém</h2></div>
        <form className="acesso-convite" onSubmit={convidar} noValidate>
          <div className="field">
            <label htmlFor="acConvEmail">E-mail da pessoa</label>
            <input id="acConvEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar convite'}</button>
        </form>
      </section>
      <section className="panel" aria-labelledby="acListaTit">
        <div className="panel-head"><h2 id="acListaTit">Pessoas com acesso</h2>{lista && <span>{lista.length}</span>}</div>
        {erro && <div className="acesso-msg erro" role="alert">{erro}</div>}
        {!lista && !erro && <p>Carregando…</p>}
        {lista && (
          <ul className="acesso-lista">
            {lista.map(u => (
              <li key={u.id}>
                <div className="acesso-quem">
                  <strong>{u.email}</strong>
                  <span>{u.ativo ? 'Último acesso: ' + dataCurta(u.ultimoAcesso) : 'Convidado em ' + dataCurta(u.criadoEm)}</span>
                </div>
                <span className={'tag ' + (u.ativo ? 'novo-pronta' : 'novo-atual')}>{u.admin ? 'Administrador' : u.ativo ? 'Ativo' : 'Convite pendente'}</span>
                {!u.ativo && <button type="button" className="btn sm" onClick={() => reenviar(u)}>Reenviar convite</button>}
                {!u.eu && <button type="button" className="btn sm ghost" onClick={() => remover(u)}>Remover</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
