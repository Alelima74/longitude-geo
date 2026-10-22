const labels = {
  PENDING: "Pendente", AVAILABLE: "Disponível", CONFIRMED: "Confirmado", NOT_APPLICABLE: "Não aplicável", REVIEW_REQUIRED: "Revisão necessária", READY: "Pronto", NOT_READY: "Não pronto",
  STATE_CORE: "Exigência estadual", CONDITIONAL: "Condicional", REGISTRY_PROFILE: "Exigência do cartório",
  STATE_BASE: "Norma estadual", BOUNDARY_RULE: "Regra de confrontação", MANUAL: "Inserido manualmente",
  SIGEF_MEMORIAL: "Memorial SIGEF", REGISTRY_CONFIRMED: "Matrícula confirmada", MATRICULA_CONFIRMADA: "Matrícula confirmada", MANUAL_CONFIRMED: "Confirmação manual",
  OCR_REGISTRY_DOCUMENT:"Leitura da matrícula por OCR",REGISTRY_DOCUMENT:"Documento da matrícula",DRAFT:"Rascunho",SIGNED:"Assinada",FILED:"Protocolada",NOTIFIED:"Notificado",ACKNOWLEDGED:"Anuiu",CONTESTED:"Impugnou",NO_RESPONSE:"Prazo transcorrido sem manifestação",
  NATURAL_PERSON:"Pessoa física",LEGAL_ENTITY:"Pessoa jurídica",POSSEIRO_OCUPANTE:"Posseiro / ocupante",IMOVEL_PRIVADO:"Imóvel particular",OWNER:"Proprietário",POSSESSOR:"Possuidor",OCCUPANT:"Ocupante",PROMISSORY_BUYER:"Promitente comprador",
  CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa",
  SYSTEM: "Sistema", DOCUMENT: "Documento", MEMORIAL: "Memorial", OCR: "Reconhecimento de texto",
};

export function ptBR(value, fallback = "Não informado") { return labels[value] || value || fallback; }
export function statusLabel(value) { return ptBR(value); }
export function requirementLabel(value) { return ptBR(value); }
export function sourceLabel(value) { return ptBR(value); }
export function priorityLabel(value) { return ptBR(value); }
export function notificationStatusLabel(value){return ({DRAFT:"Rascunho",READY:"Pronta para assinatura",SIGNED:"Assinada",FILED:"Protocolada",NOTIFIED:"Notificado",ACKNOWLEDGED:"Anuiu",CONTESTED:"Impugnou",NO_RESPONSE:"Prazo transcorrido sem manifestação"})[value]||ptBR(value);}
export function boundaryTypeLabel(value){return ptBR(value);}
export function translateInternalValue(value){return ptBR(value);}

export const checklistFilters = [
  ["TODOS", "Todos"], ["PENDENTES", "Pendentes"], ["PRONTOS", "Prontos"], ["CONDICIONAIS", "Condicionais"], ["CARTÓRIO", "Cartório"], ["CONFRONTANTES", "Confrontantes"], ["ÓRGÃOS", "Órgãos públicos"],
];
