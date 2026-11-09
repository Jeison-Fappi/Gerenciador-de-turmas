-- Rode depois de seguranca.sql e agenda_turmas.sql.

create table if not exists public.fotos_turma (
  id uuid primary key default gen_random_uuid(),
  turma text not null references public.turmas(nome) on update cascade on delete restrict,
  storage_path text not null unique,
  nome_arquivo text not null check (char_length(nome_arquivo) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  tamanho_bytes bigint not null check (tamanho_bytes between 1 and 10485760),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

alter table public.fotos_turma enable row level security;
grant select, insert, delete on public.fotos_turma to authenticated;

drop policy if exists "equipe gerencia fotos das turmas" on public.fotos_turma;
create policy "equipe gerencia fotos das turmas" on public.fotos_turma
  for all to authenticated
  using ((select public.eh_da_equipe()))
  with check ((select public.eh_da_equipe()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-turmas',
  'fotos-turmas',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipe consulta fotos das turmas" on storage.objects;
drop policy if exists "equipe envia fotos das turmas" on storage.objects;
drop policy if exists "equipe remove fotos das turmas" on storage.objects;

create policy "equipe consulta fotos das turmas" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-turmas' and (select public.eh_da_equipe()));

create policy "equipe envia fotos das turmas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-turmas' and (select public.eh_da_equipe()));

create policy "equipe remove fotos das turmas" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-turmas' and (select public.eh_da_equipe()));
