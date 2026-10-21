'use client';
// Aviso de processo repetido ao criar ou editar uma tarefa do quadro: mostra quem já tem o processo e
// pergunta se segue mesmo assim. Sem o SQL novo, ou se a busca falhar, segue sem avisar.
import { useCallback, useRef, useState } from 'react';
import { diaMes, type Dados } from '@/lib/organizacao';
import { formatarProcesso, soDigitos } from '@/lib/processo';
import { useJanela } from '@/componentes/useJanela';
import type { Banco } from './Organizacao';

type Em = { id: string; dono: string | null; dono_nome?: string; titulo?: string; etapa?: string; coluna?: string; conferencia?: string; prazo?: string };

export function useDuplicado(banco: Banco, dados: Dados, pessoa: boolean, eu: string | null){
  const [aberto, setAberto] = useState<{ proc: string; lista: Em[] } | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const semBusca = useRef(false);

  const nomeDe = (dono: string | null, nome?: string) => {
    if (!dono) return pessoa ? 'Gestor' : 'Você (seu quadro)';
    if (pessoa && dono === eu) return 'Você';
    return nome || dados.pessoas.find(p => p.id === dono)?.nome || 'Pessoa excluída';
  };

  // Devolve true para seguir
  const confere = useCallback(async (proc: string, ignorarId?: string): Promise<boolean> => {
    if (soDigitos(proc).length !== 20 || semBusca.current) return true;
    const r = await banco.chamar('org_processo_em_uso', { p_processo: formatarProcesso(proc) });
    if (r.status === 'erro' && r.codigo === 'PGRST202') semBusca.current = true;
    const lista: Em[] = r.status === 'ok' && Array.isArray(r.tarefas) ? r.tarefas.filter((t: Em) => t.id !== ignorarId) : [];
    if (!lista.length) return true;
    return new Promise<boolean>(res => { resolver.current = res; setAberto({ proc: formatarProcesso(proc), lista }); });
  }, [banco]);

  const finalizar = (v: boolean) => { const r = resolver.current; resolver.current = null; setAberto(null); r?.(v); };
  const { ref, cliqueFora } = useJanela(!!aberto, () => finalizar(false));

  const janela = (
    <dialog id="orgDupDialog" ref={ref} aria-labelledby="orgDupTit" onClick={cliqueFora}
      onClose={e => { const d = e.currentTarget; const sim = d.returnValue === 'sim'; d.returnValue = ''; if (aberto) finalizar(sim); }}>
      <form className="sheet" method="dialog">
        <h2 id="orgDupTit">Este processo já está com alguém</h2>
        <p className="field-hint" id="orgDupInfo" style={{ margin: '-6px 0 0' }}>
          {aberto ? (aberto.lista.length === 1 ? 'Há 1 tarefa em aberto' : 'Há ' + aberto.lista.length + ' tarefas em aberto') + ' com o processo ' + aberto.proc + ':' : ''}
        </p>
        <ul id="orgDupLista">
          {aberto?.lista.map(t => {
            const pz = t.prazo ? new Date(String(t.prazo).slice(0, 10) + 'T00:00') : null;
            return (
              <li key={t.id}>
                <b>{nomeDe(t.dono, t.dono_nome)}</b>: {t.titulo || 'Sem título'} · {t.conferencia === 'enviada' ? 'em conferência' : (t.coluna || (t.etapa === 'afazer' ? 'A fazer' : 'Em andamento'))}
                {pz ? ' · prazo ' + diaMes(pz) : ''}
              </li>
            );
          })}
        </ul>
        <div className="sheet-actions">
          <button type="submit" className="btn" value="nao">Cancelar</button>
          <button type="submit" className="btn primary" value="sim" id="orgDupSim">Salvar mesmo assim</button>
        </div>
      </form>
    </dialog>
  );
  return { confere, janela };
}
