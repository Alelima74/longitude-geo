# Checklist Cartorial Inteligente

O checklist do Averbação GEO é derivado do projeto por `evaluateCartorialChecklist`. Ele não substitui documentos, não presume exigências jurídicas universais e não altera o parser SIGEF, a geometria ou as peças técnicas existentes.

## Níveis de requisito

- `STATE_CORE`: núcleo-base do procedimento, como Requerimento, Memorial certificado, planta externa, responsabilidade técnica, CCIR, regularidade ITR e certidão da matrícula.
- `CONDITIONAL`: nasce de uma condição verificável do projeto, como pessoa jurídica, procurador ou tipo de confrontante.
- `REGISTRY_PROFILE`: exigência configurada pela serventia, incluindo CAR, Laudo Técnico e documentos adicionais do responsável técnico.

Os estados são `PENDING`, `AVAILABLE`, `CONFIRMED`, `NOT_APPLICABLE` e `REVIEW_REQUIRED`. Cada item contém motivo, fonte da regra, documentos vinculados, validade opcional e trilha de auditoria.

## Motor de confrontações

`evaluateBoundaryRequirements` normaliza os tipos documentais e manuais. Imóvel privado pode gerar anuência; posse gera anuência do ocupante; vias municipais, estaduais e federais sugerem manifestação do órgão e Laudo de Via; servidão exige revisão de natureza e beneficiário; terras públicas e unidades de conservação sugerem o órgão configurável; terra indígena gera requisito FUNAI e alerta crítico; rios e cursos d'água geram laudo e revisão de dominialidade sem presumir navegabilidade, APP, largura ou titularidade.

No perfil-base de Mato Grosso, os órgãos apenas sugeridos são SINFRA/MT, INTERMAT e SEMA/MT. Em situações federais são sugeridos DNIT, INCRA, SPU, ICMBio ou FUNAI conforme o tipo, sempre admitindo revisão.

## Perfis de cartório

`RegistryOfficeProfile` registra identificação da serventia, requisitos padrão, overrides condicionais, regras de validade, observações e estado ativo. Sem perfil específico, aplica-se `MATO_GROSSO_GEO_BASE`, composto apenas pelo núcleo estadual e regras condicionais.

CAR e Laudo Técnico não são exigências universais. O perfil pode marcá-los como obrigatórios; o Laudo também pode ser ativado por confrontação especial. Prazos ficam em `validityRules` ou `validityDays`, nunca como constantes universais.

## Prontidão e alertas

`calculateProtocolReadiness` retorna:

- `NOT_READY`: existe requisito obrigatório pendente;
- `REVIEW_REQUIRED`: requisito obrigatório depende de revisão;
- `READY`: todos os requisitos obrigatórios estão `AVAILABLE` ou `CONFIRMED`, desconsiderando os validamente não aplicáveis.

Na interface, `READY` é exibido como “Pronto para revisão final”, acompanhado do aviso de que o profissional deve conferir o procedimento antes do protocolo.

Alertas recebem prioridade `CRITICAL`, `HIGH`, `MEDIUM` ou `LOW`. A matrícula não confirmada, confrontações públicas, terra indígena, pendências e documentos vencidos são avaliados automaticamente.

## Dossiê

Itens `AVAILABLE` ou `CONFIRMED` com `documentIds` podem ser obtidos por `dossierItemsFromChecklist`. A montagem mantém capa, índice e checklist antes das peças e documentos de suporte. A seleção manual continua disponível para revisão profissional.

## Auditoria

Alterações manuais usam `applyChecklistOverride` e registram ator, data, mudança e fonte `MANUAL`, além do `auditTrail` geral do Projeto GEO. Requisitos derivados identificam sua origem como `STATE_BASE`, `BOUNDARY_RULE`, `REGISTRY_PROFILE` ou `MANUAL`.
