-- =====================================================================
-- Assistente do gestor: rotinas de secretaria (passo a passo)
-- =====================================================================
-- Como usar: cole tudo no SQL Editor do Supabase e clique em Run.
-- Precisa do sql/organizacao.sql já instalado (usa a mesma senha do gestor).
-- Pode rodar de novo quando o arquivo mudar: nada é apagado.
--
-- Acesso: só o gestor (toda função pede a senha de 6 dígitos da Organização).
-- Os modelos de texto continuam na tabela org_txt_modelos (a mesma biblioteca
-- da aba "Modelos de texto"); o assistente só lê e salva nela.
-- =====================================================================

create table if not exists ast_rotinas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',          -- ex.: "INSS: após a decisão"
  assunto text not null default '',         -- ex.: "INSS", "Execução", "Alvará"
  quando text not null default '',          -- o que dispara a rotina: "Depois da decisão que concede o benefício"
  passos jsonb not null default '[]',       -- ["Intimar o INSS para implantar", "Aguardar 30 dias", ...]
  observacoes text not null default '',
  alterado_por text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ast_rotinas_assunto_idx on ast_rotinas (lower(assunto));

alter table ast_rotinas enable row level security;
revoke all on ast_rotinas from anon, authenticated;

-- Tudo o que o assistente precisa de uma vez: rotinas, modelos de texto e a cidade dos documentos
create or replace function ast_dados(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text;
begin
  if p_pin is null or btrim(p_pin) = '' then
    return jsonb_build_object('status', 'senha');
  end if;
  st := org_verifica(p_pin);
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'rotinas', coalesce((select jsonb_agg(to_jsonb(r) order by lower(r.assunto), lower(r.titulo)) from ast_rotinas r), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'categoria', m.categoria, 'texto', m.texto)
                                          order by lower(m.nome)) from org_txt_modelos m), '[]'::jsonb),
    'cidade', coalesce((select txt_cidade from org_config where id = 1), '')
  );
end;
$$;

create or replace function ast_salvar_rotina(p_pin text, p_id uuid, p_titulo text, p_assunto text, p_quando text, p_passos jsonb, p_observacoes text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text;
  titulo_ok text := left(btrim(coalesce(p_titulo, '')), 120);
  passos_ok jsonb;
  novo uuid;
begin
  if p_pin is null then
    return jsonb_build_object('status', 'senha');
  end if;
  st := org_verifica(p_pin);
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if titulo_ok = '' then
    return jsonb_build_object('status', 'erro', 'message', 'Dê um título à rotina.');
  end if;
  -- só textos não vazios, no máximo 60 passos de até 1000 caracteres
  select coalesce(jsonb_agg(left(btrim(v), 1000) order by n), '[]'::jsonb) into passos_ok
    from (select v, n from jsonb_array_elements_text(case when jsonb_typeof(p_passos) = 'array' then p_passos else '[]'::jsonb end)
                          with ordinality as x(v, n)
           where btrim(v) <> '' order by n limit 60) y;
  if p_id is null then
    insert into ast_rotinas (titulo, assunto, quando, passos, observacoes, alterado_por)
    values (titulo_ok, left(btrim(coalesce(p_assunto, '')), 60), left(btrim(coalesce(p_quando, '')), 500),
            passos_ok, left(coalesce(p_observacoes, ''), 4000), 'Gestor')
    returning id into novo;
  else
    update ast_rotinas
       set titulo = titulo_ok, assunto = left(btrim(coalesce(p_assunto, '')), 60), quando = left(btrim(coalesce(p_quando, '')), 500),
           passos = passos_ok, observacoes = left(coalesce(p_observacoes, ''), 4000), alterado_por = 'Gestor', updated_at = now()
     where id = p_id
    returning id into novo;
    if novo is null then
      return jsonb_build_object('status', 'erro', 'message', 'Esta rotina não existe mais.');
    end if;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function ast_excluir_rotina(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text;
begin
  if p_pin is null then
    return jsonb_build_object('status', 'senha');
  end if;
  st := org_verifica(p_pin);
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from ast_rotinas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- Só quem entrou no site (e-mail e senha) chama; a senha do gestor é conferida dentro
revoke all on function ast_dados(text) from public, anon;
revoke all on function ast_salvar_rotina(text, uuid, text, text, text, jsonb, text) from public, anon;
revoke all on function ast_excluir_rotina(text, uuid) from public, anon;
grant execute on function ast_dados(text) to authenticated;
grant execute on function ast_salvar_rotina(text, uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function ast_excluir_rotina(text, uuid) to authenticated;
