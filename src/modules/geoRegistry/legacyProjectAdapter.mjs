import { createGeoRegistryProject } from "./geoRegistryModel.mjs";

export function parseLegacyNumber(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function legacyPropertyToGeoProject(record) {
  const propertyRaw = record.legacy_raw_data || {};
  const legacy = (normalized, ...rawKeys) => normalized ?? firstLegacyValue(propertyRaw, rawKeys);
  const importedAt = record.updated_at || record.created_at || new Date().toISOString();
  return createGeoRegistryProject({
    id: `metrica-${record.property_id}`, createdAt: importedAt,
    property: { name: legacy(record.name, "NomeImovel") || "", municipality: legacy(record.municipality, "Cidade") || "", state: legacy(record.state, "Estado") || "", area: parseLegacyNumber(legacy(record.area_original ?? record.area_ha, "Area")), registryArea: parseLegacyNumber(legacy(record.area_original ?? record.area_ha, "Area")), importedArea: parseLegacyNumber(legacy(record.area_original ?? record.area_ha, "Area")), perimeter: parseLegacyNumber(legacy(record.perimeter_original ?? record.perimeter_m, "Perimetro")), importedPerimeter: parseLegacyNumber(legacy(record.perimeter_original ?? record.perimeter_m, "Perimetro")), address: legacy(record.address, "Endereco") || "", district: legacy(record.district, "BAIRRO") || "", incraCode: legacy(record.sncr_incra, "Incra") || "", sncr: legacy(record.sncr_incra, "Incra") || "", sigefCode: legacy(record.sigef_code, "Codigo_SIGEF") || "" },
    owners: record.owners || ownerFromFlatRecord(record),
    registry: { registrationNumber: record.registration_number || "", cns: record.cns || "", registryOffice: record.registry_office_name || "", registryDistrict: record.registry_district || "", district: record.registry_district || "", state: record.registry_state || record.state || "", registrationType: record.registration_type || "", book: record.book || "", page: record.page || "", propertyName: record.name || "", owner: record.owner_name || "", ownerDocument: record.owner_document || "", incraCode: record.sncr_incra || "", confirmed: false },
    registryState: record.registration_number || record.cns ? "REVIEW_REQUIRED" : "NOT_IMPORTED",
    sigef: { certificationId: "", legacySigefCode: legacy(record.sigef_code, "Codigo_SIGEF") || "" },
    technicalProfessional: record.technicalProfessional || {},
    cartorialData: { owner: record.owner_name || "", ownerDocument: record.owner_document || "" },
    legacyImport: { source: "METRICA_TOPO_MDB", propertyId: record.property_id, legacyId: record.legacy_id, registryLegacyId: record.registry_legacy_id || null, ownerLegacyIds: (record.owner_legacy_ids || [record.owner_legacy_id]).filter(Boolean), importedAt },
    dataOrigins: Object.fromEntries(["property.name","property.municipality","property.state","property.area","property.perimeter","property.address","property.district","property.incraCode","sigef.certificationId","registry.registrationNumber","registry.cns","registry.registryOffice","registry.district","registry.state","registry.owner","registry.ownerDocument"].map((path) => [path, "IMPORTAÇÃO MÉTRICA TOPO"])),
    auditTrail: [{ field: "legacyImport", originalValue: null, changedValue: record.legacy_id, changedAt: importedAt }],
  });
}

function ownerFromFlatRecord(record) {
  return record.owner_name ? [{ name: record.owner_name, document: record.owner_document || "", isPrimary: true, source: "LEGACY_DATABASE" }] : [];
}

export function buildGeoProjectFromLegacyData({ property = {}, registries = [], ownerships = [], people = [], companies = [], surveyProjects = [], technicalResponsibilities = [], technicalProfessionals = [] }) {
  const row = joinLegacyGeoRows([property], registries, ownerships, people, companies)[0] || { property_id: property.id, legacy_id: property.legacy_id, ...property };
  const relatedOwners = ownerships.filter((item) => item.property_id === property.id && !item.deleted_at).map((link) => {
    const person = people.find((item) => item.id === link.person_id) || {};
    const company = companies.find((item) => item.id === link.company_id) || {};
    const raw = person.legacy_raw_data || company.legacy_raw_data || link.legacy_raw_data || {};
    return { name: person.name || company.company_name || firstLegacyValue(raw,["NomeProp","Razao_Social"]) || "", document: person.cpf || company.cnpj || firstLegacyValue(raw,["CPF_CIC","CNPJ"]) || "", nationality: person.nationality || firstLegacyValue(raw,["Nacionalidade"]) || "", profession: person.profession || firstLegacyValue(raw,["Profissao"]) || "", address: person.address || company.address || firstLegacyValue(raw,["Endereco"]) || "", city: person.city || company.city || firstLegacyValue(raw,["Cidade"]) || "", state: person.state || company.state || firstLegacyValue(raw,["Estado"]) || "", rg: person.rg || firstLegacyValue(raw,["RG"]) || "", rgIssuer: person.rg_issuer || firstLegacyValue(raw,["orgexprop"]) || "", maritalStatus: person.marital_status || firstLegacyValue(raw,["Est_Civil"]) || "", spouseName: person.spouse_name || firstLegacyValue(raw,["Conjuge"]) || "", spouseRg: person.spouse_rg || firstLegacyValue(raw,["RG_Conjuge"]) || "", spouseDocument: person.spouse_cpf || firstLegacyValue(raw,["CPF_CIC_Conjuge"]) || "", stableUnion: person.stable_union || firstLegacyValue(raw,["Reg_Uniao"]) || "", isPrimary: Boolean(link.is_primary), source: "LEGACY_DATABASE" };
  }).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const service = surveyProjects.find((item) => item.property_id === property.id && !item.deleted_at);
  const responsibility = service && technicalResponsibilities.find((item) => item.survey_project_id === service.id);
  const professional = responsibility && technicalProfessionals.find((item) => item.id === responsibility.professional_id);
  const person = professional && people.find((item) => item.id === professional.person_id);
  const company = professional && companies.find((item) => item.id === professional.company_id);
  return legacyPropertyToGeoProject({ ...row, owners: relatedOwners, owner_name: relatedOwners[0]?.name || row.owner_name, owner_document: relatedOwners[0]?.document || row.owner_document, technicalProfessional: professional ? { name: person?.name || company?.contact_name || "", professionalQualification: professional.qualification || "", professionalRegistration: professional.professional_registration || "", incraCredential: professional.incra_credential || "", responsibilityType: responsibility.responsibility_type || "", responsibilityNumber: responsibility.responsibility_number || "", source: "LEGACY_DATABASE" } : {} });
}

export function mergeHydratedGeoProject(hydrated, saved) {
  if (!saved) return hydrated;
  const merged = createGeoRegistryProject({ ...saved, ...hydrated,
    sourceDocuments: saved.sourceDocuments || [], geometry: saved.geometry || hydrated.geometry,
    canonicalSurveyGeometry: saved.canonicalSurveyGeometry || hydrated.canonicalSurveyGeometry,
    geometrySource: saved.geometrySource || hydrated.geometrySource,
    vertices: saved.vertices?.length ? saved.vertices : hydrated.vertices,
    boundaries: saved.boundaries?.length ? saved.boundaries : hydrated.boundaries,
    validation: Object.keys(saved.validation || {}).length ? saved.validation : hydrated.validation,
    memorial: saved.memorial || hydrated.memorial, memorialRegistry: saved.memorialRegistry || hydrated.memorialRegistry,
    auditTrail: [...(hydrated.auditTrail || []), ...(saved.auditTrail || [])],
    dataOrigins: { ...(hydrated.dataOrigins || {}), ...(saved.dataOrigins || {}) },
  });
  for (const [path, origin] of Object.entries(saved.dataOrigins || {})) {
    if (origin !== "PREENCHIMENTO MANUAL" && origin !== "MANUAL_CONFIRMED") continue;
    setPath(merged, path, getPath(saved, path));
  }
  if (saved.registry?.confirmed) merged.registry = { ...hydrated.registry, ...saved.registry };
  return merged;
}

export function consolidateLegacyProjectFragments(projects = []) {
  if (!projects.length) throw new Error("Nenhum fragmento legado disponível.");
  const primary=projects[0]; const pick=(path)=>projects.map((project)=>getPath(project,path)).find((value)=>value!==""&&value!=null)??"";
  const owners=projects.flatMap((project)=>project.owners||[]).filter((owner,index,all)=>all.findIndex((candidate)=>candidate.name===owner.name&&candidate.document===owner.document)===index);
  const result=createGeoRegistryProject({ ...primary,
    property:{...primary.property,name:pick("property.name"),municipality:pick("property.municipality"),state:pick("property.state"),area:pick("property.area"),perimeter:pick("property.perimeter"),sncr:pick("property.sncr"),incraCode:pick("property.incraCode")},
    registry:{...primary.registry,registrationNumber:pick("registry.registrationNumber"),cns:pick("registry.cns"),registryOffice:pick("registry.registryOffice"),district:pick("registry.district"),state:pick("registry.state"),owner:owners[0]?.name||pick("registry.owner"),ownerDocument:owners[0]?.document||pick("registry.ownerDocument")}, owners,
  });
  result.legacySource={system:"METRICA_MDB",propertyIds:projects.map((project)=>project.legacyImport?.legacyId).filter(Boolean),registryIds:projects.map((project)=>project.legacyImport?.registryLegacyId).filter(Boolean),ownerIds:projects.flatMap((project)=>project.legacyImport?.ownerLegacyIds||[]).filter(Boolean),property:{name:result.property.name,municipality:result.property.municipality,state:result.property.state,area:result.property.area,perimeter:result.property.perimeter,sncr:result.property.sncr||result.property.incraCode},registry:{registrationNumber:result.registry.registrationNumber,cns:result.registry.cns,registryOffice:result.registry.registryOffice,district:result.registry.district},owner:{name:result.registry.owner,cpfCnpj:result.registry.ownerDocument},sigef:{certificationId:pick("sigef.legacySigefCode")}};
  const applied=[result.property.name,result.property.municipality,result.property.state,result.property.area,result.property.perimeter,result.registry.registrationNumber,result.registry.cns,result.registry.owner].filter((value)=>value!==""&&value!=null).length;
  result.legacyHydration={success:applied>=2,fragments:projects.length,found:applied,mapped:applied,applied}; return result;
}

export async function hydrateGeoProject(propertyId, loadTable) {
  return (await hydrateGeoProjectFragments([propertyId], loadTable))[0];
}

export async function hydrateGeoProjectFragments(propertyIds, loadTable) {
  const properties = await loadTable("properties");
  const optionalNames = ["registry_records", "property_owners", "people", "companies", "survey_projects", "technical_responsibilities", "technical_professionals"];
  const [registries, ownerships, people, companies, surveyProjects, technicalResponsibilities, technicalProfessionals] = await Promise.all(optionalNames.map(async (name) => {
    try { return await loadTable(name); } catch { return []; }
  }));
  return propertyIds.map((propertyId) => {
    const property = properties.find((item) => item.id === propertyId);
    if (!property) throw new Error(`Imóvel legado ${propertyId} não localizado para hidratação.`);
    return buildGeoProjectFromLegacyData({ property, registries: registries.filter((item) => item.property_id === propertyId), ownerships: ownerships.filter((item) => item.property_id === propertyId), people, companies, surveyProjects, technicalResponsibilities, technicalProfessionals });
  });
}

export function joinLegacyGeoRows(properties = [], registries = [], ownerships = [], people = [], companies = []) {
  const registryByProperty = firstBy(registries.filter((item) => !item.deleted_at), "property_id");
  const ownerByProperty = firstBy([...ownerships].filter((item) => !item.deleted_at).sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)), "property_id");
  const peopleById = new Map(people.map((item) => [item.id,item]));
  const companiesById = new Map(companies.map((item) => [item.id,item]));
  return properties.filter((item) => item.legacy_source === "METRICA_TOPO_MDB" && item.legacy_table === "CadImovel" && !item.deleted_at).map((item) => {
    const registry=registryByProperty.get(item.id)||{};const ownership=ownerByProperty.get(item.id)||{};const person=peopleById.get(ownership.person_id)||{};const company=companiesById.get(ownership.company_id)||{};
    const registryRaw=registry.legacy_raw_data||{};const ownerRaw=person.legacy_raw_data||company.legacy_raw_data||ownership.legacy_raw_data||{};
    return { property_id:item.id,legacy_id:item.legacy_id,registry_legacy_id:registry.legacy_id||firstLegacyValue(registryRaw,["CodigoMatricula"]),owner_legacy_id:person.legacy_id||company.legacy_id||firstLegacyValue(ownerRaw,["CodigoProp"]),legacy_raw_data:item.legacy_raw_data,name:item.name,address:item.address,district:item.district,municipality:item.municipality,state:item.state,sncr_incra:item.sncr_incra,area_original:item.area_original??item.area_ha,perimeter_original:item.perimeter_original??item.perimeter_m,sigef_code:item.sigef_code,registration_number:registry.registration_number||firstLegacyValue(registryRaw,["Numero"]),registration_type:registry.registration_type||firstLegacyValue(registryRaw,["Tipo"]),book:registry.book||firstLegacyValue(registryRaw,["Livro"]),page:registry.page||firstLegacyValue(registryRaw,["Folha"]),cns:registry.cns||firstLegacyValue(registryRaw,["CNS"]),registry_office_name:registry.registry_office_name||firstLegacyValue(registryRaw,["NomeCRI"]),registry_district:registry.registry_district||firstLegacyValue(registryRaw,["Comarca"]),registry_state:registry.state||firstLegacyValue(registryRaw,["Estado"]),owner_name:person.name||company.company_name||firstLegacyValue(ownerRaw,["NomeProp"]),owner_document:person.cpf||company.cnpj||firstLegacyValue(ownerRaw,["CPF_CIC"]),created_at:item.created_at,updated_at:item.updated_at };
  }).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pt-BR"));
}

function firstLegacyValue(raw, keys) { const entries = Object.entries(raw || {}); for (const key of keys) { const match = entries.find(([name]) => name.toLocaleLowerCase("pt-BR") === key.toLocaleLowerCase("pt-BR")); if (match?.[1] !== "" && match?.[1] != null) return match[1]; } return null; }
function getPath(object, path) { return path.split(".").reduce((value, key) => value?.[key], object); }
function setPath(object, path, value) { const keys = path.split("."); let target = object; for (const key of keys.slice(0,-1)) target = target[key] ||= {}; target[keys.at(-1)] = value; }
function firstBy(items,key){const result=new Map();for(const item of items)if(!result.has(item[key]))result.set(item[key],item);return result;}
