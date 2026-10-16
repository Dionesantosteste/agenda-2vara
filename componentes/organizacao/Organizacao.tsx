'use client';
// Seção Organização do sistema novo (parte 1): entrada, troca de tela do gestor, "Tarefas e mural",
// Lembretes e Rotinas. As outras abas (Tarefas da equipe, Quadro, Modelos de texto e Aniversariantes)
// continuam no sistema atual por enquanto: o botão delas abre a mesma aba lá, já com a mesma entrada.
import { useEffect, useState } from 'react';
import { pendentesAte, rotinaFeita } from '@/lib/organizacao';
import { useAviso } from '@/componentes/Avisos';
import { AbaLembretes } from './AbaLembretes';
import { AbaLista } from './AbaLista';
import { AbaRotinas } from './AbaRotinas';
import { Entrada } from './Entrada';
import { useProcessoRepetido } from './ProcessoRepetido';
import { useSessao, type Sessao } from './sessao';

type Aba = 'equipe' | 'lista' | 'quadro' | 'lembretes' | 'modelos' | 'rotinas' | 'aniver';
const NO_SISTEMA_ATUAL: Partial<Record<Aba, { id: string; nome: string }>> = {
  equipe: { id: 'orgPaneEquipe', nome: 'Tarefas da equipe' },
  quadro: { id: 'orgPaneQuadro', nome: 'Quadro' },
  modelos: { id: 'orgPaneModelos', nome: 'Modelos de texto' },
  aniver: { id: 'orgPaneAniver', nome: 'Aniversariantes' }
};
const lerAba = (): Aba => { try { return (sessionStorage.getItem('orgTab') as Aba) || 'lista'; } catch { return 'lista'; } };
const gravarAba = (a: Aba) => { try { sessionStorage.setItem('orgTab', a); } catch { /* sem armazenamento */ } };

// Abre a aba no sistema atual (a entrada é a mesma, guardada no navegador)
function abrirNoSistemaAtual(aba: string){
  gravarAba(aba as Aba);
  window.location.href = '/#organizacao';
}

export function Organizacao(){
  // A tela depende do navegador (entrada guardada, relógio): só aparece depois de carregar
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return <section id="view-organizacao" aria-labelledby="orgTitle">{pronto && <Corpo />}</section>;
}

function Corpo(){
  const s = useSessao();
  const avisar = useAviso();
  const [aba, setAba] = useState<Aba>(lerAba);
  const [agora, setAgora] = useState(() => new Date());
  const repetido = useProcessoRepetido(s);
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60000); return () => clearInterval(t); }, []);
  // a equipe entra direto no Quadro (o gestor volta para a última aba)
  useEffect(() => { if (s.modo === 'pessoa') setAba('quadro'); }, [s.modo, s.eu]);

  if (!s.dados) return <Entrada s={s} entrouPessoa={nome => { setAba('quadro'); avisar('Olá, ' + (nome.split(' ')[0] || nome) + '!'); }} />;
  return <Conteudo s={s} aba={aba} setAba={a => { setAba(a); gravarAba(a); }} agora={agora} repetido={repetido} />;
}

