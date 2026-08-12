# Checklist de testes — Longitude Geo Intelligence

[Voltar à especificação mestre](../MASTER_SPEC.md) · [Deployment](../DEPLOYMENT.md) · [Problemas conhecidos](../KNOWN_ISSUES.md)

## 1. Identificação da execução

- [ ] Registrar versão exibida, `VERSION.json`, branch e commit testado.
- [ ] Registrar ambiente: local, Preview ou Produção.
- [ ] Registrar navegador, sistema operacional e dispositivo.
- [ ] Usar somente dados de teste autorizados; não criar dados fictícios em produção.
- [ ] Preservar evidências de erros sem registrar credenciais ou tokens.

Resultado permitido por item: **Aprovado**, **Reprovado**, **Bloqueado** ou **Não executado**.

## 2. Build

- [ ] Instalar dependências respeitando `package-lock.json`.
- [ ] Executar `npm run build`.
- [ ] Confirmar conclusão sem erro.
- [ ] Confirmar ausência de segredo no bundle/log.
- [ ] Executar `npm run preview` quando aplicável.
- [ ] Abrir a aplicação e confirmar ausência de tela preta.

Não há testes automatizados, lint ou type-check configurados no `package.json`.

## 3. Login

- [ ] Abrir Cloud / Consulta Territorial.
- [ ] Confirmar mensagem adequada quando Supabase não estiver configurado.
- [ ] Entrar com usuário válido.
- [ ] Confirmar rejeição de credencial inválida sem expor detalhes sensíveis.
- [ ] Recarregar a página e confirmar restauração/renovação da sessão.
- [ ] Confirmar acesso aos módulos empresariais após login.
- [ ] Sair/limpar sessão e confirmar bloqueio das áreas autenticadas.
- [ ] Validar separação de dados por RLS com dois usuários autorizados, em ambiente de teste.

## 4. Cloud por coordenada

- [ ] Consultar longitude/latitude decimal válida.
- [ ] Consultar coordenada em GMS, se exposta pela interface.
- [ ] Consultar UTM com Este, Norte, fuso e hemisfério válidos.
- [ ] Verificar ponto convertido no mapa.
- [ ] Testar ponto com ocorrência e sem ocorrência.
- [ ] Alternar origens SIGEF, CAR e INTERMAT.
- [ ] Conferir atributos, geometria e data de referência retornados.
- [ ] Testar coordenadas inválidas e mensagens de validação.
- [ ] Registrar tempo de resposta e eventual timeout.

## 5. Cloud por KML/perímetro

- [ ] Importar KML poligonal válido.
- [ ] Importar GeoJSON/JSON válido.
- [ ] Importar ZIP Shapefile válido.
- [ ] Rejeitar formato não suportado com mensagem clara.
- [ ] Conferir perímetro e enquadramento no mapa.
- [ ] Conferir área calculada com fonte independente.
- [ ] Consultar sobreposições nas bases selecionadas.
- [ ] Conferir área e percentual de interseção.
- [ ] Confirmar que resultados não são duplicados indevidamente.
- [ ] Executar análise de vizinhos e testar distância configurável.
- [ ] Exportar KML e GeoJSON e reabrir os arquivos.
- [ ] Testar geometria inválida, multipolígono e arquivo grande em ambiente controlado.

## 6. PDF da Cloud

- [ ] Gerar relatório após consulta com resultado.
- [ ] Confirmar bloqueio/mensagem quando não houver resultado.
- [ ] Conferir logotipo, título, dados da consulta e tabelas.
- [ ] Conferir mapa, legenda, cores e enquadramento.
- [ ] Confirmar que o mapa preserva proporção.
- [ ] Verificar que textos/tabelas não são cortados.
- [ ] Salvar PDF e reabrir o arquivo.
- [ ] Testar Chrome/Edge desktop.
- [ ] Testar Safari no iPhone/iPad.
- [ ] Testar bloqueio de popup e mensagem ao usuário.

## 7. Proprietário por CPF/CNPJ

- [ ] Cadastrar proprietário autorizado.
- [ ] Pesquisar por nome completo e parcial.
- [ ] Pesquisar CPF/CNPJ com e sem pontuação.
- [ ] Confirmar origem do resultado: cliente, cadastro mestre, confrontante ou processo local.
- [ ] Confirmar tratamento de duplicidade.
- [ ] Vincular proprietário existente ao processo.
- [ ] Editar sem apagar histórico ou outro cadastro indevidamente.
- [ ] Repetir após recarregar e em outro dispositivo para identificar dados apenas locais.

