# Persistência online e deploy — Longitude Geo

## Sincronização pessoal e candidato 74134 — 15/10/2026

Esta seção substitui o diagnóstico inicial para a entrega pessoal. Os registros abaixo permanecem como histórico das etapas anteriores.

- O usuário confirmou que precisa dos mesmos projetos no computador e no celular. Foi implementada sincronização por **mesma conta**, com `owner_id = auth.uid()`, sem depender das permissões organizacionais antigas.
- Login global em builds publicados; sessão legada reaproveitada e renovação concorrente centralizada. Expiração mantém a interface montada para reautenticação sem descartar edições em memória.
- GEO, laudos e Peças Técnicas usam snapshots integrais versionados em produção. A base de trabalho do mapa (clientes/imóveis/análises locais) é carregada do servidor e salva pelo botão **Salvar base de trabalho na nuvem**. Cadastros `lg_*` permanecem nas tabelas existentes.
- Salvar aguarda confirmação remota. Conflito mantém as edições e orienta exportar cópia antes de reabrir. Não há fallback local após erro remoto. Arquivamento lógico exige a revisão vista pelo usuário.
- Configurações → Migração para nuvem permite importar seletivamente um backup da origem antiga. IDs existentes não são sobrescritos; dados locais não são apagados. Demos marcadas são rejeitadas e laudos exigem revisão explícita. Outros cadastros locais, MDB, bases SIGEF e anexos binários não são migrados por esta ferramenta.
- Migration **nova** `20261015160000_workspace_records.sql` validada em PostgreSQL descartável (PGlite), com RLS de dois usuários e papel anônimo, identidade, revisão e arquivamento; aplicada pelo SQL Editor ao projeto `lplydonzjixdcsqiistw`. Consulta posterior confirmou tabela criada, RLS ativo, 3 policies e 0 registros. Nenhum SQL histórico foi reaplicado.
- Validação: 124 testes aprovados em Node 22.23.3. Runtime do projeto ajustado para `22.x`, suportado pela Vercel. Atualização do cache para build 74134. Teste autenticado no deployment e aceitação entre aparelhos ainda pendentes.
- Publicação será feita com código-fonte e documentação selecionados; laudos de referência, PDFs de modelos originais, MDB, arquivos CAD, `output/`, `tmp/`, `.env` e credenciais ficam fora do envio. A comparação com PDFs originais é exclusiva do desenvolvimento local.

### Verificação da migration sem acesso remoto

```powershell
npm install --prefix tmp/workspace-db-validation --no-save --no-package-lock @electric-sql/pglite
npm run test:db
```

O runtime de teste fica em `tmp/` e não integra as dependências da aplicação. A tabela nova não depende da migration organizacional `20260904120000_online_project_foundation.sql`, que continua não aplicada nesta entrega. O limite de banco excedido permanece uma restrição operacional a resolver no plano/capacidade, sem apagar dados.

## Correções e ambientes identificados — 15/10/2026

