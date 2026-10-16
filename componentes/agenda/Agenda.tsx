'use client';
// Seção Agenda do sistema novo: contatos e categorias, nas mesmas tabelas do Supabase (contacts e categories).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ALFABETO, CATEGORIAS_PADRAO, EXEMPLOS, TODOS, agrupar, deLinha, destaque, type Contato } from '@/lib/agenda';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';
import { DialogoContato, type DadosContato } from './DialogoContato';
import { DialogoCategorias } from './DialogoCategorias';

function Destacado({ texto, busca }: { texto: string; busca: string }){
  const d = destaque(texto, busca);
  return d ? <>{d[0]}<mark>{d[1]}</mark>{d[2]}</> : <>{texto}</>;
}

export function Agenda(){
  const avisar = useAviso();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_PADRAO);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState(TODOS);
  // undefined = fechado; null = contato novo
  const [editando, setEditando] = useState<Contato | null | undefined>(undefined);
  const [gerenciando, setGerenciando] = useState(false);

  const carregarContatos = useCallback(async () => {
    const res = await supabase().from('contacts').select('*').order('name', { ascending: true });
    setCarregado(true);
    if (res.error){
      const m = res.error.message || String(res.error);
      setErro(m);
      avisar('Erro ao carregar contatos: ' + m);
      return;
    }
    setErro(null);
    setContatos((res.data || []).map(deLinha));
  }, [avisar]);

  const carregarCategorias = useCallback(async () => {
    const res = await supabase().from('categories').select('*').order('name', { ascending: true });
    if (res.error){ avisar('Erro ao carregar categorias: ' + res.error.message); return; }
    if (res.data && res.data.length) setCategorias(res.data.map(r => r.name as string));
    else {
      // primeira vez: cria as categorias padrão
      const ins = await supabase().from('categories').insert(CATEGORIAS_PADRAO.map(name => ({ name })));
      if (!ins.error) setCategorias(CATEGORIAS_PADRAO.slice());
    }
  }, [avisar]);

  // Primeira carga (uma vez só, mesmo quando o React repete o efeito no modo de desenvolvimento)
  const iniciou = useRef(false);
  useEffect(() => {
    if (!iniciou.current) (async () => {
      iniciou.current = true;
      await carregarCategorias();
      // agenda vazia: cria os contatos de exemplo
      const n = await supabase().from('contacts').select('id', { count: 'exact', head: true });
      if (!n.error && n.count === 0) await supabase().from('contacts').insert(EXEMPLOS);
      await carregarContatos();
    })();
    // Atualiza sozinho quando qualquer pessoa altera os dados
    const canal = supabase().channel('agenda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => { carregarContatos(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => { carregarCategorias(); })
      .subscribe();
    return () => { supabase().removeChannel(canal); };
  }, [carregarCategorias, carregarContatos]);

  async function salvarContato(id: string | null, d: DadosContato){
    const payload = { name: d.name, phones: d.phones, emails: d.emails, category: d.category };
    const res = id ? await supabase().from('contacts').update(payload).eq('id', id) : await supabase().from('contacts').insert(payload);
    if (res.error){ avisar('Não foi possível salvar: ' + res.error.message); return; }
    avisar(id ? 'Contato atualizado' : 'Contato adicionado');
    await carregarContatos();
  }
  async function excluirContato(id: string){
    const res = await supabase().from('contacts').delete().eq('id', id);
    if (res.error){ avisar('Não foi possível excluir: ' + res.error.message); return; }
    avisar('Contato excluído');
    await carregarContatos();
  }

  // Grava a nova lista de categorias: insere as novas e apaga as que saíram
  async function gravarCategorias(nova: string[]){
    const antes = categorias;
    setCategorias(nova);
    const novas = nova.filter(c => !antes.includes(c)), saiu = antes.filter(c => !nova.includes(c));
    if (novas.length) await supabase().from('categories').insert(novas.map(name => ({ name })));
    for (const c of saiu) await supabase().from('categories').delete().eq('name', c);
  }
  async function renomearCategoria(antigo: string, novo: string){
    setCategorias(cs => cs.map(c => (c === antigo ? novo : c)));
    if (categoria === antigo) setCategoria(novo);
    await supabase().from('categories').update({ name: novo }).eq('name', antigo);
    await supabase().from('contacts').update({ category: novo }).eq('category', antigo);
    await carregarContatos();
  }
  function excluirCategoria(cat: string){
    gravarCategorias(categorias.filter(c => c !== cat));
    if (categoria === cat) setCategoria(TODOS);
  }

  const { total, grupos } = agrupar(contatos, busca, categoria);
  const comLetra = new Set(grupos.map(g => g.letra));
  const vazio = erro
    ? 'Não foi possível carregar os contatos do banco de dados (Supabase). Os dados não foram apagados por isso. Erro: ' + erro + '. Verifique se o projeto no supabase.com não está pausado e recarregue a página.'
    : !carregado ? 'Carregando contatos…'
    : busca || categoria !== TODOS ? 'Nenhum contato encontrado.'
    : 'Nenhum contato ainda — toque em + para adicionar.';

  return (
    <>
      <section id="view-agenda" aria-labelledby="agendaTitle">
        <header>
          <div>
            <h1 id="agendaTitle">Agenda</h1>
            <div className="tagline">Contatos buscáveis por nome, telefone ou e-mail</div>
          </div>
          <div className="count" id="count">{total + (total === 1 ? ' contato' : ' contatos')}</div>
        </header>

        <div className="searchbar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="search" type="text" placeholder="Buscar por nome, telefone ou e-mail…" autoComplete="off" value={busca} onChange={e => setBusca(e.target.value)} />
          <button className="clear-btn" id="clearSearch" hidden={!busca} onClick={() => { setBusca(''); document.getElementById('search')?.focus(); }}>limpar</button>
        </div>

        <div className="filters" id="filters">
          {[TODOS, ...categorias].map(cat => (
            <button key={cat} type="button" className="chip" aria-pressed={categoria === cat} onClick={() => setCategoria(cat)}>{cat}</button>
          ))}
          <button type="button" className="chip-manage" onClick={() => setGerenciando(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> categorias
          </button>
        </div>

        <div className="layout">
          <nav className="index" id="index" aria-label="Índice alfabético">
            {ALFABETO.map(l => (
              <button key={l} disabled={!comLetra.has(l)} data-active="false"
                onClick={() => document.getElementById('group-' + l)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{l}</button>
            ))}
          </nav>
          <div id="results">
            <div className="groups" id="groups">
              {grupos.map(g => (
                <div id={'group-' + g.letra} key={g.letra}>
                  <div className="group-label">{g.letra}</div>
                  <div className="cards">
                    {g.contatos.map(c => {
                      const tel = c.phones[0], mail = c.emails[0];
                      const extra = Math.max(0, c.phones.length - 1) + Math.max(0, c.emails.length - 1);
                      const partes = [
                        tel && <a key="t" className="phone" href={'tel:' + encodeURIComponent(tel.value)}><Destacado texto={tel.value} busca={busca} /></a>,
                        mail && <a key="e" href={'mailto:' + encodeURIComponent(mail.value)}><Destacado texto={mail.value} busca={busca} /></a>,
                        extra > 0 && <span key="m" className="more">+{extra}</span>
                      ].filter(Boolean);
                      return (
                        <div className="card" key={c.id}>
                          <div className="avatar">{(c.name || '?').trim().charAt(0).toUpperCase()}</div>
                          <div className="info">
                            <div className="name"><Destacado texto={c.name} busca={busca} /></div>
                            <div className="meta">{partes.length ? partes.flatMap((p, i) => (i ? [' · ', p] : [p])) : <span className="more">sem contato salvo</span>}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <span className="badge">{c.category || 'Sem categoria'}</span>
                            <div className="card-actions">
                              <button className="icon-btn" type="button" title="Editar" onClick={() => setEditando(c)}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="empty" id="emptyState" hidden={total > 0}>{total > 0 ? '' : vazio}</div>
          </div>
        </div>
      </section>

      <button className="fab" id="addBtn" aria-label="Adicionar contato" title="Adicionar contato" onClick={() => setEditando(null)}>+</button>

      <DialogoContato contato={editando} categorias={categorias}
        fechar={() => setEditando(undefined)} salvar={salvarContato} excluir={excluirContato}
        novaCategoria={nome => { if (!categorias.includes(nome)) gravarCategorias([...categorias, nome]); }} />
      <DialogoCategorias aberto={gerenciando} fechar={() => setGerenciando(false)} categorias={categorias}
        acrescentar={nome => gravarCategorias([...categorias, nome])} renomear={renomearCategoria} excluir={excluirCategoria} />
    </>
  );
}
