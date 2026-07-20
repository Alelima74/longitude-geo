-- ============================================================
-- LONGITUDE GEO CLOUD — V70.5
-- ANÁLISE DE VIZINHOS E CONFRONTANTES
--
-- Execute uma única vez no SQL Editor do Supabase.
-- Não apaga nenhuma base, versão, usuário ou histórico.
-- ============================================================

create or replace function public.consultar_vizinhos_por_geometria(
  p_geometria_geojson jsonb,
  p_distancia_m double precision default 20
)
returns table (
  feature_id bigint,
  origem text,
  uf varchar,
  codigo text,
  nome text,
  titulo_primitivo text,
  nome_fazenda text,
  municipio text,
  matricula text,
  cns text,
  situacao text,
  version_id uuid,
  data_referencia date,
  atributos jsonb,
  relacao text,
  distancia_m numeric,
  geometria_geojson jsonb
)
language sql
stable
security invoker
set search_path = public, extensions
set statement_timeout = '120s'
as $$
  with entrada_bruta as (
    select extensions.st_force2d(
      extensions.st_makevalid(
        extensions.st_setsrid(
          extensions.st_geomfromgeojson(p_geometria_geojson::text),
          4326
        )
      )
    ) as geom
  ),
  entrada as (
    select extensions.st_multi(
      extensions.st_collectionextract(geom, 3)
    ) as geom
    from entrada_bruta
  ),
  candidatos as (
    select
      f.*,
      v.data_referencia,
      e.geom as geom_consulta
    from public.geo_features f
    join public.base_versions v
      on v.id = f.version_id
    cross join entrada e
    where v.ativa = true
      and e.geom is not null
      and not extensions.st_isempty(e.geom)
      -- Pré-filtro rápido pelo índice GiST:
      and f.geometria && extensions.st_expand(
        e.geom,
        greatest(coalesce(p_distancia_m, 0), 1) / 111320.0
      )
      -- Distância real em metros entre os limites:
      and extensions.st_dwithin(
        extensions.st_boundary(f.geometria)::geography,
        extensions.st_boundary(e.geom)::geography,
        greatest(coalesce(p_distancia_m, 0), 0)
      )
  )
  select
    c.id,
    c.origem,
    c.uf,
    c.codigo,
    c.nome,
    c.titulo_primitivo,
    c.nome_fazenda,
    c.municipio,
    c.matricula,
    c.cns,
    c.situacao,
    c.version_id,
    c.data_referencia,
    c.atributos,
    case
      when extensions.st_touches(c.geometria, c.geom_consulta)
        then 'CONFRONTANTE'
      when extensions.st_intersects(c.geometria, c.geom_consulta)
        then 'SOBREPOSTO'
      else 'PRÓXIMO'
    end as relacao,
    round(
      extensions.st_distance(
        extensions.st_boundary(c.geometria)::geography,
        extensions.st_boundary(c.geom_consulta)::geography
      )::numeric,
      3
    ) as distancia_m,
    extensions.st_asgeojson(c.geometria)::jsonb
  from candidatos c
  order by
    case
      when extensions.st_touches(c.geometria, c.geom_consulta) then 1
      when extensions.st_intersects(c.geometria, c.geom_consulta) then 2
      else 3
    end,
    distancia_m,
    c.origem,
    c.nome nulls last
  limit 1000;
$$;

grant execute
on function public.consultar_vizinhos_por_geometria(jsonb, double precision)
to anon, authenticated;

create index if not exists idx_geo_features_geometria
  on public.geo_features
  using gist (geometria);

analyze public.geo_features;
analyze public.base_versions;

select
  'V70.5 VIZINHOS E EXPORTAÇÃO DE FEIÇÕES INSTALADOS COM SUCESSO'
  as resultado;
