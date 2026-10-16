'use client';
// Aba Peritos: cadastro, edição (as perícias acompanham o nome), "Completar cadastro", "Ver perícias" e exclusão
import { useState } from 'react';
import { aberta, chaveNome, especialidadeDoPerito, laudoAtrasado, listaDePeritos, peritoCadastrado, type Pericia, type Perito, type Util } from '@/lib/pericias';
import { useAviso } from '@/componentes/Avisos';
import { SelectEspecialidade } from './SelectPerito';

export type DadosPerito = { id: string | null; nome: string; especialidade: string; telefone: string; email: string; observacoes: string };
const VAZIO: DadosPerito = { id: null, nome: '', especialidade: '', telefone: '', email: '', observacoes: '' };

function BotaoExcluir({ n, excluir }: { n: number; excluir: () => void }){
  const [armado, setArmado] = useState(false);
  return (
    <button type="button" className={'btn danger-text' + (armado ? ' armed' : '')} data-ptact="excluir" data-n={n}
      onClick={() => { if (!armado){ setArmado(true); return; } excluir(); }}>
      {!armado ? 'Excluir' : n ? 'Excluir mesmo? (' + n + (n === 1 ? ' perícia continua' : ' perícias continuam') + ' com o nome)' : 'Confirmar exclusão'}
    </button>
  );
}

