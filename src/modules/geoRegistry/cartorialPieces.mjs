import { buildCartorialDocumentContext } from "./documents/builders/cartorialDocumentContext.mjs";
import { buildRequestTemplate } from "./documents/templates/requestTemplate.mjs";
import { validateDocumentData } from "./documents/validators/documentValidators.mjs";
import { buildMemorialDocument } from "./documents/builders/memorialBuilder.mjs";
import { buildBoundaryDocuments } from "./documents/builders/boundaryDocumentBuilder.mjs";

export function buildCartorialPieces(project) {
  const context = buildCartorialDocumentContext(project);
  const requestValidation = validateDocumentData("request", context);
  const coordinateValidation = validateDocumentData("coordinates", context);
  const boundaryValidation = validateDocumentData("boundaries", context);
  const memorialValidation = validateDocumentData("memorial", context);
  const coordinates = context.vertices.map((vertex) => ({ code: vertex.code, longitude: vertex.longitudeDocument || "[DADO PENDENTE]", latitude: vertex.latitudeDocument || "[DADO PENDENTE]", altitude: vertex.altitude, source: vertex.source, note: vertex.longitudeDocument && vertex.latitudeDocument ? "" : "Coordenada documental não disponível" }));
  const boundaries = context.boundaries.filter((item) => (item.origin === "MEMORIAL" || item.boundarySource === "MANUAL") && (item.azimuthDocumentRaw || item.azimuthDocument) && (item.distanceDocumentRaw || item.distanceDocument != null) && item.boundaryName).map((item) => ({ ...item, azimuth: item.azimuthDocumentRaw || item.azimuthDocument, distance: item.distanceDocumentRaw || String(item.distanceDocument).replace(".", ",") }));
  const requestFields = flattenContext(context);
  const requestText = buildRequestTemplate(context);
  const memorialDocument = buildMemorialDocument(context); const consentLetters = buildBoundaryDocuments(context);
  return {
    context,
    request: { state: requestValidation.ready ? (requestValidation.warnings.length ? "REVISÃO NECESSÁRIA" : "PRONTO PARA REVISÃO") : "DADOS PENDENTES", missing: requestValidation.missingFields.map(missingLabel), canGenerate: requestValidation.ready, validation: requestValidation, fields: requestFields, templateOriginal: requestText, editedContent: project.documentEdits?.request || "", text: project.documentEdits?.request || requestText },
    memorial: { state: context.vertices.length && context.boundaries.length ? "PRONTO PARA REVISÃO" : memorialValidation.ready ? "DOCUMENTO SIGEF DISPONÍVEL" : "DADOS PENDENTES", validation: memorialValidation, sourceDocument: context.sourceDocuments.find((item) => item.category === "SIGEF" && item.type === "Memorial") || null, document: memorialDocument, context },
    plant: { state: "EM PREPARAÇÃO", context: { geometry: context.geometry, vertices: context.vertices, boundaries: context.boundaries, area: context.property.area, perimeter: context.property.perimeter, registration: context.registry.registrationNumber, owner: context.owner.name, municipality: context.property.municipality, scale: project.cartorialData?.["plant.scale"] || null, datum: context.sigef.datum, surveyor: context.sigef.surveyor } },
    coordinates: { state: coordinateValidation.ready ? "PRONTO" : "DADOS PENDENTES", validation: coordinateValidation, rows: coordinates, datum: context.sigef.datum.value, area: context.property.area.value, perimeter: context.property.perimeter.value },
    boundaries: { state: boundaryValidation.ready ? "PRONTO" : "DADOS PENDENTES", validation: boundaryValidation, rows: boundaries },
    checklist: { state: "PRONTO", validation: validateDocumentData("checklist", context), rows: context.checklist },
    limits: { state: "PRÓXIMA ETAPA", context }, consentLetters: { state: consentLetters.length ? "DISPONÍVEL POR CONFRONTANTE" : "DADOS PENDENTES", documents: consentLetters },
  };
}

function flattenContext(context) {
  return { owner: context.owner.name, ownerDocument: context.owner.document, property: context.property.name, registration: context.registry.registrationNumber, cns: context.registry.cns, office: context.registry.office, district: context.registry.district, municipality: context.property.municipality, state: context.property.state, geoArea: context.property.area, perimeter: context.property.perimeter, certification: context.sigef.certification, certificationDate: context.sigef.certificationDate, surveyor: context.sigef.surveyor, accreditation: context.sigef.accreditation, datum: context.sigef.datum };
}
function missingLabel(key) { return ({ "owner.name": "Proprietário", "property.name": "Imóvel", "registry.registrationNumber": "Matrícula", registryOffice: "Cartório", "registry.district": "Comarca", "property.municipality": "Município", "property.state": "UF", "property.area": "Área georreferenciada", "property.perimeter": "Perímetro", "sigef.certification": "Certificação SIGEF", "sigef.surveyor": "Responsável técnico", "sigef.accreditation": "Credenciamento" })[key] || key; }
