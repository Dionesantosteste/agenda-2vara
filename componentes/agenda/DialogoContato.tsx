'use client';
// Janela de cadastro e edição de contato (telefones e e-mails com rótulo, categoria e categoria nova)
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ROTULOS_EMAIL, ROTULOS_TELEFONE, linhasPreenchidas, type Contato, type Rotulado } from '@/lib/agenda';
import { useAviso } from '@/componentes/Avisos';

export type DadosContato = { name: string; phones: Rotulado[]; emails: Rotulado[]; category: string };
type Linha = Rotulado & { k: number };

const NOVA = '__add_new__';
let seq = 0;
const linha = (rotulos: string[], r?: Rotulado): Linha => ({ k: ++seq, label: r?.label || rotulos[0], value: r?.value || '' });

// Abre e fecha um <dialog> nativo conforme "aberto"; fecha também ao clicar fora da janela
export function useJanela(aberto: boolean, fechar: () => void){
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  const cliqueFora = (e: MouseEvent<HTMLDialogElement>) => { if (e.target === e.currentTarget) fechar(); };
  return { ref, cliqueFora, aoFechar: () => { if (aberto) fechar(); } };
}

function Linhas({ id, rotulos, email, linhas, mudar }: { id: string; rotulos: string[]; email?: boolean; linhas: Linha[]; mudar: (l: Linha[]) => void }){
  return (
    <div id={id}>
      {linhas.map(l => (
        <div className="multi-row" key={l.k}>
          <select value={l.label} onChange={e => mudar(linhas.map(x => (x.k === l.k ? { ...x, label: e.target.value } : x)))}>
            {rotulos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type={email ? 'email' : 'text'} placeholder={email ? 'nome@email.com' : '(65) 99999-0000'} className="row-value" value={l.value}
            onChange={e => mudar(linhas.map(x => (x.k === l.k ? { ...x, value: e.target.value } : x)))} />
          <button type="button" className="remove-row-btn" title="Remover" onClick={() => mudar(linhas.filter(x => x.k !== l.k))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export function DialogoContato({ contato, categorias, fechar, salvar, excluir, novaCategoria }: {
  contato: Contato | null | undefined; categorias: string[]; fechar: () => void;
  salvar: (id: string | null, d: DadosContato) => void; excluir: (id: string) => void; novaCategoria: (nome: string) => void;
}){
  const avisar = useAviso();
  const aberto = contato !== undefined;
  const { ref, cliqueFora, aoFechar } = useJanela(aberto, fechar);
  const nomeRef = useRef<HTMLInputElement>(null);
  const novaRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const [telefones, setTelefones] = useState<Linha[]>([]);
  const [emails, setEmails] = useState<Linha[]>([]);
  const [categoria, setCategoria] = useState('');
  const [nova, setNova] = useState<string | null>(null);   // null = campo de categoria nova escondido

  // Ao abrir, preenche com o contato (ou em branco)
  useEffect(() => {
    if (!aberto) return;
    setNome(contato?.name || '');
    setTelefones(contato?.phones.length ? contato.phones.map(p => linha(ROTULOS_TELEFONE, p)) : [linha(ROTULOS_TELEFONE)]);
    setEmails(contato?.emails.length ? contato.emails.map(e => linha(ROTULOS_EMAIL, e)) : [linha(ROTULOS_EMAIL)]);
    setCategoria(contato?.category || '');
    setNova(null);
    setTimeout(() => nomeRef.current?.focus(), 30);
  }, [aberto, contato]);

  function confirmarNova(){
    if (nova === null) return;
    const n = nova.trim();
    setNova(null);
    if (!n){ setCategoria(''); return; }
    novaCategoria(n);
    setCategoria(n);
  }

  // Categoria do contato que saiu da lista continua aparecendo, marcada como removida
  const removida = contato && contato.category && !categorias.includes(contato.category) ? contato.category : null;

  return (
    <dialog id="dialog" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      <form className="sheet" id="form" onSubmit={e => {
        e.preventDefault();
        const d: DadosContato = { name: nome.trim(), phones: linhasPreenchidas(telefones), emails: linhasPreenchidas(emails), category: categoria === NOVA ? '' : categoria };
        if (!d.name && !d.phones.length && !d.emails.length){ avisar('Preencha ao menos um campo'); return; }
        salvar(contato ? contato.id : null, d);
        fechar();
      }}>
        <h2 id="dialogTitle">{contato ? 'Editar contato' : 'Novo contato'}</h2>
        <div className="field">
          <label htmlFor="fName">Nome</label>
          <input id="fName" ref={nomeRef} maxLength={80} placeholder="Maria Silva" value={nome} onChange={e => setNome(e.target.value)} />
        </div>

        <div className="multi-block">
          <div className="multi-head">
            <label>Telefones</label>
            <button type="button" className="add-row-btn" id="addPhoneRow" onClick={() => setTelefones([...telefones, linha(ROTULOS_TELEFONE)])}>+ telefone</button>
          </div>
          <Linhas id="phoneRows" rotulos={ROTULOS_TELEFONE} linhas={telefones} mudar={setTelefones} />
        </div>

        <div className="multi-block">
          <div className="multi-head">
            <label>E-mails</label>
            <button type="button" className="add-row-btn" id="addEmailRow" onClick={() => setEmails([...emails, linha(ROTULOS_EMAIL)])}>+ e-mail</button>
          </div>
          <Linhas id="emailRows" rotulos={ROTULOS_EMAIL} email linhas={emails} mudar={setEmails} />
        </div>

        <div className="field">
          <label htmlFor="fCategory">Categoria</label>
          <select id="fCategory" value={categoria} onChange={e => {
            setCategoria(e.target.value);
            if (e.target.value === NOVA){ setNova(''); setTimeout(() => novaRef.current?.focus(), 20); }
            else setNova(null);
          }}>
            <option value="">Sem categoria</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            {removida && <option value={removida}>{removida} (removida)</option>}
            <option value={NOVA}>+ Nova categoria…</option>
          </select>
        </div>
        <div className="field" id="inlineCatWrap" hidden={nova === null}>
          <label htmlFor="inlineCatInput">Nova categoria</label>
          <input id="inlineCatInput" ref={novaRef} maxLength={30} placeholder="Digite o nome e pressione Enter" value={nova || ''}
            onChange={e => setNova(e.target.value)} onBlur={confirmarNova}
            onKeyDown={e => {
              if (e.key === 'Enter'){ e.preventDefault(); confirmarNova(); }
              if (e.key === 'Escape'){ e.preventDefault(); setCategoria(''); setNova(null); }
            }} />
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" id="deleteBtn" hidden={!contato} onClick={() => { if (contato){ excluir(contato.id); fechar(); } }}>Excluir</button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="btn" id="cancelBtn" onClick={fechar}>Cancelar</button>
            <button type="submit" className="btn primary">Salvar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
