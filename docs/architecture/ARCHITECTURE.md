# Arquitetura — Longitude Geo Intelligence

[Voltar à especificação mestre](../MASTER_SPEC.md) · [Banco de dados](../database/DATABASE.md) · [Módulos](../modules/MODULES.md)

## 1. Visão arquitetural

O sistema é uma SPA React/Vite com arquitetura híbrida. A camada de apresentação e boa parte do processamento geoespacial executam no navegador. Autenticação, persistência online e consultas espaciais usam Supabase/PostgreSQL/PostGIS. Três funções serverless da Vercel atuam como proxies para serviços públicos.

```text
index.html
  -> src/main.jsx
    -> src/App.jsx
      -> src/app/AppRoot.jsx
        -> ErrorBoundary
        -> LegacyWorkspace
           |- CloudPanel
           |- EnterpriseModules
           `- TechnicalPiecesModule

Browser -> Supabase Auth/REST/RPC/Storage -> PostgreSQL/PostGIS
Browser -> /api/car, /api/sigef/*, /api/intermat/* -> serviços externos
```

## 2. Frontend

### Inicialização

- `index.html`: documento principal e vínculo do manifest.
- `src/main.jsx`: monta o React, importa estilos e registra `/sw.js` em produção.
- `src/App.jsx`: exporta `AppRoot`.
- `src/app/AppRoot.jsx`: aplica `ErrorBoundary`, `LegacyWorkspace` e `PwaInstallButton`.

### Composição funcional

- `src/legacy/LegacyWorkspace.jsx`: shell, navegação, mapa e funções GIS legadas.
- `src/cloud/CloudPanel.jsx`: interface Cloud e processamento de consultas/importações.
- `src/components/EnterpriseModules.jsx`: módulos operacionais Supabase.
- `src/modules/technicalPieces/TechnicalPiecesModule.jsx`: processos e documentos técnicos.
- `src/pages/CloudPage.jsx`: wrapper isolado de `CloudPanel`, embora o workspace também o use diretamente.

### Estado no navegador

- React `useState`, `useEffect`, `useMemo` e `useRef`;
- `localStorage` para dados legados, sessão e processos técnicos;
- IndexedDB em `src/core/storage/sigefStorage.js` para base SIGEF local;
- referências Leaflet para mapa, camadas, desenhos e legendas.

Não foi encontrado gerenciador global de estado nem roteador de URL. A navegação principal é controlada pelo estado `tela` do workspace.

## 3. Organização das pastas

| Caminho | Função |
|---|---|
| `api/` | Proxies serverless CAR, SIGEF e INTERMAT |
| `public/icons/` | Ícones PWA |
| `public/templates/` | Templates DOCX utilizados pelo módulo de peças |
| `src/app/` | Composição global e tratamento de erros |
| `src/cloud/` | API, UTM, interface e estilos Cloud |
| `src/components/` | PWA, módulos empresariais e diretórios reservados |
| `src/core/` | Configuração, APIs REST, cadastro mestre, storage e templates |
| `src/legacy/` | Workspace monolítico preservado |
| `src/modules/technicalPieces/` | Peças técnicas |
| `src/pages/` | Páginas extraídas |
| `supabase/` | Scripts SQL incrementais |
| `docs/` | Documentação técnica |

## 4. Fluxo de dados

### Dados operacionais

`EnterpriseModules` chama `src/core/opsApi.js`, que acessa `/rest/v1` com o token da sessão. As tabelas usadas são `lg_clients`, `lg_properties`, `lg_analyses`, `lg_reports`, `lg_proposals` e `lg_settings`.

### Cadastro mestre

`TechnicalPiecesModule` usa `masterDataApi.js`, que agrega resultados de:

- tabelas operacionais;
- `cad_proprietarios` e `cad_confrontantes` via `registryApi.js`;
- processos técnicos armazenados localmente.

`registryApi.js` usa Supabase quando configurado e autenticado; caso contrário, mantém registros em `localStorage`.

### Dados geoespaciais locais

Arquivos KML, GeoJSON e Shapefile são lidos no navegador. Turf.js calcula área e interseções. Leaflet apresenta as geometrias. Bases SIGEF podem ser persistidas em IndexedDB.

### Dados geoespaciais Cloud

`cloudApi.js` usa Supabase REST/RPC para:

- autenticar e renovar sessão;
- consultar ponto, geometria e vizinhos;
- criar/atualizar versões e importações;
- importar lotes;
- ativar versões;
- enviar ZIP ao Storage.

## 5. Serviços e integrações

### Proxies Vercel

- `api/car.js`: encaminha consulta ao GeoServer CAR/SICAR.
- `api/sigef/[...path].js`: encaminha caminhos ao FeatureServer SIGEF.
- `api/intermat/[...path].js`: encaminha caminhos ao FeatureServer INTERMAT.

No desenvolvimento, `vite.config.js` define proxies equivalentes em `/proxy/sigef`, `/proxy/car` e `/proxy/intermat`. O workspace executável usa principalmente as rotas `/api`.

### Serviços de mapas

- OpenStreetMap;
- Esri World Imagery.

## 6. Supabase e PostGIS

O Supabase fornece Auth, REST, RPC e Storage. O PostgreSQL armazena cadastros e feições; o PostGIS executa cobertura de ponto, interseção, área, distância, vizinhança e correção de geometrias.

As RPCs V73.2 usadas pelo front-end são:

- `consultar_camadas_por_ponto_v732`;
- `consultar_camadas_por_geometria_v732`;
- `consultar_vizinhos_por_geometria_v732`.

As geometrias são tratadas em SRID 4326 e convertidas para `geography` nos cálculos métricos.

## 7. Geração de documentos

### DOCX por template

`src/core/templates/docxTemplateEngine.js` baixa o template, abre-o com PizZip e preenche tags `{CAMPO}` com Docxtemplater. Erros de template são traduzidos para mensagens com documento e campo.

Templates utilizados:

- `public/templates/MODELO_MEMORIAL_ORIGINAL.docx`;
- `public/templates/MODELO_DECLARACAO_LIMITE.docx`;
- `public/templates/MODELO_REQUERIMENTO_ORIGINAL.docx`.

O quadro de confrontantes é montado diretamente com a biblioteca `docx`. Há outros templates no diretório, mas o uso ativo deles não foi comprovado no fluxo atual.

### Limitação documental

O croqui ainda é representado por texto indicativo e a descrição geométrica depende de dados informados. O vínculo Cloud -> processo -> geometria não está concluído.

## 8. Geração de PDF

Há dois mecanismos principais:

- Cloud/workspace: montagem de relatório HTML, captura do mapa com html2canvas e impressão/salvamento em PDF pelo navegador;
- módulos empresariais: abertura de uma janela HTML formatada e chamada a `window.print()`.

jsPDF e jsPDF AutoTable constam nas dependências e são importados/usados no código Cloud. A validação oficial registra o PDF da Cloud como confirmado, mas não confirma todos os demais relatórios e dispositivos.

## 9. PWA

- `public/manifest.webmanifest`: nome, descrição, tema, orientação e ícones;
- `public/sw.js`: cache do shell, fallback de navegação e estratégia cache-first com atualização para ativos;
- `src/components/PwaInstallButton.jsx`: instalação e instruções específicas para iOS.

O cache usa o identificador `longitude-geo-v72-4`, divergente da versão estável declarada.

## 10. Deploy

O build Vite produz conteúdo estático. A Vercel hospeda o frontend e executa `api/**/*.js` com duração máxima configurada em 30 segundos. As credenciais públicas do Supabase são injetadas por variáveis de ambiente. Detalhes operacionais estão em [DEPLOYMENT.md](../DEPLOYMENT.md).

## 11. Riscos arquiteturais

- componentes muito extensos e com múltiplas responsabilidades;
- navegação sem rotas de URL;
- duplicidade de persistência local e online;
- dependência de popup/impressão do navegador;
- dependência de serviços externos e CORS/proxies;
- scripts SQL com evolução nominal incompatível;
- ausência de testes automatizados;
- versão distribuída em várias fontes divergentes.
