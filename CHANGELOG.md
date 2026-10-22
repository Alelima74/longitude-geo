# Changelog — Longitude Geo Intelligence

[Especificação mestre](docs/MASTER_SPEC.md) · [Estado atual](CURRENT_STATE.md) · [Roadmap](ROADMAP.md) · [Workflow oficial](.codex/WORKFLOW.md)

Este arquivo registra somente fatos comprováveis no repositório. A presença de código ou SQL não comprova implantação em produção. Datas são informadas apenas quando já constam em metadados existentes.

## V74.1.3-rc.4 — sincronização pessoal — 15/10/2026

Revalidação em 22/10/2026: Preview `899ef67` com build Ready; corrigida confirmação assíncrona de salvamento para preservar edições feitas durante o envio e impedir aplicação de revisão a outro projeto aberto. Teste de regressão incluído.

- login global na versão publicada; mesma sessão utilizada pelos módulos existentes;
- GEO, laudos e processos de Peças Técnicas passam a carregar e salvar snapshots no Supabase, por usuário; desenvolvimento local preserva o armazenamento anterior;
- base local de clientes, imóveis e análises territoriais ganhou carregamento remoto e salvamento explícito; os cadastros `lg_*` continuam nas tabelas existentes;
- revisão otimista impede sobrescrita por outro aparelho; exclusão de snapshots é lógica, preservando o conteúdo;
- importação seletiva de backup pré-nuvem, sem apagar origem nem sobrescrever IDs existentes; demonstrações marcadas são rejeitadas e laudos exigem confirmação de revisão;
- adicionada migration `20261015160000_workspace_records.sql`, validada em PostgreSQL descartável com dois usuários e papel anônimo; aplicada somente a nova tabela no Supabase existente;
- metadados e cache PWA identificam o build 74134; Node 22 selecionado para compatibilidade com a hospedagem;
- validação automatizada inicial: 124 testes aprovados e build aprovado. Teste autenticado entre aparelhos e promoção de produção ainda pendentes.

## Preparação de publicação — 15/10/2026

- atualizado jsPDF para `^4.2.1` e Vite para `^6.4.4`; dependências transitivas corrigidas sem `--force`;
- auditoria npm após atualização: zero vulnerabilidades conhecidas;
- adicionados três testes de exportação PDF dos laudos VTN/ITR, avaliação rural e finalidade tributária, com leitura por PDF.js e conferência de texto, colunas e páginas;
- 119 testes aprovados e build aprovado com Vite 6.4.4; validação visual e funcional remota permanece pendente;
- identificado na Vercel o nome incorreto `VITE_SUPABASE_UR`; cadastrada `VITE_SUPABASE_URL` para Production e Preview com o endpoint público do projeto existente, preservando a variável antiga e a chave;
- nenhuma migration aplicada, nenhum dado de produção alterado e nenhum deployment promovido nesta etapa.

## Preparação de persistência online — 04/09/2026

- inventariada persistência em `docs/ONLINE_MIGRATION_AUDIT.md`, sem migrar registros reais;
- SDK Supabase instalado; cliente lazy separado da sessão legada, adapters LOCAL/SUPABASE, conflitos de revisão e Storage privado preparados, ainda não conectados aos editores;
- Configurações ganhou inventário e exportação do localStorage sem tokens; envio à nuvem bloqueado até homologação;
- criada migration aditiva para `geo_projects`, `evaluation_projects` e `uploaded_files`, com revisão, RLS organizacional e bucket privado; **não aplicada**;
- Vercel recebeu configuração explícita Vite/build/dist, sem deploy;
- 116 testes aprovados e build aprovado nesta etapa; não equivale a autenticação/Storage/migração online validados;
- modo local, parsers, cálculos, composers, templates e banco de produção preservados.

## Revisão pré-publicação — PWA — 04/09/2026

