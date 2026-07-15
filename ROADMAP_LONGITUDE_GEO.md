# ROADMAP_LONGITUDE_GEO.md

## Versão atual
**V67 Enterprise**

## Base adotada
A V67 foi gerada a partir da V64, considerada a última base mais segura antes das tentativas de GNSS que deixaram a tela preta.

## Objetivo da V67
Restaurar estabilidade e criar a primeira organização estrutural para evolução comercial.

## Mantido
- Importação manual SIGEF, CAR e INTERMAT.
- Importação de ZIPs SIGEF Brasil.
- Painel de base SIGEF importada.
- Prevenção de duplicidade SIGEF ZIP.
- Persistência da base SIGEF no navegador quando possível.
- Análise de sobreposição.
- Exportação Word, GeoJSON, PNG e JPG conforme base V64.
- Perímetro analisado destacado.

## Removido / não ativado
- Servidor local `npm run bases`.
- Carregamento automático de pastas Windows.
- GNSS Engine ativo da V65/V66.
- Qualquer rotina que possa causar loop ou tela preta.

## Estrutura criada
- `src/components/Mapa`
- `src/components/SIGEF`
- `src/components/CAR`
- `src/components/INTERMAT`
- `src/components/Relatorios`
- `src/components/Analise`
- `src/components/Exportacoes`
- `src/components/GNSS`
- `src/core`

## Próximas etapas recomendadas
1. V68: separar importadores SIGEF/CAR/INTERMAT em arquivos próprios.
2. V69: separar relatório Word e captura de mapa.
3. V70: reintroduzir GNSS Engine como componente isolado e testado.
4. V71: criar login/licenciamento real.
5. V72: banco local IndexedDB para bases grandes.
