'use client';
// Dados do Arquivo: carrega caixas e processos do Supabase, acompanha em tempo real e grava as
// alterações. Toda alteração anota uma linha no histórico (arquivo_movimentos, com quem fez)
// e devolve uma função para desfazer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { indexar, type Caixa, type Local, type Processo } from '@/lib/arquivo';

export type Nota = { celula: string; texto: string; contexto: string; resolvida: boolean };
export type Desfazer = () => void;
export type Estado = 'carregando' | 'pronto' | 'sem-tabelas' | 'erro';

const COLS_CAIXA = 'id,nome,locais,secretaria';
const COLS_PROC = 'id,codigo,caixa_id,origem_id,situacao,com_quem,destino,numero,classe,partes,ano,obs,volumes_ok,excluido';
const POR_PAGINA = 1000;   // o Supabase devolve no máximo 1000 linhas por vez

type Erro = { message?: string; code?: string } | null;
function faltaTabela(e: Erro){ return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /arquivo_\w+/.test(e.message || '') && /(does not exist|Could not find)/i.test(e.message || '')); }

// Baixa a tabela inteira: a primeira parte diz quantas linhas são; as outras partes vêm ao
// mesmo tempo (até 6 de cada vez), em vez de uma depois da outra.
const AO_MESMO_TEMPO = 6;
async function todas<T>(tabela: string, colunas: string): Promise<T[]> {
  const pagina = (de: number, contar = false) => supabase().from(tabela).select(colunas, contar ? { count: 'exact' } : undefined).order('id').range(de, de + POR_PAGINA - 1);
  const r0 = await pagina(0, true);
  if (r0.error) throw r0.error;
  const primeira = (r0.data || []) as T[];
  const total = r0.count ?? primeira.length;
  if (primeira.length < POR_PAGINA || total <= POR_PAGINA) return primeira;
  const inicios: number[] = [];
  for (let de = POR_PAGINA; de < total; de += POR_PAGINA) inicios.push(de);
  const partes: T[][] = new Array(inicios.length);
  let prox = 0;
  const trabalhador = async () => {
    while (prox < inicios.length){
      const i = prox++;
      const r = await pagina(inicios[i]);
      if (r.error) throw r.error;
      partes[i] = (r.data || []) as T[];
    }
  };
  await Promise.all(Array.from({ length: Math.min(AO_MESMO_TEMPO, inicios.length) }, trabalhador));
  const out = primeira.concat(...partes);
  // se alguém cadastrou no meio do caminho e passou do total, busca o que sobrou
  if (partes.length && partes[partes.length - 1].length === POR_PAGINA){
    for (let de = inicios[inicios.length - 1] + POR_PAGINA; ; de += POR_PAGINA){
      const r = await pagina(de); if (r.error) throw r.error;
      const l = (r.data || []) as T[]; out.push(...l); if (l.length < POR_PAGINA) break;
    }
  }
  return out;
}

