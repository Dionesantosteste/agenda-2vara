// Gerenciar acessos (só administrador): listar, convidar por e-mail e remover.
// O convite é o e-mail do Supabase: a pessoa abre o link e cria a própria senha em /definir-senha.
import { NextResponse } from 'next/server';
import { emailValido } from '@/lib/acesso';
import { exigirAdmin, supabaseAdmin } from '@/lib/supabase-servidor';

export const dynamic = 'force-dynamic';

const SEM_CHAVE = 'O servidor ainda não tem a chave de administração (SUPABASE_SERVICE_ROLE_KEY). Veja o LEIA-ME, passo "Acesso por convite".';

function resposta(msg: string, status: number){ return NextResponse.json({ erro: msg }, { status }); }

export async function GET(req: Request){
  const admin = supabaseAdmin();
  if (!admin) return resposta(SEM_CHAVE, 500);
  const quem = await exigirAdmin(req, admin);
  if ('erro' in quem) return resposta(quem.erro, quem.status);
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return resposta('Não consegui listar as pessoas: ' + error.message, 500);
  const usuarios = data.users
    .map(u => ({
      id: u.id,
      email: u.email || '',
      criadoEm: u.created_at,
      ultimoAcesso: u.last_sign_in_at || null,
      ativo: !!u.email_confirmed_at || !!u.last_sign_in_at,   // false = convite ainda não aceito
      admin: u.app_metadata?.admin === true,
      eu: u.id === quem.usuario.id
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
  return NextResponse.json({ usuarios });
}

export async function POST(req: Request){
  const admin = supabaseAdmin();
  if (!admin) return resposta(SEM_CHAVE, 500);
  const quem = await exigirAdmin(req, admin);
  if ('erro' in quem) return resposta(quem.erro, quem.status);
  const corpo = await req.json().catch(() => ({}));
  const email = String(corpo?.email || '').trim().toLowerCase();
  if (!emailValido(email)) return resposta('Digite um e-mail válido.', 400);
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: new URL('/definir-senha', req.url).toString() });
  if (error){
    if (/already|registered|exists/i.test(error.message)) return resposta('Este e-mail já tem conta. Se a pessoa esqueceu a senha, ela pede um link novo na tela de entrada ("Esqueci minha senha").', 409);
    return resposta('Não consegui enviar o convite: ' + error.message, 500);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request){
  const admin = supabaseAdmin();
  if (!admin) return resposta(SEM_CHAVE, 500);
  const quem = await exigirAdmin(req, admin);
  if ('erro' in quem) return resposta(quem.erro, quem.status);
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return resposta('Faltou dizer quem remover.', 400);
  if (id === quem.usuario.id) return resposta('Você não pode remover o seu próprio acesso.', 400);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return resposta('Não consegui remover: ' + error.message, 500);
  return NextResponse.json({ ok: true });
}