## 8. Imóvel

- [ ] Cadastrar imóvel vinculado a cliente.
- [ ] Preencher município, UF, matrícula, CAR, SIGEF e área.
- [ ] Pesquisar por nome, matrícula, CNS, SNCR, SIGEF e CAR.
- [ ] Editar imóvel e conferir `updated_at`.
- [ ] Abrir histórico e registrar análise.
- [ ] Conferir relatórios/propostas relacionados.
- [ ] Excluir apenas em ambiente de teste e confirmar efeitos dos FKs.
- [ ] Confirmar isolamento RLS.

## 9. Confrontante

- [ ] Cadastrar nome/documento e imóvel confrontante.
- [ ] Pesquisar por nome, CPF/CNPJ, imóvel, matrícula, INCRA, SIGEF e CAR.
- [ ] Reutilizar cadastro em um processo.
- [ ] Completar vértices, azimute, extensão e tipo de limite.
- [ ] Editar confrontante do processo e cadastro mestre.
- [ ] Confirmar comportamento de duplicidades.
- [ ] Validar autorização para edição/exclusão por outro usuário autenticado.

## 10. Processo e peças técnicas

- [ ] Criar processo com nome e procedimento.
- [ ] Vincular proprietário e imóvel.
- [ ] Adicionar múltiplos confrontantes.
- [ ] Salvar, recarregar e reabrir o processo.
- [ ] Confirmar que o processo é local e testar perda/sincronização entre dispositivos.
- [ ] Conferir todos os campos obrigatórios antes de gerar documentos.

### Memorial

- [ ] Gerar memorial DOCX.
- [ ] Abrir no Word/LibreOffice sem corrupção.
- [ ] Conferir identificação do imóvel e proprietário.
- [ ] Conferir área, perímetro, SIGEF, datum e responsável técnico.
- [ ] Conferir caminhamento, vértices, azimutes, distâncias e confrontações.
- [ ] Verificar cabeçalho, rodapé, paginação, tabelas e estilos contra o modelo original.

### Requerimento

- [ ] Gerar requerimento DOCX.
- [ ] Conferir procedimento e fundamentação selecionada.
- [ ] Conferir proprietário, imóvel, matrícula, CNS, SNCR, área e perímetro.
- [ ] Conferir local/data e campos não preenchidos.
- [ ] Comparar fidelidade com o template original.

### Declarações de limite

- [ ] Gerar uma declaração por confrontante.
- [ ] Conferir nome seguro e único dos arquivos.
- [ ] Conferir dados dos dois imóveis e partes.
- [ ] Conferir trecho, vértices, extensão e limite.
- [ ] Confirmar que o croqui ainda é pendente; não aprovar como completo se aparecer apenas marcador textual.
- [ ] Comparar fidelidade com o template original.

### Quadro de confrontantes

- [ ] Gerar quadro DOCX.
- [ ] Conferir todas as colunas e linhas.
- [ ] Testar muitos confrontantes e quebra de página.
- [ ] Conferir caracteres, acentuação e largura das tabelas.

## 11. Desktop

- [ ] Testar largura ampla e notebook.
- [ ] Conferir sidebar, formulários, tabelas e mapa.
- [ ] Testar zoom do navegador em 80%, 100%, 125% e 150%.
- [ ] Confirmar desenho Leaflet com mouse.
- [ ] Confirmar downloads e popups.
- [ ] Verificar console sem erros críticos.

## 12. Celular

- [ ] Testar Android/Chrome e iPhone/Safari, quando disponíveis.
- [ ] Conferir navegação, botões, formulários e rolagem.
- [ ] Confirmar mapa utilizável por toque.
- [ ] Confirmar upload de arquivo pelo dispositivo.
- [ ] Gerar/abrir PDF e DOCX.
- [ ] Testar orientação vertical e horizontal.
- [ ] Instalar PWA e reabrir em modo standalone.

## 13. Tablet

- [ ] Testar orientação vertical e horizontal.
- [ ] Conferir sidebar e painéis sem sobreposição.
- [ ] Testar mapa, desenho, upload e tabelas.
- [ ] Gerar PDF.
- [ ] Instalar e executar PWA.

