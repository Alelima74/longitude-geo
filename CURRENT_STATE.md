# Estado Atual — Longitude Geo Intelligence

Documento canônico para funcionalidades validadas. Consulte também [a especificação mestre](docs/MASTER_SPEC.md), [os problemas conhecidos](docs/KNOWN_ISSUES.md) e [o checklist de testes](docs/testing/TEST_CHECKLIST.md).

## Versão estável

V74.1.3

## Candidato online — revalidação em 22/10/2026

V74.1.3-rc.4, build 74134. Preview com status Ready na Vercel; login da conta do usuário e carregamento remoto da base de trabalho confirmados. Listas de GEO e laudos consultadas sem erro e atualização dos processos técnicos confirmada. Interface autenticada verificada em viewport de celular de 390 px. 125 testes automatizados aprovados; build aprovado e auditoria npm sem vulnerabilidades conhecidas.

A sincronização é pessoal, usando a mesma conta nos aparelhos. Não foi executado teste de gravação de um projeto real nem comparação de um registro salvo em dois dispositivos independentes; esses critérios continuam pendentes. A conta não apresentou projetos GEO ou laudos na nuvem durante a validação: dados anteriores de outros navegadores precisam ser importados seletivamente por backup. Nenhum registro fictício foi criado em produção.

Entrega pelo [PR #1](https://github.com/Alelima74/longitude-geo/pull/1). A confirmação do deployment principal será registrada no guia de publicação; não interpretar a versão candidata como validação integral dos módulos históricos.

## Ambiente

- Projeto local no Windows
- Repositório GitHub
- Deploy pela Vercel
- Banco de dados Supabase/PostgreSQL/PostGIS
- Aplicação acessível por navegador
- PWA instalável em celular e tablet

## Funcionalidades confirmadas

| Funcionalidade | Situação |
|---|---|
| Login | Confirmado |
| Cloud por coordenada | Confirmado |
| Cloud por KML | Confirmado |
| PDF da Cloud | Confirmado |
| Deploy Vercel | Confirmado |
| Uso no celular | Confirmado |
| Uso no tablet | Confirmado |

## Funcionalidades ainda não validadas integralmente

| Funcionalidade | Motivo |
|---|---|
| Pesquisa por CPF/CNPJ | Precisa de cadastro de teste |
| Pesquisa de imóvel | Precisa de cadastro de teste |
| Pesquisa de confrontante | Precisa de cadastro de teste |
| Memorial | Precisa de processo cadastrado |
| Requerimento | Precisa de processo cadastrado |
| Declarações | Precisa de confrontantes cadastrados |
| Quadro de confrontantes | Precisa de confrontantes cadastrados |
| Banco mestre | Precisa de teste integrado |

## Últimos problemas tratados

- Timeout em consultas espaciais.
- Erro em SQL relacionado ao alias `relacao`.
- Falta de dependências no instalador.
- package.json não copiado por instaladores antigos.
- Erros Docxtemplater do tipo Multi error.
- Incompatibilidade entre tags {CAMPO} e {{CAMPO}}.
- Geração de PDF em Safari/iPhone.
- Necessidade de preservar proporção do mapa no PDF.

## Próxima etapa recomendada

Realizar teste completo do fluxo:

1. cadastrar proprietário;
2. cadastrar imóvel;
3. cadastrar confrontantes;
4. criar processo;
5. gerar peças técnicas;
6. revisar documentos;
7. registrar falhas;
8. corrigir;
9. publicar versão estável seguinte.

## Próxima grande versão

V75 — Gestão de Processos

Objetivo:
Transformar os módulos isolados em um fluxo centralizado por processo.
