# Banco de dados — Longitude Geo Intelligence

[Voltar à especificação mestre](../MASTER_SPEC.md) · [Arquitetura](../architecture/ARCHITECTURE.md) · [Problemas conhecidos](../KNOWN_ISSUES.md)

## 1. Escopo e nível de confirmação

Este inventário deriva exclusivamente dos arquivos em `supabase/` e das chamadas do frontend. Ele comprova definições pretendidas pelos scripts, não comprova quais scripts foram aplicados no projeto Supabase remoto, a ordem efetiva de aplicação, dados existentes ou políticas atualmente ativas.

Existe uma inconsistência estrutural: `01_setup_cloud.sql` cria `base_versions` e `geo_features` com colunas em inglês (`base_type`, `active`, `geom`), enquanto os scripts seguintes e o frontend usam nomes em português (`origem`, `ativa`, `geometria`). O script que cria `importacoes` também não foi localizado. Assim, o esquema Cloud remoto compatível com a aplicação não pode ser reconstruído integralmente apenas pelos arquivos presentes.

## 2. Extensões

- `postgis`, criada em `01_setup_cloud.sql`;
- `pgcrypto`, solicitada nos scripts 09, 10 e 11.

## 3. Tabelas comprovadas por `CREATE TABLE`

### `base_versions`

Definida no script 01 com:

- `id uuid` PK;
- `base_type text`;
- `uf text`;
- `reference_date date`;
- `original_filename text`;
- `storage_path text`;
- `feature_count integer`;
- `status text`;
- `active boolean`;
- `created_by uuid`;
- `created_at timestamptz`;
- `activated_at timestamptz`.

Scripts posteriores esperam `origem`, `data_referencia`, `nome_arquivo`, `caminho_storage`, `quantidade_feicoes`, `ativa`, `criado_por`, `criado_em` e `ativado_em`. A migration de renomeação/criação dessa variante não está no repositório auditado.

### `geo_features`

Definida no script 01 com:

- `id bigserial` PK;
- `version_id uuid` FK para `base_versions(id)` com `ON DELETE CASCADE`;
- `base_type text`;
- `uf text`;
- `code text`;
- `name text`;
- `title_name text`;
- `farm_name text`;
- `properties jsonb`;
- `geom geometry(MultiPolygon,4326)`;
- `created_at timestamptz`.

Scripts posteriores esperam `origem`, `codigo`, `nome`, `titulo_primitivo`, `nome_fazenda`, `municipio`, `matricula`, `cns`, `situacao`, `atributos` e `geometria`. A transformação entre os dois formatos não está presente.

### `lg_clients`

- `id uuid` PK;
- `owner_id uuid`;
- `name text` obrigatório;
- `document`, `phone`, `email`, `address`, `notes`;
- `created_at`, `updated_at`.

### `lg_properties`

- `id uuid` PK;
- `owner_id uuid`;
- `client_id uuid` FK para `lg_clients(id)`, `ON DELETE SET NULL`;
- `name text` obrigatório;
- `municipality`, `state`, `registration`, `car_code`, `sigef_code`;
- `area_ha numeric`, `status`, `notes`;
- `created_at`, `updated_at`;
- adicionadas no script 13: `cns`, `sncr`, `perimeter_m`, `registry_office`, `owner_name`, `owner_document`.

### `lg_reports`

- `id`, `owner_id`;
- `client_id` FK para `lg_clients`;
- `property_id` FK para `lg_properties`;
- `title`, `report_type`, `status`, `reference_date`, `summary`;
- `created_at`, `updated_at`.

### `lg_proposals`

- `id`, `owner_id`;
- `client_id` FK para `lg_clients`;
- `property_id` FK para `lg_properties`;
- `service`, `amount`, `deadline`, `payment_terms`, `scope`, `status`, `validity_date`;
- `created_at`, `updated_at`.

### `lg_settings`

- `owner_id uuid` PK;
- `company_name`, `trade_name`, `phone`, `email`, `address`;
- `technical_responsible`, `document`, `report_footer`;
- `updated_at`.

### `lg_analyses`