// Cópia do arquivo guardada neste aparelho (IndexedDB): da segunda vez em diante a página abre na
// hora com ela e atualiza em seguida. Se o navegador não deixar guardar, só abre do jeito normal.
const BANCO_LOCAL = 'arquivo-2vara', LOJA = 'copia', VERSAO_COPIA = 1;
type Copia = { v: number; caixas: Record<string, unknown>[]; processos: Record<string, unknown>[]; notas: Nota[] };
function abrirLocal(): Promise<IDBDatabase | null> {
  return new Promise(res => {
    try {
      const r = indexedDB.open(BANCO_LOCAL, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    } catch (e){ res(null); }
  });
}
async function lerCopia(): Promise<Copia | null> {
  const db = await abrirLocal(); if (!db) return null;
  return new Promise(res => {
    try { const g = db.transaction(LOJA).objectStore(LOJA).get('tudo'); g.onsuccess = () => { const c = g.result as Copia | undefined; res(c && c.v === VERSAO_COPIA ? c : null); }; g.onerror = () => res(null); }
    catch (e){ res(null); }
  });
}
// Apaga a cópia deste aparelho (ao sair do sistema)
export function apagarCopia(): Promise<void> {
  return new Promise(res => { try { const r = indexedDB.deleteDatabase(BANCO_LOCAL); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch (e){ res(); } });
}
async function guardarCopia(c: Copia){
  const db = await abrirLocal(); if (!db) return;
  try { db.transaction(LOJA, 'readwrite').objectStore(LOJA).put(c, 'tudo'); } catch (e){ /* sem espaço: tudo bem, só não guarda */ }
}

const caixaDeLinha = (r: Record<string, unknown>): Caixa => ({
  id: String(r.id), nome: String(r.nome || ''), secretaria: !!r.secretaria,
  locais: Array.isArray(r.locais) ? (r.locais as unknown[]).filter(Array.isArray).map(l => [Number((l as unknown[])[0]), String((l as unknown[])[1])] as Local) : []
});
const procDeLinha = (r: Record<string, unknown>): Processo => ({
  id: String(r.id), codigo: String(r.codigo || ''), caixa_id: String(r.caixa_id), origem_id: r.origem_id ? String(r.origem_id) : null,
  situacao: Number(r.situacao) || 0, com_quem: String(r.com_quem || ''), destino: String(r.destino || ''), numero: String(r.numero || ''),
  classe: String(r.classe || ''), partes: String(r.partes || ''), ano: String(r.ano || ''), obs: String(r.obs || ''),
  volumes_ok: !!r.volumes_ok, excluido: !!r.excluido
});

export type Mudanca = { p: Processo; novo: Partial<Processo>; texto: string };

export function useArquivo(avisar: (msg: string) => void){
  const [caixasM, setCaixasM] = useState<Map<string, Caixa>>(new Map());
  const [procsM, setProcsM] = useState<Map<string, Processo>>(new Map());
  const [notas, setNotas] = useState<Nota[]>([]);
  const [estado, setEstado] = useState<Estado>('carregando');
  const [erro, setErro] = useState('');
  const procsRef = useRef(procsM); procsRef.current = procsM;
  const estadoRef = useRef<Estado>('carregando'); estadoRef.current = estado;
  const caixasRef = useRef(caixasM); caixasRef.current = caixasM;

  const [atualizando, setAtualizando] = useState(false);
  const aplicarDados = useCallback((cx: Record<string, unknown>[], ps: Record<string, unknown>[], ns: Nota[]) => {
    setCaixasM(new Map(cx.map(r => { const c = caixaDeLinha(r); return [c.id, c]; })));
    setProcsM(new Map(ps.map(r => { const p = procDeLinha(r); return [p.id, p]; })));
    setNotas(ns.slice().sort((a, b) => a.celula.localeCompare(b.celula, undefined, { numeric: true })));
  }, []);

  const carregar = useCallback(async () => {
    // 1) abre na hora com a cópia guardada neste aparelho (se houver)
    let temCopia = false;
    const jaPronto = () => estadoRef.current === 'pronto';
    if (!jaPronto()){
      const copia = await lerCopia();
      if (copia && !jaPronto()){ aplicarDados(copia.caixas, copia.processos, copia.notas); setEstado('pronto'); temCopia = true; }
    }
    // 2) busca a versão atual no banco e troca
    setAtualizando(true);
    try {
      const [cx, ps, ns] = await Promise.all([
        todas<Record<string, unknown>>('arquivo_caixas', COLS_CAIXA),
        todas<Record<string, unknown>>('arquivo_processos', COLS_PROC),
        todas<Nota>('arquivo_notas', 'celula,texto,contexto,resolvida').catch(() => [] as Nota[])
      ]);
      aplicarDados(cx, ps, ns);
      setEstado('pronto'); setErro('');
      guardarCopia({ v: VERSAO_COPIA, caixas: cx, processos: ps, notas: ns });
    } catch (e){
      if (temCopia || jaPronto()){ avisar('Sem conexão com o banco agora: mostrando a última cópia deste aparelho.'); return; }
      const er = e as Erro;
      if (faltaTabela(er)){ setEstado('sem-tabelas'); return; }
      setErro(er?.message || String(e)); setEstado('erro');
    } finally { setAtualizando(false); }
  }, [aplicarDados, avisar]);

  useEffect(() => {
    carregar();
    // tempo real: o que outra pessoa muda aparece aqui sem recarregar
    const canal = supabase().channel('arquivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arquivo_processos' }, ev => {
        const n = ev.new as Record<string, unknown>; if (!n || !n.id) return;
        setProcsM(m => { const c = new Map(m); c.set(String(n.id), procDeLinha(n)); return c; });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arquivo_caixas' }, ev => {
        const n = ev.new as Record<string, unknown>; if (!n || !n.id) return;
        setCaixasM(m => { const c = new Map(m); c.set(String(n.id), caixaDeLinha(n)); return c; });
      })
      .subscribe();
    return () => { supabase().removeChannel(canal); };
  }, [carregar]);

  const caixas = useMemo(() => [...caixasM.values()], [caixasM]);
  const processos = useMemo(() => [...procsM.values()], [procsM]);
  const indice = useMemo(() => indexar(processos), [processos]);
  const porCaixa = useMemo(() => {
    const m = new Map<string, Processo[]>();
    for (const p of processos){ if (p.excluido) continue; const l = m.get(p.caixa_id); if (l) l.push(p); else m.set(p.caixa_id, [p]); }
    return m;
  }, [processos]);

  const anotar = (linhas: { processo_id?: string | null; caixa_id?: string | null; texto: string }[]) =>
    linhas.length ? supabase().from('arquivo_movimentos').insert(linhas) : Promise.resolve({ error: null });

  // Altera processos (um ou vários). Grava, anota no histórico e devolve como desfazer.
  const mudarProcessos = useCallback(async (lista: Mudanca[]): Promise<Desfazer | null> => {
    if (!lista.length) return null;
    const antes = lista.map(({ p, novo }) => ({ id: p.id, valores: Object.fromEntries(Object.keys(novo).map(k => [k, p[k as keyof Processo]])) as Partial<Processo> }));
    setProcsM(m => { const c = new Map(m); for (const { p, novo } of lista){ const a = c.get(p.id); if (a) c.set(p.id, { ...a, ...novo }); } return c; });
    // agrupa quem recebe exatamente a mesma mudança, para gravar de uma vez
    const grupos = new Map<string, { novo: Partial<Processo>; ids: string[] }>();
    for (const { p, novo } of lista){ const k = JSON.stringify(novo); const g = grupos.get(k); if (g) g.ids.push(p.id); else grupos.set(k, { novo, ids: [p.id] }); }
    for (const { novo, ids } of grupos.values()){
      const r = await supabase().from('arquivo_processos').update({ ...novo, updated_at: new Date().toISOString() }).in('id', ids);
      if (r.error){
        setProcsM(m => { const c = new Map(m); for (const a of antes){ const x = c.get(a.id); if (x) c.set(a.id, { ...x, ...a.valores }); } return c; });
        avisar('Não foi possível salvar: ' + r.error.message);
        return null;
      }
    }
    await anotar(lista.map(({ p, novo, texto }) => ({ processo_id: p.id, caixa_id: novo.caixa_id || p.caixa_id, texto })));
    return () => {
      const atual = procsRef.current;
      mudarProcessos(lista.map(({ p, texto }, i) => ({ p: atual.get(p.id) || p, novo: antes[i].valores, texto: 'Desfeito: ' + texto })));
    };
  }, [avisar]);

  const mudarCaixa = useCallback(async (c: Caixa, novo: Partial<Caixa>, texto: string): Promise<Desfazer | null> => {
    const antes = Object.fromEntries(Object.keys(novo).map(k => [k, c[k as keyof Caixa]])) as Partial<Caixa>;
    setCaixasM(m => { const x = new Map(m); x.set(c.id, { ...c, ...novo }); return x; });
    const r = await supabase().from('arquivo_caixas').update({ ...novo, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (r.error){ setCaixasM(m => { const x = new Map(m); x.set(c.id, c); return x; }); avisar('Não foi possível salvar: ' + r.error.message); return null; }
    await anotar([{ caixa_id: c.id, texto }]);
    return () => { const a = caixasRef.current.get(c.id) || c; mudarCaixa(a, antes, 'Desfeito: ' + texto); };
  }, [avisar]);

  const criarCaixa = useCallback(async (nome: string, locais: Local[], secretaria = false): Promise<Caixa | null> => {
    const c: Caixa = { id: crypto.randomUUID(), nome, locais, secretaria };
    const r = await supabase().from('arquivo_caixas').insert({ id: c.id, nome, locais, secretaria });
    if (r.error){ avisar('Não foi possível criar a ' + (secretaria ? 'secretaria' : 'caixa') + ': ' + r.error.message); return null; }
    setCaixasM(m => { const x = new Map(m); x.set(c.id, c); return x; });
    await anotar([{ caixa_id: c.id, texto: (secretaria ? 'Secretaria criada: ' : 'Caixa criada: ') + nome + (locais[0] ? ' (prateleira ' + locais[0][0] + ', fileira ' + locais[0][1] + ')' : '') }]);
    return c;
  }, [avisar]);

  const criarProcesso = useCallback(async (dados: Omit<Processo, 'id' | 'situacao' | 'origem_id' | 'com_quem' | 'destino' | 'volumes_ok' | 'excluido'>, texto: string): Promise<{ p: Processo; desfazer: Desfazer } | null> => {
    const p: Processo = { ...dados, id: crypto.randomUUID(), situacao: 0, origem_id: null, com_quem: '', destino: '', volumes_ok: false, excluido: false };
    const r = await supabase().from('arquivo_processos').insert({ id: p.id, codigo: p.codigo, caixa_id: p.caixa_id, numero: p.numero, classe: p.classe, partes: p.partes, ano: p.ano, obs: p.obs });
    if (r.error){ avisar('Não foi possível cadastrar: ' + r.error.message); return null; }
    setProcsM(m => { const x = new Map(m); x.set(p.id, p); return x; });
    await anotar([{ processo_id: p.id, caixa_id: p.caixa_id, texto }]);
    return { p, desfazer: () => { const a = procsRef.current.get(p.id) || p; mudarProcessos([{ p: a, novo: { excluido: true }, texto: 'Desfeito: ' + texto }]); } };
  }, [avisar, mudarProcessos]);

  const resolverNota = useCallback(async (celula: string, resolvida: boolean): Promise<Desfazer | null> => {
    setNotas(ns => ns.map(n => (n.celula === celula ? { ...n, resolvida } : n)));
    const r = await supabase().from('arquivo_notas').update({ resolvida }).eq('celula', celula);
    if (r.error){ setNotas(ns => ns.map(n => (n.celula === celula ? { ...n, resolvida: !resolvida } : n))); avisar('Não foi possível salvar: ' + r.error.message); return null; }
    await anotar([{ texto: 'Anotação da célula ' + celula + (resolvida ? ' resolvida' : ' reaberta') }]);
    return () => { resolverNota(celula, !resolvida); };
  }, [avisar]);

  return { estado, erro, carregar, atualizando, caixas, caixasM, processos, procsM, indice, porCaixa, notas, mudarProcessos, mudarCaixa, criarCaixa, criarProcesso, resolverNota };
}

export type ArquivoDados = ReturnType<typeof useArquivo>;

// Histórico (livro de registro): as últimas alterações, ou as de um processo
export type Movimento = { id: string; texto: string; quem: string; created_at: string };
export async function lerMovimentos(processoId?: string, limite = 300): Promise<Movimento[]> {
  let q = supabase().from('arquivo_movimentos').select('id,texto,quem,created_at').order('created_at', { ascending: false }).limit(limite);
  if (processoId) q = q.eq('processo_id', processoId);
  const r = await q;
  return r.error ? [] : (r.data as Movimento[]);
}