- cache PWA atualizado e limpeza restrita aos caches antigos do Longitude;
- respostas HTTP de erro e conteúdo não HTML não substituem a tela offline;
- falha de rede sem cache recebe resposta explícita; gravações de cache acompanham o ciclo do evento;
- adicionados testes automatizados de regressão do Service Worker ao comando `npm test`;
- corrigida largura mínima da navegação que expandia a página para aproximadamente 1649 px em celular de 390 px; verificado em Laudos nas larguras 390 e 768 px;
- auditoria geral ainda parcial: sincronização entre dispositivos e validação autenticada permanecem pendentes.

## Consulta Territorial — legibilidade dos resultados — 03/09/2026

- corrigido o contraste da tabela de ocorrências após a adoção do novo estilo global de tabelas;
- preservada a leitura das linhas normais, selecionadas e em destaque pelo cursor no tema escuro.

## Laudos & Avaliações — composição documental narrativa — 01/09/2026

- substituída a pré-visualização baseada em pares campo/valor por capítulos técnicos narrativos em páginas A4;
- criado `reportDocumentModel` único, consumido pela prévia e pelos renderizadores DOCX e PDF;
- implementadas exportações reais, com texto selecionável no PDF e documento editável no Word;
- criada base regional revisável, edição manual por capítulo e regeneração protegida por confirmação;
- geradas e verificadas as três demonstrações VTN, avaliação rural e garantia tributária.
- corrigida a seleção de clientes do Novo Laudo para consumir o cadastro oficial `lg_clients` e o banco mestre `clients`, incluindo registros legados de `CadCliente`.

## Averbação GEO — rastreabilidade legada e ordem documental — 31/08/2026

- preservados os IDs legados de imóvel, matrícula e proprietário durante a hidratação, sem usar o UUID do projeto para relacionar tabelas do MDB;
- unificado o consumo dos dados canônicos nas telas cadastrais da Averbação GEO;
- adicionados `documentOrder` e diagnóstico explícito de vértices encontrados, estruturados e rejeitados, mantendo o texto original e o motivo da rejeição.

## Averbação GEO — hidratação legada e geometria canônica — 18/08/2026

- criada hidratação única do Projeto GEO a partir das relações normalizadas de imóvel, matrícula, proprietários, serviços e responsável técnico;
- preservado `Codigo_SIGEF` como código legado, sem classificá-lo automaticamente como UUID de certificação;
- criada geometria canônica do Memorial exclusivamente pela ordem e pelas coordenadas documentais válidas, em GeoJSON `[longitude, latitude]`;
- corrigido o sinal dos hemisférios no parser DMS multilinha e adicionados testes para N, S, E e W;
- mantido o cadastro legado sem geometria, sem inventar perímetro ou coordenadas.
- impedido o Service Worker de servir módulos antigos durante o desenvolvimento em `localhost`.

## Importação do banco legado - Fase 2 - 18/08/2026

- vinculada a CLI ao projeto Supabase `longitude-geo` e aplicadas as migrations de fundação e importação incremental;
- importado o MDB real do Métrica TOPO em modo `NEW_ONLY`, com 23.008 registros processados, 18.228 aprovados sem ressalva, 4.780 separados para revisão e nenhum erro;
- preservados os registros existentes, sem `DROP`, sem `UPDATE` e sem sobrescrita;
- comprovada a idempotência em uma segunda execução: zero inclusões e 23.008 registros reconhecidos pela chave legada;
- liberada na interface a ação “Importar somente registros novos”, com progresso e resumo final do lote;
- validados 86 testes automatizados e o build de produção.

## Importação do banco legado - Fase 1 - 17/08/2026

- lido em modo somente leitura o banco real Métrica TOPO com 6 tabelas e 23.008 registros;
- criado adaptador local Access, preset de mapeamento, preview de schema e simulação sem persistência;
- identificados 15.269 vínculos recuperáveis, 151 ocorrências para revisão e 1.597 grupos de possíveis duplicidades;
- criada camada inicial de repositórios e migration PostgreSQL aditiva, normalizada, multi-organização, com auditoria, soft delete, RLS e idempotência por chave legada;
- mantida desabilitada a importação definitiva, reservada para a Fase 2 após revisão do preview;
- simplificado o roteiro visual para três passos, com resumo em linguagem comum e detalhes técnicos recolhidos sob demanda;
- nenhum dado existente do Longitude, localStorage ou Supabase foi alterado.

