# Estado Atual — Longitude Geo Intelligence

Documento canônico para funcionalidades validadas. Consulte também [a especificação mestre](docs/MASTER_SPEC.md), [os problemas conhecidos](docs/KNOWN_ISSUES.md) e [o checklist de testes](docs/testing/TEST_CHECKLIST.md).

## Versão estável

V74.1.3

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
