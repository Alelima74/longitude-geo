# AGENTS.md — Longitude Geo Intelligence

## 1. Identidade do projeto

Nome do sistema: Longitude Geo Intelligence

Versão estável atual: V74.1.3

Objetivo geral:
Desenvolver uma plataforma integrada para inteligência territorial,
regularização fundiária, georreferenciamento, SIGEF, CAR, INTERMAT,
geração de peças técnicas e gestão de processos rurais e urbanos.

O sistema é utilizado em produção. Alterações não podem destruir,
remover ou desativar funcionalidades existentes.

---

## 2. Tecnologias principais

- React
- TypeScript
- Vite
- Supabase
- PostgreSQL/PostGIS
- Leaflet
- Git
- GitHub
- Vercel
- jsPDF
- html2canvas
- Docxtemplater
- PizZip

Antes de adicionar uma nova biblioteca, verificar se o projeto já possui
recurso equivalente.

---

## 3. Regras obrigatórias de desenvolvimento

1. Nunca remover uma funcionalidade existente sem autorização expressa.
2. Nunca substituir arquivos inteiros quando uma alteração pontual for suficiente.
3. Preservar compatibilidade com os dados já existentes no Supabase.
4. Não alterar migrations ou scripts SQL já aplicados em produção.
5. Novas alterações no banco devem ser feitas em novo arquivo SQL.
6. Não colocar chaves, senhas ou credenciais no código.
7. Não alterar variáveis do arquivo .env sem autorização.
8. Não executar comandos destrutivos no banco de produção.
9. Não fazer force push.
10. Não trabalhar diretamente na branch main.
11. Antes de alterar código, identificar os arquivos afetados.
12. Depois da alteração, executar build e testes disponíveis.
13. Informar claramente todos os arquivos modificados.
14. Atualizar CHANGELOG.md quando houver mudança funcional.
15. Atualizar CURRENT_STATE.md quando uma versão for validada.
16. Manter a interface utilizável em computador, tablet e celular.
17. Preservar caracteres e acentuação em português do Brasil.
18. Não criar dados fictícios em produção.
19. Não alterar os templates Word originais sem autorização.
20. Não declarar uma funcionalidade como concluída sem testá-la.

---

## 4. Fluxo Git obrigatório

A branch main representa produção estável.

Para desenvolvimento:

- feature/nome-da-funcionalidade
- fix/nome-do-erro
- release/vXX.X
- docs/nome-da-documentacao

Nunca realizar desenvolvimento diretamente na main.

Antes de iniciar:

```bash
git status
git branch
git pull
```
