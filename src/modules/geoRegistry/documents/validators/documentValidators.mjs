const present = (field) => field?.value !== "" && field?.value != null;

export function validateDocumentData(documentType, context) {
  const rules = {
    request: [["owner.name", context.owner.name], ["property.name", context.property.name], ["registry.registrationNumber", context.registry.registrationNumber], ["registryOffice", context.registry.office], ["registry.district", context.registry.district], ["property.municipality", context.property.municipality], ["property.state", context.property.state], ["property.area", context.property.area], ["property.perimeter", context.property.perimeter], ["sigef.certification", context.sigef.certification], ["sigef.surveyor", context.sigef.surveyor], ["sigef.accreditation", context.sigef.accreditation]],
    coordinates: [["vertices", { value: context.vertices.length }], ["sigef.datum", context.sigef.datum]],
    boundaries: [["boundaries", { value: context.boundaries.filter((item) => (item.origin === "MEMORIAL" || item.boundarySource === "MANUAL") && (item.azimuthDocumentRaw || item.azimuthDocument) && (item.distanceDocumentRaw || item.distanceDocument != null) && item.boundaryName).length }]],
    checklist: [], memorial: [["memorial", { value: context.sourceDocuments.some((item) => item.category === "SIGEF" && item.type === "Memorial") }]],
  };
  const missingFields = (rules[documentType] || []).filter(([, field]) => !present(field) || field.value === 0 || field.value === false).map(([name]) => name);
  const warnings = [];
  if (documentType === "request" && !present(context.owner.document)) warnings.push("Proprietário sem CPF/CNPJ.");
  if (documentType === "request" && ![context.owner.civilStatus, context.owner.nationality, context.owner.profession, context.owner.address].some(present)) warnings.push("Qualificação complementar do proprietário não informada.");
  return { ready: missingFields.length === 0, warnings, missingFields };
}
