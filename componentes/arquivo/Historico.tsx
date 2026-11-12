'use client';
// Livro de registro: as últimas alterações do arquivo, com data, hora e quem fez.
import { useEffect, useState } from 'react';
import { useArq } from './Arquivo';
import { lerMovimentos, type Movimento } from './useArquivo';
import { Icone } from './Pecas';

export function Historico(){
  const { d } = useArq();
  const [movs, setMovs] = useState<Movimento[] | null>(null);
  // recarrega quando algo muda no arquivo
  useEffect(() => { let vivo = true; lerMovimentos(undefined, 300).then(m => { if (vivo) setMovs(m); }); return () => { vivo = false; }; }, [d.processos, d.caixas, d.notas]);
  const total = movs?.length || 0;
  return (
    <section className="aq-pilha" aria-labelledby="aq-titulo-hist">
      <div className="aq-topo-tela"><div><span className="aq-sobrelinha">Livro de registro</span><h1 id="aq-titulo-hist">Histórico</h1>
        <p className="aq-sub">Tudo o que foi alterado no arquivo, do mais novo para o mais antigo, com quem fez.</p></div></div>
      <div className="aq-registro">
        {movs === null ? <div className="aq-vazio">Carregando…</div>
          : total ? (
            <div style={{ overflowX: 'auto' }}><table>
              <thead><tr><th>Nº</th><th>Data</th><th>Movimentação</th><th>Quem</th></tr></thead>
              <tbody>{movs.map((m, i) => (
                <tr key={m.id}><td className="aq-num">{String(total - i).padStart(3, '0')}</td>
                  <td className="aq-data">{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{m.texto}</td><td className="aq-sub" style={{ fontSize: 13 }}>{m.quem}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <div className="aq-vazio"><Icone n="hist" t={28} /><b>Nenhuma movimentação ainda.</b><span>Quando alguém registrar saída, trocar caixa ou cadastrar, fica anotado aqui.</span></div>}
      </div>
      {total >= 300 && <p className="aq-sub" style={{ fontSize: 13 }}>Mostrando as 300 últimas. Cada processo guarda todas as dele na própria ficha.</p>}
    </section>
  );
}
