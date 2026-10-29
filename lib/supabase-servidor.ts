// Supabase com a chave de administração. SÓ roda no servidor (rotas em app/api): a chave
// SUPABASE_SERVICE_ROLE_KEY nunca pode ir para o navegador nem para o código. Configure-a nas
// variáveis de ambiente da Vercel (veja o LEIA-ME).
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL } from './supabase';

export function supabaseAdmin(): SupabaseClient | null {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) return null;
  return createClient(SUPABASE_URL, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Chamador = { usuario: User } | { erro: string; status: number };

// Confere quem está chamando: precisa mandar o token do login e ser administrador
export async function exigirAdmin(req: Request, admin: SupabaseClient): Promise<Chamador> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { erro: 'Entre no sistema para continuar.', status: 401 };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { erro: 'Sua sessão venceu. Entre de novo.', status: 401 };
  if (data.user.app_metadata?.admin !== true) return { erro: 'Só o administrador pode gerenciar os acessos.', status: 403 };
  return { usuario: data.user };
}
