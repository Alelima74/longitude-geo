# Longitude Geo V69.2 — Refatoração modular, etapa 1

## Alteração principal

O arquivo raiz `src/App.jsx` deixou de concentrar milhares de linhas. Agora ele apenas inicializa a aplicação por meio de `src/app/AppRoot.jsx`.

A versão funcional anterior foi preservada em:

- `src/legacy/LegacyWorkspace.jsx`

Isso cria uma fronteira segura: as próximas telas podem ser retiradas gradualmente do módulo legado sem reescrever todo o sistema em uma única atualização.

## Estrutura atual

```text
src/
├── App.jsx                     # raiz mínima
├── app/
│   ├── AppRoot.jsx             # composição global
│   └── ErrorBoundary.jsx       # evita tela preta sem diagnóstico
├── pages/
│   └── CloudPage.jsx           # página cloud isolada
├── cloud/
│   ├── CloudPanel.jsx
│   ├── cloudApi.js
│   └── utm.js
├── core/
└── legacy/
    └── LegacyWorkspace.jsx     # funcionalidades atuais preservadas
```

## Correções visíveis

- Menu renomeado para **Cloud Importer / Consulta UTM**.
- Versão exibida como **V69.2**.
- Tratamento global de falha: um erro deixa mensagem e botão de recarregar, em vez de tela totalmente preta.

## Próxima extração recomendada

1. Sidebar e navegação.
2. Página Cloud fora do workspace legado.
3. Relatórios.
4. Importadores locais.
5. Análise territorial.
