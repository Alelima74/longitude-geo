-- ============================================================
-- LONGITUDE GEO CLOUD — V69.1 CLOUD IMPORTER
-- Execute depois do script de fundação já concluído.
-- ============================================================

-- 1. Verificação de perfil administrativo no JWT.
create or replace function public.eh_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

grant execute on function public.eh_admin() to authenticated;

-- 2. Políticas administrativas das tabelas.
drop policy if exists "admin gerencia versoes" on public.base_versions;
create policy "admin gerencia versoes"
on public.base_versions
for all
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

drop policy if exists "admin gerencia feicoes" on public.geo_features;
create policy "admin gerencia feicoes"
on public.geo_features
for all
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

drop policy if exists "admin gerencia importacoes" on public.importacoes;
create policy "admin gerencia importacoes"
on public.importacoes
for all
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

-- 3. Função de importação em lotes.
create or replace function public.importar_lote_geojson(
  p_version_id uuid,
  p_origem text,
  p_uf varchar,
  p_features jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item jsonb;
  v_contagem integer := 0;
begin
  if not public.eh_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if jsonb_typeof(p_features) <> 'array' then
    raise exception 'p_features deve ser um array JSON';
  end if;

  if not exists (
    select 1 from public.base_versions
    where id = p_version_id
      and origem = p_origem
  ) then
    raise exception 'Versão não encontrada ou origem incompatível';
  end if;

  for v_item in select value from jsonb_array_elements(p_features)
  loop
    insert into public.geo_features (
      version_id,
      origem,
      uf,
      codigo,
      nome,
      titulo_primitivo,
      nome_fazenda,
      municipio,
      matricula,
      cns,
      situacao,
      atributos,
      geometria
    ) values (
      p_version_id,
      p_origem,
      nullif(upper(trim(p_uf)), ''),
      nullif(v_item ->> 'codigo', ''),
      nullif(v_item ->> 'nome', ''),
      nullif(v_item ->> 'titulo_primitivo', ''),
      nullif(v_item ->> 'nome_fazenda', ''),
      nullif(v_item ->> 'municipio', ''),
      nullif(v_item ->> 'matricula', ''),
      nullif(v_item ->> 'cns', ''),
      nullif(v_item ->> 'situacao', ''),
      coalesce(v_item -> 'atributos', '{}'::jsonb),
      st_setsrid(st_geomfromgeojson((v_item -> 'geometry')::text), 4326)
    );
    v_contagem := v_contagem + 1;
  end loop;

  return v_contagem;
end;
$$;

grant execute on function public.importar_lote_geojson(uuid, text, varchar, jsonb) to authenticated;

-- 4. Autorizar administrador a ativar versões.
grant execute on function public.ativar_versao_base(uuid) to authenticated;

-- Reforçar checagem administrativa na função de ativação.
create or replace function public.ativar_versao_base(
  p_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem text;
  v_uf varchar(2);
begin
  if not public.eh_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select origem, uf into v_origem, v_uf
  from public.base_versions
  where id = p_version_id;

  if v_origem is null then
    raise exception 'Versão não encontrada';
  end if;

  update public.base_versions
  set ativa = false, status = 'INATIVA'
  where origem = v_origem
    and uf is not distinct from v_uf
    and id <> p_version_id;

  update public.base_versions
  set ativa = true, status = 'ATIVA', ativado_em = now()
  where id = p_version_id;
end;
$$;

grant execute on function public.ativar_versao_base(uuid) to authenticated;

-- 5. Bucket privado para ZIPs originais.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bases-originais',
  'bases-originais',
  false,
  52428800,
  array['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin envia bases originais" on storage.objects;
create policy "admin envia bases originais"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'bases-originais' and public.eh_admin());

drop policy if exists "admin consulta bases originais" on storage.objects;
create policy "admin consulta bases originais"
on storage.objects
for select
to authenticated
using (bucket_id = 'bases-originais' and public.eh_admin());

drop policy if exists "admin remove bases originais" on storage.objects;
create policy "admin remove bases originais"
on storage.objects
for delete
to authenticated
using (bucket_id = 'bases-originais' and public.eh_admin());

-- 6. Índices adicionais de pesquisa.
create index if not exists idx_geo_features_nome_lower on public.geo_features (lower(nome));
create index if not exists idx_geo_features_titulo_lower on public.geo_features (lower(titulo_primitivo));
create index if not exists idx_geo_features_fazenda_lower on public.geo_features (lower(nome_fazenda));

select 'V69.1 CLOUD IMPORTER CRIADO COM SUCESSO' as resultado;
