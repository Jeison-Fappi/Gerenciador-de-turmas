-- Rode depois de supabase/seguranca.sql em projetos já existentes.

create table if not exists public.turmas (
  nome text primary key check (char_length(nome) between 1 and 60),
  criado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.turmas to authenticated;
alter table public.turmas enable row level security;

insert into public.turmas (nome) values
  ('SQE1'), ('SQE2'), ('TQE1'), ('TQE2'),
  ('SQC1'), ('SQC2'), ('TQC1'), ('TQC2'),
  ('CAL-JAVA'), ('CAL-IA e DADOS')
on conflict (nome) do nothing;

insert into public.turmas (nome)
select distinct trim(turma)
from public.alunos
where char_length(trim(turma)) between 1 and 60
on conflict (nome) do nothing;

drop policy if exists "time acessa turmas" on public.turmas;
drop policy if exists "equipe acessa turmas" on public.turmas;
create policy "equipe acessa turmas" on public.turmas
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));
