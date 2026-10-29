-- ACESSO SÓ POR CONVITE
-- Rode este arquivo UMA VEZ no SQL Editor do Supabase (e rode de novo depois de rodar qualquer
-- outro arquivo da pasta sql/, porque eles recriam as regras abertas).
--
-- O que faz: tira do "anon" (qualquer pessoa com o endereço do site) o direito de ler e gravar,
-- e deixa só quem entrou com e-mail e senha ("authenticated"). Nada é apagado.
--
-- ATENÇÃO: depois de rodar, o site só funciona para quem estiver logado. Convide as pessoas
-- (e crie o primeiro administrador) antes, ou logo em seguida, conforme o LEIA-ME.

-- 1. Regras das tabelas: de "qualquer um" para "só logado"
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and (roles && array['public','anon']::name[])
  loop
    execute format('alter policy %I on %I.%I to authenticated', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. Permissões diretas nas tabelas e sequências: o anon não tem nenhuma
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 3. Funções (as org_*, etc.): quem podia chamar como anon passa a ser só o logado.
--    Funções internas, que já eram bloqueadas, continuam bloqueadas.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'execute')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end $$;

-- 4. Tabelas novas criadas daqui para a frente também nascem fechadas para o anon
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- CONFERIR (opcional): não pode sobrar nada para o anon. As duas consultas têm de voltar vazias.
--   select tablename, policyname from pg_policies where schemaname = 'public' and roles && array['public','anon']::name[];
--   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute');

-- ADMINISTRADOR (quem pode convidar e remover pessoas dentro do sistema)
-- Troque o e-mail e rode, depois de essa pessoa já ter aceitado o convite:
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"admin": true}'::jsonb
--    where email = 'seu-email@exemplo.com';
-- Para tirar: troque por   raw_app_meta_data - 'admin'
