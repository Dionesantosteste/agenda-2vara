-- =====================================================================
-- Organização do gestor (mural + tarefas) protegida por senha numérica
-- =====================================================================
-- Como usar:
--   1. Troque 000000 na linha marcada com  <<< SENHA  pela senha de 6 dígitos.
--   2. Cole tudo no SQL Editor do Supabase e clique em Run.
--
-- Atualizar (quando o arquivo ganhar novidades): rode o arquivo inteiro de novo.
--   Nada é apagado e a senha que já existe é mantida (a linha <<< SENHA só vale
--   na primeira instalação; para trocar a senha use o comando no fim do arquivo).
--
-- Como funciona:
--   - As tabelas org_* ficam TRANCADAS (RLS ligado e sem políticas): a chave
--     pública do site não consegue ler nem gravar nelas diretamente.
--   - O site só acessa os dados pelas funções org_*, que conferem a senha
--     antes de qualquer leitura ou gravação.
--   - A senha fica guardada criptografada (bcrypt), nunca em texto puro.
--   - Após 5 tentativas erradas, o acesso fica bloqueado por 5 minutos.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas ----------
create table if not exists org_config (
  id int primary key default 1 check (id = 1),
  pin_hash text not null,
  tentativas int not null default 0,
  bloqueado_ate timestamptz
);

