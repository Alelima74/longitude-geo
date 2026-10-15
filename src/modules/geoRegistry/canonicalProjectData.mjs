const present = (value) => value !== "" && value != null;
const manual = (project, path) => ["PREENCHIMENTO MANUAL", "MANUAL_CONFIRMED"].includes(project.dataOrigins?.[path]);
const choose = (project, path, values) => manual(project, path) && present(values.manual) ? values.manual : present(values.registryConfirmed) ? values.registryConfirmed : present(values.sigefMemorial) ? values.sigefMemorial : present(values.legacy) ? values.legacy : present(values.ocr) ? values.ocr : "";

export function getCanonicalProjectData(project = {}) {
  const property=project.property||{},registry=project.registry||{},memorial=project.memorial||{},legacy=project.legacySource||{};
  return {
    property: {
      name: choose(project,"property.name",{manual:property.name,sigefMemorial:memorial.property?.name,legacy:legacy.property?.name||property.name}),
      municipality: choose(project,"property.municipality",{manual:property.municipality,sigefMemorial:memorial.property?.municipality,legacy:legacy.property?.municipality||property.municipality}),
      state: choose(project,"property.state",{manual:property.state,sigefMemorial:memorial.property?.state,legacy:legacy.property?.state||property.state}),
      area: choose(project,"property.area",{manual:property.area,sigefMemorial:memorial.property?.area,legacy:legacy.property?.area??property.area}),
      perimeter: choose(project,"property.perimeter",{manual:property.perimeter,sigefMemorial:memorial.property?.perimeter,legacy:legacy.property?.perimeter??property.perimeter}),
      sncr: choose(project,"property.sncr",{manual:property.sncr||property.incraCode,legacy:legacy.property?.sncr||property.sncr||property.incraCode}),
    },
    registry: {
      registrationNumber: choose(project,"registry.registrationNumber",{manual:registry.registrationNumber,registryConfirmed:registry.confirmed?registry.registrationNumber:"",sigefMemorial:memorial.registry?.registrationNumber,legacy:legacy.registry?.registrationNumber||registry.registrationNumber}),
      cns: choose(project,"registry.cns",{manual:registry.cns,registryConfirmed:registry.confirmed?registry.cns:"",sigefMemorial:memorial.registry?.cns,legacy:legacy.registry?.cns||registry.cns}),
      registryOffice: choose(project,"registry.registryOffice",{manual:registry.registryOffice,registryConfirmed:registry.confirmed?registry.registryOffice:"",legacy:legacy.registry?.registryOffice||registry.registryOffice}),
      district: choose(project,"registry.district",{manual:registry.district,registryConfirmed:registry.confirmed?registry.district:"",legacy:legacy.registry?.district||registry.district}),
    },
    owner: { name: choose(project,"registry.owner",{manual:registry.owner,registryConfirmed:registry.confirmed?registry.owner:"",sigefMemorial:memorial.registry?.owner,legacy:legacy.owner?.name||registry.owner}), cpfCnpj: choose(project,"registry.ownerDocument",{manual:registry.ownerDocument,registryConfirmed:registry.confirmed?registry.ownerDocument:"",legacy:legacy.owner?.cpfCnpj||registry.ownerDocument}) },
    sigef: { certificationId: choose(project,"sigef.certificationId",{manual:project.sigef?.certificationId,sigefMemorial:memorial.sigef?.certificationId,legacy:legacy.sigef?.certificationId||project.sigef?.legacySigefCode}) },
  };
}

export function traceCanonicalProject(project) {
  const canonical=getCanonicalProjectData(project); const bank=project.legacySource||{};
  return [
    ["Imóvel",bank.property?.name,project.property?.name,canonical.property.name], ["Matrícula",bank.registry?.registrationNumber,project.registry?.registrationNumber,canonical.registry.registrationNumber],
    ["CNS",bank.registry?.cns,project.registry?.cns,canonical.registry.cns], ["Município",bank.property?.municipality,project.property?.municipality,canonical.property.municipality],
    ["UF",bank.property?.state,project.property?.state,canonical.property.state], ["Proprietário",bank.owner?.name,project.registry?.owner,canonical.owner.name],
    ["CPF/CNPJ",bank.owner?.cpfCnpj,project.registry?.ownerDocument,canonical.owner.cpfCnpj], ["Área",bank.property?.area,project.property?.area,canonical.property.area],
    ["Perímetro",bank.property?.perimeter,project.property?.perimeter,canonical.property.perimeter], ["INCRA/SNCR",bank.property?.sncr,project.property?.sncr||project.property?.incraCode,canonical.property.sncr],
    ["Cartório",bank.registry?.registryOffice,project.registry?.registryOffice,canonical.registry.registryOffice], ["Comarca",bank.registry?.district,project.registry?.district,canonical.registry.district],
    ["Certificação SIGEF",bank.sigef?.certificationId,project.sigef?.certificationId||project.sigef?.legacySigefCode,canonical.sigef.certificationId],
  ].map(([campo,banco,adapter,value])=>({campo,banco:present(banco)?banco:"AUSENTE NO BANCO LEGADO",adapter:present(adapter)?adapter:"AUSENTE",project:present(value)?value:"AUSENTE",UI:present(value)?value:"AUSENTE"}));
}
