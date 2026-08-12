# Roadmap — Longitude Geo Intelligence

Documento canônico de planejamento. Itens marcados representam planejamento ou necessidade de validação, não garantia de implementação. Consulte [CURRENT_STATE.md](CURRENT_STATE.md) para o estado validado e [docs/MASTER_SPEC.md](docs/MASTER_SPEC.md) para o escopo técnico.

## V74.1.3 — Base atual

### Confirmado

- [x] Login
- [x] Cloud por coordenada
- [x] Cloud por KML
- [x] PDF da Cloud
- [x] Deploy Vercel
- [x] PWA
- [x] Acesso móvel

### A validar

- [ ] Proprietário por CPF/CNPJ
- [ ] Pesquisa de imóvel
- [ ] Pesquisa de confrontante
- [ ] Banco mestre
- [ ] Memorial
- [ ] Requerimento
- [ ] Declarações
- [ ] Quadro de confrontantes
- [ ] Fidelidade dos templates DOCX

---

## V75 — Processo Inteligente

### Núcleo Averbação GEO — implementado, aguardando validação funcional

- [x] Entrada e tela de Projeto GEO
- [x] Upload e extração de texto nativo de Memorial SIGEF PDF
- [x] Modelo normalizado e persistência local com reabertura
- [x] Reconstrução e validação de geometria geográfica
- [x] Mapa, vértices, confrontantes, documentos e checklist
- [ ] Validar memoriais SIGEF reais autorizados e ampliar variações do parser
- [ ] Sincronizar Projeto GEO no Supabase após confirmar schema e RLS
- [ ] Implementar parser assistido de matrícula
- [ ] Habilitar geração validada das peças cartoriais prioritárias

- [ ] Cadastro central de processo
- [ ] Número automático do processo
- [ ] Cliente vinculado
- [ ] Imóvel vinculado
- [ ] Proprietários vinculados
- [ ] Confrontantes vinculados
- [ ] Consultas territoriais vinculadas
- [ ] Documentos vinculados
- [ ] Histórico de alterações
- [ ] Status do processo
- [ ] Checklist do processo
- [ ] Upload de documentos
- [ ] Painel de andamento

---

## V76 — Banco Mestre

- [ ] Unificar clientes e proprietários
- [ ] Evitar duplicidade de CPF/CNPJ
- [ ] Cadastro completo de imóveis
- [ ] Matrículas
- [ ] CNS
- [ ] SNCR
- [ ] SIGEF
- [ ] CAR
- [ ] Cartórios
- [ ] Municípios
- [ ] Confrontantes
- [ ] Profissionais

---

## V77 — Automação Documental

- [ ] Memorial descritivo
- [ ] Requerimento
- [ ] Declaração de limites
- [ ] Carta de anuência
- [ ] Quadro de confrontantes
- [ ] Procuração
- [ ] Ofício
- [ ] Checklist
- [ ] Relatório técnico
- [ ] Gestão de templates
- [ ] Validação de campos obrigatórios

---

## V78 — Inteligência Territorial

- [ ] SIGEF nacional
- [ ] CAR
- [ ] INTERMAT
- [ ] Unidades de conservação
- [ ] Terras indígenas
- [ ] Assentamentos
- [ ] Quilombos
- [ ] Hidrografia
- [ ] Rodovias
- [ ] Municípios
- [ ] Imagens históricas
- [ ] Exportação KML
- [ ] Exportação GeoJSON
- [ ] Exportação Shapefile

---

## V79 — Gestão Comercial

- [ ] Orçamentos
- [ ] Contratos
- [ ] Financeiro
- [ ] Agenda
- [ ] Protocolos
- [ ] Controle de pagamentos
- [ ] Histórico de clientes

---

## V80 — Inteligência Artificial

- [ ] Análise de notas devolutivas
- [ ] Checklist automático
- [ ] Geração assistida de requerimentos
- [ ] Análise de impedimentos
- [ ] Consulta ao histórico do processo
- [ ] Base normativa
- [ ] Assistente fundiário especializado
