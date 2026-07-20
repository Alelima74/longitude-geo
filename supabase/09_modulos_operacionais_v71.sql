-- LONGITUDE GEO V71 — MÓDULOS OPERACIONAIS ONLINE
-- Execute uma única vez após os scripts anteriores.
create extension if not exists pgcrypto;

create table if not exists public.lg_clients (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), name text not null, document text, phone text, email text, address text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.lg_properties (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), client_id uuid references public.lg_clients(id) on delete set null, name text not null, municipality text, state varchar(2), registration text, car_code text, sigef_code text, area_ha numeric, status text default 'Em andamento', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.lg_reports (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), client_id uuid references public.lg_clients(id) on delete set null, property_id uuid references public.lg_properties(id) on delete set null, title text not null, report_type text, status text default 'Rascunho', reference_date date, summary text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.lg_proposals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), client_id uuid references public.lg_clients(id) on delete set null, property_id uuid references public.lg_properties(id) on delete set null, service text not null, amount numeric, deadline text, payment_terms text, scope text, status text default 'Em elaboração', validity_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.lg_settings (
 owner_id uuid primary key default auth.uid(), company_name text, trade_name text, phone text, email text, address text, technical_responsible text, document text, report_footer text, updated_at timestamptz not null default now());

alter table public.lg_clients enable row level security; alter table public.lg_properties enable row level security; alter table public.lg_reports enable row level security; alter table public.lg_proposals enable row level security; alter table public.lg_settings enable row level security;

do $$ declare t text; begin foreach t in array array['lg_clients','lg_properties','lg_reports','lg_proposals'] loop execute format('drop policy if exists owner_all on public.%I',t); execute format('create policy owner_all on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',t); end loop; end $$;
drop policy if exists owner_all on public.lg_settings; create policy owner_all on public.lg_settings for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());

grant select,insert,update,delete on public.lg_clients,public.lg_properties,public.lg_reports,public.lg_proposals,public.lg_settings to authenticated;
create index if not exists idx_lg_properties_client on public.lg_properties(client_id); create index if not exists idx_lg_reports_property on public.lg_reports(property_id); create index if not exists idx_lg_proposals_client on public.lg_proposals(client_id);
select 'V71 MODULOS OPERACIONAIS ONLINE CRIADOS COM SUCESSO' as resultado;
