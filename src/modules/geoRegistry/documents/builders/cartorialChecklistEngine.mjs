export const REQUIRED_LEVELS = { STATE_CORE: "STATE_CORE", CONDITIONAL: "CONDITIONAL", REGISTRY_PROFILE: "REGISTRY_PROFILE" };
export const REQUIREMENT_STATUSES = ["PENDING", "AVAILABLE", "CONFIRMED", "NOT_APPLICABLE", "REVIEW_REQUIRED"];
export const REQUIREMENT_SOURCES = ["STATE_BASE", "BOUNDARY_RULE", "REGISTRY_PROFILE", "MANUAL"];

export const CHECKLIST_CATEGORIES = ["PROPRIETÁRIO / REPRESENTAÇÃO", "REGISTRO", "SIGEF / TÉCNICO", "CADASTRO RURAL", "CONFRONTANTES", "ÓRGÃOS PÚBLICOS", "TERCEIROS INTERESSADOS", "PEÇAS CARTORIAIS", "EXIGÊNCIAS DO CARTÓRIO", "FINALIZAÇÃO"];

export const MATO_GROSSO_GEO_BASE = {
  id: "MATO_GROSSO_GEO_BASE", name: "Mato Grosso — Averbação GEO (base)", city: "", state: "MT", cns: "", registryOfficeNumber: "", active: true,
  defaultRequirements: [], conditionalOverrides: [], validityRules: {}, notes: "Núcleo estadual e regras condicionais; não contém exigências locais universais.",
};

const clean = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/gi, " ").trim().toUpperCase();
const docText = (document) => clean(`${document.category} ${document.type} ${document.name}`);
const hasDocument = (documents, terms) => documents.some((document) => terms.some((term) => docText(document).includes(clean(term))));
const item = (id, title, category, requiredLevel, status, source, reason, extra = {}) => ({ id, title, category, requiredLevel, condition: extra.condition || "ALWAYS", status, source, reason, documentId: extra.documentId || null, documentIds: extra.documentIds || [], notes: extra.notes || "", issuedAt: extra.issuedAt || null, expiresAt: extra.expiresAt || null, validityDays: extra.validityDays ?? null, required: extra.required !== false, action: extra.action || null, boundaryId: extra.boundaryId || null, ruleId: extra.ruleId || id, profileId: extra.profileId || null });
const available = (value) => value ? "AVAILABLE" : "PENDING";

export function normalizeBoundaryType(type, name = "") {
  const aliases = { IMOVEL_PRIVADO: "PRIVATE_PROPERTY", ESTRADA_MUNICIPAL: "MUNICIPAL_ROAD", RODOVIA_ESTADUAL: "STATE_HIGHWAY", RODOVIA_FEDERAL: "FEDERAL_HIGHWAY", ESTRADA_SERVIDAO: "EASEMENT_ROAD", RIO: "RIVER", CORREGO: "STREAM", RIBEIRAO: "WATERCOURSE", LAGO: "WATERCOURSE", CANAL: "WATERCOURSE", AREA_PUBLICA: "PUBLIC_STATE" };
  if (aliases[type]) return aliases[type];
  const valid = ["PRIVATE_PROPERTY", "POSSESSION", "MUNICIPAL_ROAD", "STATE_HIGHWAY", "FEDERAL_HIGHWAY", "EASEMENT_ROAD", "PUBLIC_MUNICIPAL", "PUBLIC_STATE", "PUBLIC_FEDERAL", "STATE_CONSERVATION_UNIT", "FEDERAL_CONSERVATION_UNIT", "INDIGENOUS_LAND", "FEDERAL_RIVER", "WATERCOURSE", "RIVER", "STREAM", "OTHER"];
  if (valid.includes(type)) return type;
  const value = clean(name);
  if (/\bBR \d+/.test(value)) return "FEDERAL_HIGHWAY";
  if (/\bMT \d+/.test(value) || value.includes("RODOVIA ESTADUAL")) return "STATE_HIGHWAY";
  if (value.includes("ESTRADA DE SERVIDAO")) return "EASEMENT_ROAD";
  if (value.includes("ESTRADA MUNICIPAL")) return "MUNICIPAL_ROAD";
  if (value.includes("TERRA INDIGENA")) return "INDIGENOUS_LAND";
  if (value.includes("RIO FEDERAL")) return "FEDERAL_RIVER";
  if (value.includes("CORREGO")) return "STREAM";
  if (value.includes("RIBEIRAO") || value.includes("CURSO D AGUA")) return "WATERCOURSE";
  if (/\bRIO\b/.test(value)) return "RIVER";
  return "PRIVATE_PROPERTY";
}

