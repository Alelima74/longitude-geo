# Longitude Geo Intelligence - MVP 2.2

## Implementações

- Relatório Word cartográfico com mapa capturado da tela.
- Legenda de cores no mapa e no relatório.
- Cálculo técnico corrigido usando união geométrica das interseções.
- Área sobreposta efetiva.
- Área livre estimada.
- Busca SIGEF local por código INCRA/SNCR com ou sem máscara `000.000.000.000-0`.
- Botão: Relatório Word com mapa.

## Atualizar

```cmd
xcopy D:\COMPARTILHAMENTO\longitude-geo-mvp-v22\longitude-geo-mvp-v22\* D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14\ /E /Y
cd D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14
npm install
npm run build
git add .
git commit -m "Adicionar relatorio cartografico v22"
git push
```
