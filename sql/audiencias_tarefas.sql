-- =====================================================================
-- Audiências: atribuir a audiência a alguém da Organização (tarefa no Quadro da pessoa)
-- =====================================================================
-- Rode DEPOIS do sql/organizacao.sql. Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo.

alter table audiencias add column if not exists responsavel_id uuid;   -- pessoa (org_pessoas) que está com a audiência
alter table audiencias add column if not exists tarefa_id uuid;        -- tarefa criada no Quadro dessa pessoa

-- Só o gestor. p_itens: [{ "audiencia": uuid, "para": uuid, "titulo": text, "processo": text }]
-- Cria uma tarefa por audiência e grava na audiência quem está com ela. Audiência que já tem tarefa é pulada.
create or replace function org_atribuir_audiencias(p_pin text, p_pessoa uuid, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  it jsonb;
  novo uuid;
  n int := 0;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor atribui audiências à equipe.');
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    return jsonb_build_object('status', 'erro', 'message', 'Nenhuma audiência para atribuir.');
  end if;
  if jsonb_array_length(p_itens) > 100 then
    return jsonb_build_object('status', 'erro', 'message', 'Atribua no máximo 100 audiências por vez.');
  end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    if not exists (select 1 from org_pessoas where id::text = it->>'para' and ativo) then
      return jsonb_build_object('status', 'erro', 'message', 'A pessoa escolhida não está ativa.');
    end if;
  end loop;
  for it in select * from jsonb_array_elements(p_itens) loop
    if not exists (select 1 from audiencias where id::text = it->>'audiencia' and tarefa_id is null) then
      continue;
    end if;
    insert into org_tarefas (dono, do_gestor, titulo, prioridade, urgente, responsavel, processo, etapa)
    values ((it->>'para')::uuid, true, left(btrim(coalesce(it->>'titulo', '')), 160), 'normal', false, '',
            left(coalesce(it->>'processo', ''), 40), 'afazer')
    returning id into novo;
    update audiencias set responsavel_id = (it->>'para')::uuid, tarefa_id = novo, updated_at = now()
    where id::text = it->>'audiencia';
    n := n + 1;
  end loop;
  return jsonb_build_object('status', 'ok', 'n', n);
end;
$$;
grant execute on function org_atribuir_audiencias(text, uuid, jsonb) to anon, authenticated;
