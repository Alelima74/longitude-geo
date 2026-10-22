export const BOUNDARY_TYPES = ["IMOVEL_PRIVADO", "POSSEIRO_OCUPANTE", "ESTRADA_MUNICIPAL", "RODOVIA_ESTADUAL", "RODOVIA_FEDERAL", "ESTRADA_SERVIDAO", "RIO", "CORREGO", "RIBEIRAO", "LAGO", "CANAL", "TERRA_PUBLICA_MUNICIPAL", "TERRA_PUBLICA_ESTADUAL", "TERRA_PUBLICA_FEDERAL", "UNIDADE_CONSERVACAO", "TERRA_INDIGENA", "AREA_PUBLICA", "OUTRO"];

const normalized = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
export function classifyBoundaryType(name, manualType = "") {
  if (BOUNDARY_TYPES.includes(manualType)) return manualType;
  const value = normalized(name);
  if (/\bBR[-\s]?\d+/.test(value)) return "RODOVIA_FEDERAL";
  if (/\b(MT|SP|GO|MS|PR|SC|RS|MG|RJ|BA|PA|RO|AC|AM|RR|AP|TO|MA|PI|CE|RN|PB|PE|AL|SE|ES|DF)[-\s]?\d+/.test(value) || value.includes("RODOVIA ESTADUAL")) return "RODOVIA_ESTADUAL";
  if (value.includes("ESTRADA DE SERVIDAO") || value.includes("ESTRADA SERVIDAO")) return "ESTRADA_SERVIDAO";
  if (value.includes("ESTRADA MUNICIPAL")) return "ESTRADA_MUNICIPAL";
  if (value.includes("RIBEIRAO")) return "RIBEIRAO";
  if (value.includes("CORREGO")) return "CORREGO";
  if (/\bRIO\b/.test(value)) return "RIO";
  if (/\bLAGO\b/.test(value)) return "LAGO";
  if (/\bCANAL\b/.test(value)) return "CANAL";
  if (value.includes("AREA PUBLICA")) return "AREA_PUBLICA";
  return "IMOVEL_PRIVADO";
}

export function enrichBoundaryTypes(boundaries = []) {
  return boundaries.map((item) => ({ ...item, boundaryType: classifyBoundaryType(item.boundaryName, item.additionalData?.boundaryType || item.editedBoundary?.boundaryType || item.boundaryType) }));
}

export function buildSpecialBoundaryReports(context) {
  return enrichBoundaryTypes(context.boundaries).filter((item) => item.boundaryType !== "IMOVEL_PRIVADO").map((item, index) => ({ id: `laudo-especial-${index + 1}`, type: item.boundaryType, title: ["RIO", "CORREGO", "RIBEIRAO", "LAGO", "CANAL"].includes(item.boundaryType) ? "LAUDO TÉCNICO DE CONFRONTAÇÃO COM CURSO D'ÁGUA" : "LAUDO TÉCNICO DE CONFRONTAÇÃO COM VIA OU LIMITE ESPECIAL", context, segment: item, responsibleEntity: item.additionalData?.responsibleEntity || "não identificado", dataSource: item.additionalData?.dataSource || "Memorial SIGEF" }));
}

export function buildTechnicalReport(context, validation = {}) {
  const documents = context.sourceDocuments.filter((item) => item?.name).map((item) => `${item.type || item.category}: ${item.name}`);
  const issues = validation.issues?.map((item) => item.message) || [];
  return { title: "LAUDO TÉCNICO DE GEORREFERENCIAMENTO PARA FINS REGISTRAIS", context, documents, boundaryRows: enrichBoundaryTypes(context.boundaries), analysis: { walking: context.vertices.length >= 3 ? "Caminhamento estruturado a partir dos vértices disponíveis no projeto." : "Caminhamento não validado: quantidade insuficiente de vértices.", closure: validation.status || "Fechamento geométrico não validado.", issues }, conclusion: issues.length ? "Foram identificadas ocorrências técnicas que devem ser conferidas antes do uso registral." : "Os dados disponíveis foram organizados sem presunção de conformidade jurídica ou validação não executada." };
}

export function buildRegistryComparison(context) {
  const value = (item) => String(item?.value ?? item ?? "").trim();
  const rows = [["Denominação", context.registry.propertyName, context.property.name], ["Proprietário", context.registry.owner, context.owner.name], ["Matrícula", context.registry.registrationNumber, context.registry.registrationNumber], ["CNS", context.registry.cns, context.registry.cns], ["Município", context.registry.municipality, context.property.municipality], ["Área", context.registry.area, context.property.area]];
  return rows.map(([field, registry, sigef]) => { const left = value(registry); const right = value(sigef); const difference = Number(left) && Number(right) ? Number(right) - Number(left) : null; return { field, registry: left, sigef: right, difference, status: !left || !right ? "A CONFIRMAR" : normalized(left) === normalized(right) ? "COMPATÍVEL" : "DIVERGENTE" }; });
}

export const DOSSIER_DEFAULT_ORDER = ["cover", "index", "checklist", "request", "ownerDeclaration", "memorial", "coordinates", "boundaries", "consents", "technicalReport", "specialReports", "comparison", "registryDocument", "ccir", "taxDocuments", "car", "responsibilityTerm", "certificates", "otherDocuments"];
export function buildDossier(context, pieces, selection = DOSSIER_DEFAULT_ORDER) {
  const selected = DOSSIER_DEFAULT_ORDER.filter((id) => selection.includes(id));
  const labels = { cover: "Capa", index: "Índice", checklist: "Checklist", request: "Requerimento", ownerDeclaration:"Declaração do Proprietário", memorial: "Memorial", coordinates: "Quadro de Coordenadas", boundaries: "Quadro de Confrontantes", consents: "Declarações de Anuência", technicalReport: "Laudo Técnico", specialReports: "Laudos Especiais", comparison: "Quadro Comparativo", registryDocument:"Matrícula",ccir:"CCIR",taxDocuments:"ITR / CND / CPEN",car:"CAR",responsibilityTerm:"TRT / ART / RRT",certificates:"Certidões",otherDocuments:"Outros documentos" };
  return { title: "DOSSIÊ TÉCNICO PARA AVERBAÇÃO DE GEORREFERENCIAMENTO", context, selected, index: selected.filter((id) => !["cover", "index"].includes(id)).map((id, index) => ({ number: index + 1, id, label: labels[id] })), pieces };
}
