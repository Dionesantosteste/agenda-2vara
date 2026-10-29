'use client';
// Tela aberta pelo link do e-mail: serve para o convite (primeira senha) e para "esqueci minha senha".
// O Supabase lê o link, abre uma sessão temporária e aqui a pessoa escolhe a senha.
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { problemaNaSenha, SENHA_MINIMA, traduzirErroAuth } from '@/lib/acesso';
import { Cartao } from './Cartao';

type Estado = 'aguardando' | 'pronto' | 'invalido' | 'feito';

export function DefinirSenha(){
  const [estado, setEstado] = useState<Estado>('aguardando');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const auth = supabase().auth;
    let acabou = false;
    const aceita = (e: string | undefined) => { if (acabou || !e) return; acabou = true; setEmail(e); setEstado('pronto'); };
    const { data: ass } = auth.onAuthStateChange((_ev, s) => aceita(s?.user.email));
    // Link do e-mail que aponta direto para o site (?token_hash=...&type=invite|recovery): o código é conferido aqui.
    // Assim o link não passa pelo endereço do Supabase e o verificador de links do e-mail não gasta o código.
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get('token_hash');
    const tipo = params.get('type');
    let t: ReturnType<typeof setTimeout> | undefined;
    if (tokenHash && (tipo === 'invite' || tipo === 'recovery')){
      auth.verifyOtp({ token_hash: tokenHash, type: tipo }).then(({ data, error }) => {
        if (error || !data.session) { if (!acabou) { acabou = true; setEstado('invalido'); } return; }
        history.replaceState(null, '', '/definir-senha');   // tira o código do endereço
        aceita(data.session.user.email);
      });
    } else {
      auth.getSession().then(({ data }) => aceita(data.session?.user.email));
      // sem sessão depois de alguns segundos: o link venceu ou já foi usado
      t = setTimeout(() => { if (!acabou) setEstado('invalido'); }, 4000);
    }
    return () => { if (t) clearTimeout(t); ass.subscription.unsubscribe(); };
  }, []);

  async function salvar(e: FormEvent){
    e.preventDefault();
    const p = problemaNaSenha(senha, conf);
    if (p) { setMsg(p); return; }
    setMsg(''); setOcupado(true);
    const { error } = await supabase().auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) { setMsg(traduzirErroAuth(error.message)); return; }
    setEstado('feito');
    setTimeout(() => location.replace('/'), 1500);
  }

  if (estado === 'aguardando') return <Cartao titulo="Criar senha" sub="Conferindo o seu link…"><p className="acesso-nota" role="status">Um instante…</p></Cartao>;
  if (estado === 'invalido') return (
    <Cartao titulo="Link vencido" sub="Este link não vale mais">
      <p className="acesso-nota">O link do e-mail vale por pouco tempo e só funciona uma vez. Na tela de entrada, digite o seu e-mail e clique em <strong>Esqueci minha senha</strong> para receber outro. Se ainda não tem acesso, peça um novo convite ao administrador.</p>
      <a className="btn primary acesso-btn" href="/entrar">Ir para a entrada</a>
    </Cartao>
  );
  if (estado === 'feito') return <Cartao titulo="Senha criada" sub="Tudo certo"><p className="acesso-nota" role="status">Entrando no sistema…</p></Cartao>;
  return (
    <Cartao titulo="Criar senha" sub={'Conta: ' + email}>
      <form className="acesso-form" onSubmit={salvar} noValidate>
        <div className="field">
          <label htmlFor="acNova">Nova senha</label>
          <input id="acNova" type="password" autoComplete="new-password" autoFocus value={senha} onChange={e => setSenha(e.target.value)} />
          <small className="acesso-dica">Pelo menos {SENHA_MINIMA} caracteres.</small>
        </div>
        <div className="field">
          <label htmlFor="acConf">Repita a senha</label>
          <input id="acConf" type="password" autoComplete="new-password" value={conf} onChange={e => setConf(e.target.value)} />
        </div>
        {msg && <div className="acesso-msg erro" role="alert">{msg}</div>}
        <button type="submit" className="btn primary" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar senha e entrar'}</button>
      </form>
    </Cartao>
  );
}