function Conteudo({ s, aba, setAba, agora, repetido }: { s: Sessao; aba: Aba; setAba: (a: Aba) => void; agora: Date; repetido: ReturnType<typeof useProcessoRepetido> }){
  const avisar = useAviso();
  const d = s.dados!;
  const pessoa = s.modo === 'pessoa';
  const visivel = (k: Aba) => k === 'equipe' ? s.modo === 'gestor' && d.temEquipe
    : k === 'rotinas' ? !s.alheia
    : k === 'aniver' ? s.modo === 'gestor' && !s.ver && !!d.aniv
    : true;
  const atual: Aba = visivel(aba) ? aba : 'lista';
  const devolvidas = d.tarefas.filter(t => t.conferencia === 'devolvida' && t.etapa !== 'feito' && !t.arquivadaEm).length;
  const pessoasNaLista = d.temEquipe && !pessoa ? d.pessoas : [];
  const mes = agora.getMonth() + 1;
  const nAniv = d.aniv ? d.aniv.filter(a => a.mes === mes).length : 0;
  const nLem = pendentesAte(d.lembretes, 0, agora).length;
  const nRot = d.rotinas.filter(r => !rotinaFeita(r, agora)).length;
  const aba_ = (k: Aba, nome: string, cls = '', n?: number, idN?: string, extra?: { id?: string; hidden?: boolean; tituloN?: string }) => (
    <button type="button" className={'org-tab' + (cls ? ' ' + cls : '')} role="tab" data-tab={k} aria-selected={atual === k} id={extra?.id} hidden={extra?.hidden}
      onClick={() => setAba(k)}>
      {nome}{idN !== undefined && <> <span className="org-tab-n" id={idN} title={extra?.tituloN}>{n || ''}</span></>}
    </button>
  );

  return (
    <div id="orgContent" className={(pessoa ? 'org-modo-pessoa' : '') + (s.alheia ? ' org-alheia' : '')}>
      <header>
        <div>
          <h1 id="orgH1">{pessoa ? 'Olá, ' + (d.euNome.split(' ')[0] || 'tudo bem') + '!' : 'Organização'}</h1>
          <div className="tagline" id="orgTagline">{pessoa
            ? 'Seu quadro, mural e lembretes. Tarefas do gestor chegam na primeira coluna.' + (devolvidas ? ' Você tem ' + devolvidas + (devolvidas === 1 ? ' tarefa devolvida' : ' tarefas devolvidas') + ' na conferência.' : '')
            : s.ver ? 'Tela de ' + d.euNome : 'Tarefas, mural, lembretes e rotinas da gestão'}</div>
        </div>
        <div className="org-head-actions">
          <select className="org-in so-gestor" id="orgVer" aria-label="Ver a tela de" hidden={!pessoasNaLista.length} value={s.ver || ''} onChange={e => s.verTela(e.target.value || null)}>
            <option value="">Minha tela (gestor)</option>
            {pessoasNaLista.map(p => <option key={p.id} value={p.id}>Tela de {p.nome}{p.ativo ? '' : ' (desativada)'}</option>)}
          </select>
          <button type="button" className="btn so-gestor" id="orgPessoasBtn" title="Cadastrar as pessoas da equipe (no sistema atual, por enquanto)" hidden={pessoa || !d.temEquipe}
            onClick={() => abrirNoSistemaAtual(atual)}>Pessoas</button>
          <button type="button" className="btn" id="orgLockBtn" title={pessoa ? 'Sair da sua tela neste navegador' : 'Trancar a Organização neste navegador'}
            onClick={() => { s.trancar(''); avisar(pessoa ? 'Você saiu da sua tela' : 'Organização trancada'); }}>{pessoa ? 'Sair' : 'Trancar'}</button>
        </div>
      </header>
      <div className="org-ver-aviso" id="orgVerAviso" hidden={pessoa || !s.ver}>
        <span id="orgVerAvisoTxt">Você está na tela de <b>{d.euNome}</b>. O que mudar aqui aparece para essa pessoa.</span>
        <button type="button" className="btn" id="orgVerVoltar" onClick={() => s.verTela(null)}>Voltar para a minha tela</button>
      </div>
      <div className="org-tabs-scroll">
        <div className="org-tabs" id="orgTabs" role="tablist" aria-label="Partes da Organização">
          {aba_('equipe', 'Tarefas da equipe', 'so-gestor', d.eqConferir, 'orgTabEqN', { tituloN: d.eqConferir ? 'Tarefas esperando a sua conferência' : '' })}
          {aba_('lista', 'Tarefas e mural')}
          {aba_('quadro', 'Quadro')}
          {aba_('lembretes', 'Lembretes', '', nLem, 'orgTabLemN')}
          {aba_('modelos', 'Modelos de texto')}
          {aba_('rotinas', 'Rotinas', 'so-proprio', nRot, 'orgTabRotN')}
          {aba_('aniver', 'Aniversariantes', 'so-proprio so-gestor', nAniv, 'orgTabAnivN', { id: 'orgTabAniver', hidden: !visivel('aniver'), tituloN: 'Aniversariantes deste mês' })}
        </div>
      </div>

      {(Object.keys(NO_SISTEMA_ATUAL) as Aba[]).map(k => (
        <div key={k} id={NO_SISTEMA_ATUAL[k]!.id} className="org-pane" hidden={atual !== k}>
          <div className="panel org-no-atual">
            <div className="panel-head"><h2>{NO_SISTEMA_ATUAL[k]!.nome}</h2></div>
            <p>Esta parte da Organização ainda está no sistema atual. Ela passa para cá nas próximas etapas da mudança.</p>
            <div><button type="button" className="btn primary" onClick={() => abrirNoSistemaAtual(k)}>Abrir {NO_SISTEMA_ATUAL[k]!.nome} no sistema atual</button></div>
          </div>
        </div>
      ))}
      <AbaLista s={s} agora={agora} visivel={atual === 'lista'} confereProcesso={repetido.confere} abrirNoSistemaAtual={abrirNoSistemaAtual} />
      <AbaLembretes s={s} agora={agora} visivel={atual === 'lembretes'} />
      {!s.alheia && <AbaRotinas s={s} agora={agora} visivel={atual === 'rotinas'} />}
      {repetido.janela}
    </div>
  );
}
