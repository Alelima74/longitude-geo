# Longitude Geo V70 — Consulta Territorial Cloud

## Implementado
- Consulta por UTM.
- Consulta por coordenada geográfica em decimal ou GMS.
- Consulta por perímetro KML, GeoJSON/JSON ou ZIP Shapefile.
- Cálculo de área e percentual de sobreposição.
- Download dos resultados em KML e GeoJSON.
- Relatório para impressão ou salvamento em PDF.
- Importação de ZIPs acima de 50 MB em modo local grande, sem armazenamento do ZIP original no Storage.

## Instalação
1. Execute `ATUALIZAR_V70_INTELIGENCIA.bat`.
2. No Supabase SQL Editor, execute `supabase/04_consulta_territorial_v70.sql`.
3. Na pasta oficial, execute `npm run dev`.

O arquivo `.env.local` existente na pasta oficial não é substituído.
