-- =====================================================================
-- Preferências de cada pessoa (aparência: tema, cor de fundo e cores das colunas do Quadro)
-- =====================================================================
-- Como usar: cole tudo no SQL Editor do Supabase e clique em Run. Pode rodar de novo: nada é apagado.
--
-- Guarda a aparência na conta de quem entrou (e-mail e senha), para ela valer em qualquer
-- computador, navegador ou endereço do site. Cada pessoa só lê e grava a própria linha.
-- Enquanto este arquivo não rodar, o site continua guardando a aparência só no navegador.
-- =====================================================================

create table if not exists preferencias (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  aparencia jsonb not null default '{}'::jsonb,   -- {"tema": "dark", "fundo": "ceu", "colunas": {"afazer": "rosa"}}
  updated_at timestamptz not null default now()
);

alter table preferencias enable row level security;

drop policy if exists "dono le preferencias" on preferencias;
drop policy if exists "dono cria preferencias" on preferencias;
drop policy if exists "dono altera preferencias" on preferencias;
create policy "dono le preferencias" on preferencias for select to authenticated using (user_id = auth.uid());
create policy "dono cria preferencias" on preferencias for insert to authenticated with check (user_id = auth.uid());
create policy "dono altera preferencias" on preferencias for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on preferencias from anon;
grant select, insert, update on preferencias to authenticated;
