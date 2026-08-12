import { formatNumberBR, ownerQualification, pending } from "../formatters/cartorialFormatters.mjs";

export function buildRequestTemplate(context) {
  const qualification = ownerQualification(context.owner);
  return `AO ILUSTRÍSSIMO SENHOR OFICIAL DO REGISTRO DE IMÓVEIS DA COMARCA DE ${pending(context.registry.district)}/${pending(context.registry.state)}

${pending(context.owner.name)}${qualification ? `, ${qualification},` : ","} proprietário(a) do imóvel rural denominado ${pending(context.property.name)}, objeto da matrícula nº ${pending(context.registry.registrationNumber)}, do ${pending(context.registry.office)}, vem requerer a averbação do georreferenciamento do referido imóvel.

O imóvel foi objeto de levantamento georreferenciado e encontra-se certificado no Sistema de Gestão Fundiária – SIGEF, sob a certificação nº ${pending(context.sigef.certification)}, apresentando área georreferenciada de ${formatNumberBR(context.property.area, 4)} ha e perímetro de ${formatNumberBR(context.property.perimeter, 2)} m.

O levantamento técnico foi realizado sob responsabilidade de ${pending(context.sigef.surveyor)}, credenciamento INCRA/SIGEF ${pending(context.sigef.accreditation)}.

Diante do exposto, requer-se a averbação do georreferenciamento na matrícula do imóvel, com a atualização da descrição tabular e demais atos pertinentes.

Termos em que,
Pede deferimento.

${pending(context.property.municipality)}, ${pending(context.generatedAt)}

____________________________________
${pending(context.owner.name)}`;
}
