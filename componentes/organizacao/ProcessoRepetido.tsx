'use client';
// "Este processo já está com alguém": ao criar ou editar tarefa com um processo que já tem tarefa em aberto.
// Devolve true para seguir. Sem o SQL novo, ou se a busca falhar, segue sem avisar.
import { useRef, useState } from 'react';
import { descreverEmUso, type EmUso } from '@/lib/organizacao';
import { formatarProcesso, soDigitos } from '@/lib/processo';
import { useJanela } from '@/componentes/useJanela';
import type { Sessao } from './sessao';

export function useProcessoRepetido(s: Sessao){
  const [pedido, setPedido] = useState<{ info: string; itens: EmUso[] } | null>(null);
  const resposta = useRef<(sim: boolean) => void>(() => {});
  const semFuncao = useRef(false);
  const fechar = (sim: boolean) => { setPedido(null); resposta.current(sim); resposta.current = () => {}; };
  const { ref, cliqueFora, aoFechar } = useJanela(!!pedido, () => fechar(false));

  async function confere(proc: string, ignorarId?: string): Promise<boolean> {
    if (soDigitos(proc).length !== 20 || semFuncao.current) return true;
    const r = await s.chamar('org_processo_em_uso', { p_processo: formatarProcesso(proc) });
    if (r.status === 'erro' && r.codigo === 'PGRST202') semFuncao.current = true;
    const L = r.status === 'ok' && Array.isArray(r.tarefas) ? (r.tarefas as EmUso[]).filter(t => t.id !== ignorarId) : [];
    if (!L.length) return true;
    setPedido({ info: (L.length === 1 ? 'Há 1 tarefa em aberto' : 'Há ' + L.length + ' tarefas em aberto') + ' com o processo ' + formatarProcesso(proc) + ':', itens: L });
    setTimeout(() => document.getElementById('orgDupSim')?.focus(), 0);
    return new Promise(ok => { resposta.current = ok; });
  }

  const nomeDe = (id: string) => (s.dados?.pessoas.find(p => p.id === id) || { nome: '' }).nome;
  const janela = (
    <dialog id="orgDupDialog" aria-labelledby="orgDupTit" ref={ref} onClick={cliqueFora} onClose={aoFechar}>
      <form className="sheet" onSubmit={e => e.preventDefault()}>
        <h2 id="orgDupTit">Este processo já está com alguém</h2>
        <p className="field-hint" id="orgDupInfo" style={{ margin: '-6px 0 0' }}>{pedido?.info}</p>
        <ul id="orgDupLista">
          {pedido?.itens.map(t => { const d = descreverEmUso(t, s.modo === 'pessoa', s.eu, nomeDe); return <li key={t.id}><b>{d.quem}</b>{d.resto}</li>; })}
        </ul>
        <div className="sheet-actions">
          <button type="button" className="btn" value="nao" onClick={() => fechar(false)}>Cancelar</button>
          <button type="button" className="btn primary" value="sim" id="orgDupSim" onClick={() => fechar(true)}>Salvar mesmo assim</button>
        </div>
      </form>
    </dialog>
  );
  return { confere, janela };
}
