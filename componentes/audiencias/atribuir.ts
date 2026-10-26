// Atribuir audiência a alguém da Organização: cria uma tarefa no Quadro da pessoa (só o gestor).
// A senha do gestor é a mesma que a tela Organização guarda na aba do navegador.
import { mensagemDoStatus } from '@/lib/organizacao';
import { supabase } from '@/lib/supabase';
import { tituloDaTarefa } from '@/lib/audiencias';

export type Pessoa = { id: string; nome: string };

export const senhaDoGestor = (): string | null => { try { return sessionStorage.getItem('orgPin'); } catch { return null; } };

export async function pessoasAtivas(): Promise<Pessoa[]> {
  const res = await supabase().rpc('org_pessoas_publico');
  return !res.error && res.data && Array.isArray(res.data.pessoas) ? res.data.pessoas : [];
}

// Devolve '' quando deu certo; senão, a mensagem para mostrar
export async function atribuirAudiencias(linhas: { id: string; processo: string; date: Date; tipo: string }[], para: string): Promise<string> {
  const pin = senhaDoGestor();
  if (!pin) return 'Para atribuir, entre como gestor em Organização (a senha fica guardada nesta aba).';
  const res = await supabase().rpc('org_atribuir_audiencias', {
    p_pin: pin, p_pessoa: null,
    p_itens: linhas.map(a => ({ audiencia: a.id, para, titulo: tituloDaTarefa(a.tipo, a.date), processo: a.processo }))
  });
  if (res.error){
    return /PGRST202|org_atribuir|function|responsavel_id|tarefa_id/i.test((res.error.code || '') + ' ' + res.error.message)
      ? 'Falta atualizar o Supabase: rode o arquivo sql/audiencias_tarefas.sql (veja o LEIA-ME.md).'
      : 'Não foi possível atribuir: ' + res.error.message;
  }
  const r = res.data as { status: string; message?: string };
  if (r.status === 'ok') return '';
  if (r.status === 'erro') return r.message || 'Não foi possível atribuir.';
  return mensagemDoStatus(r.status, false) + ' Entre de novo como gestor em Organização.';
}
