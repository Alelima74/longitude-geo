export const GEO_REGISTRY_STORAGE_KEY = "longitude_geo_registry_projects_v1";

export function createGeoRegistryProject(source = {}) {
  const now = new Date().toISOString();
  return {
    id: source.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: source.createdAt || now,
    updatedAt: now,
    property: { name: "", municipality: "", state: "", area: null, perimeter: null, ...source.property },
    memorial: source.memorial || { property: {}, registry: {}, sigef: {}, geodesy: {} },
    registry: { registrationNumber: "", cns: "", registryOffice: "", district: "", municipality: "", state: "", propertyName: "", owner: "", ownerDocument: "", previousArea: null, incraCode: "", ccir: "", nirfCib: "", car: "", acts: [], confirmed: false, ...source.registry },
    registryState: source.registryState || (source.registry?.confirmed ? "CONFIRMED" : "NOT_IMPORTED"),
    memorialRegistry: source.memorialRegistry || {},
    sigef: { certificationId: "", parcelId: "", certificationDate: "", status: "", surveyor: "", accreditationCode: "", ...source.sigef },
    geodesy: { datum: "", coordinateSystem: "", utmZone: "", centralMeridian: "", ...source.geodesy },
    vertices: source.vertices || [],
    boundaries: source.boundaries || [],
    geometry: source.geometry || null,
    geometrySource: source.geometrySource || "",
    calculated: source.calculated || {},
    manualOverrides: source.manualOverrides || {},
    cartorialData: source.cartorialData || {},
    documentEdits: source.documentEdits || {},
    sourceDocuments: source.sourceDocuments || [],
    validation: source.validation || {},
    generatedDocuments: source.generatedDocuments || [],
    checklist: source.checklist || defaultChecklist(),
    auditTrail: source.auditTrail || [],
    dataOrigins: source.dataOrigins || {},
  };
}

export function defaultChecklist() {
  return [
    ["REGISTRO", "Matrícula atualizada"], ["SIGEF", "Certificação SIGEF"], ["SIGEF", "Memorial Descritivo"], ["SIGEF", "Planta"],
    ["CADASTRO RURAL", "CCIR"], ["CADASTRO RURAL", "ITR / CIB"], ["CADASTRO RURAL", "CAR"], ["RESPONSABILIDADE TÉCNICA", "ART/TRT"],
    ["PEÇAS", "Requerimento de Averbação"], ["PEÇAS", "Memorial"], ["PEÇAS", "Planta"], ["PEÇAS", "Quadro de Coordenadas"], ["PEÇAS", "Quadro de Confrontantes"], ["PEÇAS", "Declarações"], ["PEÇAS", "Anuências, quando aplicáveis"],
  ].map(([category, label]) => ({ id: `${category}-${label}`, category, label, status: "pending", observation: "" }));
}

export function projectProgress(project) {
  const checks = [project.property.name, project.property.municipality, project.property.state,
    project.sigef.certificationId, project.registry.registrationNumber, project.registry.cns,
    project.vertices.length >= 3, project.geometry, project.validation?.status];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
