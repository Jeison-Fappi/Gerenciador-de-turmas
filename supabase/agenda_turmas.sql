-- Rode depois de supabase/seguranca.sql no projeto de teste já existente.

alter table public.turmas
  add column if not exists agenda jsonb not null default '[]'::jsonb,
  add column if not exists arquivada boolean not null default false;

insert into public.turmas (nome)
select distinct trim(turma)
from public.alunos
where char_length(trim(turma)) between 1 and 60
on conflict (nome) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alunos_turma_fkey'
      and conrelid = 'public.alunos'::regclass
  ) then
    alter table public.alunos
      add constraint alunos_turma_fkey
      foreign key (turma) references public.turmas(nome)
      on update cascade on delete restrict;
  end if;
end $$;

create table if not exists public.excecoes_aula (
  turma text not null references public.turmas(nome) on update cascade on delete cascade,
  data date not null,
  ativa boolean not null,
  primary key (turma, data)
);

grant select, insert, update, delete on public.turmas, public.excecoes_aula to authenticated;
alter table public.turmas enable row level security;
alter table public.excecoes_aula enable row level security;

drop policy if exists "time acessa turmas" on public.turmas;
drop policy if exists "equipe acessa turmas" on public.turmas;
drop policy if exists "time acessa excecoes_aula" on public.excecoes_aula;
drop policy if exists "equipe acessa excecoes_aula" on public.excecoes_aula;
create policy "equipe acessa turmas" on public.turmas
  for all to authenticated using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));
create policy "equipe acessa excecoes_aula" on public.excecoes_aula
  for all to authenticated using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));
