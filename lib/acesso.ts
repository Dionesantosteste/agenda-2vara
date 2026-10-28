// Regras do acesso por convite (login com e-mail e senha). Sem chamadas ao banco: só validações,
// para poderem ser testadas.

export const SENHA_MINIMA = 8;

// Telas que abrem sem estar logado
const PUBLICAS = ['/entrar', '/definir-senha'];
export function caminhoPublico(caminho: string): boolean {
  return PUBLICAS.some(p => caminho === p || caminho.startsWith(p + '/'));
}

// Para onde voltar depois do login. Só aceita endereço do próprio site (nunca outro domínio).
export function voltaSegura(volta: string | null | undefined): string {
  if (!volta || !volta.startsWith('/') || volta.startsWith('//') || volta.includes('\\')) return '/';
  if (caminhoPublico(volta.split(/[?#]/)[0])) return '/';
  return volta;
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Devolve o motivo de a senha não servir, ou '' quando está boa
export function problemaNaSenha(senha: string, confirmacao: string): string {
  if (senha.length < SENHA_MINIMA) return 'A senha precisa ter pelo menos ' + SENHA_MINIMA + ' caracteres.';
  if (senha !== confirmacao) return 'As duas senhas não são iguais.';
  return '';
}

// Mensagens do Supabase Auth em português
export function traduzirErroAuth(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Este e-mail ainda não confirmou o convite. Abra o link que foi enviado para ele.';
  if (m.includes('same password')) return 'Escolha uma senha diferente da anterior.';
  if (m.includes('weak') || m.includes('at least')) return 'A senha é fraca demais. Use letras e números, com 8 caracteres ou mais.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (m.includes('already') && m.includes('regist')) return 'Este e-mail já tem conta.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  return 'Não deu certo: ' + msg;
}