export function evaluateBoundaryRequirements(boundary, profile = MATO_GROSSO_GEO_BASE) {
  const type = normalizeBoundaryType(boundary.boundaryType, boundary.boundaryName);
  const id = `${boundary.fromVertex || "inicio"}-${boundary.toVertex || "fim"}`;
  const reason = (label) => `Trecho ${boundary.fromVertex || "?"} → ${boundary.toVertex || "?"} confronta com ${boundary.boundaryName || label}.`;
  const result = [];
  if (type === "PRIVATE_PROPERTY") {
    result.push(item(`boundary-consent-${id}`, "Declaração / anuência de confrontante", "CONFRONTANTES", "CONDITIONAL", "PENDING", "BOUNDARY_RULE", "Confrontante particular identificado no Memorial.", { boundaryId: id, condition: "boundaryType = PRIVATE_PROPERTY", action: "GERAR_PECA" }));
    if (boundary.additionalData?.married === true || boundary.married === true) result.push(item(`boundary-spouse-${id}`, "Revisar assinatura do cônjuge do confrontante", "CONFRONTANTES", "CONDITIONAL", "REVIEW_REQUIRED", "BOUNDARY_RULE", "Confrontante marcado como casado; a necessidade de assinatura deve ser revisada.", { boundaryId: id }));
  }
  if (type === "POSSESSION") result.push(item(`occupant-consent-${id}`, "Anuência do ocupante / posseiro", "CONFRONTANTES", "CONDITIONAL", "PENDING", "BOUNDARY_RULE", reason("posseiro"), { boundaryId: id, action: "GERAR_PECA" }));
  const publicRules = {
    MUNICIPAL_ROAD: ["Certidão / manifestação municipal", "PREFEITURA / MUNICÍPIO", "CONFRONTAÇÃO COM VIA MUNICIPAL"],
    STATE_HIGHWAY: ["Certidão / manifestação do órgão estadual", profile.state === "MT" ? "SINFRA/MT" : "ÓRGÃO ESTADUAL A CONFIRMAR", "RODOVIA ESTADUAL IDENTIFICADA"],
    FEDERAL_HIGHWAY: ["Certidão / manifestação do órgão federal", "DNIT", "RODOVIA FEDERAL IDENTIFICADA"],
    PUBLIC_MUNICIPAL: ["Certidão / manifestação do Município", "PREFEITURA / MUNICÍPIO", "TERRA PÚBLICA MUNICIPAL IDENTIFICADA"],
    PUBLIC_STATE: ["Certidão / manifestação do órgão estadual", profile.state === "MT" ? "INTERMAT" : "ÓRGÃO ESTADUAL A CONFIRMAR", "TERRA PÚBLICA ESTADUAL IDENTIFICADA"],
    PUBLIC_FEDERAL: ["Manifestação / certidão do órgão federal competente", "INCRA / SPU / OUTRO", "TERRA PÚBLICA FEDERAL IDENTIFICADA"],
    STATE_CONSERVATION_UNIT: ["Manifestação / certidão ambiental estadual", profile.state === "MT" ? "SEMA/MT" : "ÓRGÃO AMBIENTAL ESTADUAL", "UNIDADE DE CONSERVAÇÃO ESTADUAL IDENTIFICADA"],
    FEDERAL_CONSERVATION_UNIT: ["Manifestação do órgão federal competente", "ICMBio / SPU / OUTRO", "UNIDADE DE CONSERVAÇÃO FEDERAL IDENTIFICADA"],
    INDIGENOUS_LAND: ["Manifestação / certidão FUNAI", "FUNAI", "TERRA INDÍGENA IDENTIFICADA COMO CONFRONTANTE"],
    FEDERAL_RIVER: ["Manifestação / certidão do órgão federal", "SPU / OUTRO", "RIO FEDERAL IDENTIFICADO"],
  };
  if (publicRules[type]) { const [title, agency, alert] = publicRules[type]; result.push(item(`agency-${type}-${id}`, title, "ÓRGÃOS PÚBLICOS", "CONDITIONAL", "PENDING", "BOUNDARY_RULE", `${reason(type)} Órgão sugerido: ${agency}.`, { boundaryId: id, notes: alert, action: "ANEXAR_DOCUMENTO" })); }
  if (["MUNICIPAL_ROAD", "STATE_HIGHWAY", "FEDERAL_HIGHWAY"].includes(type)) result.push(item(`road-report-${id}`, "Laudo técnico de confrontação com via", "PEÇAS CARTORIAIS", "CONDITIONAL", "AVAILABLE", "BOUNDARY_RULE", reason(type), { boundaryId: id, action: "GERAR_PECA" }));
  if (type === "EASEMENT_ROAD") { result.push(item(`easement-review-${id}`, "Analisar estrada de servidão e beneficiário", "CONFRONTANTES", "CONDITIONAL", "REVIEW_REQUIRED", "BOUNDARY_RULE", `${reason("estrada de servidão")} Não presumir natureza pública.`, { boundaryId: id })); result.push(item(`easement-report-${id}`, "Laudo técnico de via / servidão", "PEÇAS CARTORIAIS", "CONDITIONAL", "AVAILABLE", "BOUNDARY_RULE", reason("estrada de servidão"), { boundaryId: id, action: "GERAR_PECA" })); }
  if (["RIVER", "STREAM", "WATERCOURSE", "FEDERAL_RIVER"].includes(type)) { result.push(item(`water-report-${id}`, "Laudo técnico de confrontação com curso d'água", "PEÇAS CARTORIAIS", "CONDITIONAL", "AVAILABLE", "BOUNDARY_RULE", reason(type), { boundaryId: id, action: "GERAR_PECA" })); result.push(item(`water-domain-${id}`, "Verificar dominialidade / órgão competente", "ÓRGÃOS PÚBLICOS", "CONDITIONAL", "REVIEW_REQUIRED", "BOUNDARY_RULE", "Curso d'água identificado; navegabilidade, APP, largura e dominialidade não foram presumidas.", { boundaryId: id })); }
  if (boundary.additionalData?.oppositeBankBoundary === true || boundary.oppositeBankBoundary === true) result.push(item(`opposite-bank-${id}`, "Revisar confrontante da margem oposta", "CONFRONTANTES", "CONDITIONAL", "REVIEW_REQUIRED", "BOUNDARY_RULE", "Existe imóvel confrontante além do curso d'água.", { boundaryId: id }));
  const memorialName = boundary.boundaryNameMemorial || boundary.originalData?.boundaryName || boundary.boundaryName;
  const registryName = boundary.boundaryNameRegistry || boundary.additionalData?.boundaryNameRegistry;
  if (memorialName && registryName && clean(memorialName) !== clean(registryName)) result.push(item(`boundary-name-divergence-${id}`, "Comprovar vínculo e domínio do confrontante", "CONFRONTANTES", "CONDITIONAL", "REVIEW_REQUIRED", "BOUNDARY_RULE", `Divergência entre Memorial (${memorialName}) e registro (${registryName}); não foi definido automaticamente qual nome está correto.`, { boundaryId: id }));
  return result;
}

