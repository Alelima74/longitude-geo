import { cleanDocumentText, optionalSentence, safeValue } from "../validators/documentQuality.mjs";

const join = (items) => items.filter(Boolean).join(", ");
function ownerQualification(c) {
  if (safeValue(c.owner.type)==="LEGAL_ENTITY") return join([safeValue(c.legalEntity.corporateName)||safeValue(c.owner.name),optionalSentence(c.legalEntity.document,(v)=>`CNPJ nº ${v}`),optionalSentence(c.legalEntity.representativeName,(v)=>`representada por ${v}`),optionalSentence(c.legalEntity.representativeDocument,(v)=>`CPF nº ${v}`),safeValue(c.legalEntity.representativeRole)]);
  return join([safeValue(c.owner.name),safeValue(c.owner.nationality),safeValue(c.owner.profession),safeValue(c.owner.civilStatus),optionalSentence(c.owner.propertyRegime,(v)=>`sob o regime de ${v}`),optionalSentence(c.owner.rg,(v)=>`RG nº ${v}${safeValue(c.owner.rgIssuer)?` - ${safeValue(c.owner.rgIssuer)}${safeValue(c.owner.rgState)?`/${safeValue(c.owner.rgState)}`:""}`:""}`),optionalSentence(c.owner.document,(v)=>`CPF nº ${v}`),optionalSentence(c.owner.birthDate,(v)=>`nascido(a) em ${v}`)]);
}
function address(c){const line=join([safeValue(c.owner.address),safeValue(c.owner.addressNumber),safeValue(c.owner.addressComplement),safeValue(c.owner.district),safeValue(c.owner.municipality),safeValue(c.owner.state),optionalSentence(c.owner.postalCode,(v)=>`CEP ${v}`)]);return line?`residente e domiciliado(a) em ${line}`:"";}
function spouse(c){if(!safeValue(c.spouse.name))return"";return `, juntamente com seu cônjuge/companheiro(a) ${join([safeValue(c.spouse.name),safeValue(c.spouse.nationality),safeValue(c.spouse.profession),optionalSentence(c.spouse.rg,(v)=>`RG nº ${v}`),optionalSentence(c.spouse.document,(v)=>`CPF nº ${v}`)])}`;}
export function buildRequestTemplate(c){
 const destination=join([safeValue(c.procedure.destinationOffice),optionalSentence(c.procedure.district,(v)=>`Comarca de ${v}`),safeValue(c.registry.state)]);
 const contacts=join([optionalSentence(c.owner.phone,(v)=>`telefone ${v}`),optionalSentence(c.owner.email,(v)=>`e-mail ${v}`)]);
 const procedureRefs=join([optionalSentence(c.procedure.returnNote,(v)=>`Nota Devolutiva nº ${v}`),optionalSentence(c.procedure.serviceOrder,(v)=>`Ordem de Serviço nº ${v}`),optionalSentence(c.procedure.protocol,(v)=>`Protocolo nº ${v}`)]);
 const technical=join([safeValue(c.technical.name),safeValue(c.technical.profession),safeValue(c.technical.council)?`${safeValue(c.technical.council)} nº ${safeValue(c.technical.registrationNumber)}`:optionalSentence(c.technical.registrationNumber,(v)=>`registro profissional nº ${v}`),optionalSentence(c.technical.accreditation,(v)=>`credenciamento INCRA ${v}`),safeValue(c.technical.responsibilityTerm)]);
 const property=join([safeValue(c.property.name),optionalSentence(c.registry.registrationNumber,(v)=>`matrícula nº ${v}`),optionalSentence(c.registry.cns,(v)=>`CNS ${v}`),optionalSentence(c.property.incraCode,(v)=>`código INCRA/SNCR ${v}`),optionalSentence(c.property.area,(v)=>`área georreferenciada de ${v} ha`),optionalSentence(c.sigef.certification,(v)=>`certificação SIGEF ${v}`)]);
 return cleanDocumentText(`REQUERIMENTO DE AVERBAÇÃO DE GEORREFERENCIAMENTO

AO ILUSTRÍSSIMO SENHOR OFICIAL DO ${destination}

${ownerQualification(c)}${spouse(c)}${address(c)?`, ${address(c)}`:""}${contacts?`, ${contacts}`:""}, vem respeitosamente requerer a averbação do georreferenciamento do imóvel rural ${property}.

O pedido é formulado nos termos dos artigos 212 e 213 da Lei nº 6.015/1973, da Lei nº 10.267/2001 e de sua regulamentação, mediante planta e memorial descritivo assinados por profissional legalmente habilitado e acompanhados do respectivo documento de responsabilidade técnica.

O levantamento respeita os limites e direitos dos confrontantes, conforme documentação técnica e declarações que instruem o procedimento.${technical?` O trabalho técnico foi executado por ${technical}.`:""}${procedureRefs?` Referências do procedimento: ${procedureRefs}.`:""}${safeValue(c.property.fiscalValue)?` Valor declarado do imóvel para fins fiscais: R$ ${safeValue(c.property.fiscalValue)}.`:""}

Termos em que, pede deferimento.

${safeValue(c.procedure.signatureMunicipality)}${safeValue(c.procedure.requestDate)?`, ${safeValue(c.procedure.requestDate)}.`:""}

_______________________________________________
${safeValue(c.owner.name)}
Proprietário(a)${safeValue(c.owner.document)?` · CPF ${safeValue(c.owner.document)}`:""}${safeValue(c.spouse.name)?`

_______________________________________________
${safeValue(c.spouse.name)}
Cônjuge/Companheiro(a)${safeValue(c.spouse.document)?` · CPF ${safeValue(c.spouse.document)}`:""}`:""}`);
}

export function buildOwnerLimitsDeclaration(c){return cleanDocumentText(`DECLARAÇÃO DO PROPRIETÁRIO SOBRE RESPEITO AOS LIMITES

${ownerQualification(c)}, proprietário(a) do imóvel rural ${join([safeValue(c.property.name),optionalSentence(c.registry.registrationNumber,(v)=>`matrícula nº ${v}`),optionalSentence(c.registry.cns,(v)=>`CNS ${v}`),optionalSentence(c.sigef.certification,(v)=>`certificação SIGEF ${v}`)])}, declara, sob as responsabilidades civil e criminal aplicáveis, que o levantamento georreferenciado respeita os limites materiais, a posse e os direitos dos imóveis confrontantes, não tendo promovido alteração unilateral das divisas.

A presente declaração é emitida para instruir o procedimento de averbação de georreferenciamento perante o Registro de Imóveis competente.

${safeValue(c.procedure.signatureMunicipality)}${safeValue(c.procedure.requestDate)?`, ${safeValue(c.procedure.requestDate)}.`:""}

_______________________________________________
${safeValue(c.owner.name)}
Proprietário(a)${safeValue(c.owner.document)?` · CPF ${safeValue(c.owner.document)}`:""}`);}
