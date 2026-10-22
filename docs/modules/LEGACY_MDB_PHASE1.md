# Importação MDB - diagnóstico da Fase 1

Fonte analisada em 17/08/2026: `C:\Program Files (x86)\Métrica\Métrica TOPO\Cadastro.mdb`. SHA-256 da cópia de análise: `80414D3325596F53DB54FD90822DA7C2905286356D11F023348F7C1A105881CE`. A leitura foi realizada por Jet OLEDB em uma cópia temporária; o arquivo original e os dados do Longitude não foram alterados.

## Schema real e contagens

| Tabela | Registros | Campos encontrados |
|---|---:|---|
| CadCliente | 207 | Codigo_Cliente, Razao_Social, Fantasia, CNPJ, IE, Nome, CPF, RG, Endereco, Cidade, UF, CEP, Fone, Fax, Email, CODCLIEVN, orgex |
| CadEmpresa | 3 | Codigo_Empresa, Razao_Social, CNPJ, IE, Fantasia, Endereco, Cidade, UF, CEP, Fone, Fax, Email, Responsavel, Qualificacao, CPF, RG, CREA, Codigo_Credenciado, Selecionado, CODEMPEVN, orgex, Tipo_Conselho |
| CadImovel | 7.524 | CodigoImovel, NomeImovel, Endereco, BAIRRO, Cidade, Estado, Incra, CODIMOEVN, IPTU, Lote, Quadra, Cadastro, Area, Perimetro, Codigo_SIGEF |
| CadMatricula | 7.536 | CodigoMatricula, CodigoImovel, Numero, Tipo, Folha, Livro, Comarca, Estado, NomeCRI, CNS, CODMATEVN, NaturezaIterpa, LocalizacaoIterpa, ComunidadeIterpa, GlebaIterpa, ColoniaIterpa, LotesIterpa, Processositerpa, CodigoIterpa, MemorialNIterpa, DeclinacaoMagneticaIterpa, NorteConfrontante, SulConfrontante, LesteConfrontante, OesteConfrontante, AreaAverbada, AreadeAPP, AreaDemarcada, AreaDeduzida, AreaLT |
| CadProprietario | 7.529 | CodigoProp, CodigoImovel, NomeProp, Nacionalidade, Profissao, Endereco, Cidade, Estado, RG, CPF_CIC, Est_Civil, Conjuge, RG_Conjuge, CPF_CIC_Conjuge, Reg_Uniao, CODPROEVN, TIPO, orgexprop, orgexconj, Contato_CNPJ |
| CadServico | 209 | CodigoServico, CodigoCliente, Levantamento, Finalidade, EquipUtilizado, EquipeDeCampo, EquipeDeEscritorio, AreaAproximada, ART, Data, CODSEREVN, Tipo_Responsabilidade |

Total: 6 tabelas e 23.008 registros.

## Relações recuperadas

- CadMatricula.CodigoImovel -> CadImovel.CodigoImovel: 7.536 vínculos, nenhum órfão.
- CadProprietario.CodigoImovel -> CadImovel.CodigoImovel: 7.529 vínculos, nenhum órfão.
- CadServico.CodigoCliente -> CadCliente.Codigo_Cliente: 204 vínculos e 5 órfãos.
- Total de relações recuperadas: 15.269.

## Incompletudes e duplicidades potenciais

- 2 clientes sem Nome e Razao_Social; 3 imóveis sem NomeImovel; 91 matrículas sem Numero; 50 proprietários sem NomeProp.
- Nenhuma matrícula ou proprietário sem CodigoImovel.
- 20 grupos repetidos em CadCliente.CPF, 1 em CadCliente.CNPJ, 1.337 em CadImovel.NomeImovel e 239 em CadProprietario.CPF_CIC.
- Nomes repetidos de imóveis são apenas candidatos a conflito; não serão mesclados automaticamente.

## Mapeamento e preservação

O preset executável está em `src/legacy-import/presets/metricaTopo.mjs`. Campos operacionais sem correspondência canônica direta permanecem em `legacy_raw_data`, incluindo IE, Fax, códigos EVN, Selecionado, MemorialNIterpa, DeclinacaoMagneticaIterpa e confrontantes cardeais antigos. Valores numéricos originais de área e perímetro possuem colunas próprias para o texto original.

## Resultado da simulação

- Clientes: 207 encontrados; 205 sem campos essenciais vazios.
- Organizações/técnicos: 3 encontrados.
- Imóveis: 7.524 encontrados; 7.521 sem nome vazio.
- Matrículas: 7.536 encontradas; 7.445 com número informado.
- Proprietários: 7.529 encontrados; 7.479 com nome informado.
- Serviços: 209 encontrados; 204 vinculados diretamente a clientes.
- Escritas realizadas: zero. A importação definitiva pertence à Fase 2.

## PostgreSQL proposto

A migration `supabase/14_legacy_import_foundation_v74_1.sql` cria de forma aditiva o modelo canônico multi-organização, histórico de importação, auditoria, soft delete, índices, chaves legadas idempotentes e RLS. Ela não foi aplicada a nenhum ambiente nesta fase.