export function Peritos({ peritos, itens, nomes, erro, busca, agora, util, salvar, excluir, verPericias, recarregar }: {
  peritos: Perito[]; itens: Pericia[]; nomes: string[]; erro: boolean; busca: string; agora: Date; util: Util;
  salvar: (x: DadosPerito, nomeAntigo: string | null) => Promise<boolean>; excluir: (id: string) => Promise<boolean>; verPericias: (nome: string) => void;
  recarregar: () => Promise<void>;
}){
  const avisar = useAviso();
  const [f, setF] = useState<DadosPerito>(VAZIO);
  // nome antes da edição: ao renomear, as perícias desse perito passam a usar o nome novo
  const [nomeAntigo, setNomeAntigo] = useState<string | null>(null);
  const limpar = () => { setF(VAZIO); setNomeAntigo(null); };
  const rolarAoForm = () => document.getElementById('peritoForm')?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  async function enviar(){
    const x = { ...f, nome: f.nome.trim().replace(/\s+/g, ' '), telefone: f.telefone.trim(), email: f.email.trim(), observacoes: f.observacoes.trim() };
    if (!x.nome){ avisar('Informe o nome do perito'); return; }
    const outro = peritoCadastrado(peritos, x.nome);
    if (outro && outro.id !== x.id){ avisar('Já existe um perito com esse nome.'); return; }
    if (!(await salvar(x, nomeAntigo))) return;
    avisar(x.id ? 'Perito atualizado' : 'Perito cadastrado');
    limpar();
    await recarregar();
    document.getElementById('ptNome')?.focus();
  }

  const lista = listaDePeritos(peritos, nomes, busca), q = busca.trim();
  const vazio = erro ? 'A tabela de peritos ainda não existe no Supabase. Rode o SQL do LEIA-ME.md (Passo 2.4) e recarregue a página.'
    : !lista.length ? (q ? 'Nenhum perito encontrado.' : 'Nenhum perito cadastrado ainda. Use o formulário acima.') : '';
  const editando = !!f.id;
  const campo = (k: keyof DadosPerito) => (e: { target: { value: string } }) => setF(s => ({ ...s, [k]: e.target.value }));

  return (
    <div id="perPeritosView">
      <form className="quick" id="peritoForm" autoComplete="off" aria-labelledby="peritoFormTitle" onSubmit={e => { e.preventDefault(); enviar(); }}>
        <div className="quick-head">
          <h2 id="peritoFormTitle">{editando ? 'Editar perito' : 'Cadastrar perito'}</h2>
          <span className="quick-hint" id="peritoFormHint">{editando ? 'Se mudar o nome, as perícias deste perito passam a usar o nome novo' : 'Depois é só escolher o perito na lista ao cadastrar a perícia'}</span>
        </div>
        <input type="hidden" id="peritoId" value={f.id || ''} readOnly />
        <div className="perito-grid">
          <div className="field pt-nome"><label htmlFor="ptNome">Nome</label><input id="ptNome" maxLength={120} placeholder="Ex.: Dra. Paula Andrade" required value={f.nome} onChange={campo('nome')} /></div>
          <div className="field pt-esp"><label htmlFor="ptEsp">Especialidade</label><SelectEspecialidade id="ptEsp" value={f.especialidade} onChange={x => setF(s => ({ ...s, especialidade: x }))} /></div>
          <div className="field pt-tel"><label htmlFor="ptTel">Telefone</label><input id="ptTel" maxLength={40} placeholder="(65) 99999-0000" value={f.telefone} onChange={campo('telefone')} /></div>
          <div className="field pt-email"><label htmlFor="ptEmail">E-mail</label><input id="ptEmail" type="email" maxLength={120} placeholder="nome@email.com" value={f.email} onChange={campo('email')} /></div>
          <div className="field pt-obs"><label htmlFor="ptObs">Observações</label><input id="ptObs" maxLength={500} placeholder="Ex.: atende só às terças; prefere intimação por e-mail" value={f.observacoes} onChange={campo('observacoes')} /></div>
          <div className="pt-btns">
            <button type="button" className="btn" id="ptCancelar" hidden={!editando} onClick={limpar}>Cancelar</button>
            <button type="submit" className="btn primary" id="ptSalvar">{editando ? 'Salvar alterações' : 'Cadastrar perito'}</button>
          </div>
        </div>
      </form>
      <div className="empty" id="peritosEmpty" hidden={!vazio}>{vazio}</div>
      <div className="pgrid" id="peritosLista">
        {lista.map(x => {
          const minhas = itens.filter(p => chaveNome(p.perito) === chaveNome(x.nome));
          const and = minhas.filter(aberta).length, atr = minhas.filter(p => laudoAtrasado(p, agora, util)).length, conc = minhas.filter(p => p.status === 'laudo_juntado').length;
          return (
            <article key={x.id || 'n:' + x.nome} className={'ptcard' + (x.id && f.id === x.id ? ' editing' : '')}>
              <div><h3>{x.nome}</h3>
                {x.especialidade && <div className="prow" style={{ marginTop: 4 }}><span className="pesp">{x.especialidade}</span></div>}
                {!x.cadastrado && <div className="pobs" style={{ marginTop: 4 }}>Usado em perícias, mas ainda sem cadastro.</div>}</div>
              {(x.telefone || x.email) && <div className="contato">{x.telefone && <span>{x.telefone}</span>}{x.email && <span>{x.email}</span>}</div>}
              {x.observacoes && <div className="obs">{x.observacoes}</div>}
              <div className="ptnums"><div><b>{and}</b><span>em andamento</span></div><div className={atr ? 'bad' : ''}><b>{atr}</b><span>laudos atrasados</span></div><div><b>{conc}</b><span>concluídas</span></div></div>
              <div className="ptacts">
                {minhas.length > 0 && <button type="button" className="btn" data-ptact="ver" data-nome={x.nome} onClick={() => verPericias(x.nome)}>Ver perícias</button>}
                {x.cadastrado ? <>
                  <button type="button" className="btn" data-ptact="editar" data-id={x.id} onClick={() => {
                    setF({ id: x.id, nome: x.nome, especialidade: x.especialidade, telefone: x.telefone, email: x.email, observacoes: x.observacoes });
                    setNomeAntigo(x.nome);
                    rolarAoForm(); setTimeout(() => document.getElementById('ptNome')?.focus(), 0);
                  }}>Editar</button>
                  <BotaoExcluir key={x.id} n={minhas.length} excluir={async () => { if (await excluir(x.id) && f.id === x.id) limpar(); }} />
                </> : <button type="button" className="btn primary" data-ptact="cadastrar" data-nome={x.nome} onClick={() => {
                  setF({ ...VAZIO, nome: x.nome, especialidade: especialidadeDoPerito([], itens, x.nome) });
                  setNomeAntigo(null);
                  rolarAoForm(); setTimeout(() => document.getElementById('ptTel')?.focus(), 0);
                }}>Completar cadastro</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