## 14. PWA e atualização

- [ ] Confirmar manifest, ícones e nome.
- [ ] Confirmar registro do Service Worker em HTTPS/produção.
- [ ] Testar primeira instalação.
- [ ] Testar abertura offline do shell já visitado.
- [ ] Confirmar que funções online informam indisponibilidade sem corromper dados.
- [ ] Publicar novo Preview controlado e confirmar atualização do cache.
- [ ] Verificar se o identificador antigo `longitude-geo-v72-4` causa conteúdo obsoleto.

## 15. Registro final

- [ ] Listar itens aprovados, reprovados, bloqueados e não executados.
- [ ] Anexar evidências e passos de reprodução.
- [ ] Registrar impacto e possibilidade de regressão.
- [ ] Não declarar a versão validada enquanto houver item obrigatório reprovado ou não executado.
- [ ] Atualizar `CURRENT_STATE.md` somente após validação autorizada.

## 16. Averbação GEO

- [ ] Abrir **Averbação GEO** pelo menu em desktop, tablet e celular.
- [ ] Criar, salvar, recarregar e reabrir Projeto GEO.
- [ ] Importar PDF SIGEF pesquisável autorizado e conferir cada campo extraído.
- [ ] Importar PDF sem texto e confirmar fallback sem dados inventados.
- [ ] Importar KML, GeoJSON e SHP/ZIP e conferir enquadramento do perímetro.
- [ ] Alternar mapa, satélite e fundo branco.
- [ ] Comparar área e perímetro com fonte técnica independente.
- [ ] Conferir vértices, agrupamento de confrontantes, mensagens e checklist.
- [ ] Confirmar ausência de erros no console.
- [x] Executar `npm test` para o parser e validação (9 testes aprovados na implementação inicial).
- [x] Executar `npm run build` (aprovado na implementação inicial, com aviso de tamanho de chunk).
- [x] Validar por testes automatizados número brasileiro, quebras de linha, registros incompletos, ambiguidades, UTM, latitude/longitude e área divergente (17 testes aprovados).
- [ ] Importar Memorial SIGEF real autorizado e registrar padrões ainda não reconhecidos no diagnóstico técnico.
- [x] Executar fixture realista com códigos `G61-M-XXXX`, DMS multilinha, altitude, segmentos e confrontantes (19/19 testes aprovados após correções).
- [ ] Repetir manualmente o ciclo PDF → Geometria → KML → abas → mapa-base → novo arquivo e confirmar ausência do erro Leaflet.
- [ ] Validar consulta por certificação em ambiente com acesso à fonte pública SIGEF.
- [x] Validar reconstrução fechada de cinco segmentos a partir de cinco vértices, sem preenchimento fictício dos atributos.
- [x] Validar `Município/UF`, `Proprietário(a)`, `Responsável Técnico(a)`, matrícula e sistema geodésico em fixture textual.
- [x] Validar status `DIFERENÇA A CONFERIR` e diferenças em ha, m², metros e percentuais sem tolerância configurada.
- [x] Separar no diagnóstico segmentos extraídos do Memorial e segmentos reconstruídos geometricamente.
- [x] Exibir azimute/distância documentais e calculados em campos distintos, sem usar o cálculo como dado documental.
- [ ] Reimportar o Memorial real e copiar a seção `Estrutura bruta dos segmentos` para identificar o arranjo exato entregue pelo PDFJS.
- [ ] Confirmar no Memorial real a extração de azimute, distância e confrontante para cada um dos cinco trechos.
- [ ] Confirmar no texto bruto do Memorial real o padrão de Município/UF; manter como não identificado enquanto o padrão não estiver comprovado.
- [x] Preservar página, X, Y, largura, altura e texto dos itens PDF para diagnóstico de layout.
- [x] Validar em fixture espacial cinco segmentos documentais com azimute, distância e confrontante associados à linha correta.
- [x] Validar `Nossa Senhora do Livramento-MT` e `Matrícula do imóvel: 103328` sem confusão com CNS/parcela.
- [ ] Reimportar o Memorial CHACARA CANAA e confirmar a posição real das colunas em `VER ITENS PDF` e `VER LINHAS RECONSTRUÍDAS`.
