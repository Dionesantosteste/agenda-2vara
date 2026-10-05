-- =====================================================================
-- Tipos de audiência (lista que você mesmo administra no site)
-- =====================================================================
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo: nada é apagado.

create table if not exists audiencias_tipos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists audiencias_tipos_nome_idx on audiencias_tipos (lower(nome));

alter table audiencias_tipos enable row level security;
drop policy if exists "public read audiencias_tipos" on audiencias_tipos;
drop policy if exists "public write audiencias_tipos" on audiencias_tipos;
drop policy if exists "public update audiencias_tipos" on audiencias_tipos;
drop policy if exists "public delete audiencias_tipos" on audiencias_tipos;
create policy "public read audiencias_tipos" on audiencias_tipos for select using (true);
create policy "public write audiencias_tipos" on audiencias_tipos for insert with check (true);
create policy "public update audiencias_tipos" on audiencias_tipos for update using (true);
create policy "public delete audiencias_tipos" on audiencias_tipos for delete using (true);

-- Tipos iniciais e os que já estão gravados nas audiências (não duplica)
insert into audiencias_tipos (nome) values ('Instrução e julgamento'), ('Apresentação'), ('Em continuação')
on conflict do nothing;
insert into audiencias_tipos (nome)
select distinct on (lower(trim(tipo))) trim(tipo) from audiencias where trim(tipo) <> ''
order by lower(trim(tipo))
on conflict do nothing;

-- Atualização em tempo real: rode esta linha separada (se disser que já existe, pode ignorar)
-- alter publication supabase_realtime add table audiencias_tipos;
