# Longitude Geo Intelligence - MVP 1.4

## Novidades

- Motor de análise de sobreposição.
- Cruza o perímetro atual com:
  - Base SIGEF local importada
  - Feição CAR/SIGEF consultada
- Lista parcelas sobrepostas com atributos principais.
- Calcula:
  - Área da parcela
  - Área sobreposta
  - Percentual sobre o perímetro analisado
  - Percentual sobre a parcela
- Exporta relatório em Word (.doc)
- Exporta interseções em GeoJSON

## Fluxo recomendado

1. Carregue/desenhe um perímetro ou consulte um CAR/SIGEF.
2. Clique em "Usar feição como perímetro atual", se a feição consultada for o alvo da análise.
3. Importe a base SIGEF GeoJSON, quando quiser cruzar com SIGEF.
4. Clique em "Executar análise".
5. Clique em "Exportar Word".

## Rodar

```bash
npm install
npm run dev
```
