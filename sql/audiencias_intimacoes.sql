-- =====================================================================
-- Audiências: lista de quem intimar (partes, testemunhas, perito…) com ✓ intimado / ✗ não intimado
-- =====================================================================
-- Cole no SQL Editor do Supabase e clique em Run. Só acrescenta uma coluna; nada é apagado. Pode rodar de novo.
-- Cada item: { "id", "nome", "papel", "meio", "situacao" ('' | 'intimada' | 'nao' | 'dispensada'), "em", "motivo" }

alter table audiencias add column if not exists intimacoes jsonb not null default '[]'::jsonb;
