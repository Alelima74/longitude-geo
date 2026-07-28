-- Longitude Geo V73.1 RC — Cadastro mestre reutilizável
-- Execute uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.cad_confrontantes (
  id uuid primary key default gen_random_uuid(),
  nome text,
  documento text,
  imovel text,
  matricula text,
  cns text,
  codigo_incra text,
  codigo_sigef text,
  codigo_car text,
  municipio text,
  uf text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cad_proprietarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  rg text,
  estado_civil text,
  conjuge_nome text,
  conjuge_documento text,
  endereco text,
  email text,
  telefone text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cad_marcos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  tipo text,
  longitude double precision,
  latitude double precision,
  altitude double precision,
  easting double precision,
  northing double precision,
  fuso integer,
  hemisferio text,
  origem text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pecas_processos (
  id uuid primary key default gen_random_uuid(),
  nome text,
  procedimento text,
  imovel_id uuid,
  dados jsonb not null default '{}'::jsonb,
  status text not null default 'RASCUNHO',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cad_confrontantes_nome on public.cad_confrontantes using gin (to_tsvector('simple', coalesce(nome,'') || ' ' || coalesce(imovel,'') || ' ' || coalesce(documento,'')));
create index if not exists idx_cad_confrontantes_codigos on public.cad_confrontantes (codigo_incra, codigo_sigef, codigo_car);
create unique index if not exists idx_cad_marcos_codigo on public.cad_marcos (codigo);

alter table public.cad_confrontantes enable row level security;
alter table public.cad_proprietarios enable row level security;
alter table public.cad_marcos enable row level security;
alter table public.pecas_processos enable row level security;

drop policy if exists "cad_confrontantes_authenticated" on public.cad_confrontantes;
create policy "cad_confrontantes_authenticated" on public.cad_confrontantes for all to authenticated using (true) with check (true);

drop policy if exists "cad_proprietarios_authenticated" on public.cad_proprietarios;
create policy "cad_proprietarios_authenticated" on public.cad_proprietarios for all to authenticated using (true) with check (true);

drop policy if exists "cad_marcos_authenticated" on public.cad_marcos;
create policy "cad_marcos_authenticated" on public.cad_marcos for all to authenticated using (true) with check (true);

drop policy if exists "pecas_processos_own" on public.pecas_processos;
create policy "pecas_processos_own" on public.pecas_processos
for all to authenticated
using (created_by = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check (created_by = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select, insert, update, delete on public.cad_confrontantes to authenticated;
grant select, insert, update, delete on public.cad_proprietarios to authenticated;
grant select, insert, update, delete on public.cad_marcos to authenticated;
grant select, insert, update, delete on public.pecas_processos to authenticated;

select 'V73.1 CADASTRO MESTRE CRIADO COM SUCESSO' as resultado;
