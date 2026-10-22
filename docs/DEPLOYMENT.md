# Deploy — Longitude Geo Intelligence

[Voltar à especificação mestre](MASTER_SPEC.md) · [Problemas conhecidos](KNOWN_ISSUES.md) · [Checklist de testes](testing/TEST_CHECKLIST.md)

## 1. Escopo

O repositório comprova um frontend Vite hospedável na Vercel, funções serverless em `api/`, Supabase como backend e PWA. Este guia não autoriza alteração do banco nem substitui os procedimentos do ambiente de produção.

## 2. Git e GitHub

A `main` representa produção estável. O fluxo definido em `AGENTS.md` exige desenvolvimento fora da `main`, usando:

- `feature/nome-da-funcionalidade`;
- `fix/nome-do-erro`;
- `release/vXX.X`;
- `docs/nome-da-documentacao`.

Antes de qualquer desenvolvimento, devem ser verificados `git status` e a branch. `git pull` deve ser realizado apenas quando autorizado e quando não houver risco de sobrescrever trabalho local. Force push é proibido.

O repositório local informa integração com GitHub, mas URL, workflows de CI e regras de proteção não foram confirmados nos arquivos auditados.

## 3. Requisitos de build

- Node.js 22.x, conforme `package.json`;
- dependências instaladas pelo lockfile;
- variáveis do Supabase configuradas no ambiente;
- acesso de rede para mapas, Supabase e serviços externos.

Comandos declarados:

```bash
npm install
npm run build
npm run preview
```

Há script `npm test` para testes de GEO, PWA, persistência e exportação PDF. Não há script de lint. O build gera `dist/`. A revalidação de 15/10/2026 e os ambientes identificados estão em [DEPLOY_LONGITUDE_GEO.md](DEPLOY_LONGITUDE_GEO.md).

## 4. Variáveis de ambiente

O código reconhece:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `VITE_SUPABASE_ANON_KEY` como fallback legado.

Somente chaves públicas/publicáveis podem chegar ao frontend. Service role, senha, token administrativo ou qualquer segredo não deve ser armazenado em código, `.env.example`, commit ou documentação.

As variáveis devem ser configuradas separadamente nos ambientes Development, Preview e Production da Vercel. Valores não são registrados neste documento.

## 5. Vercel

`vercel.json` configura funções `api/**/*.js` com duração máxima de 30 segundos. Rotas serverless existentes:

- `/api/car`;
- `/api/sigef/[...path]`;
- `/api/intermat/[...path]`.

Não há configuração explícita de redirects/rewrites no `vercel.json`. O comportamento SPA deve ser validado no projeto Vercel.

## 6. Preview

Fluxo recomendado:

1. trabalhar em branch permitida;
2. conferir o diff e garantir que nenhum segredo foi incluído;
3. executar build local;
4. publicar Preview pela integração GitHub/Vercel configurada externamente;
5. verificar variáveis do ambiente Preview;
6. executar integralmente [TEST_CHECKLIST.md](testing/TEST_CHECKLIST.md);
7. registrar versão/build e evidências;
8. somente promover após validação.

`VERSION.json` identifica o ambiente como `preview` e status `release-candidate`; isso não confirma que o deploy atualmente acessado seja Preview.

## 7. Produção

Antes da promoção:

- confirmar branch e revisão aprovada;
- confirmar backup e possibilidade de rollback;
- confirmar compatibilidade com o schema Supabase de produção;
- não reaplicar scripts SQL históricos;
- validar login, Cloud, PDF, PWA e responsividade;
- validar proxies CAR, SIGEF e INTERMAT;
- confirmar que o cache PWA foi versionado adequadamente;
- registrar a versão validada em `CURRENT_STATE.md` quando autorizado.

O deploy de produção é declarado como confirmado em `CURRENT_STATE.md`, mas detalhes de domínio, projeto e pipeline não constam no repositório.

## 8. Banco e migrations

- scripts já aplicados não devem ser editados;
- nova alteração exige novo arquivo SQL não destrutivo;
- nunca executar migration sem identificar o estado atual do banco e plano de rollback;
- nunca executar comandos destrutivos em produção;
- conferir RLS, grants, funções e dependências antes da aplicação;
- a divergência entre schemas Cloud em inglês/português deve ser resolvida por auditoria do banco antes de nova instalação.

## 9. Rollback

### Frontend/Vercel

Preferir promover novamente um deployment anterior validado pela interface da Vercel ou reverter por novo commit, sem force push. Confirmar também o cache da PWA após o rollback.

### Banco

Não há scripts de rollback versionados. Não tentar desfazer migrations históricas sem backup e análise do schema remoto. Mudanças futuras devem incluir plano de rollback antes da execução.

### Dados locais

Processos técnicos e bases locais podem estar no navegador. Rollback de frontend não restaura `localStorage` ou IndexedDB. Antes de ações de suporte, preservar os dados locais quando possível.

## 10. Instalação PWA

Pré-requisitos:

- aplicação servida por HTTPS;
- manifest e ícones acessíveis;
- Service Worker registrado em produção;
- navegador compatível.

Em navegadores compatíveis, o componente `PwaInstallButton` usa o evento de instalação. No iPhone/iPad, orienta o usuário a usar Compartilhar -> Adicionar à Tela de Início. Após atualização, validar se o Service Worker não mantém a versão anterior em cache.

## 11. Itens de infraestrutura não confirmados

- URL e configuração do repositório GitHub;
- proteção da `main`;
- workflows CI/CD;
- domínio de produção;
- projeto Vercel e política de promoção;
- projeto Supabase de Preview/Produção;
- backups automáticos;
- observabilidade, logs e alertas;
- schema efetivamente implantado.
