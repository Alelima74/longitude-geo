# Auditoria de persistência online — Longitude Geo

Data: 04/09/2026. Inventário do código antes da implementação. Não comprova estado do banco remoto. Migração de dados reais: **não executada**.

| Dado | Onde está salvo hoje | Componente que usa | Destino no Supabase | Status da migração |
|---|---|---|---|---|
| Clientes | localStorage `longitude_geo_mvp_v8_corrigido.clientes`; `lg_clients`; `clients` canônico / CadCliente | LegacyWorkspace, EnterpriseModules, clientRepository, Novo Laudo | `clients`, preservando aliases e vínculos legados | Duas fontes online e uma local; consolidação pendente |
| Imóveis | mesma chave, `.imoveis`; `lg_properties`; `properties` / CadImovel | LegacyWorkspace, EnterpriseModules, Wizard, adaptador GEO | `properties`, cadastro mestre único | Consolidar IDs e atualizar consumidores |
| Proprietários | `longitude_registry_cad_proprietarios_v73_1`; `cad_proprietarios`; `people`, `companies`, `property_owners` | registryApi, masterDataApi, TechnicalPieces, GEO | `people`/`companies` + `property_owners`; avaliar alias `owners` sem duplicar principal | Modelos existentes precisam de compatibilidade |
| Matrículas | campos locais em imóveis/projetos; `registry_records` / CadMatricula | legacyProjectAdapter, GEO | `registry_records` (alias `registrations` a compatibilizar) | Preservar CodImovel, CodMatricula, CNS e JSON bruto |
| Projetos GEO | `longitude_geo_registry_projects_v1` | GeoRegistryModule, CartorialDataForm | `geo_projects` com snapshot integral versionado; desdobramento em vértices/segmentos/documentos | Local; salvar e listar são síncronos |
| Peças técnicas antigas | `longitude_geo_technical_processes_v73` | TechnicalPiecesModule, masterDataApi | `cartorial_processes`, `cartorial_data`, `cartorial_documents` | Tabelas existem no SQL, tela ainda local |
| Laudos e avaliações | `longitude_geo_evaluation_projects_v1` | EvaluationModule, evaluationRepository | `evaluation_projects`, snapshot de capítulos, overrides, cálculos, status e referências | Local; não recalcular ou reformatar durante migração |
| Base de mercado | `project.market.comparables`, demonstrações em evaluationDemoData; base regional em regionalKnowledgeBase | EvaluationModule, composer | `evaluation_market_samples` e coleção compartilhada | Não há repository de base compartilhada |
| Responsáveis técnicos | `lg_settings`; projeto; `technical_professionals` / CadEmpresa | EnterpriseModules, avaliações, GEO | `technical_professionals` e configurações por organização | Fontes duplicadas; preservar originais |
| Documentos e anexos | downloads/blob URLs, metadados dentro de projeto; tabelas `attachments`/`cartorial_documents` previstas | geradores, previews, parsers, plant export | bucket privado + `uploaded_files`, documentos/versionamento por projeto | Sem upload integrado comprovado |
| Configurações | `lg_settings` por owner; `organizations.settings`; constantes na UI | EnterpriseModules, LongitudeShell | configurações por organização | Identidade do cabeçalho ainda estática |
| SIGEF local | `longitude_sigef_brasil_local_v1` e `longitude_sigef_brasil_meta_v1` | sigefStorage, LegacyWorkspace, sigefParcelService | Storage para arquivo; bases geográficas existentes | Não enviar automaticamente bases volumosas |
| Sessão | `longitude_cloud_session_v2` | cloudApi, opsApi, registryApi | Supabase Auth via SDK | Renovação duplicada via fetch; não incluir tokens em backup |
| Relatórios/propostas/análises | `lg_reports`, `lg_proposals`, `lg_analyses`; análises locais na chave principal | EnterpriseModules, LegacyWorkspace | Compatibilizar com cadastros canônicos e organização | FKs atuais apontam `lg_*` |
| MDB | arquivo externo Windows lido pelo middleware Vite e PowerShell; `import_records` mantém bruto | LegacyImportPanel, scripts/inspect-metrica-access.ps1 | modelo canônico existente; importador auditável | Rota local não existe na Vercel; preservar MDB |
| Demonstrações | evaluationDemoData, sampleTechnicalProject, valores gerados por createCompleteDemoFields | Laudos, GEO em DEV | Não migrar como dados reais | Novos laudos/copias herdam partes demonstrativas: exigir revisão antes de migrar |

## Descobertas transversais

- Não foi localizado uso direto de `sessionStorage` ou IndexedDB no código ativo `src`; isso não prova inexistência de dados históricos no navegador. Backup deve inventariar IndexedDB se presente, ou bloquear migração automática até exportação.
- Arquivos JSON no código: versões/configurações; snapshots de dados são serializados em localStorage. MDB, anexos e dados de outros perfis/origens não podem ser inventariados pelo código do navegador atual.
- `clients`, `properties`, `technical_professionals`, `property_owners`, `organizations` e `users` já têm definição SQL. Não recriar com outro formato.
- Políticas antigas `cad_*` usam `using(true)`. A migração canônica também concede escrita em `users`: isso permite risco de alteração do próprio papel. Precisa revisão específica antes de qualquer Preview com dados privados. Não modificar SQL aplicado.
- IDs locais são UUIDs e strings `eval-...`/timestamp. Um UUID online novo precisa preservar IDs locais/legados e não quebrar FKs dos `lg_*` existentes.
- `getSettings()` não filtra organização; proteção atual depende de RLS por owner. Não declarar colaboração organizacional implementada.

## Plano de implementação e pontos de validação

1. Preparar SDK singleton, interfaces de repository testáveis LOCAL/SUPABASE e backup não destrutivo.
2. Preparar nova migration aditiva para projetos/snapshots/Storage isolado, sem aplicar em banco desconhecido.
3. Confirmar projeto Supabase de Preview, schema real, organização e administrador. Validar SQL/RLS em banco descartável autorizado.
4. Integrar todos os consumidores, resolver FKs `lg_*` vs canônico e arquivos; status explícito; não alternar para gravação local após erro remoto.
5. Adicionar ferramenta Configurações → Migração para nuvem com backup verificado, idempotência e relatório de conflitos. Proibir demos e manter base local.
6. Publicar Preview Vercel protegido e testar dois navegadores/organizações; só então habilitar fonte remota principal.

Os passos não executados permanecem pendentes; este relatório não autoriza promover produção nem comprova migração.
