-- LONGITUDE GEO V69 CLOUD - executar no SQL Editor do Supabase
create extension if not exists postgis;

create table if not exists public.base_versions (
  id uuid primary key default gen_random_uuid(),
  base_type text not null check (base_type in ('SIGEF','CAR','INTERMAT')),
  uf text,
  reference_date date,
  original_filename text not null,
  storage_path text,
  feature_count integer default 0,
  status text not null default 'processing',
  active boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create table if not exists public.geo_features (
  id bigserial primary key,
  version_id uuid not null references public.base_versions(id) on delete cascade,
  base_type text not null,
  uf text,
  code text,
  name text,
  title_name text,
  farm_name text,
  properties jsonb not null default '{}'::jsonb,
  geom geometry(MultiPolygon,4326) not null,
  created_at timestamptz not null default now()
);
create index if not exists geo_features_geom_gix on public.geo_features using gist(geom);
create index if not exists geo_features_version_idx on public.geo_features(version_id);
create index if not exists geo_features_code_idx on public.geo_features(code);
create index if not exists base_versions_active_idx on public.base_versions(base_type,uf,active);

alter table public.base_versions enable row level security;
alter table public.geo_features enable row level security;

create or replace function public.is_admin() returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin';
$$;

create policy "authenticated read versions" on public.base_versions for select to authenticated using (true);
create policy "admin insert versions" on public.base_versions for insert to authenticated with check (public.is_admin());
create policy "admin update versions" on public.base_versions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read features" on public.geo_features for select to authenticated using (true);
create policy "admin insert features" on public.geo_features for insert to authenticated with check (public.is_admin());

create or replace function public.import_geojson_batch(
  p_version_id uuid,
  p_base_type text,
  p_uf text,
  p_features jsonb
) returns integer
language plpgsql security invoker set search_path=public as $$
declare item jsonb; inserted integer := 0; g geometry;
begin
  if not public.is_admin() then raise exception 'Acesso administrativo necessário'; end if;
  for item in select * from jsonb_array_elements(p_features) loop
    begin
      g := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(item->'geometry'),4326));
      if not ST_IsValid(g) then g := ST_MakeValid(g); end if;
      insert into public.geo_features(version_id,base_type,uf,code,name,title_name,farm_name,properties,geom)
      values(p_version_id,p_base_type,p_uf,item->>'code',item->>'name',item->>'title_name',item->>'farm_name',coalesce(item->'properties','{}'::jsonb),g);
      inserted := inserted + 1;
    exception when others then
      raise notice 'Feição ignorada: %', SQLERRM;
    end;
  end loop;
  update public.base_versions set feature_count=(select count(*) from public.geo_features where version_id=p_version_id) where id=p_version_id;
  return inserted;
end; $$;

grant execute on function public.import_geojson_batch(uuid,text,text,jsonb) to authenticated;

create or replace function public.activate_base_version(p_version_id uuid) returns void
language plpgsql security invoker set search_path=public as $$
declare v public.base_versions%rowtype;
begin
  if not public.is_admin() then raise exception 'Acesso administrativo necessário'; end if;
  select * into v from public.base_versions where id=p_version_id;
  if not found then raise exception 'Versão inexistente'; end if;
  if not exists(select 1 from public.geo_features where version_id=p_version_id) then raise exception 'Versão sem feições'; end if;
  update public.base_versions set active=false where base_type=v.base_type and coalesce(uf,'')=coalesce(v.uf,'');
  update public.base_versions set active=true,status='active',activated_at=now() where id=p_version_id;
end; $$;
grant execute on function public.activate_base_version(uuid) to authenticated;

create or replace function public.query_point_bases(p_lon double precision,p_lat double precision)
returns table(feature_id bigint,base_type text,uf text,code text,name text,title_name text,farm_name text,reference_date date,created_at timestamptz,geometry_geojson text)
language sql security invoker stable set search_path=public as $$
  select f.id,f.base_type,f.uf,f.code,f.name,f.title_name,f.farm_name,v.reference_date,v.created_at,ST_AsGeoJSON(f.geom)
  from public.geo_features f join public.base_versions v on v.id=f.version_id
  where v.active=true and ST_Covers(f.geom,ST_SetSRID(ST_Point(p_lon,p_lat),4326))
  order by case f.base_type when 'SIGEF' then 1 when 'CAR' then 2 else 3 end,f.code;
$$;
grant execute on function public.query_point_bases(double precision,double precision) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bases-originais','bases-originais',false,5368709120,array['application/zip','application/x-zip-compressed','application/octet-stream'])
on conflict(id) do nothing;

create policy "admin upload original bases" on storage.objects for insert to authenticated
with check(bucket_id='bases-originais' and public.is_admin());
create policy "admin read original bases" on storage.objects for select to authenticated
using(bucket_id='bases-originais' and public.is_admin());
