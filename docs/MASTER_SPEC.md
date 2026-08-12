# Especificação mestre — Longitude Geo Intelligence

## Navegação documental

- [Arquitetura](architecture/ARCHITECTURE.md)
- [Banco de dados](database/DATABASE.md)
- [Módulos](modules/MODULES.md)
- [Problemas conhecidos](KNOWN_ISSUES.md)
- [Deployment](DEPLOYMENT.md)
- [Checklist de testes](testing/TEST_CHECKLIST.md)
- [Changelog consolidado](../CHANGELOG.md)
- [Workflow oficial](../.codex/WORKFLOW.md)

Esta é a especificação técnica canônica. Documentos com versão no nome são referências históricas e não substituem `CURRENT_STATE.md` quanto ao estado validado.

## 1. Finalidade deste documento

Este documento descreve o sistema comprovável no repositório. Ele não confirma o estado do banco remoto nem substitui validação funcional. Os estados usados são:

- **Implementado:** existe código executável correspondente.
- **Confirmado:** além do código, `CURRENT_STATE.md` registra validação.
- **Parcialmente implementado:** existe parte do fluxo, mas faltam integrações ou elementos previstos.
- **Não validado:** existe implementação, porém a documentação oficial exige teste integrado.
- **Planejado:** consta no roadmap, sem implementação completa comprovada.

## 2. Visão geral e objetivos

O Longitude Geo Intelligence é uma aplicação web/PWA para inteligência territorial, regularização fundiária, georreferenciamento, consulta a bases públicas, análise espacial, geração de peças técnicas e gestão operacional de serviços rurais e urbanos.

Seus objetivos atuais são:

- consultar SIGEF, CAR/SICAR e INTERMAT;
- importar e versionar bases geoespaciais no Supabase/PostGIS;
- analisar pontos, perímetros, sobreposições e vizinhança;
- administrar clientes, imóveis, análises, relatórios, propostas e configurações;
- reutilizar dados de proprietários, confrontantes, imóveis e marcos;
- gerar documentos DOCX e relatórios para impressão/PDF;
- operar em navegador, computador, celular e tablet.

## 3. Escopo atual

### Confirmado pela documentação de estado

- login;
- consulta Cloud por coordenada;
- consulta Cloud por KML;
- PDF da Cloud;
- deploy na Vercel;
- PWA e uso em celular e tablet.

### Implementado no código, sujeito a validação

- mapa Leaflet com desenho e edição de geometrias;
- importação KML, GeoJSON/JSON e ZIP Shapefile;
- consulta territorial por UTM, coordenada geográfica e perímetro;
- cálculo de área, interseção e percentual de sobreposição;
- análise de vizinhos/confrontantes;
- exportação KML e GeoJSON na Cloud e Shapefile no workspace legado;
- importação local e Cloud de bases territoriais;
- dashboard e CRUD de clientes, imóveis, análises, relatórios e propostas;
- cadastro/pesquisa de proprietários e confrontantes;
- geração de memorial, requerimento, declaração de limite e quadro de confrontantes;
- backup JSON dos módulos empresariais.

### Parcialmente implementado

- processo técnico: existe no módulo de peças e em `pecas_processos`, mas o front-end persiste processos técnicos principalmente em `localStorage` e não há fluxo central V75;
- banco mestre: tabelas, buscas e fallback local existem, mas a unificação e o teste integrado estão pendentes;
- automação documental: documentos são gerados, porém croqui, geometria vinculada, paginação e fidelidade integral aos modelos não estão confirmados;
- modularização: a raiz foi reduzida, mas `src/legacy/LegacyWorkspace.jsx` ainda concentra a maior parte das funções GIS;
- processamento de bases grandes: ocorre no navegador, sem worker dedicado.

## 4. Tecnologias comprovadas

- React 18 e React DOM;
- JavaScript/JSX;
- Vite 5;
- Supabase Auth, REST e Storage;
- PostgreSQL/PostGIS;
- Leaflet e Leaflet Draw;
- Turf.js e toGeoJSON;
- shpjs e `@mapbox/shp-write`;
- `docx`, Docxtemplater e PizZip;
- jsPDF, jsPDF AutoTable e html2canvas;
- Service Worker e Web App Manifest;
- Vercel Serverless Functions;
- Git/GitHub.

Observação: `AGENTS.md` cita TypeScript, mas não foram encontrados arquivos `.ts` ou `.tsx` no código auditado.

## 5. Módulos

| Módulo | Situação | Responsabilidade |
|---|---|---|
| Workspace legado | Implementado | Mapa, análises, integrações, importações locais, relatórios e exportações |
| Cloud / Consulta Territorial | Confirmado em parte | Login, consultas PostGIS, importação administrativa e relatórios |
| Módulos empresariais | Implementado, não validado integralmente | Clientes, imóveis, análises, relatórios, propostas e configurações |
| Peças Técnicas | Implementado, não validado integralmente | Processos locais e documentos DOCX |
| Cadastro mestre | Parcialmente implementado | Pesquisa e reutilização de proprietários, imóveis e confrontantes |
| PWA | Confirmado | Instalação e cache básico do shell |
| Proxies Vercel | Implementado | Acesso aos serviços SIGEF, CAR e INTERMAT |
| GNSS | Não implementado/ativado | Apenas diretório reservado e README |