## Averbação GEO — navegação e preparação de notificações — 17/08/2026

- substituída a navegação horizontal do projeto por menu interno vertical, agrupado e recolhível em telas menores;
- ampliada a tradução central dos estados, origens, tipos de pessoa e tipos de confrontação apresentados ao usuário;
- reorganizado o checklist imprimível por categoria, classificação, situação e justificativa;
- criado o fluxo de seleção individual ou em lote dos confrontantes particulares e posseiros elegíveis para notificação;
- adicionadas validações específicas para pessoa física e jurídica, complementação persistente de dados e estados cartoriais em português;
- preservados os dados documentais originais de confrontação e excluídos do fluxo automático vias, águas e limites públicos;
- adicionada entrada própria “Notificação de Confrontante” no menu Documentos, mantendo também um atalho em Peças Cartoriais;
- incorporada como referência funcional a estrutura do modelo “14 - NOTIFICAÇÃO DOS CONFRONTANTES.pdf”, com uma página individual por destinatário pessoa física ou jurídica.

## Longitude Light — primeira etapa do Checklist — 17/08/2026

- criada camada central de tradução `ptBR` para status, níveis, fontes e prioridades cartoriais;
- criado primeiro recorte do design system Longitude Light com tokens de cor, espaço, raio e sombra;
- substituída a apresentação técnica do Checklist por resumo, chips, alertas, badges e cartões com detalhes progressivos;
- removidos selects de enum da experiência do Checklist e adotadas ações em português claro;
- preservados integralmente o motor cartorial, os overrides, os anexos e a persistência existentes;
- validada a ausência de enums visíveis e a responsividade do Checklist em desktop e 390 px.

## Checklist cartorial inteligente — 17/08/2026

- substituído o checklist visual estático por motor derivado de núcleo estadual, condições do projeto e perfil configurável da serventia;
- adicionadas regras para proprietário pessoa jurídica, representação, confrontantes privados, posse, vias, terras públicas, unidades de conservação, terra indígena e cursos d'água;
- adicionados alertas priorizados, motivos por requisito, documentos vinculados, validade opcional, auditoria e prontidão `NOT_READY`, `REVIEW_REQUIRED` ou `READY`;
- incluídos perfil-base Mato Grosso sem exigências locais universais, configuração de CAR/Laudo e relatório de pendências;
- preparada a seleção de documentos do checklist para montagem do dossiê;
- documentado o motor em `docs/modules/CARTORIAL_CHECKLIST.md`.

## Fluxo cartorial do Averbação GEO — 17/08/2026

- isolado o conteúdo imprimível em `#print-root/.print-document`, com fundo branco e eliminação da quebra obrigatória após a última folha;
- retiradas temporariamente Planta e Declaração de Limites do painel produtivo, preservando o código técnico existente;
- reorganizadas as peças em Documentos Principais, Confrontações, Conferência e Finalização;
- adicionados Laudo Técnico Geral, classificação estruturada de limites e laudos especiais para vias e cursos d'água;
- restringidas as anuências aos confrontantes classificados como imóveis privados;
- implementados Quadro Comparativo, estado configurável das peças e montagem seletiva do Dossiê com capa e índice;
- adicionadas regressões para estrada, rio, anuência privada, ordem seletiva do dossiê e isolamento branco da impressão.

## Recuperação do Averbação GEO — 12/08/2026

- isoladas as fontes Memorial e documento registral para impedir sobrescrita entre elas;
- adicionada regressão automatizada dos campos e cinco vértices do caso CHACARA CANAA;
- adicionada interpretação documental, linha a linha, dos cinco segmentos e confrontantes fornecidos para a CHACARA CANAA;
- separadas a confiança bruta do OCR e a validação semântica dos campos registrais, rejeitando números incompatíveis com matrícula;
- instituídos os estados registrais `NOT_IMPORTED`, `OCR_PROCESSING`, `REVIEW_REQUIRED` e `CONFIRMED` para controlar a Conferência;
- conferência registral bloqueada enquanto o documento registral não estiver processado;
- confrontantes mantidos em modo estritamente documental, sem exibir dados técnicos não extraídos;
- testes automatizados e build aprovados; importação manual do PDF real ainda pendente.

