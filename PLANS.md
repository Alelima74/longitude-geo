# Planos de Execução

Documento canônico para planos de implementação extensos. O estado validado permanece em [CURRENT_STATE.md](CURRENT_STATE.md), e o planejamento de versões em [ROADMAP.md](ROADMAP.md).

Este arquivo deve ser utilizado para tarefas extensas, que envolvam
vários arquivos, banco de dados ou mais de uma etapa de desenvolvimento.

## Regras

Antes de implementar uma funcionalidade grande, o agente deve registrar:

- objetivo;
- diagnóstico;
- arquivos envolvidos;
- alterações no banco;
- riscos;
- etapas;
- testes;
- plano de rollback.

## Plano ativo

### Averbação GEO — primeira entrega

Status: implementado localmente; validação funcional em navegador pendente.

- objetivo: transformar Memorial SIGEF ou geometria em Projeto GEO rastreável;
- banco: nenhuma migration; persistência local compatível com processos técnicos existentes;
- arquivos: novo módulo isolado em `src/modules/geoRegistry`, integração pontual no menu e dependência `pdfjs-dist`;
- riscos: diversidade dos memoriais, indisponibilidade da fonte pública, persistência apenas local e bundle maior;
- rollback: remover a entrada/importação do módulo e seus arquivos, sem afetar mapa ou dados legados;
- testes: parser/validação automatizados e build aprovados; teste visual/manual pendente.

### V75 — Processo Inteligente

Status: planejamento

#### Objetivo

Criar um módulo central onde cada serviço seja tratado como um processo,
reunindo cliente, imóvel, proprietários, confrontantes, consultas,
documentos, histórico e status.

#### Antes de implementar

- mapear tabelas existentes;
- identificar cadastros duplicados;
- localizar serviços e componentes atuais;
- identificar relacionamento entre imóveis e proprietários;
- conferir as políticas RLS;
- verificar compatibilidade com produção;
- elaborar migration não destrutiva.

#### Entregas previstas

- tabela de processos;
- relacionamento com cliente;
- relacionamento com imóvel;
- status;
- histórico;
- tela de listagem;
- tela de detalhes;
- criação de processo;
- edição;
- vinculação de documentos;
- checklist;
- testes responsivos.
