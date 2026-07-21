-- LONGITUDE GEO V70.4 - INCRA 2A EDICAO E FALLBACK RAPIDO

alter table public.base_versions drop constraint if exists base_versions_origem_check;
alter table public.base_versions add constraint base_versions_origem_check check (origem in ('SIGEF','CAR','INTERMAT','INCRA_2A_EDICAO','FUNAI','ICMBIO','INCRA','SEMA','IBAMA','MAPBIOMAS','OUTRA'));

create or replace function public.consultar_camadas_por_geometria_rapida(p_geometria_geojson jsonb)
returns table(feature_id bigint, origem text, uf varchar, codigo text, nome text, titulo_primitivo text, nome_fazenda text, municipio text, matricula text, cns text, situacao text, version_id uuid, data_referencia date, atributos jsonb, area_feicao_ha numeric, area_intersecao_ha numeric, percentual_sobre_perimetro numeric, geometria_geojson jsonb, geometria_intersecao_geojson jsonb)
language sql stable security invoker set search_path=public,extensions as $$
with e as (select st_multi(st_collectionextract(st_force2d(st_makevalid(st_setsrid(st_geomfromgeojson(p_geometria_geojson::text),4326))),3)) geom)
select f.id,f.origem,f.uf,f.codigo,f.nome,f.titulo_primitivo,f.nome_fazenda,f.municipio,f.matricula,f.cns,f.situacao,f.version_id,v.data_referencia,f.atributos,round((st_area(f.geometria::geography)/10000.0)::numeric,6),null::numeric,null::numeric,st_asgeojson(f.geometria)::jsonb,null::jsonb
from public.geo_features f join public.base_versions v on v.id=f.version_id cross join e
where v.ativa=true and f.geometria && e.geom and st_intersects(f.geometria,e.geom)
order by f.origem,f.nome nulls last limit 500; $$;
grant execute on function public.consultar_camadas_por_geometria_rapida(jsonb) to anon,authenticated;
analyze public.geo_features;
select 'V70.4 INCRA 2A E FALLBACK INSTALADOS COM SUCESSO' resultado;
