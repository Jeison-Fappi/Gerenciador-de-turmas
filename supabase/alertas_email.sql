-- Automação de avisos de frequência. A instalação não cria envios retroativos.

create table if not exists public.alunos_emails (
  aluno_id uuid primary key references public.alunos(id) on delete cascade,
  email text not null,
  eh_teste boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint alunos_emails_formato check (email = lower(trim(email)) and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

alter table public.alunos_emails
  add column if not exists eh_teste boolean not null default false,
  add column if not exists atualizado_em timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alunos_emails_formato'
      and conrelid = 'public.alunos_emails'::regclass
  ) then
    alter table public.alunos_emails
      add constraint alunos_emails_formato
      check (email = lower(trim(email)) and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
  end if;
end $$;

alter table public.alunos_emails enable row level security;
grant select, insert, update, delete on public.alunos_emails to authenticated;

drop policy if exists "Admins podem consultar emails" on public.alunos_emails;
drop policy if exists "Admins podem cadastrar emails" on public.alunos_emails;
drop policy if exists "Admins podem atualizar emails" on public.alunos_emails;
drop policy if exists "Admins podem excluir emails" on public.alunos_emails;
drop policy if exists "equipe gerencia e-mails de alunos" on public.alunos_emails;

create policy "equipe gerencia e-mails de alunos" on public.alunos_emails
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));

create or replace function public.atualizar_email_aluno_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists atualizar_email_aluno_timestamp on public.alunos_emails;
create trigger atualizar_email_aluno_timestamp
before insert or update on public.alunos_emails
for each row execute function public.atualizar_email_aluno_timestamp();

create table if not exists public.email_automacao_config (
  id smallint primary key check (id = 1),
  modo text not null default 'desativado' check (modo in ('desativado', 'teste', 'producao')),
  data_inicio date,
  atualizado_em timestamptz not null default now()
);

insert into public.email_automacao_config (id, modo, data_inicio)
values (1, 'desativado', null)
on conflict (id) do nothing;

create or replace function public.cancelar_fila_ao_alterar_modo_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.modo is distinct from old.modo then
    update public.fila_emails_frequencia
    set status = 'cancelado', cancelada_em = now()
    where status = 'pendente'
      and (new.modo = 'desativado' or modo <> new.modo);
  end if;
  return new;
end;
$$;

create table if not exists public.fila_emails_frequencia (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references public.alunos(id) on delete set null,
  nome_aluno text not null,
  turma text not null,
  data_falta date not null,
  total_faltas integer not null,
  faltas_consecutivas integer not null,
  categoria text not null check (categoria in ('acompanhamento', 'alerta', 'sequencia', 'apoio', 'limite')),
  modo text not null check (modo in ('teste', 'producao')),
  agendada_para timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviado', 'cancelado', 'falha')),
  tentativas integer not null default 0,
  erro text,
  resend_id text,
  criada_em timestamptz not null default now(),
  enviada_em timestamptz,
  cancelada_em timestamptz,
  unique (aluno_id, data_falta)
);

create index if not exists fila_emails_frequencia_pendentes
  on public.fila_emails_frequencia (agendada_para)
  where status = 'pendente';

drop trigger if exists cancelar_fila_ao_alterar_modo_email on public.email_automacao_config;
create trigger cancelar_fila_ao_alterar_modo_email
after update of modo on public.email_automacao_config
for each row execute function public.cancelar_fila_ao_alterar_modo_email();

alter table public.email_automacao_config enable row level security;
alter table public.fila_emails_frequencia enable row level security;
grant select on public.email_automacao_config, public.fila_emails_frequencia to authenticated;

drop policy if exists "equipe consulta configuração de e-mails" on public.email_automacao_config;
create policy "equipe consulta configuração de e-mails" on public.email_automacao_config
  for select to authenticated using ((select public.eh_da_equipe()));

drop policy if exists "equipe consulta fila de e-mails" on public.fila_emails_frequencia;
create policy "equipe consulta fila de e-mails" on public.fila_emails_frequencia
  for select to authenticated using ((select public.eh_da_equipe()));

