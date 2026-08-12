# Changelog — Longitude Geo Intelligence

[Especificação mestre](docs/MASTER_SPEC.md) · [Estado atual](CURRENT_STATE.md) · [Roadmap](ROADMAP.md) · [Workflow oficial](.codex/WORKFLOW.md)

Este arquivo registra somente fatos comprováveis no repositório. A presença de código ou SQL não comprova implantação em produção. Datas são informadas apenas quando já constam em metadados existentes.

## Recuperação do Averbação GEO — 12/08/2026

- isoladas as fontes Memorial e documento registral para impedir sobrescrita entre elas;
- adicionada regressão automatizada dos campos e cinco vértices do caso CHACARA CANAA;
- conferência registral bloqueada enquanto o documento registral não estiver processado;
- confrontantes mantidos em modo estritamente documental, sem exibir dados técnicos não extraídos;
- testes automatizados e build aprovados; importação manual do PDF real ainda pendente.

## Estado atual documentado

### V74.1.3

Fonte: `AGENTS.md`, `CURRENT_STATE.md` e `ROADMAP.md`.

Confirmado na documentação de estado:

- login;
- Cloud por coordenada;
- Cloud por KML;
- PDF da Cloud;
- deploy Vercel;
- PWA;
- uso em celular e tablet.

Ainda não validado integralmente:

- proprietário por CPF/CNPJ;
- pesquisa de imóvel;
- pesquisa de confrontante;
- banco mestre;
- memorial;
- requerimento;
- declarações;
- quadro de confrontantes;
- fidelidade dos templates DOCX.

### V74.1.3 RC1 — 28/07/2026

Fonte: `VERSION.json` e `CHANGELOG_LONGITUDE_GEO.md`.

- delimitadores da Declaração de Limites corrigidos;
- templates padronizados com tags `{CAMPO}` do Docxtemplater;
- tratamento do erro `Multi error` associado a `{{CAMPO}}`;
- mensagens passaram a identificar documento e campo problemático;
- o changelog histórico registra validação interna de DOCX pelo instalador.

Observação: o instalador que executaria essa validação não foi identificado entre os arquivos da versão atual; o fato é preservado como registro histórico, não como comportamento novamente verificado.

## Histórico técnico comprovável, sem data confirmada

Os itens abaixo são comprovados por arquivos versionados, mas não recebem data por não haver data confiável associada a cada alteração.

### V74 — Banco mestre

- campos adicionais em `lg_properties` e `cad_confrontantes`;
- índices de documento normalizado e nome de imóvel.

### V73.2 — Consultas otimizadas

- RPCs por ponto, geometria e vizinhos com filtro de origens;
- índices e timeouts para consultas espaciais.

### V73.1 — Cadastro mestre reutilizável

- tabelas `cad_confrontantes`, `cad_proprietarios`, `cad_marcos` e `pecas_processos`;
- políticas RLS e índices de pesquisa.

### V72 — Estabilização operacional e PWA

- tabela `lg_analyses` e histórico por imóvel;
- triggers de atualização de `updated_at`;
- manifest, Service Worker e instalação PWA presentes no repositório.

### V71 — Módulos operacionais

- tabelas e interface para clientes, imóveis, relatórios, propostas e configurações.

### V70–V70.5 — Consulta territorial

- consulta espacial por perímetro;
- normalização de geometrias 2D;
- tratamento de timeout/fallback;
- suporte a novas origens;
- consulta de vizinhos/confrontantes e exportações.

### V69–V69.2 — Cloud e modularização inicial

- fundação Supabase/PostGIS e importador administrativo;
- separação de `AppRoot`, `ErrorBoundary`, página Cloud, diretório `core` e workspace legado.

## Inconsistências de histórico

- `package.json` informa `7.4.1-rc.4` e nome associado a V72;
- `VERSION.json` informa `74.1.3-rc.1` com data de 28/07/2026;
- `AGENTS.md` e `CURRENT_STATE.md` informam V74.1.3 estável;
- README principal informa V69.2;
- o cache do Service Worker referencia V72.4.

Essas divergências não foram corrigidas nesta atualização documental.

## Atualização documental atual

Sem atribuição de versão ou data de produto:

- criada especificação mestre em `docs/MASTER_SPEC.md`;
- criada documentação de arquitetura, banco, módulos, problemas conhecidos, deployment e testes;
- nenhuma funcionalidade de aplicação foi modificada;
- nenhuma validação funcional adicional foi declarada.
- revisada a coerência entre documentos canônicos e históricos;
- corrigidos caminhos e links internos da documentação;
- identificados explicitamente documentos históricos para evitar conflito com o estado atual.

