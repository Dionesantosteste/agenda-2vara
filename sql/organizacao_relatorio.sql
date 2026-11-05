-- =====================================================================
-- Organização: relatório de produtividade por pessoa
-- =====================================================================
-- Rode DEPOIS do sql/organizacao.sql. Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo.
-- (O sql/organizacao.sql atualizado já inclui esta função.)

-- Relatório de produtividade (só o gestor): tarefas concluídas por pessoa num período (horário da vara),
-- inclusive as já arquivadas, mais as recebidas no período e o que cada uma tem em aberto hoje.
-- O site monta o resumo, a impressão e as planilhas com estes dados.
create or replace function org_relatorio(p_pin text, p_pessoa uuid, p_de date, p_ate date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ac record;
  ini timestamptz;
  fim timestamptz;
begin
  select * into ac from org_acesso(p_pin, p_pessoa);
  if ac.o_st <> 'ok' then
    return jsonb_build_object('status', ac.o_st);
  end if;
  if not ac.o_gestor then
    return jsonb_build_object('status', 'erro', 'message', 'Só o gestor tira o relatório de produtividade.');
  end if;
  if p_de is null or p_ate is null or p_de > p_ate then
    return jsonb_build_object('status', 'erro', 'message', 'Escolha um período válido (a data inicial não pode ser depois da final).');
  end if;
  if p_ate - p_de > 366 then
    return jsonb_build_object('status', 'erro', 'message', 'O período pode ter no máximo um ano.');
  end if;
  ini := p_de::timestamp at time zone 'America/Cuiaba';
  fim := (p_ate + 1)::timestamp at time zone 'America/Cuiaba';
  return jsonb_build_object('status', 'ok', 'de', p_de, 'ate', p_ate, 'hoje', org_hoje(),
    'tarefas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'dono', t.dono, 'titulo', t.titulo, 'processo', t.processo, 'prazo', t.prazo,
               'prioridade', t.prioridade, 'do_gestor', t.do_gestor, 'created_at', t.created_at, 'feita_em', t.feita_em,
               'dia', (t.feita_em at time zone 'America/Cuiaba')::date, 'conclusao', t.conclusao,
               'devolvida', coalesce(t.conf_hist @> '[{"a": "devolvida"}]', false),
               'aprovada', coalesce(t.conf_hist @> '[{"a": "aprovada"}]', false),
               'arquivada', t.arquivada_em is not null)
             order by t.feita_em)
        from org_tarefas t
       where t.dono is not null and t.feita_em >= ini and t.feita_em < fim), '[]'::jsonb),
    -- recebidas: tarefas que entraram no quadro da pessoa no período (mandadas pelo gestor ou criadas por ela)
    'recebidas', coalesce((select jsonb_agg(x) from (
        select t.dono, count(*) as n, count(*) filter (where t.do_gestor) as do_gestor
          from org_tarefas t where t.dono is not null and t.created_at >= ini and t.created_at < fim
         group by t.dono) x), '[]'::jsonb),
    -- em aberto hoje (não concluídas, não arquivadas e já visíveis para a pessoa)
    'abertas', coalesce((select jsonb_agg(x) from (
        select t.dono, count(*) as n, count(*) filter (where t.prazo < org_hoje()) as atrasadas
          from org_tarefas t
         where t.dono is not null and t.arquivada_em is null and t.etapa <> 'feito'
           and (t.aparece_em is null or t.aparece_em <= org_hoje())
         group by t.dono) x), '[]'::jsonb));
end;
$$;
grant execute on function org_relatorio(text, uuid, date, date) to anon, authenticated;
