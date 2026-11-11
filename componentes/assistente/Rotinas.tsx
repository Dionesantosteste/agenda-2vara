'use client';
// Aba "Rotinas de secretaria": procurar, abrir, copiar, editar e excluir os passo a passos salvos
import { useState } from 'react';
import { buscarRotinas, rotinaEmTexto, type Rotina } from '@/lib/assistente';
import { useAviso } from '@/componentes/Avisos';
import { chamar, copiar, problema } from './comum';
import type { RascunhoRotina } from './Dialogos';

function Cartao({ r, editar, excluida }: { r: Rotina; editar: (r: RascunhoRotina) => void; excluida: () => void }){
  const avisar = useAviso();
  const [armado, setArmado] = useState(false);
  async function excluir(){
    if (!armado){ setArmado(true); setTimeout(() => setArmado(false), 4000); return; }
    const res = await chamar('ast_excluir_rotina', { p_id: r.id });
    if (res.status !== 'ok'){ avisar(problema(res)); return; }
    avisar('Rotina excluída');
    excluida();
  }
  return (
    <details className="ast-rot">
      <summary>
        <span className="ast-rot-tit">{r.titulo}</span>
        {r.quando && <span className="ast-rot-quando">{r.quando}</span>}
      </summary>
      <ol className="ast-rot-passos">{r.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
      {r.observacoes && <p className="ast-rot-obs">{r.observacoes}</p>}
      <div className="ast-acoes">
        <button type="button" className="btn sm" onClick={async () => avisar(await copiar(rotinaEmTexto(r)) ? 'Rotina copiada' : 'Não foi possível copiar')}>Copiar</button>
        <button type="button" className="btn sm" onClick={() => editar({ ...r })}>Editar</button>
        <button type="button" className={'btn sm danger-text' + (armado ? ' armed' : '')} onClick={excluir}
          aria-label={armado ? 'Confirmar exclusão da rotina ' + r.titulo : 'Excluir a rotina ' + r.titulo}>{armado ? 'Excluir mesmo?' : 'Excluir'}</button>
      </div>
    </details>
  );
}

export function AbaRotinas({ rotinas, carregando, editar, recarregar }: {
  rotinas: Rotina[]; carregando: boolean; editar: (r: RascunhoRotina) => void; recarregar: () => void;
}){
  const [busca, setBusca] = useState('');
  const lista = busca.trim() ? buscarRotinas(rotinas, busca, 200) : rotinas;
  const grupos = new Map<string, Rotina[]>();
  for (const r of lista){
    const g = r.assunto || 'Sem assunto';
    grupos.set(g, [...(grupos.get(g) || []), r]);
  }
  const nova = () => editar({ id: null, titulo: '', assunto: '', quando: '', passos: [], observacoes: '' });

  return (
    <div className="ast-rotinas">
      <div className="ast-barra">
        <div className="field ast-busca">
          <label htmlFor="astBusca">Procurar rotina</label>
          <input id="astBusca" type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="ex.: INSS decisão" />
        </div>
        <button type="button" className="btn primary" onClick={nova}>Nova rotina</button>
      </div>
      {carregando && !rotinas.length ? <p className="ast-vazio">Carregando…</p>
        : !rotinas.length ? (
          <div className="ast-vazio">
            <p>Nenhuma rotina cadastrada ainda.</p>
            <p>Escreva uma em <strong>Nova rotina</strong> ou peça na conversa, por exemplo: “Salve a rotina de INSS: após a decisão, intimar a APS; depois…”.</p>
          </div>)
        : !lista.length ? (
          <div className="ast-vazio">
            <p>Nenhuma rotina combina com “{busca}”.</p>
            <button type="button" className="btn sm" onClick={() => setBusca('')}>Limpar a busca</button>
          </div>)
        : [...grupos.entries()].map(([g, rs]) => (
          <section key={g} className="ast-grupo" aria-label={g}>
            <h3>{g}</h3>
            {rs.map(r => <Cartao key={r.id} r={r} editar={editar} excluida={recarregar} />)}
          </section>
        ))}
    </div>
  );
}
