'use client';
// Sessão da Organização: quem entrou (gestor pela senha ou pessoa pelo nome), de quem é a tela aberta
// e os dados dela. Guardado nos mesmos lugares do sistema atual, então a entrada vale nos dois:
// senha e tela escolhida na aba do navegador (sessionStorage); pessoa no navegador (localStorage).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  lembreteDe, mensagemDoStatus, notaDe, rotinaDe, tarefaDe, type Lembrete, type Nota, type Pessoa, type Rotina, type Tarefa
} from '@/lib/organizacao';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';

export type Resposta = { status: string; message?: string; codigo?: string; [k: string]: unknown };
export type Modo = 'gestor' | 'pessoa';
export type Dados = {
  temEquipe: boolean; temConf: boolean; temNotaTitulo: boolean; temOrdemLista: boolean; eqConferir: number;
  euNome: string; pessoas: Pessoa[]; notas: Nota[]; tarefas: Tarefa[]; lembretes: Lembrete[]; rotinas: Rotina[];
  aniv: { mes: number }[] | null; txtTem: boolean; txtModelos: { id: string; nome: string }[];
};

const ler = (s: Storage | undefined, k: string) => { try { return s ? s.getItem(k) : null; } catch { return null; } };
const gravar = (s: Storage | undefined, k: string, v: string | null) => {
  try { if (!s) return; if (v == null) s.removeItem(k); else s.setItem(k, v); } catch { /* sem armazenamento */ }
};
const sessao = () => (typeof window === 'undefined' ? undefined : window.sessionStorage);
const local = () => (typeof window === 'undefined' ? undefined : window.localStorage);

function interpretar(r: Resposta): Dados {
  const arr = (k: string) => (Array.isArray(r[k]) ? r[k] as Record<string, unknown>[] : []);
  const pessoa = r.pessoa as { nome?: string } | null;
  return {
    temEquipe: r.equipe === true, temConf: r.conferencia === true, temNotaTitulo: r.nota_titulo === true, temOrdemLista: r.ordem_lista === true,
    eqConferir: typeof r.equipe_conferir === 'number' ? r.equipe_conferir : 0,
    euNome: pessoa && pessoa.nome ? pessoa.nome : '',
    pessoas: arr('pessoas').map(p => ({ id: String(p.id), nome: (p.nome as string) || '', ativo: p.ativo !== false })),
    notas: arr('notas').map(notaDe),
    tarefas: arr('tarefas').map(t => tarefaDe(t, null)),
    lembretes: arr('lembretes').map(lembreteDe),
    rotinas: arr('rotinas').map(rotinaDe),
    aniv: Array.isArray(r.aniversarios) ? (r.aniversarios as { mes: unknown }[]).map(a => ({ mes: Number(a.mes) })) : null,
    txtTem: Array.isArray(r.txt_modelos),
    txtModelos: arr('txt_modelos').map(m => ({ id: String(m.id), nome: (m.nome as string) || 'Sem nome' }))
  };
}

