# Longitude Geo Intelligence - MVP 2.4

## Correção

O botão "Baixar relatório de sobreposição" ainda dependia do cruzamento antigo.
Nesta versão, os relatórios passam a usar também a análise automática criada quando o KML é carregado.

## Agora funciona assim

1. Carrega KML/GeoJSON.
2. Sistema busca CAR online pelo entorno e cruza SIGEF local, se importado.
3. Sistema desenha as feições próximas/sobrepostas.
4. Botão "Baixar relatório de sobreposição" usa esse resultado automático.
5. Botão "Relatório Word com mapa" também usa esse resultado automático.

## Atualizar

```cmd
xcopy D:\COMPARTILHAMENTO\longitude-geo-mvp-v24\longitude-geo-mvp-v24\* D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14\ /E /Y
cd D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14
npm install
npm run build
npm run dev
```

Se passar no teste local:

```cmd
git add .
git commit -m "Corrigir relatorio para analise automatica"
git push
```