function stateCore(project, documents) {
  const generated = new Set((project.generatedDocuments || []).map((entry) => entry.type || entry.id));
  return [
    item("request", "Requerimento de averbação", "PEÇAS CARTORIAIS", "STATE_CORE", available(generated.has("request")), "STATE_BASE", "Peça-base do procedimento de averbação."),
    item("owner-boundary-declaration", "Declaração do proprietário sobre respeito aos limites", "PROPRIETÁRIO / REPRESENTAÇÃO", "STATE_CORE", "PENDING", "STATE_BASE", "Declaração do proprietário do imóvel objeto; não se confunde com anuência de confrontante."),
    item("sigef-memorial", "Memorial descritivo certificado SIGEF", "SIGEF / TÉCNICO", "STATE_CORE", available(hasDocument(documents,["MEMORIAL"]) && Boolean(project.sigef?.certificationId || project.memorial?.sigef?.certificationId)), "STATE_BASE", "Memorial importado e certificação/UUID devem estar disponíveis."),
    item("external-plant", "Planta georreferenciada externa", "SIGEF / TÉCNICO", "STATE_CORE", available(hasDocument(documents,["PLANTA"])), "STATE_BASE", "A planta deve ser anexada externamente; não é gerada automaticamente nesta versão."),
    item("technical-responsibility", "Responsabilidade técnica — ART / TRT / RRT", "SIGEF / TÉCNICO", "STATE_CORE", available(hasDocument(documents,["ART","TRT","RRT"]) || Boolean(project.cartorialData?.["technical.responsibilityTerm"]?.value)), "STATE_BASE", "Comprovação da responsabilidade técnica do levantamento."),
    item("ccir", "CCIR do imóvel", "CADASTRO RURAL", "STATE_CORE", available(hasDocument(documents,["CCIR"])), "STATE_BASE", "Documento cadastral rural associado ao imóvel."),
    item("itr-regularity", "Regularidade ITR — comprovantes, CND ou CPEN", "CADASTRO RURAL", "STATE_CORE", available(hasDocument(documents,["ITR","CND","CPEN"])), "STATE_BASE", "Uma das alternativas documentais pode atender ao item; não são exigidas simultaneamente."),
    item("registry-full-copy", "Certidão de inteiro teor da matrícula", "REGISTRO", "STATE_CORE", available(hasDocument(documents,["MATRICULA","INTEIRO TEOR"])), "STATE_BASE", "Documento registral do imóvel; validade depende do perfil selecionado."),
    item("title-chain", "Certidão / documentação de cadeia dominial", "REGISTRO", "STATE_CORE", "REVIEW_REQUIRED", "STATE_BASE", "Necessidade deve ser confirmada conforme o procedimento."),
  ];
}

