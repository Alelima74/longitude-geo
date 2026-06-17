# Longitude Geo Intelligence - MVP 1.7

## Novidades

- Tela de detalhe do imóvel.
- Botão "Abrir imóvel".
- Histórico de análises por imóvel.
- Abrir mapa de análise salva.
- Gerar relatório de análise salva.
- Duplicar análise.
- Excluir análise.
- Estrutura para abas futuras: documentos, mapas, relatórios, propostas e pendências.

## Atualizar Git

```cmd
xcopy D:\COMPARTILHAMENTO\longitude-geo-mvp-v17\longitude-geo-mvp-v17\* D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14\ /E /Y
cd D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14
npm install
npm run build
git add .
git commit -m "Adicionar historico de analises por imovel"
git push
```