- `id uuid` PK;
- `owner_id uuid`;
- `client_id` FK para `lg_clients`, `ON DELETE SET NULL`;
- `property_id` FK para `lg_properties`, `ON DELETE CASCADE`;
- `analysis_type`, `reference_date`, `area_ha`, `occurrences`, `status`, `notes`;
- `query_payload jsonb`, `result_payload jsonb`;
- `created_at`, `updated_at`.

### `cad_confrontantes`

- `id uuid` PK;
- `nome`, `documento`, `imovel`, `matricula`, `cns`;
- `codigo_incra`, `codigo_sigef`, `codigo_car`;
- `municipio`, `uf`, `observacoes`;
- `created_at`, `updated_at`;
- adicionadas no script 13: `rg`, `qualificacao`, `cartorio`, `situacao`.

### `cad_proprietarios`

- `id uuid` PK;
- `nome text` obrigatório;
- `documento`, `rg`, `estado_civil`;
- `conjuge_nome`, `conjuge_documento`;
- `endereco`, `email`, `telefone`, `observacoes`;
- `created_at`, `updated_at`.

### `cad_marcos`

- `id uuid` PK;
- `codigo text` obrigatório;
- `tipo`, `longitude`, `latitude`, `altitude`;
- `easting`, `northing`, `fuso`, `hemisferio`, `origem`, `observacoes`;
- `created_at`, `updated_at`.

### `pecas_processos`

- `id uuid` PK;
- `nome`, `procedimento`, `imovel_id`;
- `dados jsonb`;
- `status`;
- `created_by uuid`;
- `created_at`, `updated_at`.

`imovel_id` não possui FK declarada no script auditado.

### `importacoes`

É usada por políticas e pelo frontend (`cloudApi.js`), mas nenhum `CREATE TABLE public.importacoes` foi encontrado. Os campos esperados pelo frontend incluem, pelo menos, os enviados/listados no fluxo Cloud, e a listagem ordena por `iniciado_em`. A estrutura não deve ser inferida sem o script ausente ou inspeção do banco remoto.

## 4. Relacionamentos comprovados

- `geo_features.version_id -> base_versions.id`;
- `lg_properties.client_id -> lg_clients.id`;
- `lg_reports.client_id -> lg_clients.id`;
- `lg_reports.property_id -> lg_properties.id`;
- `lg_proposals.client_id -> lg_clients.id`;
- `lg_proposals.property_id -> lg_properties.id`;
- `lg_analyses.client_id -> lg_clients.id`;
- `lg_analyses.property_id -> lg_properties.id`.

Não existem FKs comprovadas entre `cad_*`, `pecas_processos` e as tabelas `lg_*`.

## 5. Funções/RPCs identificadas

| Função | Finalidade | Uso atual comprovado |
|---|---|---|
| `is_admin()` | Verificar role administrativa | Esquema inicial |
| `eh_admin()` | Verificar `app_metadata.role = admin` | Importador Cloud posterior |
| `import_geojson_batch(...)` | Importação inicial em lotes | Função histórica; frontend atual não a chama |
| `activate_base_version(uuid)` | Ativação no esquema inicial | Função histórica |
| `query_point_bases(double precision,double precision)` | Consulta inicial por ponto | Função histórica |
| `importar_lote_geojson(uuid,text,varchar,jsonb)` | Importar lote no esquema em português | Chamada por `cloudApi.js` |
| `ativar_versao_base(uuid)` | Ativar versão por origem/UF | Chamada por `cloudApi.js` |
| `consultar_camadas_por_geometria(jsonb)` | Consulta por perímetro | Versões V70/V70.2 |
| `consultar_camadas_por_geometria_rapida(jsonb)` | Fallback rápido | Script V70.4; uso atual não comprovado |
| `consultar_vizinhos_por_geometria(jsonb,double precision)` | Vizinhos V70.5 | Substituída no frontend pela V73.2 |
| `consultar_camadas_por_ponto_v732(double precision,double precision,text[])` | Consulta por ponto e origens | Chamada atual |
| `consultar_camadas_por_geometria_v732(jsonb,text[])` | Sobreposição por origens | Chamada atual |
| `consultar_vizinhos_por_geometria_v732(jsonb,double precision,text[])` | Vizinhos por origens | Chamada atual |
| `lg_touch_updated_at()` | Atualizar `updated_at` | Trigger das tabelas operacionais |

