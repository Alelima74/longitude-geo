# Módulos — Longitude Geo Intelligence

[Voltar à especificação mestre](../MASTER_SPEC.md) · [Arquitetura](../architecture/ARCHITECTURE.md) · [Checklist de testes](../testing/TEST_CHECKLIST.md)

## Critérios de situação

- **Confirmado:** validado em `CURRENT_STATE.md`.
- **Implementado:** há código funcional, sem validação oficial completa.
- **Parcial:** fluxo incompleto ou dividido entre implementações.
- **Não validado:** código existe, mas o teste integrado está pendente.
- **Planejado:** apenas roadmap/estrutura reservada.

## Inventário

| Módulo | Finalidade | Arquivos principais | Dados utilizados | Situação |
|---|---|---|---|---|
| Inicialização | Montar aplicação e registrar PWA | `index.html`, `src/main.jsx`, `src/App.jsx`, `src/app/AppRoot.jsx` | Manifest e versão | Implementado |
| Tratamento de erro | Evitar tela preta e permitir recarga | `src/app/ErrorBoundary.jsx` | Erros React | Implementado |
| Workspace legado | Shell, navegação e núcleo GIS | `src/legacy/LegacyWorkspace.jsx`, `src/style.css` | Estado React, localStorage, Leaflet, arquivos locais e APIs | Implementado; modularização parcial |
| Análise Territorial | Importar/desenhar perímetro, calcular área e cruzamentos | `LegacyWorkspace.jsx`, Turf.js | KML, GeoJSON, desenho, bases locais/online | Implementado; não validado integralmente |
| Cloud / Consulta Territorial | Login, ponto, UTM, perímetro, sobreposição, vizinhos e relatório | `src/cloud/CloudPanel.jsx`, `cloudApi.js`, `utm.js`, `CloudPage.jsx` | Supabase, PostGIS, KML, GeoJSON, Shapefile | Login/coordenada/KML/PDF confirmados; demais fluxos não validados integralmente |
| Importador Cloud | Versionar e ativar bases | `CloudPanel.jsx`, `cloudApi.js`, scripts 01–08 | `base_versions`, `geo_features`, `importacoes`, Storage | Implementado; esquema remoto não confirmado |
| SIGEF local/online | Importar base e consultar feições | `LegacyWorkspace.jsx`, `sigefStorage.js`, `api/sigef/[...path].js` | GeoJSON/ZIP, IndexedDB, FeatureServer | Implementado; dependente de serviço externo |
| CAR/SICAR | Importar/consultar e analisar feições | `LegacyWorkspace.jsx`, `api/car.js` | ZIP/GeoJSON, WFS CAR | Implementado; dependente de serviço externo |
| INTERMAT | Importar base, catálogo e feições | `LegacyWorkspace.jsx`, `api/intermat/[...path].js` | ZIP/GeoJSON, FeatureServer | Implementado; dependente de serviço externo |
| Mapa | Visualizar, desenhar e editar geometrias | `LegacyWorkspace.jsx`, `CloudPanel.jsx` | Leaflet, OSM, Esri, GeoJSON | Implementado; extração modular planejada |
| Exportações | KML, GeoJSON e Shapefile | `LegacyWorkspace.jsx`, `CloudPanel.jsx` | Feições e interseções | Implementado; cobertura por teste não documentada |
| Relatórios territoriais | Gerar mapa, tabelas e PDF | `LegacyWorkspace.jsx`, `CloudPanel.jsx` | Resultados espaciais, html2canvas, jsPDF/impressão | PDF Cloud confirmado; demais relatórios não validados integralmente |
| Dashboard | Indicadores operacionais | `src/components/EnterpriseModules.jsx` | Tabelas `lg_*` | Implementado; exige Supabase autenticado |
| Clientes | CRUD e pesquisa | `EnterpriseModules.jsx`, `opsApi.js` | `lg_clients` | Implementado; pesquisa CPF/CNPJ não validada |
| Imóveis | CRUD, vínculo com cliente e histórico | `EnterpriseModules.jsx`, `opsApi.js` | `lg_properties`, `lg_analyses`, relatórios e propostas | Implementado; pesquisa não validada |
| Análises operacionais | Linha do tempo de análises | `EnterpriseModules.jsx` | `lg_analyses` | Implementado; não validado integralmente |
| Relatórios empresariais | Cadastro e impressão | `EnterpriseModules.jsx` | `lg_reports`, `lg_settings` | Implementado; não validado integralmente |
| Propostas | Cadastro e impressão | `EnterpriseModules.jsx` | `lg_proposals`, clientes e imóveis | Implementado; não validado integralmente |
| Configurações | Perfil institucional e diagnóstico | `EnterpriseModules.jsx`, `opsApi.js` | `lg_settings`, sessão e tabelas `lg_*` | Implementado |
| Backup | Baixar snapshot JSON operacional | `EnterpriseModules.jsx` | Configurações e dados `lg_*` carregados | Implementado; restauração não encontrada |
| Cadastro mestre | Reutilizar proprietários, imóveis e confrontantes | `masterDataApi.js`, `registryApi.js`, script 11/13 | `lg_clients`, `lg_properties`, `cad_*`, processos locais | Parcial e não validado integradamente |
| Peças Técnicas | Criar processo e documentos | `TechnicalPiecesModule.jsx`, `technical-pieces.css` | Cadastros, localStorage, templates DOCX | Implementado; documentos não validados integralmente |
| Memorial | Gerar memorial DOCX | `TechnicalPiecesModule.jsx`, `MODELO_MEMORIAL_ORIGINAL.docx` | Processo, imóvel, proprietário e confrontantes | Não validado; geometria/caminhamento parcial |
| Declaração de limite | Gerar DOCX por confrontante | `TechnicalPiecesModule.jsx`, `MODELO_DECLARACAO_LIMITE.docx` | Processo e confrontante | Não validado; croqui não integrado |
| Requerimento | Gerar requerimento DOCX | `TechnicalPiecesModule.jsx`, `MODELO_REQUERIMENTO_ORIGINAL.docx` | Processo, proprietário e imóvel | Não validado |
| Quadro de confrontantes | Montar tabela DOCX | `TechnicalPiecesModule.jsx` | Lista de confrontantes | Não validado |
| PWA | Instalação e cache básico | `PwaInstallButton.jsx`, `public/sw.js`, `manifest.webmanifest` | Eventos do navegador e cache | Confirmado |
| GNSS | Futuro motor GNSS | `src/components/GNSS/README.md` | Nenhum fluxo ativo | Não ativado/planejado |
| Processo Inteligente V75 | Centralizar serviço e histórico | `PLANS.md`, `ROADMAP.md` | Ainda a definir em migration futura | Planejado |
| Averbação GEO | Criar Projeto GEO por Memorial SIGEF ou geometria, validar e preparar peças cartoriais | `src/modules/geoRegistry/*` | PDF local, KML/GeoJSON/SHP-ZIP, proxy SIGEF e localStorage | Implementado; validação funcional pendente |

## Duplicidades e fronteiras

- Clientes/proprietários aparecem em `lg_clients`, `cad_proprietarios`, `cad_confrontantes` e processos locais.
- Imóveis aparecem em `lg_properties`, confrontantes e processos locais.
- Processos técnicos são salvos localmente, embora exista `pecas_processos` no SQL.
- Mapa, análise, SIGEF, CAR, INTERMAT, exportações e relatórios possuem diretórios reservados, mas a implementação permanece no workspace legado.
- Há geração de relatório/PDF tanto no workspace/Cloud quanto nos módulos empresariais.
