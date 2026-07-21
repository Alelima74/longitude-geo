-- LONGITUDE GEO V72 RC — ESTABILIZAÇÃO DOS MÓDULOS
create extension if not exists pgcrypto;

create table if not exists public.lg_analyses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 client_id uuid references public.lg_clients(id) on delete set null,
 property_id uuid references public.lg_properties(id) on delete cascade,
 analysis_type text not null default 'Consulta territorial',
 reference_date date,
 area_ha numeric,
 occurrences integer not null default 0,
 status text not null default 'Preliminar',
 notes text,
 query_payload jsonb not null default '{}'::jsonb,
 result_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.lg_analyses enable row level security;
drop policy if exists owner_all on public.lg_analyses;
create policy owner_all on public.lg_analyses for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
grant select,insert,update,delete on public.lg_analyses to authenticated;
create index if not exists idx_lg_analyses_property on public.lg_analyses(property_id);
create index if not exists idx_lg_analyses_client on public.lg_analyses(client_id);
create index if not exists idx_lg_analyses_created on public.lg_analyses(created_at desc);

create or replace function public.lg_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['lg_clients','lg_properties','lg_reports','lg_proposals','lg_settings','lg_analyses'] loop
   execute format('drop trigger if exists trg_touch_updated_at on public.%I',t);
   execute format('create trigger trg_touch_updated_at before update on public.%I for each row execute function public.lg_touch_updated_at()',t);
 end loop;
end $$;

select 'V72 RC MODULOS E HISTORICO CRIADOS COM SUCESSO' as resultado;