## Peças cartoriais do Averbação GEO — 12/08/2026

- corrigido o DXF rejeitado pelo AutoCAD, substituindo a estrutura AC1027 incompleta por escritor estrutural R12/AC1009 com pares validados;
- removidas entidades raster `IMAGE/IMAGEDEF` incompletas; o PNG permanece no ZIP e o quadro vetorial informa seu nome até haver biblioteca de anexação confiável;
- completada a apresentação CAD A3 em coordenadas de folha, mantendo também o perímetro técnico no Model Space;
- adicionada exportação PDF ISO A3 paisagem em 420 x 297 mm e pacote CAD DXF vetorial com PNG de localização e README;
- estruturado o DXF com Model Space nas coordenadas efetivamente disponíveis, entidades editáveis, layers temáticos e Paper Space A3;
- mantido o botão DWG explícito, com bloqueio informativo enquanto não houver Autodesk RealDWG/AutoCAD ou ODA File Converter validado, sem produzir DXF renomeado;
- implementado gerador modular da Planta Georreferenciada A3 baseado no modelo mestre, consumindo geometria, vértices, confrontantes e dados cartoriais do Projeto GEO;
- adicionados enquadramento, escala numérica e escala gráfica automáticos, Norte, rótulos externos de confrontantes e quadro DMS adaptativo;
- substituído o quadro de situação fictício por mapa independente com Esri World Imagery e perímetro do projeto destacado, sem alterar o mapa principal;
- adicionados testes de regressão da CHACARA CANAA e de uma segunda geometria para escala, enquadramento e localização;
- substituídos os previews genéricos por templates documentais derivados dos quatro modelos mestres fornecidos;
- incluído comparador visual de desenvolvimento com os PDFs renderizados dos modelos originais;
- criada folha planimétrica A3 paisagem própria, com desenho vetorial, selo, situação, convenções e coordenadas documentais;
- corrigida a persistência atômica dos campos cartoriais confirmados no objeto completo do Projeto GEO;
- adicionada regressão permanente de serialização, reabertura e precedência `MANUAL_CONFIRMED`;
- separados os estilos de impressão do Requerimento, Memorial e Anuência conforme as dimensões dos modelos originais;
- mantida a Planta explicitamente como `EM DESENVOLVIMENTO`, sem geração genérica;
- criado contexto documental rastreável, com valor, origem, confirmação e data de alteração;
- habilitados previews do Requerimento, Memorial SIGEF original, Quadro de Coordenadas, Quadro de Confrontantes e Checklist;
- adicionados editor do Requerimento, restauração do modelo e impressão A4 pelo navegador;
- adicionada área de confirmação manual dos dados das peças e complementação não destrutiva dos confrontantes;
- preparado contrato para DOCX sem implementar geração definitiva;
- Planta, Declaração de Limites e Cartas de Anuência permanecem explicitamente em preparação/próxima etapa.

### Adequação aos modelos Longitude

- cadastro cartorial ampliado para proprietário, cônjuge, imóvel, responsável técnico e procedimento;
- Requerimento alinhado ao conteúdo variável do modelo real de retificação de área;
- Memorial formatado com identificação e narrativa automática do perímetro;
- Declaração de Reconhecimento de Limite habilitada individualmente por confrontante;
- previews aproximados às geometrias A4 dos modelos DOCX existentes em `public/templates`;
- planta técnica mantida pendente porque o PDF-modelo não está disponível no repositório.

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
# Correção — planta georreferenciada baseada no DWG mestre (2026-08-13)

