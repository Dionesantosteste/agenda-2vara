// Conexão com o Supabase: o mesmo projeto e a mesma chave pública do sistema atual
// (a chave pública já aparece no site; o acesso aos dados é controlado no banco).
// Dá para trocar pelas variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mgfsfzzvngqarwcmfzxy.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZnNmenp2bmdxYXJ3Y21menh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzk5OTEsImV4cCI6MjEwNDcxNTk5MX0.QTc6CC4KBIbE3kTfgS0lR4qv4w5DI2GJmfwpKh5oZDk';

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!cliente) cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return cliente;
}
