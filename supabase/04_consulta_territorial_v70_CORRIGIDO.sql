-- ============================================================
-- LONGITUDE GEO CLOUD — V70 CONSULTA TERRITORIAL — CORRIGIDO
-- Execute uma única vez depois dos scripts 01, 02 e 03.
-- Este script cria/substitui somente a função de consulta espacial
-- por perímetro. Não apaga bases, versões ou feições importadas.
-- ============================================================

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
as $$
  with entrada as (
    select
      st_collectionextract(
        st_makevalid(
          st_setsrid(
            st_geomfromgeojson(p_geometria_geojson::text),
            4326
          )
        ),
        3
      ) as geom
  ),
  entrada_valida as (
    select
      geom,
      nullif(st_area(geom::geography), 0) as area_m2
    from entrada
    where geom is not null
      and not st_isempty(geom)
  ),
  resultados as (
    select
      f.id as feature_id,
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
      v.data_referencia,
      f.atributos,
      round(
        (st_area(f.geometria::geography) / 10000.0)::numeric,
        6
      ) as area_feicao_ha,
      round(
        (
          st_area(
            st_intersection(f.geometria, e.geom)::geography
          ) / 10000.0
        )::numeric,
        6
      ) as area_intersecao_ha,
      round(
        (
          100.0
          * st_area(
              st_intersection(f.geometria, e.geom)::geography
            )
          / e.area_m2
        )::numeric,
        6
      ) as percentual_sobre_perimetro,
      st_asgeojson(f.geometria)::jsonb as geometria_geojson,
      st_asgeojson(
        st_intersection(f.geometria, e.geom)
      )::jsonb as geometria_intersecao_geojson
    from public.geo_features f
    join public.base_versions v
      on v.id = f.version_id
    cross join entrada_valida e
    where v.ativa = true
      and f.geometria && e.geom
      and st_intersects(f.geometria, e.geom)
      and not st_isempty(
        st_intersection(f.geometria, e.geom)
      )
  )
  select
    r.feature_id,
    r.origem,
    r.uf,
    r.codigo,
    r.nome,
    r.titulo_primitivo,
    r.nome_fazenda,
    r.municipio,
    r.matricula,
    r.cns,
    r.situacao,
    r.version_id,
    r.data_referencia,
    r.atributos,
    r.area_feicao_ha,
    r.area_intersecao_ha,
    r.percentual_sobre_perimetro,
    r.geometria_geojson,
    r.geometria_intersecao_geojson
  from resultados r
  order by
    r.origem,
    r.area_intersecao_ha desc,
    r.nome nulls last;
$$;

grant execute
on function public.consultar_camadas_por_geometria(jsonb)
to anon, authenticated;

select
  'V70 CONSULTA TERRITORIAL CRIADA COM SUCESSO' as resultado;
