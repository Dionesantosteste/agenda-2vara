'use client';
// Peças comuns do Assistente: a senha do gestor (a mesma da Organização, guardada na aba)
// e a chamada às funções do banco (ast_* e org_txt_*).
import { mensagemDoStatus } from '@/lib/organizacao';
import { supabase } from '@/lib/supabase';

export const lerPin = (): string | null => { try { return sessionStorage.getItem('orgPin'); } catch { return null; } };
export const gravarPin = (v: string | null) => { try { if (v == null) sessionStorage.removeItem('orgPin'); else sessionStorage.setItem('orgPin', v); } catch { /* sem armazenamento */ } };

export type RespostaBanco = { status: string; message?: string; [campo: string]: any };

// Chama uma função do banco com a senha do gestor. Devolve a resposta ou { status: 'erro', message }.
export async function chamar(fn: string, args: Record<string, unknown> = {}): Promise<RespostaBanco> {
  const res = await supabase().rpc(fn, { p_pin: lerPin(), ...args });
  if (res.error){
    const m = (res.error.code || '') + ' ' + res.error.message;
    return { status: 'erro', message: /PGRST202|function/i.test(m)
      ? (fn.startsWith('ast_') ? 'Falta instalar o Assistente no Supabase: rode o arquivo sql/assistente.sql (veja o LEIA-ME).'
                               : 'A Organização no Supabase está desatualizada: rode o sql/organizacao.sql de novo (veja o LEIA-ME).')
      : 'Erro no banco de dados: ' + res.error.message };
  }
  return (res.data as RespostaBanco) || { status: 'erro', message: 'O banco não respondeu.' };
}

// Mensagem para mostrar quando a resposta não foi "ok" (senha errada, bloqueado...)
export function problema(r: RespostaBanco): string {
  if (r.status === 'erro') return r.message || 'Erro';
  return mensagemDoStatus(r.status, false) || 'Entre de novo como gestor.';
}

export async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}
