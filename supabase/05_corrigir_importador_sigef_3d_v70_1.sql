-- ============================================================
-- LONGITUDE GEO CLOUD — V70.1
-- CORREÇÃO DE GEOMETRIAS 3D/Z, GEOMETRIAS INVÁLIDAS E SIGEF
--
-- Execute uma única vez no SQL Editor do Supabase.
-- Não apaga bases, usuários, versões ou histórico.
-- ============================================================

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
  v_geom extensions.geometry;
  v_polygonal extensions.geometry;
  v_contagem integer := 0;
begin
  if not public.eh_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if jsonb_typeof(p_features) <> 'array' then
    raise exception 'p_features deve ser um array JSON';
  end if;

  if not exists (
    select 1
    from public.base_versions
    where id = p_version_id
      and origem = p_origem
  ) then
    raise exception 'Versão não encontrada ou origem incompatível';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_features)
  loop
    begin
      -- Lê o GeoJSON, define o SRID, remove altitude Z/M e corrige
      -- anéis, autointerseções e outras inconsistências topológicas.
      v_geom := extensions.st_force2d(
        extensions.st_makevalid(
          extensions.st_setsrid(
            extensions.st_geomfromgeojson((v_item -> 'geometry')::text),
            4326
          )
        )
      );

      -- SIGEF, CAR e INTERMAT devem entrar como polígonos.
      -- ST_MakeValid pode produzir GeometryCollection; extraímos
      -- apenas as partes poligonais e consolidamos em MultiPolygon.
      v_polygonal := extensions.st_multi(
        extensions.st_collectionextract(v_geom, 3)
      );

      if v_polygonal is null or extensions.st_isempty(v_polygonal) then
        raise exception 'Geometria sem componente poligonal válido';
      end if;

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
        v_polygonal
      );

      v_contagem := v_contagem + 1;

    exception
      when others then
        -- Uma feição defeituosa não derruba o lote completo.
        -- O aviso fica no log do PostgreSQL e as demais continuam.
        raise warning 'Feição ignorada na versão %, origem %: %',
          p_version_id, p_origem, sqlerrm;
    end;
  end loop;

  return v_contagem;
end;
$$;

grant execute
on function public.importar_lote_geojson(uuid, text, varchar, jsonb)
to authenticated;

-- Confirmação técnica: a função deve existir e retornar a assinatura.
select
  'V70.1 IMPORTADOR 3D/Z CORRIGIDO COM SUCESSO' as resultado,
  pg_get_function_identity_arguments(
    'public.importar_lote_geojson(uuid,text,character varying,jsonb)'::regprocedure
  ) as assinatura;