## 6. RLS e políticas identificadas

RLS é habilitada nos scripts para:

- `base_versions`;
- `geo_features`;
- `lg_clients`, `lg_properties`, `lg_reports`, `lg_proposals`, `lg_settings`, `lg_analyses`;
- `cad_confrontantes`, `cad_proprietarios`, `cad_marcos`, `pecas_processos`.

Políticas identificadas:

- leitura autenticada e escrita administrativa no esquema Cloud inicial;
- `admin gerencia versoes`, `admin gerencia feicoes`, `admin gerencia importacoes`;
- `owner_all` nas tabelas `lg_*`, restringindo por `owner_id = auth.uid()`;
- `cad_confrontantes_authenticated`, `cad_proprietarios_authenticated` e `cad_marcos_authenticated`, permitindo todas as operações a usuários autenticados;
- `pecas_processos_own`, permitindo dono ou admin;
- políticas de upload, leitura e remoção administrativa no bucket `bases-originais`.

As políticas Cloud antigas e novas podem coexistir ou substituir-se conforme a ordem aplicada. O estado final remoto não está confirmado.

## 7. Storage

Bucket privado identificado: `bases-originais`.

O script 01 configura limite de 5 GiB; o script 02 atualiza para 50 MiB. O frontend possui modo local para arquivos maiores, sem guardar o ZIP original no Storage. O limite efetivo remoto não foi verificado.

## 8. Índices

### Espaciais

- `geo_features_geom_gix` sobre `geom`;
- `idx_geo_features_geometria` sobre `geometria`;
- `idx_geo_features_origem_geometria`, apesar do nome, é GiST apenas sobre `geometria`.

### Relacionais e pesquisa

- versão, código, origem e base ativa;
- nomes/títulos/fazendas em minúsculas;
- FKs de clientes, imóveis, relatórios, propostas e análises;
- GIN textual de confrontantes;
- códigos INCRA/SIGEF/CAR;
- código único de marco;
- documentos normalizados e nome de imóvel em minúsculas.

## 9. Scripts SQL

1. `01_setup_cloud.sql` — fundação Cloud inicial.
2. `02_cloud_importer_admin.sql` — administração, importador e Storage.
3. `03_definir_primeiro_admin.sql` — definição manual do primeiro admin.
4. `04_consulta_territorial_v70.sql` — consulta por geometria.
5. `04_consulta_territorial_v70_CORRIGIDO.sql` — variante corrigida.
6. `05_corrigir_importador_sigef_3d_v70_1.sql` — normalização 2D/importador.
7. `06_corrigir_timeout_consulta_perimetro_v70_2.sql` — timeout e consulta.
8. `07_incluir_incra_2a_e_fallback_v70_4.sql` — novas origens e fallback.
9. `08_vizinhos_exportacao_v70_5.sql` — vizinhos/confrontantes.
10. `09_modulos_operacionais_v71.sql` — tabelas `lg_*` iniciais.
11. `10_estabilizacao_modulos_v72.sql` — análises e triggers.
12. `11_cadastro_mestre_v73_1.sql` — cadastros reutilizáveis.
13. `12_otimizar_consultas_v73_2.sql` — RPCs atuais e índices.
14. `13_banco_mestre_v74.sql` — campos e índices adicionais.

Há dois arquivos numerados como 04. Nenhum deve ser reaplicado ou alterado sem conhecer o histórico do ambiente.

## 10. Pontos não confirmados

- scripts realmente aplicados no Supabase de Preview e Produção;
- definição de `importacoes`;
- migration entre nomes ingleses e portugueses do esquema Cloud;
- políticas finais ativas e grants efetivos;
- limite atual do bucket;
- volume, qualidade e compatibilidade dos dados existentes;
- existência de objetos criados manualmente fora do repositório;
- desempenho real dos índices e RPCs em produção.