## 6. Fluxos principais

### Consulta Cloud

1. O usuário configura URL e chave publicável do Supabase no ambiente.
2. O login usa Supabase Auth e armazena a sessão no navegador.
3. A entrada pode ser UTM, coordenada geográfica ou arquivo de perímetro.
4. O front-end normaliza a geometria e chama RPCs PostGIS pela API REST.
5. O resultado é exibido em mapa e tabela.
6. O usuário pode consultar vizinhos, exportar dados e gerar relatório.

### Importação administrativa de bases

1. Usuário autenticado com `app_metadata.role = admin` seleciona origem, UF, data e arquivo.
2. O navegador lê e normaliza as feições.
3. É criada uma versão da base e um registro de importação.
4. As feições são enviadas em lotes por RPC.
5. A nova versão é ativada; a anterior da mesma origem/UF é desativada.

O fluxo depende de um esquema Supabase compatível com os nomes usados por `src/cloud/cloudApi.js`. A compatibilidade exata do banco remoto não pode ser confirmada pelo repositório.

### Gestão operacional

1. Usuário autenticado acessa tabelas `lg_*` via REST.
2. Clientes e imóveis podem ser cadastrados e editados.
3. Análises, relatórios e propostas são vinculáveis a cliente/imóvel.
4. Configurações institucionais alimentam documentos impressos.

### Peças técnicas

1. Pesquisa-se proprietário e imóvel em clientes, cadastro mestre e processos locais.
2. Confrontantes são pesquisados ou cadastrados.
3. O processo é salvo no navegador.
4. Templates DOCX são preenchidos ou um documento é montado pela biblioteca `docx`.
5. Os arquivos são baixados no dispositivo.

## 7. Integrações

- Supabase Auth, REST, RPC e Storage;
- SIGEF/INCRA por FeatureServer publicado em `pamgia.ibama.gov.br`;
- CAR/SICAR por WFS em `geoserver.car.gov.br`;
- INTERMAT por FeatureServer em `intergeo.intermat.mt.gov.br`;
- OpenStreetMap e Esri World Imagery como mapas-base;
- Vercel para hospedagem e proxies em `/api`.

## 8. Situação atual

A versão estável declarada em `AGENTS.md` e `CURRENT_STATE.md` é V74.1.3. `VERSION.json` registra `74.1.3-rc.1`, enquanto `package.json`, README e cache da PWA contêm identificadores anteriores ou divergentes. Não há suíte automatizada configurada no `package.json`.

## 9. Limitações e riscos

- forte concentração de responsabilidades em `LegacyWorkspace.jsx` e `CloudPanel.jsx`;
- coexistência de Supabase, `localStorage` e IndexedDB;
- possível duplicidade entre clientes, proprietários e confrontantes;
- esquema SQL histórico inconsistente entre nomes em inglês e português;
- estado real das migrations no Supabase não verificável localmente;
- dependência de serviços públicos externos;
- processamento de arquivos grandes limitado à memória do navegador;
- templates e documentos dependem de dados manuais enquanto não houver vínculo geométrico;
- divergência de versões em diferentes arquivos;
- ausência de testes automatizados, lint e type-check configurados.

## 10. Roadmap resumido

- **V75 — Processo Inteligente:** processo central, vínculos, histórico, status, checklist, documentos e painel.
- **V76 — Banco Mestre:** unificação de cadastros e ampliação de dados registrais/cadastrais.
- **V77 — Automação Documental:** novos documentos, gestão de templates e validação de campos.
- **V78 — Inteligência Territorial:** novas camadas, imagens históricas e exportações.
- **V79 — Gestão Comercial:** contratos, financeiro, agenda, protocolos e pagamentos.
- **V80 — Inteligência Artificial:** análise documental, checklist, base normativa e assistente especializado.

## 11. Averbação GEO — implementação em validação

O módulo `src/modules/geoRegistry` cria um Projeto GEO normalizado a partir de PDF pesquisável ou geometria KML/GeoJSON/SHP-ZIP. O texto PDF é tratado como dado não confiável, sem OCR inicial e sem execução de conteúdo. O projeto permanece no `localStorage`, de forma compatível com a persistência atual das Peças Técnicas, até que o schema remoto seja confirmado.

Serviços separados:

- `sigefMemorialParser`: normalização de campos, vértices e confrontações;
- `sigefParcelService`: consulta ao proxy SIGEF existente, com fallback explícito;
- `geometryValidationService`: reconstrução, área, perímetro, duplicidade e autointersecção;
- `geoRegistryStorage`: salvar e reabrir projetos no navegador;
- `pdfTextExtractor`: extração de texto nativo e validação do arquivo;
- `geospatialFileParser`: importação KML, GeoJSON e SHP/ZIP.

A consulta pública e o parser não simulam dados ausentes. Matrícula, geração efetiva de peças e sincronização remota permanecem como próximas etapas.

Durante a validação de memoriais, a interface apresenta diagnóstico técnico do arquivo, campos e confiança, ambiguidades, coordenadas, segmentos e cada etapa do processamento. Coordenadas UTM são convertidas com `proj4` somente quando datum, fuso e hemisfério são suficientes; caso contrário, o registro é preservado como incompleto e a limitação é informada.