create or replace function public.aula_contabilizada(p_turma text, p_data date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ativa boolean;
  v_dia integer;
begin
  if not exists (
    select 1 from public.turmas
    where nome = p_turma and not arquivada
  ) then
    return false;
  end if;

  select ativa into v_ativa
  from public.excecoes_aula
  where turma = p_turma and data = p_data;
  if found then return v_ativa; end if;

  v_dia := extract(isodow from p_data)::integer;
  return exists (
    select 1
    from public.turmas t,
         lateral jsonb_array_elements_text(coalesce(t.agenda, '[]'::jsonb)) as slot(valor)
    where t.nome = p_turma
      and split_part(slot.valor, ':', 1)::integer = v_dia
  );
end;
$$;

revoke all on function public.aula_contabilizada(text, date) from public, anon, authenticated;

create or replace function public.enfileirar_alerta_frequencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno public.alunos%rowtype;
  v_email public.alunos_emails%rowtype;
  v_config public.email_automacao_config%rowtype;
  v_total integer;
  v_consecutivas integer := 0;
  v_data date;
  v_status text;
  v_categoria text;
  v_modo text;
begin
  if tg_op = 'DELETE' then
    if old.status = 'F' then
      update public.fila_emails_frequencia
      set status = 'cancelado', cancelada_em = now()
      where aluno_id = old.aluno_id and data_falta = old.data and status = 'pendente';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'F' and new.status <> 'F' then
    update public.fila_emails_frequencia
    set status = 'cancelado', cancelada_em = now()
    where aluno_id = new.aluno_id and data_falta = new.data and status = 'pendente';
    return new;
  end if;

  if new.status <> 'F' or (tg_op = 'UPDATE' and old.status = 'F') then return new; end if;

  select * into v_config from public.email_automacao_config where id = 1;
  if v_config.modo = 'desativado' or v_config.data_inicio is null or new.data < v_config.data_inicio then return new; end if;
  if not public.aula_contabilizada((select turma from public.alunos where id = new.aluno_id), new.data) then return new; end if;

  select * into v_aluno from public.alunos where id = new.aluno_id;
  if not found or v_aluno.arquivado then return new; end if;

  select * into v_email from public.alunos_emails where aluno_id = new.aluno_id;
  if not found or (v_config.modo = 'teste' and not v_email.eh_teste) or (v_config.modo = 'producao' and v_email.eh_teste) then return new; end if;

  v_modo := v_config.modo;
  select v_aluno.faltas_anteriores + count(*)
  into v_total
  from public.presencas p
  where p.aluno_id = new.aluno_id
    and p.status = 'F'
    and public.aula_contabilizada(v_aluno.turma, p.data);

  if v_total < 5 then return new; end if;

  v_data := new.data;
  while v_consecutivas < 13 loop
    if not public.aula_contabilizada(v_aluno.turma, v_data) then
      v_data := v_data - 1;
      continue;
    end if;

    select status into v_status
    from public.presencas
    where aluno_id = new.aluno_id and data = v_data;
    if not found or v_status <> 'F' then exit; end if;
    v_consecutivas := v_consecutivas + 1;
    v_data := v_data - 1;
  end loop;

  v_categoria := case
    when v_total >= 13 then 'limite'
    when v_total >= 10 and v_consecutivas >= 10 then 'sequencia'
    when v_total >= 10 then 'apoio'
    when v_total >= 7 then 'alerta'
    else 'acompanhamento'
  end;

  insert into public.fila_emails_frequencia (
    aluno_id, nome_aluno, turma, data_falta, total_faltas,
    faltas_consecutivas, categoria, modo, agendada_para
  ) values (
    new.aluno_id, v_aluno.nome, v_aluno.turma, new.data, v_total,
    v_consecutivas, v_categoria, v_modo,
    ((new.data + 1)::timestamp + time '19:00') at time zone 'America/Sao_Paulo'
  )
  on conflict (aluno_id, data_falta) do nothing;

  return new;
end;
$$;

drop trigger if exists enfileirar_alerta_frequencia on public.presencas;
create trigger enfileirar_alerta_frequencia
after insert or update of status on public.presencas
for each row execute function public.enfileirar_alerta_frequencia();

drop trigger if exists cancelar_alerta_frequencia_excluida on public.presencas;
create trigger cancelar_alerta_frequencia_excluida
after delete on public.presencas
for each row execute function public.enfileirar_alerta_frequencia();

create or replace function public.cancelar_email_frequencia(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linhas integer;
begin
  if not public.eh_da_equipe() then raise exception 'Acesso não autorizado'; end if;
  update public.fila_emails_frequencia
  set status = 'cancelado', cancelada_em = now()
  where id = p_id and status = 'pendente';
  get diagnostics v_linhas = row_count;
  return v_linhas = 1;
end;
$$;

revoke all on function public.cancelar_email_frequencia(uuid) from public, anon;
grant execute on function public.cancelar_email_frequencia(uuid) to authenticated;

create or replace function public.reivindicar_emails_frequencia(p_limite integer default 25)
returns setof public.fila_emails_frequencia
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with elegiveis as (
    select f.id
    from public.fila_emails_frequencia f
    join public.email_automacao_config c on c.id = 1 and c.modo = f.modo
    where f.status = 'pendente' and f.agendada_para <= now()
    order by f.agendada_para
    for update skip locked
    limit least(greatest(p_limite, 1), 100)
  )
  update public.fila_emails_frequencia f
  set status = 'enviando', tentativas = tentativas + 1
  from elegiveis e
  where f.id = e.id
  returning f.*;
end;
$$;

revoke all on function public.reivindicar_emails_frequencia(integer) from public, anon, authenticated;
grant execute on function public.reivindicar_emails_frequencia(integer) to service_role;

create or replace function public.finalizar_email_frequencia(
  p_id uuid,
  p_status text,
  p_resend_id text default null,
  p_erro text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('enviado', 'falha', 'cancelado') then raise exception 'Status inválido'; end if;
  update public.fila_emails_frequencia
  set status = p_status,
      resend_id = p_resend_id,
      erro = left(p_erro, 1000),
      enviada_em = case when p_status = 'enviado' then now() else null end,
      cancelada_em = case when p_status = 'cancelado' then now() else cancelada_em end
  where id = p_id and status = 'enviando';
end;
$$;

revoke all on function public.finalizar_email_frequencia(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.finalizar_email_frequencia(uuid, text, text, text) to service_role;