- Vercel: conta `longitude74`, projeto `longitude-geo-vercel`, repositório `Alelima74/longitude-geo`. Produção em `https://longitude-geo-vercel.vercel.app`, commit publicado `eee802e`, branch `main`; essa implantação é anterior à versão local em desenvolvimento.
- Supabase: `longitude-geo`, referência `lplydonzjixdcsqiistw`, identificado pelo usuário como ambiente marcado Production. Após reativação, painel mostrou Healthy e consumo de banco de 0,678 GB para limite de 0,5 GB. Esses fatos foram observados nas capturas do usuário; não constituem auditoria de schema/RLS.
- Na Vercel, `VITE_SUPABASE_UR` estava cadastrado em Production e Preview. Adicionada a variável correta `VITE_SUPABASE_URL` com o endpoint público do mesmo projeto. Chave publicável e variável antiga preservadas; confirmação de salvamento verificada no painel. A mudança exige novo build e não corrige retroativamente o deployment antigo. Nenhum redeploy foi acionado.
- jsPDF atualizado para `^4.2.1`, Vite para `^6.4.4` e correções compatíveis transitivas aplicadas sem `--force`. Auditoria final: **zero vulnerabilidades conhecidas**. O registro de dez alertas abaixo descreve o estado anterior às correções.
- Validação final local: **119 testes aprovados**, incluindo três testes que geram PDFs dos laudos demonstrativos e extraem o conteúdo com PDF.js para conferir texto, tabelas e páginas. Build aprovado; permanecem avisos de API CJS e bundle principal grande (aproximadamente 2,77 MB antes de gzip). Esses testes não validam captura html2canvas, download em Safari ou layout visual de todas as páginas.
- Smoke test do build servido por `vite preview`: interface de Análise territorial carregou e navegação para Laudos & Avaliações exibiu os três modelos demonstrativos e lista de projetos. Nenhum registro cadastrado; esse teste não confirma login, consultas ou persistência remota.
- Nenhum arquivo `.env`, SQL aplicado, template Word original ou dado remoto foi alterado. `CURRENT_STATE.md` não foi promovido: a nova versão ainda não foi homologada/publicada.

Pendente para a homologação integrada: ambiente Supabase de teste separado, backup verificado, revisão de schema/RLS e integração dos consumidores locais. Preview e Production atualmente compartilham a configuração do mesmo banco; uma URL Preview por si só não isola os dados. Não testar cadastros fictícios contra esse banco de produção.

## Diagnóstico inicial para publicação — 15/10/2026

Preparação retomada na branch `feature/cloud-migration`, commit base `7bb71ba`, com alterações locais anteriores preservadas. A versão atual ainda não foi publicada nem homologada em ambiente remoto.

- `npm test`: 116 testes aprovados, sem falhas ou testes ignorados. Os testes de persistência remota usam doubles; não comprovam RLS ou integração com Supabase real.
- `npm run build`: aprovado com Vite 5.4.21 e Node 20.17.0. Avisos de API CJS depreciada e bundle principal de aproximadamente 2,74 MB antes de gzip.
- `npm audit --json`: 10 dependências com alertas (4 moderados, 5 altos e 1 crítico). jsPDF possui alerta crítico; a correção sugerida é 4.2.1, fora da versão principal instalada. Vite também requer atualização de versão principal segundo a auditoria. Não foi executado `audit fix` nem atualização automática.
- `git pull`: consulta remota executada, mas sem integração porque a branch atual não possui upstream. Não escolher `main` automaticamente com alterações locais pendentes.
- Nenhum vínculo `.vercel` foi localizado. Projeto Vercel e Supabase de homologação ainda precisam ser identificados pelo responsável.
- Confirmado no código: `geoRegistryStorage.js` e `evaluationRepository.mjs` continuam usando localStorage; o SDK de sessão nova está separado em `src/data/online/supabaseClient.js`.
- O importador Access continua implementado em `configureServer` do Vite. Seu funcionamento em desenvolvimento não comprova disponibilidade na Vercel.

Ordem de continuidade: identificar os ambientes e backups; corrigir dependências com validação das exportações PDF/Word; concluir integração de autenticação e persistência; homologar a migration e isolamento organizacional; publicar Preview protegido; executar aceitação em dois navegadores e em celular/tablet; promover produção com deployment anterior disponível para rollback. Os detalhes das seções abaixo continuam aplicáveis. Não promover `CURRENT_STATE.md` como versão online validada com base apenas no build e nos testes unitários.

## Situação da entrega — 04/09/2026

**Preparação parcial. Não está online nesta nova arquitetura.** Frontend local preservado. Branch `feature/cloud-migration`, com alterações anteriores do usuário mantidas. Nenhum commit/push/deploy ou escrita remota nesta etapa.