function conditionalOwner(project) {
  const ownerType = project.ownerType || project.cartorialData?.["owner.type"]?.value || "NATURAL_PERSON";
  const representation = project.representation || {};
  return [
    item("corporate-documents", "Documentos societários e representação", "PROPRIETÁRIO / REPRESENTAÇÃO", "CONDITIONAL", ownerType === "LEGAL_ENTITY" ? "PENDING" : "NOT_APPLICABLE", "STATE_BASE", ownerType === "LEGAL_ENTITY" ? "Proprietário identificado como pessoa jurídica." : "Proprietário não identificado como pessoa jurídica.", { condition: "ownerType = LEGAL_ENTITY", required: ownerType === "LEGAL_ENTITY" }),
    item("power-of-attorney", "Procuração e identificação do procurador", "PROPRIETÁRIO / REPRESENTAÇÃO", "CONDITIONAL", representation.exists ? "PENDING" : "NOT_APPLICABLE", "STATE_BASE", representation.exists ? "Representação por procurador informada no projeto." : "Não há representação por procurador informada.", { condition: "representation.exists = true", required: Boolean(representation.exists) }),
  ];
}

function generatedPieceRequirements(project, documents) {
  const generated = new Set((project.generatedDocuments || []).flatMap((entry) => [entry.id, entry.type]));
  const rows = [
    ["piece-request", "Requerimento gerado", generated.has("request") || Boolean(project.documentEdits?.request)],
    ["piece-memorial", "Memorial disponível", hasDocument(documents,["MEMORIAL"])],
    ["piece-coordinates", "Quadro de Coordenadas gerado", generated.has("coordinates")],
    ["piece-boundaries", "Quadro de Confrontantes gerado", generated.has("boundaries")],
    ["piece-consents", "Anuências geradas", generated.has("consents")],
    ["piece-technical-report", "Laudo Técnico gerado", generated.has("technicalReport")],
    ["piece-special-reports", "Laudos especiais gerados", generated.has("specialReports")],
    ["piece-comparison", "Quadro Comparativo gerado", generated.has("comparison")],
  ];
  return rows.map(([id,title,isAvailable]) => item(id,title,"PEÇAS CARTORIAIS","CONDITIONAL",available(isAvailable),"STATE_BASE",isAvailable?"Peça reconhecida nos documentos gerados/anexados do projeto.":"Peça ainda não registrada como gerada no projeto.",{required:false}));
}

