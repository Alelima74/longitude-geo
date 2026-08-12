# Problemas conhecidos, riscos e itens não validados

[Voltar à especificação mestre](MASTER_SPEC.md) · [Banco de dados](database/DATABASE.md) · [Checklist de testes](testing/TEST_CHECKLIST.md)

## 1. Problemas e inconsistências atuais

### Esquema Cloud incompleto no repositório

O script inicial cria colunas em inglês, enquanto scripts posteriores e o frontend usam colunas em português. A criação da tabela `importacoes` não foi encontrada. O banco remoto pode conter migrations ou objetos não versionados localmente.

**Risco:** instalação nova não reproduzir o ambiente operacional ou falhar ao aplicar o script 02.

### Versionamento divergente

- `AGENTS.md` e `CURRENT_STATE.md`: V74.1.3;
- `VERSION.json`: 74.1.3-rc.1;
- `package.json`: 7.4.1-rc.4;
- README: V69.2;
- cache do Service Worker: V72.4.

**Risco:** identificação incorreta de build, cache antigo e dificuldade de rollback.

### Componentes monolíticos

`LegacyWorkspace.jsx` e `CloudPanel.jsx` concentram interface, estado, regras, acesso externo, GIS, exportação e relatório.

**Risco:** regressões cruzadas e baixa testabilidade.

### Persistência duplicada

Há dados em Supabase, `localStorage` e IndexedDB. Proprietários, clientes, confrontantes, imóveis e processos podem existir em mais de uma fonte.

**Risco:** duplicidade, divergência, perda de vínculo e comportamento diferente entre dispositivos.

### Processos fora do banco

O módulo de peças salva a coleção `longitude_geo_technical_processes_v73` em `localStorage`, apesar da tabela `pecas_processos` existir no SQL.

**Risco:** processo não sincronizado, indisponível em outro dispositivo e sujeito à limpeza do navegador.

### Dependência de serviços externos

SIGEF, CAR e INTERMAT dependem de endpoints públicos e proxies. Mudanças de URL, schema, disponibilidade, timeout ou CORS podem interromper consultas.

### Arquivos grandes processados no navegador

Importações grandes dependem da memória e da permanência do navegador aberto. Não existe worker servidor dedicado no repositório.

### Segurança do cadastro mestre

As políticas dos cadastros `cad_confrontantes`, `cad_proprietarios` e `cad_marcos` permitem todas as operações a qualquer usuário autenticado.

**Ponto a confirmar:** se o cadastro deve ser compartilhado por todos os usuários do projeto ou isolado por organização/dono.

### Ausência de testes automatizados

`package.json` não possui scripts de teste, lint ou type-check. A validação disponível é manual e por build.

### TypeScript não presente

Embora listado como tecnologia no `AGENTS.md`, o código auditado usa JavaScript/JSX.

## 2. Funcionalidades não validadas oficialmente

Conforme `CURRENT_STATE.md` e `ROADMAP.md`:

- pesquisa de proprietário por CPF/CNPJ;
- pesquisa de imóvel;
- pesquisa de confrontante;
- banco mestre integrado;
- memorial;
- requerimento;
- declarações de limite;
- quadro de confrontantes;
- fidelidade dos templates DOCX.

Existência de código não equivale a validação funcional.

## 3. Automação documental parcial

- croqui ainda não é inserido a partir da geometria;
- descrição/caminhamento pode ficar pendente ou depender de entrada manual;
- vínculo Cloud -> processo não foi implementado integralmente;
- fidelidade de cabeçalhos, rodapés, tabelas e paginação não foi confirmada;
- planta A4/A3/A2/A1 e DXF estão planejados.

### Averbação GEO

- o parser inicial cobre PDFs SIGEF com texto pesquisável e padrões reconhecíveis; PDFs digitalizados ainda exigem entrada geoespacial alternativa;
- coordenadas UTM sem latitude/longitude não são convertidas silenciosamente;
- a consulta depende dos campos publicados pela fonte pública já usada pelo sistema e pode não localizar uma certificação;
- KML, GeoJSON e SHP/ZIP estão ativos; KMZ permanece preparado conceitualmente, mas não habilitado nesta entrega;
- projetos são locais ao navegador e ainda não sincronizam entre dispositivos;
- parser de matrícula e geração final das peças cartoriais permanecem desabilitados para evitar documentos incompletos ou juridicamente inadequados.
- a correção do parser usa fixture realista baseada na estrutura observada, mas ainda requer repetição da validação com o Memorial SIGEF real autorizado;
- a rota da consulta SIGEF foi corrigida, porém a fonte externa não pôde ser validada neste ambiente devido a bloqueio de conexão de rede do proxy (`EACCES`).

## 4. Falhas históricas relevantes registradas

Os itens abaixo constam em `CURRENT_STATE.md` e no changelog histórico, mas não foram reproduzidos nesta auditoria:

- timeout em consultas espaciais;
- erro SQL relacionado ao alias `relacao`;
- dependências ausentes em instaladores;
- `package.json` não copiado por instaladores antigos;
- erro Docxtemplater `Multi error`;
- incompatibilidade entre `{CAMPO}` e `{{CAMPO}}`;
- geração de PDF no Safari/iPhone;
- preservação da proporção do mapa no PDF.

## 5. Possíveis regressões a monitorar

- autenticação e renovação de token;
- políticas RLS bloqueando ou expondo dados;
- RPCs antigas sendo chamadas contra schema novo;
- perda de Z/3D ou geometria inválida na importação;
- timeout em perímetros grandes;
- percentuais incorretos por geometria inválida ou sobreposições duplicadas;
- mapa ausente, cortado ou deformado no PDF;
- popup bloqueado na geração de relatório;
- templates DOCX com tag inválida;
- cache PWA servindo build anterior;
- exclusão de dados compartilhados do cadastro mestre;
- perda de processos ao limpar armazenamento do navegador;
- quebra de layout em celular/tablet;
- falha de proxy por alteração nos serviços oficiais.

## 6. Pontos não testados nesta atualização documental

- build;
- execução local;
- login real;
- conexão com Supabase;
- estado do banco remoto;
- endpoints externos;
- geração efetiva de PDF/DOCX;
- instalação PWA;
- responsividade em dispositivos físicos.

Nenhum desses itens foi declarado como aprovado por esta documentação.
