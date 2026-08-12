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
    memorialRegistry: source.memorialRegistry || {},
    sigef: { certificationId: "", parcelId: "", certificationDate: "", status: "", surveyor: "", accreditationCode: "", ...source.sigef },
    geodesy: { datum: "", coordinateSystem: "", utmZone: "", centralMeridian: "", ...source.geodesy },
    vertices: source.vertices || [],
    boundaries: source.boundaries || [],
    geometry: source.geometry || null,
    geometrySource: source.geometrySource || "",
    calculated: source.calculated || {},
    manualOverrides: source.manualOverrides || {},
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
    ["SIGEF", "Certificação"], ["SIGEF", "Memorial"], ["SIGEF", "Planta"],
    ["Registro", "Matrícula atualizada"], ["Cadastro rural", "CCIR"],
    ["Cadastro rural", "ITR/CIB"],
    ["Responsabilidade técnica", "ART/TRT"], ["Peças", "Requerimento"],
    ["Peças", "Planta"], ["Peças", "Memorial"], ["Peças", "Quadro de coordenadas"],
  ].map(([category, label]) => ({ id: `${category}-${label}`, category, label, status: "pending" }));
}

export function projectProgress(project) {
  const checks = [project.property.name, project.property.municipality, project.property.state,
    project.sigef.certificationId, project.registry.registrationNumber, project.registry.cns,
    project.vertices.length >= 3, project.geometry, project.validation?.status];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
