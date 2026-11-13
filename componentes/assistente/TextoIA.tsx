// Mostra a resposta da IA com o mínimo de formatação: títulos (#), listas (- e 1.) e **negrito**.
// Tudo vira texto do React (nada de HTML vindo de fora).
import type { ReactNode } from 'react';

function negrito(linha: string): ReactNode[] {
  return linha.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
}

// Texto sem as marcas (para copiar e colar no processo)
export function semMarcas(t: string): string {
  return t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');
}

export function TextoIA({ texto }: { texto: string }){
  const blocos: ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  const fecharLista = () => {
    if (!lista) return;
    const itens = lista.itens.map((t, i) => <li key={i}>{negrito(t)}</li>);
    blocos.push(lista.ordenada ? <ol key={blocos.length}>{itens}</ol> : <ul key={blocos.length}>{itens}</ul>);
    lista = null;
  };
  for (const linha of texto.split(/\r?\n/)){
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(linha);
    const mar = /^\s*[-*•]\s+(.*)$/.exec(linha);
    const tit = /^#{1,6}\s+(.*)$/.exec(linha);
    if (num || mar){
      const ordenada = !!num;
      if (!lista || lista.ordenada !== ordenada){ fecharLista(); lista = { ordenada, itens: [] }; }
      lista.itens.push((num || mar)![1]);
      continue;
    }
    fecharLista();
    if (tit) blocos.push(<p key={blocos.length} className="ast-tit">{negrito(tit[1])}</p>);
    else if (linha.trim()) blocos.push(<p key={blocos.length}>{negrito(linha)}</p>);
  }
  fecharLista();
  return <div className="ast-texto">{blocos}</div>;
}