| Entrega solicitada | Estado |
|---|---|
| URL Preview | Ainda não criada; projeto Vercel não identificado |
| Supabase | Vínculo local encontrado: `lplydonzjixdcsqiistw`; não confirmado como teste; não foi alterado |
| Migration nova | `supabase/migrations/20260904120000_online_project_foundation.sql`, não aplicada |
| Tabelas novas | SQL preparado para `geo_projects`, `evaluation_projects`, `uploaded_files`; criação remota não executada |
| Bucket | `longitude-private`, privado, limite 50 MB; apenas preparado em SQL |
| RLS | Select/insert/update por `current_organization_id()` nas três tabelas; Storage por prefixo da organização; não testada em PostgreSQL |
| Backup | Configurações → Migração para nuvem; exporta as chaves Longitude do localStorage, exceto sessões/segredos. Não cobre MDB, IndexedDB ou outras origens |
| Dois navegadores | Pendente; nenhuma prova de persistência compartilhada |
| Testes | 116 testes unitários aprovados; adapters remotos testados com doubles, não Supabase real |
| Build | Aprovado; aviso de bundle principal grande |
| Segurança das dependências | npm audit: 8 alertas, 4 moderados, 3 altos, 1 crítico; jsPDF/Vite exigem revisão antes de produção. Nenhum `audit fix --force` executado |

## 1. Confirmar ambientes antes de qualquer escrita

Obter o projeto Vercel e confirmar um Supabase de teste distinto da produção (ou um Preview/branch isolado autorizado). Não supor que a referência local é descartável. Confirmar administrador, organização e backups. Não copiar credenciais para documentação ou chat.

O `public.users` existente determina organização. A migration histórica permite escrita nessa tabela por usuários da organização; revisar a administração de membros/papéis antes de expor qualquer novo ambiente. As tabelas `cad_*` antigas também têm policies amplas. A nova migration não resolve essas policies históricas por si só.

## 2. Banco / migrations

1. Comparar schema remoto e histórico efetivamente aplicado com o repositório, somente leitura.
2. As migrations antigas dependem de estruturas `lg_*` definidas em SQL fora da pasta migrations; não rodar toda a sequência cegamente em projeto vazio.
3. Homologar a nova migration em ambiente descartável. Ela usa `CREATE TABLE` sem mascarar colisões: se os nomes já existem, revisar compatibilidade em vez de sobrescrever.
4. SQL preparado contém snapshots integrais, UUIDs e IDs locais/legados separados. Não é o schema mínimo completo solicitado: entidades normalizadas de avaliações, base de mercado, cadastros ambientais, profiles/aliases e documentos por módulo ainda exigem implementação compatível.
5. Testar RLS com dois usuários da mesma organização, outro de organização diferente e cliente anônimo. Confirmar negação de leitura/escrita cruzada e de autoalteração de associação/papel.
6. Confirmar ausência de links públicos e validar prefixos/parentesco organizacional no Storage.

Não aplicar SQL pelo frontend; não usar service_role em variáveis VITE. Não incluir senhas do banco em comandos registrados no repositório.

## 3. Integração ainda necessária

- `src/data/online/supabaseClient.js`: SDK singleton lazy, sessão nova independente. Não conectado ao login legado ou gate global; não publicar presumindo proteção completa.
- `recordRepository.mjs`: seleção explícita LOCAL/SUPABASE, sem fallback após erro; adapter de snapshot com paginação e controle otimista de revisão. Ainda não substitui as funções síncronas dos editores.
- `fileRepository.mjs`: upload privado e link assinado de curta duração; metadados falhos geram aviso e não apagam arquivo. Ainda não conectado aos geradores/exportadores.
- Unificar clientes/imóveis antes de converter FKs `lg_reports`/`lg_proposals` e snapshots. Não trocar UUIDs sem tabela de correspondência.
- Ao integrar, usar `VITE_SUPABASE_PRIMARY=false` durante homologação; habilitar somente após todos os consumidores estarem preparados. Nesta etapa a variável não é consumida: o sistema atual continua local onde já era local.
- Não habilitar um toggle que dê falsa impressão de persistência online.
- Salvar deve aguardar confirmação do servidor e mostrar Salvando / Salvo na nuvem / Erro ao salvar. Alterações concorrentes exigem reabertura/revisão, sem overwrite silencioso.

