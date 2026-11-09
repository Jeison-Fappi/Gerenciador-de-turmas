-- ==========================================================
-- SEGURANÇA ADICIONAL (rode DEPOIS do schema.sql)
--
-- 1. Só quem está na lista "equipe" acessa os dados. Mesmo que
--    alguém consiga criar uma conta (cadastro aberto por engano,
--    login anônimo), não enxerga nada.
-- 2. Limites de tamanho nos textos.
--
-- ANTES de rodar, crie os usuários do time em
-- Authentication > Users e confira a lista com:
--     select id, email, created_at from auth.users;
-- Qualquer e-mail que você não reconheça deve ser removido antes.
-- ==========================================================

-- Lista de quem pode acessar (sem nenhuma policy: a API não lê nem escreve aqui)
create table if not exists equipe (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  criado_em timestamptz not null default now()
);
alter table equipe enable row level security;
alter table excecoes_aula enable row level security;

-- Pergunta "quem está logado é da equipe?"
create or replace function public.eh_da_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.equipe where user_id = auth.uid());
$$;

revoke all on function public.eh_da_equipe() from public, anon;
grant execute on function public.eh_da_equipe() to authenticated;

-- Coloca na equipe todos os usuários que existem agora
insert into equipe (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- Troca as regras antigas ("qualquer logado") por "só a equipe"
drop policy if exists "time acessa alunos" on alunos;
drop policy if exists "time acessa turmas" on turmas;
drop policy if exists "equipe acessa turmas" on turmas;
drop policy if exists "time acessa excecoes_aula" on excecoes_aula;
drop policy if exists "equipe acessa excecoes_aula" on excecoes_aula;
drop policy if exists "time acessa presencas" on presencas;
drop policy if exists "time acessa observacoes" on observacoes;
drop policy if exists "equipe acessa alunos" on alunos;
drop policy if exists "equipe acessa presencas" on presencas;
drop policy if exists "equipe acessa observacoes" on observacoes;

create policy "equipe acessa turmas" on turmas
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));

create policy "equipe acessa excecoes_aula" on excecoes_aula
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));

create policy "equipe acessa alunos" on alunos
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));

create policy "equipe acessa presencas" on presencas
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));

create policy "equipe acessa observacoes" on observacoes
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));

-- Limites de tamanho
alter table alunos drop constraint if exists alunos_tamanhos;
alter table alunos add constraint alunos_tamanhos check (
  char_length(nome) between 1 and 120
  and char_length(turma) between 1 and 60
  and faltas_anteriores between 0 and 1000
);

alter table observacoes drop constraint if exists observacoes_tamanho;
alter table observacoes add constraint observacoes_tamanho check (
  char_length(texto) between 1 and 2000
);

-- ==========================================================
-- Para ADICIONAR uma pessoa depois:
--   1) crie o usuário em Authentication > Users
--   2) rode:
--      insert into equipe (user_id, email)
--      select id, email from auth.users where email = 'pessoa@empresa.com';
--
-- Para REMOVER o acesso de alguém:
--      delete from equipe where email = 'pessoa@empresa.com';
--   (e apague o usuário em Authentication > Users)
-- ==========================================================
