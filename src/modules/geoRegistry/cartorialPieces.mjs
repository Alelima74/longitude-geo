import { buildCartorialDocumentContext } from "./documents/builders/cartorialDocumentContext.mjs";
import { buildOwnerLimitsDeclaration, buildRequestTemplate } from "./documents/templates/requestTemplate.mjs";
import { validateDocumentData } from "./documents/validators/documentValidators.mjs";
import { buildMemorialDocument } from "./documents/builders/memorialBuilder.mjs";
import { buildBoundaryDocuments } from "./documents/builders/boundaryDocumentBuilder.mjs";
import { buildDossier, buildRegistryComparison, buildSpecialBoundaryReports, buildTechnicalReport, enrichBoundaryTypes } from "./documents/builders/cartorialWorkflow.mjs";
import { dossierItemsFromChecklist, evaluateCartorialChecklist } from "./documents/builders/cartorialChecklistEngine.mjs";

export function buildCartorialPieces(project) {
  const context = buildCartorialDocumentContext(project);
  context.boundaries = enrichBoundaryTypes(context.boundaries);
  const requestValidation = validateDocumentData("request", context);
  const ownerDeclarationValidation = validateDocumentData("ownerDeclaration", context);
  const coordinateValidation = validateDocumentData("coordinates", context);
  const boundaryValidation = validateDocumentData("boundaries", context);
  const memorialValidation = validateDocumentData("memorial", context);
  const technicalReportValidation = validateDocumentData("technicalReport", context);
  const coordinates = context.vertices.map((vertex) => ({ code: vertex.code, longitude: vertex.longitudeDocument || "[DADO PENDENTE]", latitude: vertex.latitudeDocument || "[DADO PENDENTE]", altitude: vertex.altitude, source: vertex.source, note: vertex.longitudeDocument && vertex.latitudeDocument ? "" : "Coordenada documental não disponível" }));
  const boundaries = context.boundaries.filter((item) => (item.origin === "MEMORIAL" || item.boundarySource === "MANUAL") && (item.azimuthDocumentRaw || item.azimuthDocument) && (item.distanceDocumentRaw || item.distanceDocument != null) && item.boundaryName).map((item) => ({ ...item, azimuth: item.azimuthDocumentRaw || item.azimuthDocument, distance: item.distanceDocumentRaw || String(item.distanceDocument).replace(".", ",") }));
  const requestFields = flattenContext(context);
  const requestText = buildRequestTemplate(context);
  const ownerDeclarationText = buildOwnerLimitsDeclaration(context);
  const memorialDocument = buildMemorialDocument(context); const consentLetters = buildBoundaryDocuments(context);
  const technicalReport = buildTechnicalReport(context, project.validation);
  const specialReports = buildSpecialBoundaryReports(context);
  const comparison = buildRegistryComparison(context);
  const intelligentChecklist = evaluateCartorialChecklist(project);
  return {
    context,
    request: { state: requestValidation.ready ? "PRONTO PARA REVISÃO" : "DADOS PENDENTES", missing: requestValidation.missingFields.map(missingLabel), canGenerate: requestValidation.ready, validation: requestValidation, context, fields: requestFields, templateOriginal: requestText, editedContent: project.documentEdits?.request || "", text: project.documentEdits?.request || requestText },
    ownerDeclaration: { state: ownerDeclarationValidation.ready ? "PRONTO PARA REVISÃO" : "DADOS PENDENTES", canGenerate: ownerDeclarationValidation.ready, validation: ownerDeclarationValidation, context, text: ownerDeclarationText },
    memorial: { state: context.vertices.length && context.boundaries.length ? "PRONTO PARA REVISÃO" : memorialValidation.ready ? "DOCUMENTO SIGEF DISPONÍVEL" : "DADOS PENDENTES", validation: memorialValidation, sourceDocument: context.sourceDocuments.find((item) => item.category === "SIGEF" && item.type === "Memorial") || null, document: memorialDocument, context },
    plant: { state: context.geometry && context.vertices.length ? "AUDITORIA GEOMÉTRICA" : "DADOS PENDENTES", context: { geometry: context.geometry, vertices: context.vertices, boundaries: context.boundaries, area: context.property.area, perimeter: context.property.perimeter, property: { ...context.property, owner: context.owner.name }, registry: context.registry, certification: context.sigef.certification, scale: project.cartorialData?.["plant.scale"] || null, datum: context.sigef.datum, utmZone: context.property.utmZone, projection: context.property.projection, centralMeridian: context.property.centralMeridian, surveyor: context.sigef.surveyor, technical: context.technical, procedure: context.procedure } },
    coordinates: { state: coordinateValidation.ready ? "PRONTO" : "DADOS PENDENTES", validation: coordinateValidation, rows: coordinates, datum: context.sigef.datum.value, area: context.property.area.value, perimeter: context.property.perimeter.value },
    boundaries: { state: boundaryValidation.ready ? "PRONTO" : "DADOS PENDENTES", validation: boundaryValidation, rows: boundaries },
    checklist: { state: intelligentChecklist.readiness.state, validation: validateDocumentData("checklist", context), rows: intelligentChecklist.items, evaluation: intelligentChecklist },
    consentLetters: { state: consentLetters.length ? "DISPONÍVEL POR CONFRONTANTE PRIVADO" : "NÃO APLICÁVEL / DADOS PENDENTES", documents: consentLetters },
    technicalReport: { state: technicalReportValidation.ready ? "DISPONÍVEL PARA REVISÃO" : "DADOS PENDENTES", validation:technicalReportValidation, document: technicalReport },
    specialReports: { state: specialReports.length ? "CONFRONTAÇÃO ESPECIAL IDENTIFICADA" : "NÃO IDENTIFICADA", documents: specialReports },
    comparison: { state: "DISPONÍVEL PARA CONFERÊNCIA", rows: comparison },
    dossier: { state: "DISPONÍVEL PARA MONTAGEM", checklist: intelligentChecklist, checklistDocuments: dossierItemsFromChecklist(intelligentChecklist), build: (selection) => buildDossier(context, { request: requestText, ownerDeclaration: ownerDeclarationText, memorial: memorialDocument, coordinates, boundaries, consentLetters, technicalReport, specialReports, comparison, checklist: intelligentChecklist.items, checklistDocuments: dossierItemsFromChecklist(intelligentChecklist) }, selection) },
  };
}

function flattenContext(context) {
  return { owner: context.owner.name, ownerDocument: context.owner.document, property: context.property.name, registration: context.registry.registrationNumber, cns: context.registry.cns, office: context.registry.office, district: context.registry.district, municipality: context.property.municipality, state: context.property.state, geoArea: context.property.area, perimeter: context.property.perimeter, certification: context.sigef.certification, certificationDate: context.sigef.certificationDate, surveyor: context.sigef.surveyor, accreditation: context.sigef.accreditation, datum: context.sigef.datum };
}
function missingLabel(key) { return ({ "owner.name": "Proprietário", "property.name": "Imóvel", "registry.registrationNumber": "Matrícula", registryOffice: "Cartório", "registry.district": "Comarca", "property.municipality": "Município", "property.state": "UF", "property.area": "Área georreferenciada", "property.perimeter": "Perímetro", "sigef.certification": "Certificação SIGEF", "sigef.surveyor": "Responsável técnico", "sigef.accreditation": "Credenciamento" })[key] || key; }
