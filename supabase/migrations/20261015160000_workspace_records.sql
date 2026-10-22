-- Sincronização da mesma conta entre dispositivos. Não altera tabelas legadas.
begin;
create table public.longitude_workspace_records (
  owner_id uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind in ('geo', 'evaluation', 'workspace', 'technical')),
  local_id text not null check (length(local_id) between 1 and 200),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null default 1 check (revision > 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, kind, local_id)
);
alter table public.longitude_workspace_records enable row level security;
revoke all on public.longitude_workspace_records from public, anon, authenticated;
grant select on public.longitude_workspace_records to authenticated;
grant insert (kind, local_id, payload) on public.longitude_workspace_records to authenticated;
grant update (payload, archived) on public.longitude_workspace_records to authenticated;
create policy workspace_owner_read on public.longitude_workspace_records
for select to authenticated using (owner_id = (select auth.uid()));
create policy workspace_owner_insert on public.longitude_workspace_records
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy workspace_owner_update on public.longitude_workspace_records
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create function public.longitude_workspace_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.kind <> old.kind or new.local_id <> old.local_id then
    raise exception 'Identidade do registro é imutável';
  end if;
  new.revision := old.revision + 1;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.longitude_workspace_revision() from public, anon, authenticated;
create trigger longitude_workspace_revision before update on public.longitude_workspace_records
for each row execute function public.longitude_workspace_revision();
comment on table public.longitude_workspace_records is 'Snapshots pessoais versionados; mesma conta em vários aparelhos; exclusão lógica.';
notify pgrst, 'reload schema';
commit;
