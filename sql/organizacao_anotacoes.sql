-- =====================================================================
-- Organização: editar uma anotação já feita na tarefa
-- =====================================================================
-- Rode DEPOIS do sql/organizacao.sql. Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo.

create or replace function org_editar_anotacao(p_pin text, p_pessoa uuid, p_id uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  txt text := left(btrim(coalesce(p_texto, '')), 2000);
  tarefa uuid;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if txt = '' then
    return jsonb_build_object('status', 'erro', 'message', 'A anotação não pode ficar vazia.');
  end if;
  update org_anotacoes x set texto = txt
   from org_tarefas t
   where x.id = p_id and t.id = x.tarefa_id and t.dono is not distinct from ac.o_dono
   returning x.tarefa_id into tarefa;
  if tarefa is null then
    return jsonb_build_object('status', 'erro', 'message', 'Esta anotação não existe mais.');
  end if;
  update org_tarefas set updated_at = now() where id = tarefa;
  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function org_editar_anotacao(text, uuid, uuid, text) to anon, authenticated;