- O renderer e o exportador CAD da planta passam a usar o formato A2 paisagem (594 × 420 mm), moldura, divisões, selo, legenda, informações cartográficas e escala medidos no DWG mestre da CHÁCARA CANAÃ.
- O enquadramento da parcela aplica caixa envolvente mínima rotacionada somente na apresentação; as coordenadas originais permanecem no Model Space do DXF.
- Os layers CAD genéricos foram substituídos pela nomenclatura do gabarito (`LAYOUT`, `FOLHA_SELO_GRANDE`, `ROTEIRO_PERIMETRICO`, `VERTICES`, `LEGENDA`, `ESCALA_GRAFICA` e correlatos).
# Correção crítica — integridade geométrica da planta (2026-08-13)

- Removida da cadeia ativa a normalização independente dos eixos X/Y que podia deformar visualmente a parcela.
- Criada uma geometria canônica única, vinculada à mesma `project.geometry` validada pelo módulo GEOMETRIA, com ordem e códigos dos vértices preservados.
- A apresentação usa rotação rígida e um único fator de escala; testes verificam distâncias, ângulos e proporções antes/depois da transformação.
- Latitude/longitude deixa de ser exportada diretamente como X/Y no CAD. Sem coordenadas métricas ou fuso UTM documental confirmado, PDF e DXF definitivos ficam bloqueados.
- O DXF passa por round-trip programático da polyline técnica antes de ser disponibilizado.
- Adicionada auditoria geométrica de desenvolvimento com caminhamento, projeção, fingerprint, azimutes e distâncias documentais/calculadas.
## Em desenvolvimento — template CAD parametrizado

- A planta CAD oficial passa a usar diretamente o DWG profissional fornecido como mestre, com campos variáveis convertidos em atributos e geração por AutoCAD Core Console.
- A exportação DWG é bloqueada quando a geometria canônica não contém coordenadas métricas documentais validadas; SVG/HTML permanece apenas como prévia.
# Longitude Light — Fase 1 global — 17/08/2026

- Criado Design System central com tokens, tipografia, componentes, layout, formulários, tabelas, badges e documentos.
- Substituídos sidebar e cabeçalho legados escuros por navegação clara, agrupada e responsiva, com ícones vetoriais consistentes.
- Criado novo Dashboard com resumo operacional, projetos recentes, pendências, atividades e ações rápidas.
- Reformulada a Visão Geral da Averbação GEO com navegação horizontal, resumo do imóvel, indicadores, mapa, pendências e fontes de dados.
- Integrado o Checklist Cartorial ao shell global claro, mantendo traduções em português e ocultando enums técnicos.
- Movida a instalação PWA do botão flutuante para o rodapé da navegação lateral e atualizado o modal para o tema claro.
- Nenhuma regra de SIGEF, CAR, INTERMAT, geometria, documentos, checklist ou persistência foi alterada nesta fase.
- Melhorado o contraste dos cards de peças cartoriais com amarelo institucional em títulos, estados e rótulos sobre fundo verde-escuro.
# Correções não lançadas

- Corrigida a importação do banco Métrica selecionado manualmente (`.mdb`/`.accdb`), que antes permitia apenas a conferência e mantinha a importação definitiva bloqueada.
- Integrados os imóveis importados do Métrica à tela inicial da Averbação GEO, com pesquisa e abertura no formato de Projeto GEO preenchido para continuidade do processamento.
### Laudos & Avaliações
- Adicionada a Fase 1 do módulo estrutural de avaliações: projetos, seleção de imóveis canônicos, matriz de fontes, áreas, dados tributários, comparáveis e cálculo inicial.
- Interface concluída com três laudos demonstrativos, biblioteca de modelos, editor em navegação vertical e pré-visualização paginada em formato A4.
- Corrigidos contraste dos botões, termos técnicos expostos ao usuário e comportamento responsivo em 1366 × 768.
- Revisados os modelos contra quatro laudos reais do escritório, com matriz documental, 508 campos em 27 grupos, conferência de fontes, blocos fundiários condicionais, saneamento amostral e prévia completa de 28 páginas.
