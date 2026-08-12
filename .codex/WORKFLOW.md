# WORKFLOW OFICIAL

## Objetivo

Definir o processo oficial de evolução do Longitude Geo Intelligence.

## Fluxo obrigatório

Toda nova funcionalidade deverá seguir obrigatoriamente esta sequência:

1. Planejamento
2. Especificação técnica
3. Aprovação
4. Implementação
5. Testes locais
6. Testes funcionais
7. Atualização da documentação
8. Commit
9. Push
10. Deploy Vercel
11. Validação em Produção

## Regras obrigatórias

- Nunca alterar código sem entender toda a arquitetura.
- Sempre ler `AGENTS.md` antes de iniciar qualquer tarefa.
- Sempre consultar `ROADMAP.md`.
- Sempre consultar `CURRENT_STATE.md`.
- Nunca remover funcionalidades existentes sem autorização.
- Nunca alterar templates oficiais DOCX sem autorização.
- Nunca alterar scripts SQL já homologados sem criar nova migration.
- Nunca modificar variáveis do Supabase.
- Nunca alterar configurações da Vercel sem autorização.
- Nunca executar `git push` automaticamente.
- Nunca executar deploy automaticamente.
- Sempre preservar compatibilidade com versões anteriores.
- Sempre manter o projeto compilando.
- Sempre atualizar `CHANGELOG.md` quando houver alteração.
- Sempre atualizar `docs/MASTER_SPEC.md` quando houver nova funcionalidade.

## Organização do desenvolvimento

Todo desenvolvimento deverá ser dividido em módulos independentes.

Exemplo:

- Inteligência Territorial
- Cloud
- Banco Mestre
- Peças Técnicas
- Motor Documental
- Relatórios
- Propostas
- Administração
- Configurações

## Política de documentação

Nenhuma funcionalidade será considerada concluída sem:

- documentação atualizada;
- checklist atualizado;
- roadmap atualizado;
- changelog atualizado.

Documentos canônicos:

- `docs/MASTER_SPEC.md`: escopo e especificação mestre;
- `docs/architecture/ARCHITECTURE.md`: arquitetura;
- `docs/database/DATABASE.md`: banco de dados;
- `docs/modules/MODULES.md`: módulos e situação funcional;
- `docs/KNOWN_ISSUES.md`: riscos e itens não validados;
- `docs/DEPLOYMENT.md`: publicação e rollback;
- `docs/testing/TEST_CHECKLIST.md`: validação;
- `CHANGELOG.md`: histórico consolidado.

Documentos com versão no nome e o arquivo `CHANGELOG_LONGITUDE_GEO.md` são históricos. Em caso de divergência, devem prevalecer, nesta ordem: `AGENTS.md` e este workflow para regras; `CURRENT_STATE.md` para situação validada; `ROADMAP.md` e `PLANS.md` para planejamento; e os documentos canônicos acima para descrição técnica.

## Política Git

Fluxo oficial:

```text
Feature Branch

↓

Testes

↓

Pull Request

↓

Main

↓

Deploy
```

## Objetivo final

Transformar o Longitude Geo Intelligence na plataforma mais completa de regularização fundiária do Brasil, mantendo arquitetura organizada, documentação completa e evolução contínua.
