import { paragraph, section, text } from "../helpers.mjs";
export function composeApplicantIdentification(p) {
  const name = text(p.client?.name);
  return section("applicant", "1", "IDENTIFICAÇÃO DO SOLICITANTE", [paragraph(`${name}, qualificado nos documentos integrantes do processo, figura na qualidade de solicitante do presente trabalho técnico. As informações pessoais e de representação devem ser conferidas com os documentos originais antes da emissão final.`)]);
}
export function composeOwnerIdentification(p) {
  const owner = text(p.property?.owner), same = owner === p.client?.name;
  return section("owner", "2", "IDENTIFICAÇÃO DO PROPRIETÁRIO", [paragraph(same ? `O solicitante acima identificado também consta como proprietário do imóvel avaliando, razão pela qual se evita a repetição de sua qualificação. A titularidade considerada decorre da documentação registral analisada.` : `${owner} consta como proprietário ou titular indicado do imóvel avaliando. A relação entre solicitante, proprietário e eventual representante deve ser verificada na matrícula, procuração ou instrumento jurídico pertinente.`)]);
}
export function composePurpose(p) {
  const isVtn = p.evaluationType === "VTN_ITR", isTax = p.evaluationType === "TAX_PURPOSE";
  const purpose = isVtn ? "determinar o Valor da Terra Nua - VTN, na data-base indicada, sem inclusão de construções, instalações, benfeitorias, culturas, pastagens cultivadas ou florestas plantadas" : isTax ? "determinar o valor de mercado do imóvel para instrução de análise de garantia tributária" : "determinar o valor de mercado do imóvel rural";
  return section("purpose", "3", "OBJETO, OBJETIVO E FINALIDADE", [paragraph(`O objeto deste laudo é o imóvel rural denominado ${text(p.property?.name)}, situado em ${text(p.property?.municipality)}/${text(p.property?.state)}. O trabalho tem por objetivo ${purpose}.`), paragraph(`A conclusão é vinculada ao escopo, à data-base e aos documentos disponibilizados. O laudo não substitui certidões registrais, licenças, levantamentos ambientais, auditoria jurídica ou investigação de passivos que não tenham sido expressamente contratados.`)]);
}
export function composeLimitations(p) {
  return section("limitations", "4", "PRESSUPOSTOS, RESSALVAS E LIMITAÇÕES", [paragraph("Admitiram-se como autênticos e representativos os documentos apresentados, sem prejuízo da conferência de sua validade pelos órgãos competentes. Informações de terceiros foram empregadas como elementos de pesquisa e devem ser rastreáveis à respectiva fonte."), paragraph("As áreas cadastrais e registrais possuem finalidades próprias e não são automaticamente equivalentes. Eventuais diferenças são expostas tecnicamente, sem tentativa de conciliação jurídica automática. A inspeção de campo, quando não comprovada no projeto, deve ser indicada como pendência."), paragraph(`A responsabilidade técnica pela versão final caberá a ${text(p.technical?.responsible)}, mediante registro profissional ${text(p.technical?.registration)} e emissão do documento de responsabilidade aplicável.`)]);
}
