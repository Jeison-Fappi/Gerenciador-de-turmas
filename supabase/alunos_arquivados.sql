
alter table public.alunos
  add column if not exists arquivado boolean not null default false;
