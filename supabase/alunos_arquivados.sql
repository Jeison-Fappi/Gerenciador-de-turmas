-- Rode no Supabase de teste antes de publicar a branch de teste.
alter table public.alunos
  add column if not exists arquivado boolean not null default false;
