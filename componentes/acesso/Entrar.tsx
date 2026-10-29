'use client';
// Tela de entrada: e-mail e senha. Quem esqueceu a senha pede um link novo por e-mail.
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { emailValido, traduzirErroAuth, voltaSegura } from '@/lib/acesso';
import { Cartao } from './Cartao';

export function Entrar(){
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const volta = () => voltaSegura(new URLSearchParams(location.search).get('volta'));

  // quem já está logado vai direto para o sistema
  useEffect(() => { supabase().auth.getSession().then(({ data }) => { if (data.session) location.replace(volta()); }); }, []);

  async function entrar(e: FormEvent){
    e.preventDefault();
    setMsg(''); setInfo('');
    if (!emailValido(email)) { setMsg('Digite o e-mail com que você foi convidado.'); return; }
    if (!senha) { setMsg('Digite a senha.'); return; }
    setOcupado(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) { setOcupado(false); setMsg(traduzirErroAuth(error.message)); return; }
    location.replace(volta());
  }

  async function esqueci(){
    setMsg(''); setInfo('');
    if (!emailValido(email)) { setMsg('Digite o seu e-mail acima e clique de novo em "Esqueci minha senha".'); return; }
    setOcupado(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + '/definir-senha' });
    setOcupado(false);
    if (error) { setMsg(traduzirErroAuth(error.message)); return; }
    setInfo('Se este e-mail tiver acesso, um link para criar uma nova senha foi enviado. Confira também a caixa de spam.');
  }

  return (
    <Cartao titulo="Entrar" sub="Acesso restrito à equipe da 2ª Vara">
      <form className="acesso-form" onSubmit={entrar} noValidate>
        <div className="field">
          <label htmlFor="acEmail">E-mail</label>
          <input id="acEmail" type="email" autoComplete="username" autoFocus value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acSenha">Senha</label>
          <input id="acSenha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} />
        </div>
        {msg && <div className="acesso-msg erro" role="alert">{msg}</div>}
        {info && <div className="acesso-msg" role="status">{info}</div>}
        <button type="submit" className="btn primary" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="acesso-link" onClick={esqueci} disabled={ocupado}>Esqueci minha senha</button>
      </form>
      <p className="acesso-nota">Ainda não tem acesso? Peça um convite ao administrador.</p>
    </Cartao>
  );
}
