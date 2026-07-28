-- LONGITUDE GEO V73.2 — CONSULTAS OTIMIZADAS POR BASE
-- Execute no SQL Editor do Supabase depois do SQL 11.

create index if not exists idx_geo_features_origem_geometria
  on public.geo_features using gist (geometria);

create index if not exists idx_geo_features_origem
  on public.geo_features (origem);

create index if not exists idx_base_versions_ativa_origem
  on public.base_versions (ativa, origem);

create or replace function public.consultar_camadas_por_ponto_v732(
  p_longitude double precision,
  p_latitude double precision,
  p_origens text[] default null
)
returns table (
  feature_id bigint, origem text, uf varchar, codigo text, nome text,
  titulo_primitivo text, nome_fazenda text, municipio text, matricula text,
  cns text, situacao text, version_id uuid, data_referencia date,
  atributos jsonb, geometria_geojson jsonb
)
language sql stable security invoker
set search_path = public, extensions
set statement_timeout = '60s'
as $$
  with ponto as (
    select extensions.st_setsrid(extensions.st_point(p_longitude, p_latitude), 4326) as geom
  )
  select f.id, f.origem, f.uf, f.codigo, f.nome, f.titulo_primitivo,
         f.nome_fazenda, f.municipio, f.matricula, f.cns, f.situacao,
         f.version_id, v.data_referencia, f.atributos,
         extensions.st_asgeojson(f.geometria)::jsonb
  from ponto p
  join public.geo_features f
    on f.geometria && p.geom
   and extensions.st_covers(f.geometria, p.geom)
  join public.base_versions v
    on v.id = f.version_id and v.ativa = true
  where p_origens is null or f.origem = any(p_origens)
  order by f.origem, f.nome nulls last
  limit 500;
$$;

create or replace function public.consultar_camadas_por_geometria_v732(
  p_geometria_geojson jsonb,
  p_origens text[] default null
)
returns table (
  feature_id bigint, origem text, uf varchar, codigo text, nome text,
  titulo_primitivo text, nome_fazenda text, municipio text, matricula text,
  cns text, situacao text, version_id uuid, data_referencia date,
  atributos jsonb, area_feicao_ha numeric, area_intersecao_ha numeric,
  percentual_sobre_perimetro numeric, geometria_geojson jsonb,
  geometria_intersecao_geojson jsonb
)
language sql stable security invoker
set search_path = public, extensions
set statement_timeout = '180s'
as $$
  with entrada as (
    select extensions.st_multi(
      extensions.st_collectionextract(
        extensions.st_makevalid(
          extensions.st_force2d(
            extensions.st_setsrid(
              extensions.st_geomfromgeojson(p_geometria_geojson::text), 4326
            )
          )
        ), 3
      )
    ) geom
  ),
  entrada_valida as (
    select geom, nullif(extensions.st_area(geom::geography), 0) area_m2
    from entrada where geom is not null and not extensions.st_isempty(geom)
  ),
  candidatos as (
    select f.*, v.data_referencia, e.geom geom_consulta, e.area_m2
    from entrada_valida e
    join public.geo_features f on f.geometria && e.geom
    join public.base_versions v on v.id=f.version_id and v.ativa=true
    where (p_origens is null or f.origem=any(p_origens))
      and extensions.st_intersects(f.geometria,e.geom)
    limit 5000
  ),
  inter as (
    select c.*, extensions.st_collectionextract(
      extensions.st_makevalid(extensions.st_intersection(c.geometria,c.geom_consulta)),3
    ) geom_inter
    from candidatos c
  )
  select i.id, i.origem, i.uf, i.codigo, i.nome, i.titulo_primitivo,
         i.nome_fazenda, i.municipio, i.matricula, i.cns, i.situacao,
         i.version_id, i.data_referencia, i.atributos,
         round((extensions.st_area(i.geometria::geography)/10000)::numeric,6),
         round((extensions.st_area(i.geom_inter::geography)/10000)::numeric,6),
         round((100*extensions.st_area(i.geom_inter::geography)/i.area_m2)::numeric,6),
         extensions.st_asgeojson(i.geometria)::jsonb,
         extensions.st_asgeojson(i.geom_inter)::jsonb
  from inter i
  where i.geom_inter is not null and not extensions.st_isempty(i.geom_inter)
  order by i.origem, extensions.st_area(i.geom_inter::geography) desc;
$$;

create or replace function public.consultar_vizinhos_por_geometria_v732(
  p_geometria_geojson jsonb,
  p_distancia_m double precision default 20,
  p_origens text[] default null
)
returns table (
  feature_id bigint, origem text, uf varchar, codigo text, nome text,
  nome_fazenda text, matricula text, cns text, data_referencia date,
  relacao text, distancia_m numeric, geometria_geojson jsonb
)
language sql stable security invoker
set search_path = public, extensions
set statement_timeout = '180s'
as $$
  with entrada as (
    select extensions.st_multi(
      extensions.st_collectionextract(
        extensions.st_makevalid(
          extensions.st_setsrid(extensions.st_geomfromgeojson(p_geometria_geojson::text),4326)
        ),3
      )
    ) geom
  )
  select f.id, f.origem, f.uf, f.codigo, f.nome, f.nome_fazenda,
         f.matricula, f.cns, v.data_referencia,
         case when extensions.st_touches(f.geometria,e.geom) then 'CONFRONTANTE'
              else 'PRÓXIMO' end,
         round(extensions.st_distance(f.geometria::geography,e.geom::geography)::numeric,3),
         extensions.st_asgeojson(f.geometria)::jsonb
  from entrada e
  join public.geo_features f
    on f.geometria && extensions.st_expand(e.geom, greatest(p_distancia_m,0)/111320.0)
  join public.base_versions v on v.id=f.version_id and v.ativa=true
  where (p_origens is null or f.origem=any(p_origens))
    and not extensions.st_equals(f.geometria,e.geom)
    and extensions.st_dwithin(f.geometria::geography,e.geom::geography,greatest(p_distancia_m,0))
  order by relacao, distancia_m, f.origem
  limit 2000;
$$;

grant execute on function public.consultar_camadas_por_ponto_v732(double precision,double precision,text[]) to anon, authenticated;
grant execute on function public.consultar_camadas_por_geometria_v732(jsonb,text[]) to anon, authenticated;
grant execute on function public.consultar_vizinhos_por_geometria_v732(jsonb,double precision,text[]) to anon, authenticated;

analyze public.geo_features;
analyze public.base_versions;

select 'V73.2 CONSULTAS OTIMIZADAS CRIADAS COM SUCESSO' as resultado;
