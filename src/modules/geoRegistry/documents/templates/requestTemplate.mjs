import { pending } from "../formatters/cartorialFormatters.mjs";
const p = pending;
export function buildRequestTemplate(c) {
  const spouse = c.spouse.name.value ? `, tendo como cônjuge/companheiro(a) ${p(c.spouse.name)}, portador(a) do RG nº ${p(c.spouse.rg)} e CPF nº ${p(c.spouse.document)}, data de nascimento ${p(c.spouse.birthDate)}` : "";
  return `REQUERIMENTO RETIFICAÇÃO DE ÁREA

AO ILUSTRÍSSIMO SENHOR OFICIAL DO ${p(c.procedure.destinationOffice)} DA COMARCA DE ${p(c.procedure.district)}/${p(c.registry.state)}

Eu, ${p(c.owner.name)}, ${p(c.owner.nationality)}, ${p(c.owner.profession)}, ${p(c.owner.civilStatus)}${c.owner.propertyRegime.value ? ` sob o regime de ${c.owner.propertyRegime.value}` : ""}, portador(a) do RG nº ${p(c.owner.rg)} - ${p(c.owner.rgIssuer)}, CPF/CNPJ nº ${p(c.owner.document)}, data de nascimento ${p(c.owner.birthDate)}${spouse}, residente e domiciliado(a) em ${p(c.owner.address)}, bairro ${p(c.owner.district)}, ${p(c.owner.municipality)}/${p(c.owner.state)}, CEP ${p(c.owner.postalCode)}, e-mail ${p(c.owner.email)}, telefone ${p(c.owner.phone)}, venho, por meio deste, requerer a retificação da área do imóvel rural denominado ${p(c.property.name)}, matrícula nº ${p(c.registry.registrationNumber)}, cadastrado no INCRA sob o código nº ${p(c.property.incraCode)}, conforme levantamento topográfico e georreferenciamento realizado.

O pedido é formulado nos termos do art. 213, II, da Lei nº 6.015/1973, da Lei nº 10.267/2001, regulamentada pelo Decreto nº 4.449/2002, e das alterações introduzidas pela Lei nº 10.931/2004, mediante planta e memorial descritivo assinados por profissional legalmente habilitado e acompanhados do respectivo documento de responsabilidade técnica.

O imóvel encontra-se certificado no Sistema de Gestão Fundiária - SIGEF sob o código ${p(c.sigef.certification)}. As divisas foram respeitadas, sem alteração dos direitos dos confrontantes, conforme representação gráfica, memorial descritivo e declarações anexas.

Nota Devolutiva: ${p(c.procedure.returnNote)}
Ordem de Serviço: ${p(c.procedure.serviceOrder)}
Protocolo: ${p(c.procedure.protocol)}

O levantamento foi realizado pelo responsável técnico ${p(c.technical.name)}, ${p(c.technical.profession)}, ${p(c.technical.council)} nº ${p(c.technical.registrationNumber)}, credenciamento INCRA ${p(c.technical.accreditation)}, ${p(c.technical.responsibilityTerm)}.

O(s) requerente(s) declara(m) verdadeiras as informações prestadas neste requerimento e nos documentos anexos, sob as responsabilidades civil e criminal aplicáveis, reiterando que foram respeitados os direitos dos confrontantes.

Seguem anexas as plantas, os memoriais descritivos, o documento de responsabilidade técnica e os demais documentos necessários ao procedimento.

Termos em que,
Pede deferimento.

${p(c.procedure.signatureMunicipality)}, ${p(c.procedure.requestDate)}

_______________________________________________
${p(c.owner.name)}
Proprietário(a)${c.spouse.name.value ? `

_______________________________________________
${c.spouse.name.value}
Cônjuge/Companheiro(a)` : ""}`;
}
