const now = () => new Date().toISOString();
const manualEntry = (project, key) => project.cartorialData?.[key];
const has = (value) => value !== "" && value != null;

function field(project, key, { registry, memorial, fallback, fallbackOrigin = "SIGEF_MEMORIAL" } = {}) {
  if (project.registryState === "CONFIRMED" && has(registry)) return record(registry, "REGISTRY_CONFIRMED", true, project.registryConfirmedAt);
  if (has(memorial)) return record(memorial, "SIGEF_MEMORIAL", true, project.updatedAt);
  const manual = manualEntry(project, key);
  if (manual?.confirmed && has(manual.value)) return record(manual.value, "MANUAL", true, manual.updatedAt);
  if (has(registry)) return record(registry, "REGISTRY_OCR", false, project.updatedAt);
  if (has(fallback)) return record(fallback, fallbackOrigin, fallbackOrigin !== "REGISTRY_OCR", project.updatedAt);
  return record("", "SYSTEM", false, project.updatedAt);
}

export function buildCartorialDocumentContext(project) {
  const memorialRegistry = project.memorial?.registry || project.memorialRegistry || {};
  const memorialProperty = project.memorial?.property || project.property || {};
  const memorialSigef = project.memorial?.sigef || project.sigef || {};
  const memorialGeodesy = project.memorial?.geodesy || project.geodesy || {};
  return {
    owner: {
      name: field(project, "owner.name", { registry: project.registry?.owner, memorial: memorialRegistry.owner }),
      document: field(project, "owner.document", { registry: project.registry?.ownerDocument }),
      civilStatus: field(project, "owner.civilStatus"), nationality: field(project, "owner.nationality"), profession: field(project, "owner.profession"), address: field(project, "owner.address"),
    },
    registry: {
      registrationNumber: field(project, "registry.registrationNumber", { registry: project.registry?.registrationNumber, memorial: memorialRegistry.registrationNumber }),
      cns: field(project, "registry.cns", { registry: project.registry?.cns, memorial: memorialRegistry.cns }),
      office: field(project, "registry.office", { registry: project.registry?.registryOffice }), district: field(project, "registry.district", { registry: project.registry?.district }),
      municipality: field(project, "registry.municipality", { registry: project.registry?.municipality, fallback: project.property?.municipality }), state: field(project, "registry.state", { registry: project.registry?.state, fallback: project.property?.state }),
      area: field(project, "registry.area", { registry: project.registry?.previousArea }),
    },
    property: {
      name: field(project, "property.name", { memorial: memorialProperty.name, fallback: project.property?.name }), municipality: field(project, "property.municipality", { memorial: memorialProperty.municipality, fallback: project.property?.municipality }), state: field(project, "property.state", { memorial: memorialProperty.state, fallback: project.property?.state }),
      area: field(project, "property.area", { memorial: memorialProperty.area, fallback: project.property?.area }), perimeter: field(project, "property.perimeter", { memorial: memorialProperty.perimeter, fallback: project.property?.perimeter }),
      incraCode: field(project, "property.incraCode", { registry: project.registry?.incraCode }), ccir: field(project, "property.ccir", { registry: project.registry?.ccir }), nirfCib: field(project, "property.nirfCib", { registry: project.registry?.nirfCib }), car: field(project, "property.car", { registry: project.registry?.car }),
    },
    sigef: {
      certification: field(project, "sigef.certification", { memorial: memorialSigef.certificationId, fallback: project.sigef?.certificationId }), certificationDate: field(project, "sigef.certificationDate", { memorial: memorialSigef.certificationDate, fallback: project.sigef?.certificationDate }), surveyor: field(project, "sigef.surveyor", { memorial: memorialSigef.surveyor, fallback: project.sigef?.surveyor }), accreditation: field(project, "sigef.accreditation", { memorial: memorialSigef.accreditationCode, fallback: project.sigef?.accreditationCode }), datum: field(project, "sigef.datum", { memorial: memorialGeodesy.datum, fallback: project.geodesy?.datum }),
    },
    vertices: (project.vertices || []).map((vertex) => ({ ...vertex, source: vertex.latitudeDocument && vertex.longitudeDocument ? "SIGEF_MEMORIAL" : "GEOMETRY" })),
    boundaries: (project.boundaries || []).map((boundary) => ({ ...boundary, originalData: boundary.originalData || boundary.originalBoundary || { boundaryName: boundary.boundaryName, boundaryRegistration: boundary.boundaryRegistration, boundaryCns: boundary.boundaryCns, azimuthDocumentRaw: boundary.azimuthDocumentRaw || boundary.azimuthDocument, distanceDocumentRaw: boundary.distanceDocumentRaw }, additionalData: boundary.additionalData || boundary.editedBoundary || {}, manualOverrides: boundary.manualOverrides || {} })),
    checklist: project.checklist || [], sourceDocuments: project.sourceDocuments || [], geometry: project.geometry || null, generatedAt: record(new Date().toLocaleDateString("pt-BR"), "SYSTEM", true, now()),
  };
}

function record(value, origin, confirmed, updatedAt) { return { value: value ?? "", origin, confirmed: Boolean(confirmed), updatedAt: updatedAt || now() }; }