export function useSessao(){
  const avisar = useAviso();
  const [modo, setModo] = useState<Modo>('gestor');
  const [pin, setPin] = useState<string | null>(null);
  const [eu, setEu] = useState<string | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [msg, setMsg] = useState('');
  const [entrada, setEntrada] = useState<{ id: string; nome: string }[]>([]);
  const semCarregar = useRef(false);
  // a sessão de agora (as funções abaixo leem daqui, sem esperar o React redesenhar)
  const atual = useRef({ modo: 'gestor' as Modo, pin: null as string | null, eu: null as string | null, ver: null as string | null });

  const listaDeEntrada = useCallback(async () => {
    const res = await supabase().rpc('org_pessoas_publico');
    setEntrada(!res.error && res.data && Array.isArray(res.data.pessoas) ? res.data.pessoas : []);
  }, []);

  // Toda chamada leva a senha (gestor) e a tela em uso: a da pessoa que entrou ou a que o gestor escolheu
  const chamar = useCallback(async (fn: string, args: Record<string, unknown> = {}): Promise<Resposta> => {
    const a = atual.current;
    const base = { p_pin: a.modo === 'pessoa' ? null : a.pin, p_pessoa: a.modo === 'pessoa' ? a.eu : a.ver };
    const res = await supabase().rpc(fn, { ...base, ...args });
    if (res.error){
      const m = (res.error.code || '') + ' ' + (res.error.message || '');
      return { status: 'erro', codigo: res.error.code || '', message: /PGRST202|org_|function/i.test(m)
        ? 'A Organização no Supabase está desatualizada ou não foi instalada. Rode o arquivo sql/organizacao.sql inteiro de novo (veja o LEIA-ME.md).'
        : 'Erro no banco de dados: ' + res.error.message };
    }
    return (res.data as Resposta) || { status: 'erro', message: 'O banco não respondeu.' };
  }, []);

  const trancar = useCallback((m: string) => {
    atual.current = { modo: 'gestor', pin: null, eu: null, ver: null };
    setModo('gestor'); setPin(null); setEu(null); setVer(null); setDados(null);
    gravar(sessao(), 'orgPin', null); gravar(sessao(), 'orgVer', null); gravar(local(), 'orgPessoa', null);
    setMsg(m || '');
    listaDeEntrada();
    setTimeout(() => document.getElementById('orgPin')?.focus(), 30);
  }, [listaDeEntrada]);

  // A lista da equipe (aba "Tarefas da equipe") ainda fica no sistema atual: aqui só vem a tela aberta
  const buscar = useCallback(async () => {
    let r: Resposta = semCarregar.current ? { status: 'erro', codigo: 'PGRST202' } : await chamar('org_carregar', { p_equipe: 0 });
    if (r.status === 'erro' && r.codigo === 'PGRST202'){ semCarregar.current = true; r = await chamar('org_listar'); }
    return r;
  }, [chamar]);

  // Trata a resposta; devolve true quando deu certo
  const ok = useCallback((r: Resposta): boolean => {
    if (r.status === 'ok') return true;
    if (r.status === 'erro'){ avisar(r.message || ''); return false; }
    const a = atual.current;
    // o gestor estava vendo a tela de alguém que foi excluído: volta para a dele
    if (r.status === 'sem_pessoa' && a.modo === 'gestor' && a.ver){
      verTela(null);
      avisar('Essa pessoa não está mais cadastrada.');
      return false;
    }
    trancar(mensagemDoStatus(r.status, a.modo === 'pessoa'));
    return false;
  }, [avisar, trancar]);   // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = useCallback(async (): Promise<boolean> => {
    const r = await buscar();
    if (!ok(r)) return false;
    setDados(interpretar(r));
    return true;
  }, [buscar, ok]);

  async function verTela(id: string | null){
    atual.current = { ...atual.current, ver: id || null };
    setVer(id || null);
    gravar(sessao(), 'orgVer', id || null);
    await carregar();
  }

  async function entrarComSenha(p: string): Promise<string> {
    atual.current = { modo: 'gestor', pin: p, eu: null, ver: null };
    const r = await buscar();
    if (r.status === 'ok'){
      gravar(sessao(), 'orgPin', p);
      setModo('gestor'); setPin(p); setEu(null); setVer(null);
      setDados(interpretar(r));
      setMsg('');
      return '';
    }
    atual.current = { ...atual.current, pin: null };
    return r.status === 'erro' ? r.message || '' : mensagemDoStatus(r.status, false);
  }

  async function entrarComoPessoa(id: string){
    atual.current = { modo: 'pessoa', pin: null, eu: id, ver: null };
    setModo('pessoa'); setPin(null); setEu(id); setVer(null);
    gravar(sessao(), 'orgTab', 'quadro');   // a equipe entra direto no Quadro
    const r = await buscar();
    if (!ok(r)) return null;
    const d = interpretar(r);
    setDados(d);
    gravar(local(), 'orgPessoa', id);
    return d;
  }

  // Ao abrir: retoma a entrada guardada (a mesma do sistema atual)
  useEffect(() => {
    const p = ler(sessao(), 'orgPin'), v = ler(sessao(), 'orgVer') || null, pessoa = p ? null : ler(local(), 'orgPessoa');
    if (p){ atual.current = { modo: 'gestor', pin: p, eu: null, ver: v }; setModo('gestor'); setPin(p); setVer(v); carregar(); }
    else if (pessoa){ atual.current = { modo: 'pessoa', pin: null, eu: pessoa, ver: null }; setModo('pessoa'); setEu(pessoa); carregar(); }
    else { listaDeEntrada(); setTimeout(() => document.getElementById('orgPin')?.focus(), 30); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return { modo, pin, eu, ver, dados, msg, setMsg, entrada, chamar, ok, carregar, trancar, verTela, entrarComSenha, entrarComoPessoa,
    alheia: modo === 'pessoa' || !!ver };
}
export type Sessao = ReturnType<typeof useSessao>;
