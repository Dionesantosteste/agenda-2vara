// Aparência guardada na conta de quem entrou (tabela preferencias, sql/preferencias.sql), para valer em
// qualquer computador, navegador ou endereço do site. Mesma regra do sistema atual:
// ao entrar, se a conta já tem aparência ela vale aqui; se não tem, o que está neste navegador sobe para a conta.
// "aparPendente" marca uma mudança feita aqui que a conta ainda não confirmou (ex.: trocou de tela no meio):
// nesse caso é o navegador que sobe para a conta, e não o contrário.
// Sem a tabela no banco ou sem internet, a aparência continua só no navegador, como antes.
import { aparenciaLocal, aparenciaVazia, gravarAparenciaLocal, normalizarAparencia } from './aparencia';
import { supabase } from './supabase';

export const EVENTO_APARENCIA = 'aparencia-da-conta';
const PENDENTE = 'aparPendente';

const estado = { uid: null as string | null, pronto: false, semTabela: false, iniciado: false, seq: 0 };

function marcar(v: boolean){
  try { if (v) localStorage.setItem(PENDENTE, '1'); else localStorage.removeItem(PENDENTE); } catch { /* sem armazenamento */ }
}
function pendente(){
  try { return !!localStorage.getItem(PENDENTE); } catch { return false; }
}

async function enviar(){
  if (!estado.uid || estado.semTabela) return;
  const n = ++estado.seq;
  const r = await supabase().from('preferencias').upsert({ user_id: estado.uid, aparencia: aparenciaLocal(), updated_at: new Date().toISOString() });
  if (r.error){ estado.semTabela = true; return; }
  if (n === estado.seq) marcar(false);
}

// Depois de cada mudança no navegador (tema, fundo)
export function salvarAparenciaNaConta(){
  marcar(true);
  if (estado.pronto) void enviar();
}

// Chamada uma vez por página (botão Aparência do menu)
export async function carregarAparenciaDaConta(){
  if (estado.iniciado) return;
  estado.iniciado = true;
  try {
    const { data } = await supabase().auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid){ estado.pronto = true; return; }
    estado.uid = uid;
    const r = await supabase().from('preferencias').select('aparencia').eq('user_id', uid).maybeSingle();
    estado.pronto = true;
    if (r.error){ estado.semTabela = true; return; }
    if (pendente()) await enviar();
    else if (r.data){
      gravarAparenciaLocal(normalizarAparencia(r.data.aparencia));
      window.dispatchEvent(new Event(EVENTO_APARENCIA));
    } else if (!aparenciaVazia(aparenciaLocal())) await enviar();
  } catch {
    estado.pronto = true; estado.semTabela = true;
  }
}
