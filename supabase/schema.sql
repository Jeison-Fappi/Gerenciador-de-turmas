-- ==========================================================
-- GERENCIADOR DE TURMAS - estrutura do banco (Supabase)
-- Cole tudo no SQL Editor do Supabase e clique em "Run".
-- ==========================================================

create table if not exists alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  turma text not null,
  faltas_anteriores int not null default 0,
  criado_em timestamptz not null default now()
);

-- Não permite dois alunos com o mesmo nome (igual ao sistema atual)
create unique index if not exists alunos_nome_unico on alunos (lower(nome));

create table if not exists presencas (
  aluno_id uuid not null references alunos(id) on delete cascade,
  data date not null,
  status text not null check (status in ('P', 'F', 'J')),
  primary key (aluno_id, data)
);

create table if not exists observacoes (
  aluno_id uuid not null references alunos(id) on delete cascade,
  data date not null,
  texto text not null,
  primary key (aluno_id, data)
);

-- Segurança: só usuários logados acessam os dados
alter table alunos enable row level security;
alter table presencas enable row level security;
alter table observacoes enable row level security;

create policy "time acessa alunos" on alunos
  for all to authenticated using (true) with check (true);
create policy "time acessa presencas" on presencas
  for all to authenticated using (true) with check (true);
create policy "time acessa observacoes" on observacoes
  for all to authenticated using (true) with check (true);