create table if not exists org_notas (
  id uuid primary key default gen_random_uuid(),
  texto text not null default '',
  cor text not null default 'amarelo',          -- amarelo, verde, rosa, azul
  fixada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists org_tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  prazo date,
  urgente boolean not null default false,
  responsavel text not null default '',
  processo text not null default '',
  feita_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- etapa da tarefa no quadro: afazer, fazendo, feito
alter table org_tarefas add column if not exists etapa text not null default 'afazer';
update org_tarefas set etapa = 'feito' where feita_em is not null and etapa <> 'feito';

create table if not exists org_lembretes (
  id uuid primary key default gen_random_uuid(),
  texto text not null default '',
  data date not null default current_date,
  hora time,
  processo text not null default '',
  feito_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists org_rotinas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  frequencia text not null default 'mensal',     -- semanal, mensal, trimestral
  feita_em timestamptz,                           -- última vez que foi feita
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table org_config    enable row level security;
alter table org_notas     enable row level security;
alter table org_tarefas   enable row level security;
alter table org_lembretes enable row level security;
alter table org_rotinas   enable row level security;
revoke all on org_config, org_notas, org_tarefas, org_lembretes, org_rotinas from anon, authenticated;

-- ---------- senha ----------
insert into org_config (id, pin_hash)
values (1, extensions.crypt('000000', extensions.gen_salt('bf')))   -- <<< SENHA
on conflict (id) do nothing;

-- ---------- conferência da senha (uso interno) ----------
create or replace function org_verifica(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg org_config%rowtype;
begin
  select * into cfg from org_config where id = 1 for update;
  if not found then
    return 'sem_config';
  end if;
  if cfg.bloqueado_ate is not null and cfg.bloqueado_ate > now() then
    return 'bloqueado';
  end if;
  if p_pin is not null and crypt(p_pin, cfg.pin_hash) = cfg.pin_hash then
    update org_config set tentativas = 0, bloqueado_ate = null where id = 1;
    return 'ok';
  end if;
  if cfg.tentativas + 1 >= 5 then
    update org_config set tentativas = 0, bloqueado_ate = now() + interval '5 minutes' where id = 1;
    return 'bloqueado';
  end if;
  update org_config set tentativas = cfg.tentativas + 1 where id = 1;
  return 'senha';
end;
$$;
revoke all on function org_verifica(text) from public, anon, authenticated;

-- ---------- funções usadas pelo site ----------
-- Todas devolvem {"status": "ok" | "senha" | "bloqueado" | "sem_config", ...}

create or replace function org_listar(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'notas', coalesce((select jsonb_agg(to_jsonb(n) order by n.fixada desc, n.created_at desc) from org_notas n), '[]'::jsonb),
    'tarefas', coalesce((select jsonb_agg(to_jsonb(t) order by t.prazo nulls last, t.created_at) from org_tarefas t), '[]'::jsonb),
    'lembretes', coalesce((select jsonb_agg(to_jsonb(l) order by l.data, l.hora nulls first) from org_lembretes l), '[]'::jsonb),
    'rotinas', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from org_rotinas r), '[]'::jsonb)
  );
end;
$$;

create or replace function org_salvar_nota(p_pin text, p_id uuid, p_texto text, p_cor text, p_fixada boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_notas (texto, cor, fixada)
    values (coalesce(p_texto, ''), coalesce(p_cor, 'amarelo'), coalesce(p_fixada, false))
    returning id into novo;
  else
    update org_notas
       set texto = coalesce(p_texto, texto), cor = coalesce(p_cor, cor),
           fixada = coalesce(p_fixada, fixada), updated_at = now()
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_nota(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_notas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- versão antiga (sem etapa) é substituída pela de baixo
drop function if exists org_salvar_tarefa(text, uuid, text, date, boolean, text, text, timestamptz);

create or replace function org_salvar_tarefa(
  p_pin text, p_id uuid, p_titulo text, p_prazo date, p_urgente boolean,
  p_responsavel text, p_processo text, p_feita_em timestamptz, p_etapa text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_tarefas (titulo, prazo, urgente, responsavel, processo, feita_em, etapa)
    values (coalesce(p_titulo, ''), p_prazo, coalesce(p_urgente, false),
            coalesce(p_responsavel, ''), coalesce(p_processo, ''), p_feita_em, coalesce(p_etapa, 'afazer'))
    returning id into novo;
  else
    update org_tarefas
       set titulo = coalesce(p_titulo, titulo), prazo = p_prazo, urgente = coalesce(p_urgente, urgente),
           responsavel = coalesce(p_responsavel, responsavel), processo = coalesce(p_processo, processo),
           feita_em = p_feita_em, etapa = coalesce(p_etapa, etapa), updated_at = now()
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_tarefa(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_tarefas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_salvar_lembrete(
  p_pin text, p_id uuid, p_texto text, p_data date, p_hora time, p_processo text, p_feito_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_lembretes (texto, data, hora, processo, feito_em)
    values (coalesce(p_texto, ''), coalesce(p_data, current_date), p_hora, coalesce(p_processo, ''), p_feito_em)
    returning id into novo;
  else
    update org_lembretes
       set texto = coalesce(p_texto, texto), data = coalesce(p_data, data), hora = p_hora,
           processo = coalesce(p_processo, processo), feito_em = p_feito_em, updated_at = now()
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_lembrete(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_lembretes where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function org_salvar_rotina(
  p_pin text, p_id uuid, p_titulo text, p_frequencia text, p_feita_em timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
  novo uuid;
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  if p_id is null then
    insert into org_rotinas (titulo, frequencia, feita_em)
    values (coalesce(p_titulo, ''), coalesce(p_frequencia, 'mensal'), p_feita_em)
    returning id into novo;
  else
    update org_rotinas
       set titulo = coalesce(p_titulo, titulo), frequencia = coalesce(p_frequencia, frequencia),
           feita_em = p_feita_em, updated_at = now()
     where id = p_id
    returning id into novo;
  end if;
  return jsonb_build_object('status', 'ok', 'id', novo);
end;
$$;

create or replace function org_excluir_rotina(p_pin text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st text := org_verifica(p_pin);
begin
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;
  delete from org_rotinas where id = p_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function org_listar(text) to anon, authenticated;
grant execute on function org_salvar_nota(text, uuid, text, text, boolean) to anon, authenticated;
grant execute on function org_excluir_nota(text, uuid) to anon, authenticated;
grant execute on function org_salvar_tarefa(text, uuid, text, date, boolean, text, text, timestamptz, text) to anon, authenticated;
grant execute on function org_excluir_tarefa(text, uuid) to anon, authenticated;
grant execute on function org_salvar_lembrete(text, uuid, text, date, time, text, timestamptz) to anon, authenticated;
grant execute on function org_excluir_lembrete(text, uuid) to anon, authenticated;
grant execute on function org_salvar_rotina(text, uuid, text, text, timestamptz) to anon, authenticated;
grant execute on function org_excluir_rotina(text, uuid) to anon, authenticated;

-- =====================================================================
-- TROCAR A SENHA (ou criar uma nova se esquecer): rode só a linha abaixo,
-- trocando 000000 pela nova senha.
--
-- update org_config set pin_hash = extensions.crypt('000000', extensions.gen_salt('bf')), tentativas = 0, bloqueado_ate = null where id = 1;
-- =====================================================================