## 4. Backup e migração

1. Abrir a origem e perfil do navegador realmente usados no escritório. `localhost:5186` e outras portas são bases locais diferentes.
2. Em Configurações → Migração para nuvem, conferir contagens e exportar `longitude_backup_pre_cloud_YYYYMMDD_HHMM.json`.
3. Verificar arquivo salvo e guardar cópia segura; contém dados pessoais. Preserva inclusive JSON inválido em forma bruta. Tokens não são exportados.
4. Completar backup externo de MDB, documentos e IndexedDB histórico, se existir. O arquivo exportado nesta etapa não é backup completo de todas essas fontes.
5. Ferramenta de envio permanece desabilitada. Antes de habilitar, implementar correspondências de IDs, idempotência transacional e deduplicação por legado/CPF-CNPJ/matrícula+CNS confirmado. Ambiguidades devem ir para revisão, nunca fusão automática por nome.
6. Demos marcadas são rejeitadas pelo adapter; dados demonstrativos herdados por cópias/laudos novos ainda requerem detecção/revisão adicional.
7. Nunca apagar localStorage/MDB após envio. Comparar contagens e conteúdo em outro navegador antes de concluir.

## 5. Vercel

Configuração no repositório: framework `vite`, build `npm run build`, saída `dist`; funções `api/**/*.js` preservadas. Não há React Router no fluxo atual: navegação ocorre por estado. Não foram inventadas rotas `/laudos` ou `/projetos/:id`; se forem implementadas, testar rewrite sem capturar `/api/*`.

No projeto Vercel autorizado, cadastrar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` separadamente em Preview e Production. Não commitar `.env.local`; nunca usar service_role. As variáveis VITE entram no build, portanto exigem novo build ao mudar.

Só publicar Preview após gate global Auth e consumers online estarem implementados e SQL homologado. Não publicar só o frontend e chamar de online. Middleware Access do Vite não roda na Vercel: manter importação MDB no escritório ou preparar serviço separado autenticado, sem desativar importador local.

## 6. Aceitação em dois navegadores

Em Preview autorizado, cadastrar cliente/imóvel/projeto GEO/laudo reais de teste autorizados no navegador A. Salvar e confirmar nuvem. Abrir navegador B com armazenamento independente, autenticar e comparar registros, capítulos, overrides e anexos. Editar em ambos e comprovar conflito de revisão. Desconectar rede e comprovar erro, sem gravação local silenciosa. Testar renovação de sessão, logout e tentativa anônima. Não criar fixtures em produção.

## 7. Rollback não destrutivo

Manter implantação anterior e exportações locais. Caso a integração falhe, restaurar o deployment anterior autorizado e configuração de fonte local anterior, sem apagar tabelas/bucket nem dados recém-enviados. Preservar projetos editados online para reconciliação manual; voltar ao local não sincroniza automaticamente alterações remotas. Não executar DROP, reset, force push ou reaplicar migrations antigas.

## Arquivos alterados nesta preparação

- `package.json`, `package-lock.json`, `vercel.json`, `src/components/EnterpriseModules.jsx`.
- `src/data/online/recordRepository.mjs`, `localBackup.mjs`, `supabaseClient.js`, `fileRepository.mjs`, `CloudMigrationPanel.jsx`.
- `supabase/migrations/20260904120000_online_project_foundation.sql`, `tests/onlinePersistence.test.mjs`.
- `docs/ONLINE_MIGRATION_AUDIT.md`, este guia, `docs/MASTER_SPEC.md`, `docs/testing/TEST_CHECKLIST.md`, `ROADMAP.md`, `CHANGELOG.md`.

`CURRENT_STATE.md` não foi promovido: os critérios de aceitação online ainda não foram cumpridos.

Referências oficiais consultadas: [SDK Supabase](https://supabase.com/docs/reference/javascript/initializing), [configuração Vercel](https://vercel.com/docs/project-configuration).
