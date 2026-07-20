-- LONGITUDE GEO CLOUD V70.2
-- Correcao de timeout na consulta por KML/perimetro

create or replace function public.consultar_camadas_por_geometria(
  p_geometria_geojson jsonb
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
  area_feicao_ha numeric,
  area_intersecao_ha numeric,
  percentual_sobre_perimetro numeric,
  geometria_geojson jsonb,
  geometria_intersecao_geojson jsonb
)
language sql
stable
security invoker
set search_path = public, extensions
set statement_timeout = '120s'
as $$
  with entrada_bruta as (
    select
      extensions.st_force2d(
        extensions.st_makevalid(
          extensions.st_setsrid(
            extensions.st_geomfromgeojson(p_geometria_geojson::text),
            4326
          )
        )
      ) as geom
  ),
  entrada as (
    select
      extensions.st_multi(
        extensions.st_collectionextract(geom, 3)
      ) as geom
    from entrada_bruta
  ),
  entrada_valida as (
    select
      geom,
      nullif(extensions.st_area(geom::geography), 0) as area_m2
    from entrada
    where geom is not null
      and not extensions.st_isempty(geom)
  ),
  candidatos as (
    select
      f.id,
      f.origem,
      f.uf,
      f.codigo,
      f.nome,
      f.titulo_primitivo,
      f.nome_fazenda,
      f.municipio,
      f.matricula,
      f.cns,
      f.situacao,
      f.version_id,
      f.atributos,
      f.geometria,
      v.data_referencia,
      e.geom as geom_consulta,
      e.area_m2 as area_consulta_m2
    from public.geo_features f
    join public.base_versions v
      on v.id = f.version_id
    cross join entrada_valida e
    where v.ativa = true
      and f.geometria && e.geom
      and extensions.st_intersects(f.geometria, e.geom)
  ),
  intersecoes as (
    select
      c.*,
      i.geom_intersecao
    from candidatos c
    cross join lateral (
      select
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_intersection(c.geometria, c.geom_consulta)
          ),
          3
        ) as geom_intersecao
    ) i
    where i.geom_intersecao is not null
      and not extensions.st_isempty(i.geom_intersecao)
  ),
  calculos as (
    select
      i.*,
      extensions.st_area(i.geometria::geography) / 10000.0 as area_feicao_ha_calc,
      extensions.st_area(i.geom_intersecao::geography) / 10000.0 as area_intersecao_ha_calc
    from intersecoes i
  )
  select
    c.id as feature_id,
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
    round(c.area_feicao_ha_calc::numeric, 6) as area_feicao_ha,
    round(c.area_intersecao_ha_calc::numeric, 6) as area_intersecao_ha,
    round(
      (100.0 * (c.area_intersecao_ha_calc * 10000.0) / c.area_consulta_m2)::numeric,
      6
    ) as percentual_sobre_perimetro,
    extensions.st_asgeojson(c.geometria)::jsonb as geometria_geojson,
    extensions.st_asgeojson(c.geom_intersecao)::jsonb as geometria_intersecao_geojson
  from calculos c
  order by
    c.origem,
    c.area_intersecao_ha_calc desc,
    c.nome nulls last;
$$;

grant execute
on function public.consultar_camadas_por_geometria(jsonb)
to anon, authenticated;

create index if not exists idx_geo_features_geometria
  on public.geo_features
  using gist (geometria);

analyze public.geo_features;
analyze public.base_versions;

select 'V70.2 CONSULTA POR PERIMETRO OTIMIZADA COM SUCESSO' as resultado;
