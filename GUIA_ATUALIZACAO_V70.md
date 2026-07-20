# Passos obrigatórios da V70

1. Extrair esta pasta.
2. Executar `ATUALIZAR_V70_INTELIGENCIA.bat`.
3. Abrir o Supabase > SQL Editor > New query.
4. Abrir `supabase/04_consulta_territorial_v70.sql`, copiar tudo e clicar em Run.
5. Confirmar: `V70 CONSULTA TERRITORIAL CRIADA COM SUCESSO`.
6. Na pasta oficial, executar `npm run dev`.
7. Abrir `Cloud / Consulta Territorial`.

## ZIPs grandes
- Até 50 MB: ZIP original é enviado ao Storage e as feições são processadas.
- Acima de 50 MB: o ZIP não é enviado ao Storage; é lido no notebook e as feições são gravadas em lotes no PostGIS.
- O notebook e o navegador precisam permanecer ligados até o final.
- Arquivos extremamente grandes ainda dependem da memória disponível no computador.
