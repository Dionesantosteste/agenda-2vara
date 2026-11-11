'use client';
// Janelas de salvar: rotina de secretaria (ast_rotinas) e modelo de texto (a biblioteca da Organização)
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { passosDoTexto, type Rotina } from '@/lib/assistente';
import { useAviso } from '@/componentes/Avisos';
import { useJanela } from '@/componentes/useJanela';
import { chamar, problema } from './comum';

export type RascunhoRotina = Omit<Rotina, 'id'> & { id: string | null };
export type RascunhoModelo = { nome: string; categoria: string; texto: string };

export function DialogoRotina({ rascunho, fechar, salvo }: { rascunho: RascunhoRotina | null; fechar: () => void; salvo: () => void }){
  const avisar = useAviso();
  const aberto = !!rascunho;
  const { ref, cliqueFora, aoFechar } = useJanela(aberto, fechar);
  const [titulo, setTitulo] = useState('');
  const [assunto, setAssunto] = useState('');
  const [quando, setQuando] = useState('');
  const [passos, setPassos] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const tituloRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rascunho) return;
    setTitulo(rascunho.titulo); setAssunto(rascunho.assunto); setQuando(rascunho.quando);
    setPassos(rascunho.passos.map((p, i) => (i + 1) + '. ' + p).join('\n')); setObs(rascunho.observacoes); setErro('');
    setTimeout(() => tituloRef.current?.focus(), 30);
  }, [rascunho]);

  async function salvar(e: FormEvent){
    e.preventDefault();
    const lista = passosDoTexto(passos);
    if (!titulo.trim()){ setErro('Dê um título à rotina.'); tituloRef.current?.focus(); return; }
    if (!lista.length){ setErro('Escreva pelo menos um passo.'); return; }
    setSalvando(true);
    const r = await chamar('ast_salvar_rotina', { p_id: rascunho?.id || null, p_titulo: titulo, p_assunto: assunto, p_quando: quando, p_passos: lista, p_observacoes: obs });
    setSalvando(false);
    if (r.status !== 'ok'){ setErro(problema(r)); return; }
    avisar('Rotina salva');
    salvo();
    fechar();
  }

  return (
    <dialog ref={ref} onClick={cliqueFora} onClose={aoFechar} aria-labelledby="astRotTitulo">
      <form className="sheet" onSubmit={salvar} noValidate>
        <h2 id="astRotTitulo">{rascunho?.id ? 'Editar rotina' : 'Salvar rotina de secretaria'}</h2>
        <div className="field">
          <label htmlFor="astRotT">Título</label>
          <input id="astRotT" ref={tituloRef} maxLength={120} value={titulo} onChange={e => { setTitulo(e.target.value); setErro(''); }} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="astRotA">Assunto</label>
            <input id="astRotA" maxLength={60} value={assunto} onChange={e => setAssunto(e.target.value)} />
            <span className="field-hint">Ex.: INSS, Execução, Alvará</span>
          </div>
          <div className="field">
            <label htmlFor="astRotQ">Quando se aplica</label>
            <input id="astRotQ" maxLength={500} value={quando} onChange={e => setQuando(e.target.value)} />
            <span className="field-hint">Ex.: depois da decisão</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="astRotP">Passos (um por linha)</label>
          <textarea id="astRotP" rows={8} value={passos} onChange={e => { setPassos(e.target.value); setErro(''); }} />
        </div>
        <div className="field">
          <label htmlFor="astRotO">Observações</label>
          <textarea id="astRotO" rows={3} maxLength={4000} value={obs} onChange={e => setObs(e.target.value)} />
        </div>
        <div className="lock-msg" role="alert">{erro}</div>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar rotina'}</button>
        </div>
      </form>
    </dialog>
  );
}

export function DialogoModelo({ rascunho, categorias, fechar }: { rascunho: RascunhoModelo | null; categorias: string[]; fechar: () => void }){
  const avisar = useAviso();
  const { ref, cliqueFora, aoFechar } = useJanela(!!rascunho, fechar);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rascunho) return;
    setNome(rascunho.nome); setCategoria(rascunho.categoria); setTexto(rascunho.texto); setErro('');
    setTimeout(() => nomeRef.current?.focus(), 30);
  }, [rascunho]);

  async function salvar(e: FormEvent){
    e.preventDefault();
    if (!nome.trim()){ setErro('Dê um nome ao modelo.'); nomeRef.current?.focus(); return; }
    if (!texto.trim()){ setErro('O texto está vazio.'); return; }
    setSalvando(true);
    const r = await chamar('org_txt_salvar_modelo', { p_pessoa: null, p_id: null, p_nome: nome, p_categoria: categoria, p_texto: texto });
    setSalvando(false);
    if (r.status !== 'ok'){ setErro(problema(r)); return; }
    avisar('Modelo salvo em Organização › Modelos de texto');
    fechar();
  }

  return (
    <dialog ref={ref} onClick={cliqueFora} onClose={aoFechar} aria-labelledby="astModTitulo">
      <form className="sheet" onSubmit={salvar} noValidate>
        <h2 id="astModTitulo">Salvar como modelo de texto</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="astModN">Nome do modelo</label>
            <input id="astModN" ref={nomeRef} maxLength={80} value={nome} onChange={e => { setNome(e.target.value); setErro(''); }} />
          </div>
          <div className="field">
            <label htmlFor="astModC">Categoria</label>
            <input id="astModC" maxLength={40} list="astModCats" value={categoria} onChange={e => setCategoria(e.target.value)} />
            <datalist id="astModCats">{categorias.map(c => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div className="field">
          <label htmlFor="astModT">Texto</label>
          <textarea id="astModT" rows={12} value={texto} onChange={e => { setTexto(e.target.value); setErro(''); }} />
          <span className="field-hint">Campos entre chaves, como {'{{processo}}'} e {'{{autor}}'}, são preenchidos na aba Modelos de texto.</span>
        </div>
        <div className="lock-msg" role="alert">{erro}</div>
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={fechar}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar modelo'}</button>
        </div>
      </form>
    </dialog>
  );
}
