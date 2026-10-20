create table if not exists turmas (
  nome text primary key check (char_length(nome) between 1 and 60),
  agenda jsonb not null default '[]'::jsonb,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now()
);

insert into turmas (nome) values
  ('SQE1'), ('SQE2'), ('TQE1'), ('TQE2'),
  ('SQC1'), ('SQC2'), ('TQC1'), ('TQC2'),
  ('CAL-JAVA'), ('CAL-IA e DADOS')
on conflict (nome) do nothing;

create table if not exists alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  turma text not null references turmas(nome) on update cascade on delete restrict,
  faltas_anteriores int not null default 0,
  criado_em timestamptz not null default now()
);

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

create table if not exists excecoes_aula (
  turma text not null references turmas(nome) on update cascade on delete cascade,
  data date not null,
  ativa boolean not null,
  primary key (turma, data)
);

alter table alunos enable row level security;
alter table turmas enable row level security;
alter table presencas enable row level security;
alter table observacoes enable row level security;
alter table excecoes_aula enable row level security;
grant select, insert, update, delete on public.turmas, public.excecoes_aula to authenticated;

drop policy if exists "time acessa alunos" on alunos;
drop policy if exists "time acessa turmas" on turmas;
drop policy if exists "time acessa presencas" on presencas;
drop policy if exists "time acessa observacoes" on observacoes;
drop policy if exists "time acessa excecoes_aula" on excecoes_aula;
create policy "time acessa alunos" on alunos for all to authenticated using (true) with check (true);
create policy "time acessa turmas" on turmas for all to authenticated using (true) with check (true);
create policy "time acessa presencas" on presencas for all to authenticated using (true) with check (true);
create policy "time acessa observacoes" on observacoes for all to authenticated using (true) with check (true);
create policy "time acessa excecoes_aula" on excecoes_aula for all to authenticated using (true) with check (true);