function profileRequirements(profile) {
  if (!profile?.id || profile.id === MATO_GROSSO_GEO_BASE.id) return [];
  return (profile.defaultRequirements || []).filter((requirement) => !["car","technical-report"].includes(requirement.id)).map((requirement) => item(`profile-${requirement.id}`, requirement.title || requirement.id, requirement.category || "EXIGÊNCIAS DO CARTÓRIO", "REGISTRY_PROFILE", requirement.status || "PENDING", "REGISTRY_PROFILE", requirement.reason || `Exigência configurada no perfil ${profile.name}.`, { required: requirement.required !== false, profileId: profile.id, validityDays: requirement.validityDays ?? profile.validityRules?.[requirement.id] ?? null }));
}

export function evaluateCartorialChecklist(project, profile = project.registryOfficeProfile || project.cartorialProfile || MATO_GROSSO_GEO_BASE) {
  const documents = project.sourceDocuments || [];
  let items = [...stateCore(project, documents), ...conditionalOwner(project), ...generatedPieceRequirements(project, documents), ...(project.boundaries || []).flatMap((boundary) => evaluateBoundaryRequirements(boundary, profile)), ...profileRequirements(profile)];
  const carProfile = profile?.defaultRequirements?.find((entry) => entry.id === "car");
  items.push(item("car", "Cadastro Ambiental Rural — CAR", "CADASTRO RURAL", "REGISTRY_PROFILE", carProfile?.required ? available(hasDocument(documents,["CAR"])) : "REVIEW_REQUIRED", carProfile ? "REGISTRY_PROFILE" : "STATE_BASE", carProfile?.required ? `Exigido pelo perfil ${profile.name}.` : "Não é requisito estadual universal; confirmar perfil da serventia.", { required: Boolean(carProfile?.required), profileId: carProfile ? profile.id : null }));
  const specialBoundary = items.some((entry) => entry.source === "BOUNDARY_RULE" && entry.category === "ÓRGÃOS PÚBLICOS");
  const reportProfile = profile?.defaultRequirements?.find((entry) => entry.id === "technical-report");
  items.push(item("technical-report", "Laudo técnico para fins registrais", "PEÇAS CARTORIAIS", specialBoundary ? "CONDITIONAL" : "REGISTRY_PROFILE", specialBoundary || reportProfile?.required ? "AVAILABLE" : "REVIEW_REQUIRED", specialBoundary ? "BOUNDARY_RULE" : reportProfile ? "REGISTRY_PROFILE" : "STATE_BASE", specialBoundary ? "Ativado por confrontação especial." : reportProfile?.required ? `Exigido pelo perfil ${profile.name}.` : "Disponível para ativação manual ou por perfil.", { required: Boolean(specialBoundary || reportProfile?.required) }));
  items.push(item("rt-documents", "Documentos do responsável técnico", "EXIGÊNCIAS DO CARTÓRIO", "REGISTRY_PROFILE", "REVIEW_REQUIRED", profile?.id && profile.id !== MATO_GROSSO_GEO_BASE.id ? "REGISTRY_PROFILE" : "STATE_BASE", "RG, CPF, registro profissional, credenciamento e responsabilidade técnica são configuráveis por serventia.", { required: false, profileId: profile?.id || null }));
  for (const thirdParty of project.interestedParties || []) items.push(item(`interested-${thirdParty.id}`, `Análise de terceiro interessado — ${thirdParty.name || thirdParty.type}`, "TERCEIROS INTERESSADOS", "CONDITIONAL", thirdParty.requirementStatus || "REVIEW_REQUIRED", "MANUAL", `Terceiro interessado do tipo ${thirdParty.type} cadastrado no projeto.`, { required: thirdParty.requirementStatus !== "NOT_APPLICABLE" }));
  const overrides = project.checklistOverrides || {};
  items = items.map((entry) => { const override = overrides[entry.id]; if (!override) return entry; return { ...entry, ...override, source: override.source || entry.source, documentIds: override.documentIds || entry.documentIds, audit: [...(entry.audit || []), ...(override.audit || [])] }; });
  const alerts = buildCartorialAlerts(project, items);
  const readiness = calculateProtocolReadiness(items);
  return { profile, items, alerts, readiness, generatedAt: new Date().toISOString() };
}