## Em desenvolvimento — módulo Averbação GEO

- adicionada entrada **Averbação GEO** à navegação principal;
- criado fluxo local de criação, salvamento e reabertura de Projeto GEO;
- implementada leitura de texto nativo de Memorial SIGEF PDF com `pdfjs-dist`, validação de MIME/extensão/tamanho e sem execução de conteúdo incorporado;
- implementados modelo normalizado, parser de memorial, consulta SIGEF desacoplada com fallback, importação KML/GeoJSON/SHP-ZIP e validação geométrica;
- adicionados mapa Leaflet isolado, fundo branco, cálculo de área/perímetro, tabelas de vértices/confrontantes, conferência, documentos, peças cartoriais e checklist configurável;
- adicionada suíte automatizada do núcleo de parsing/validação;
- módulo ainda requer validação visual e funcional completa antes de atualização do estado estável.
- adicionado modo de diagnóstico do Memorial SIGEF com metadados do PDF, texto bruto opcional, etapas reais de processamento, confiança e ambiguidades por campo;
- parser dividido em rotinas de campos, coordenadas e segmentos, com normalização brasileira e preservação de registros incompletos;
- adicionada identificação de coordenadas geodésicas, latitude/longitude decimal e UTM, com conversão UTM via `proj4` quando os parâmetros são suficientes;
- adicionados marcadores e códigos alternáveis dos vértices no mapa;
- suíte do módulo ampliada para 17 testes automatizados.
- corrigida a extração PDFJS para preservar linhas pela posição visual dos itens, impedindo que a denominação absorva o documento inteiro;
- restringidos vértices e segmentos a códigos SIGEF estruturados (`G61-M-3064` e equivalentes M/P/V), eliminando palavras comuns interpretadas como vértices;
- adicionada leitura de coordenadas DMS em múltiplas linhas, incluindo longitude, latitude e altitude;
- corrigido o ciclo de vida do mapa Leaflet com desmontagem de listeners, camadas, instância e identificador do container;
- corrigida a rota da consulta SIGEF no desenvolvimento (`/proxy/sigef/query`) e os nomes reais de atributos da camada pública;
- adicionada mensagem explícita quando a consulta pública não estiver disponível;
- testes ampliados para 19 casos, incluindo fixture textual realista do SIGEF e rejeição de palavras comuns.
- segmentos passam a ser reconstruídos pela ordem dos vértices válidos, incluindo fechamento, sem inventar azimute, distância ou confrontante;
- adicionadas variantes estruturais para `Proprietário(a)`, `Município/UF`, `Responsável Técnico(a)`, matrícula e sistema geodésico de referência;
- a origem da geometria passou a distinguir Memorial SIGEF, KML, GeoJSON, SHP e consulta SIGEF;
- comparação de área/perímetro passou a exibir diferenças absolutas e percentuais; sem tolerância técnica configurada, o status é `DIFERENÇA A CONFERIR`;
- testes ampliados para 21 casos automatizados.
- o diagnóstico do Memorial passou a separar segmentos efetivamente extraídos dos segmentos apenas reconstruídos pela ordem dos vértices;
- adicionada a seção temporária `Estrutura bruta dos segmentos`, com linhas e numeração do texto entregue pelo PDFJS, para orientar a adaptação ao documento real sem presumir seu formato;
- azimute e distância documentais passaram a ser exibidos separadamente dos valores calculados para conferência, com origem `MEMORIAL` ou `RECONSTRUÍDO` e status explícito;
- testes ampliados para 22 casos automatizados; a extração dos atributos reais dos segmentos e de Município/UF permanece pendente do texto bruto do Memorial usado na validação manual.
- corrigida a regressão de runtime `enrichCalculatedSegments is not defined`, movendo o enriquecimento calculado para módulo ESM explicitamente importado pela interface;
- adicionada cobertura automatizada do caminho parser do Memorial → enriquecimento de segmentos usado após a importação;
- a consulta da Averbação GEO passou a priorizar a base SIGEF local já mantida pelo Longitude e somente depois consultar a camada pública PAMGIA/IBAMA;
- o proxy SIGEF de desenvolvimento passou a registrar request, endpoint externo, status, content-type, prévia da resposta e causas de erro sem registrar credenciais;
- testes ampliados para 24 casos automatizados; KML, Leaflet e parsers geoespaciais não foram alterados nesta correção.
- o extrator PDF passou a preservar página, texto, coordenadas X/Y, largura e altura de cada `textItem`, mantendo também o texto semântico reconstruído;
- criado parser espacial independente para reconstruir linhas e colunas da tabela SIGEF e associar vértice, azimute documental, distância documental e confrontante por linha;
- adicionados padrões específicos para `Município/UF: Município-UF` e `Matrícula do imóvel`, sem confundir matrícula, CNS, certificação, parcela ou SNCR;
- situação e código da parcela ausentes passaram a ser apresentados como `Não informado no Memorial`, com origem documental explícita;
- corrigida a aba Conferência para não apresentar dados do Memorial como se viessem de documento registral ainda não importado;
- percentual de progresso provisório substituído por estado textual que considera confrontantes e segmentos documentais como dados críticos;
- adicionados, somente em desenvolvimento, os diagnósticos `VER ITENS PDF` e `VER LINHAS RECONSTRUÍDAS`;
- testes ampliados para 26 casos, incluindo fixture espacial com cinco segmentos documentais; KML, Leaflet e mapa não foram alterados.
- vértices do Memorial passaram a preservar `latitudeDocument`/`longitudeDocument` exatamente em DMS e `latitudeDecimal`/`longitudeDecimal` separadamente para mapa, geometria e cálculos;
- aba Vértices passou a exibir DMS documental por padrão, com coordenadas decimais disponíveis sob demanda e aviso explícito para coordenadas derivadas de geometria;
- tela Documento Registral e aba Conferência ajustadas para a etapa anterior à importação da matrícula, sem repetição ou mistura de fontes;
- iniciada a primeira etapa real das peças cartoriais com templates reutilizáveis e pré-visualização do Requerimento, Quadro de Coordenadas, Quadro de Confrontantes e Checklist para Protocolo;
- Requerimento bloqueia geração definitiva quando faltam essenciais; Quadro de Confrontantes aceita somente segmentos documentais completos;
- adicionada rastreabilidade interna por campo para `SIGEF/MEMORIAL`, `MATRÍCULA`, `KML`, `PREENCHIMENTO MANUAL` e `CÁLCULO`;
- testes ampliados para 29 casos automatizados; exportação definitiva DOCX/PDF permanece fora desta etapa.
- habilitada importação real de certidão/matrícula PDF com texto nativo, parser registral independente, revisão editável/ignorável e confirmação antes do uso dos dados;
- modelo registral ampliado para matrícula, CNS, cartório, comarca, município/UF, denominação, proprietário/CPF-CNPJ, área, INCRA/SNCR, CCIR, NIRF/CIB, CAR e atos identificados, todos confirmados com origem `REGISTRY_DOCUMENT`;
- Conferência passou a comparar valores confirmados do Registro/Matrícula com o snapshot preservado do SIGEF/Memorial, usando `COMPATÍVEL`, `DIVERGENTE` e `NÃO LOCALIZADO` sem eleger fonte correta;
- parser espacial de segmentos passou a expor `parseSigefSegmentTableFromLayout` e preservar matrícula/CNS encontrados na célula do confrontante;
- aba Confrontantes passou a distinguir `MEMORIAL SIGEF` de `RECONSTRUÍDO` e a informar explicitamente quando o trecho possui apenas reconstrução geométrica;
- template do Requerimento atualizado para consumir dados registrais confirmados e dados SIGEF da mesma fonte usada na pré-visualização;
- testes ampliados para 31 casos automatizados; os PDFs reais não estavam disponíveis nesta sessão para reimportação manual.
- adicionada detecção de matrícula digitalizada pela quantidade/qualidade do texto nativo, sem executar OCR quando o conteúdo pesquisável for suficiente;
- implementado fallback OCR local no navegador com `tesseract.js`, renderização PDFJS página a página, progresso, confiança e origem `OCR_REGISTRY_DOCUMENT`;
- diagnóstico registral passou a mostrar tipo do PDF, método de extração, páginas, campos encontrados e campos de baixa confiança para conferência;
- aba Confrontantes ganhou modo simples padrão, modo técnico opcional, agrupamento consecutivo e edição manual com origem/histórico `MANUAL`;
- azimutes calculados passaram a ser normalizados para o intervalo de 0° a menos de 360°, sem alterar azimutes documentais;
- Quadro de Confrontantes continua priorizando dados documentais e aceita preenchimento manual confirmado, nunca confrontante inferido;
- testes ampliados para 35 casos automatizados, incluindo política de fallback OCR, campos críticos reconhecidos, baixa confiança, azimute normalizado e confrontante manual.
