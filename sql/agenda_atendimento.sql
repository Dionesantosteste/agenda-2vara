-- Agenda: horário de atendimento e plantão do contato.
-- Rode uma vez no SQL Editor do Supabase (pode rodar de novo sem problema).
alter table contacts add column if not exists service_hours text default '';
alter table contacts add column if not exists has_on_call boolean default false;
alter table contacts add column if not exists on_call_phone text default '';
