'use client';
// Tela de entrada: senha de 6 dígitos do gestor (entra sozinha ao completar) ou o nome da pessoa da equipe
import { useState } from 'react';
import { iniciais } from '@/lib/organizacao';
import type { Sessao } from './sessao';

export function Avatar({ nome, pequeno }: { nome: string; pequeno?: boolean }){
  return <span className={'avatar' + (pequeno ? ' sm' : '')} aria-hidden="true">{iniciais(nome)}</span>;
}

export function Entrada({ s, entrouPessoa }: { s: Sessao; entrouPessoa: (nome: string) => void }){
  const [pin, setPin] = useState('');
  const [conferindo, setConferindo] = useState(false);

  async function enviar(valor: string){
    if (!/^\d{6}$/.test(valor)){ s.setMsg('A senha tem 6 números.'); return; }
    setConferindo(true);
    const erro = await s.entrarComSenha(valor);
    setConferindo(false);
    setPin('');
    if (erro){ s.setMsg(erro); document.getElementById('orgPin')?.focus(); }
  }

  return (
    <div className="lock" id="orgLock">
      <div className="lock-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
      <h2 id="orgTitle">Organização</h2>
      <p>Área do gestor. Digite a senha de 6 dígitos.</p>
      <form id="orgPinForm" autoComplete="off" onSubmit={e => { e.preventDefault(); enviar(pin); }}>
        <input className="pin-input" id="orgPin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label="Senha de 6 dígitos" placeholder="••••••" required
          value={pin} onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPin(v); s.setMsg('');
            if (v.length === 6) enviar(v);
          }} />
        <div className="lock-msg" id="orgMsg" role="alert">{s.msg}</div>
        <button type="submit" className="btn primary" id="orgEnter" disabled={conferindo}>{conferindo ? 'Conferindo…' : 'Entrar'}</button>
      </form>
      <div className="lock-pessoas" id="orgEntrarPessoas" hidden={!s.entrada.length}>
        <div className="lock-sep">É da equipe? Entre na sua tela</div>
        <div className="lock-lista" id="orgEntrarLista">
          {s.entrada.map(p => (
            <button key={p.id} type="button" className="pessoa-btn" data-entrar={p.id} onClick={async () => {
              const d = await s.entrarComoPessoa(p.id);
              if (d) entrouPessoa(d.euNome);
            }}><Avatar nome={p.nome} /><span>{p.nome}</span></button>
          ))}
        </div>
      </div>
    </div>
  );
}