export function calculateProtocolReadiness(items) {
  const required = items.filter((entry) => entry.required && entry.status !== "NOT_APPLICABLE");
  const accepted = new Set(["AVAILABLE", "CONFIRMED"]);
  const pending = required.filter((entry) => !accepted.has(entry.status));
  const review = required.filter((entry) => entry.status === "REVIEW_REQUIRED");
  return { state: pending.length ? (review.length ? "REVIEW_REQUIRED" : "NOT_READY") : "READY", completed: required.length - pending.length, total: required.length, percent: required.length ? Math.round((required.length - pending.length) / required.length * 100) : 100, disclaimer: "A conferência final deve ser realizada pelo profissional antes do protocolo." };
}

export function buildCartorialAlerts(project, items) {
  const alerts = [];
  if (project.registryState !== "CONFIRMED") alerts.push({ id: "registry-missing", priority: "HIGH", title: "Matrícula não importada ou não confirmada" });
  for (const entry of items.filter((item) => ["PENDING", "REVIEW_REQUIRED"].includes(item.status))) { let priority = entry.required ? "MEDIUM" : "LOW"; if (entry.id.includes("INDIGENOUS_LAND") || clean(entry.reason).includes("TERRA INDIGENA")) priority = "CRITICAL"; else if (entry.source === "BOUNDARY_RULE" && entry.category === "ÓRGÃOS PÚBLICOS") priority = "HIGH"; alerts.push({ id: `alert-${entry.id}`, priority, title: entry.title, reason: entry.reason, requirementId: entry.id }); }
  for (const entry of items.filter((item) => item.expiresAt && new Date(item.expiresAt) < new Date())) alerts.push({ id: `expired-${entry.id}`, priority: "HIGH", title: `Documento vencido: ${entry.title}`, requirementId: entry.id });
  return alerts;
}

export function applyChecklistOverride(project, requirementId, changes, actor = "USUÁRIO LOCAL", changedAt = new Date().toISOString()) {
  const previous = project.checklistOverrides?.[requirementId] || {};
  return { ...project, checklistOverrides: { ...(project.checklistOverrides || {}), [requirementId]: { ...previous, ...changes, audit: [...(previous.audit || []), { actor, changedAt, changes, source: "MANUAL" }] } }, auditTrail: [...(project.auditTrail || []), { field: `checklistOverrides.${requirementId}`, changedValue: changes, source: "MANUAL", changedAt }] };
}

export function buildPendingRequirementsReport(project, evaluation) {
  return { title: `Pendências para protocolo — ${project.property?.name || "Imóvel não identificado"}`, items: evaluation.items.filter((entry) => entry.required && ["PENDING", "REVIEW_REQUIRED"].includes(entry.status)).map((entry, index) => ({ number: index + 1, title: entry.title, reason: entry.reason, priority: evaluation.alerts.find((alert) => alert.requirementId === entry.id)?.priority || "MEDIUM" })), readiness: evaluation.readiness };
}

export function dossierItemsFromChecklist(evaluation) {
  return evaluation.items.filter((entry) => ["AVAILABLE", "CONFIRMED"].includes(entry.status) && entry.documentIds?.length).flatMap((entry) => entry.documentIds.map((documentId) => ({ requirementId: entry.id, documentId })));
}

export function createRegistryOfficeProfile(values = {}) { return { id: values.id || `registry-profile-${Date.now()}`, name: values.name || "Novo perfil de cartório", city: values.city || "", state: values.state || "MT", cns: values.cns || "", registryOfficeNumber: values.registryOfficeNumber || "", defaultRequirements: values.defaultRequirements || [], conditionalOverrides: values.conditionalOverrides || [], validityRules: values.validityRules || {}, notes: values.notes || "", active: values.active !== false }; }
