# Longitude Geo Intelligence - MVP 2.0

## Implementações

- Mapa da análise de sobreposição inserido no relatório Word.
- Busca SIGEF local por código INCRA/SNCR com e sem máscara `000.000.000.000-0`.
- Botões liga/desliga para pré-visualizar parcelas SIGEF local e CAR no mapa.
- Pré-visualização com transparência para analisar possível sobreposição com KML, GeoJSON ou desenho importado.

## Atualizar

```cmd
xcopy D:\COMPARTILHAMENTO\longitude-geo-mvp-v20\longitude-geo-mvp-v20\* D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14\ /E /Y
cd D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14
npm install
npm run build
git add .
git commit -m "Implementar mapa relatorio busca incra e preview camadas"
git push
```
