import { figure, paragraph, section } from "../helpers.mjs";
import { getRegionalKnowledge } from "../regionalKnowledgeBase.mjs";
export function composeRegionalCharacterization(p) {
  const r = getRegionalKnowledge(p.property?.municipality, p.property?.state);
  if (!r) return section("regional", "5", "CARACTERIZAÇÃO DA REGIÃO", [paragraph("Caracterização regional ainda não cadastrada.")], { regionalMissing: true, source: null });
  return section("regional", "5", "CARACTERIZAÇÃO DA REGIÃO", [
    paragraph("A leitura regional contextualiza o imóvel no mercado e no ambiente físico em que se insere. Os textos seguintes possuem escala municipal e não substituem a caracterização específica da propriedade."),
    { type: "subheading", number: "5.1", title: "LOCALIZAÇÃO DO MUNICÍPIO" }, paragraph(r.location), figure(`Figura 1 - Localização regional de ${r.municipality}/${r.state}.`),
    { type: "subheading", number: "5.2", title: "ASPECTOS FÍSICOS" }, paragraph("Os aspectos físicos são apresentados por temas para permitir a leitura integrada das condições regionais relevantes à ocupação rural e à formação de valor."),
    { type: "subheading", number: "5.2.1", title: "ASPECTOS PEDOLÓGICOS" }, paragraph(r.pedology),
    { type: "subheading", number: "5.2.2", title: "UNIDADE DE RELEVO" }, paragraph(r.relief),
    { type: "subheading", number: "5.2.3", title: "ASPECTOS DE VEGETAÇÃO" }, paragraph(r.vegetation),
    { type: "subheading", number: "5.2.4", title: "ASPECTOS DA HIDROGRAFIA" }, paragraph(r.hydrography),
    { type: "subheading", number: "5.3", title: "ASPECTOS ECONÔMICOS E ESTRUTURA FUNDIÁRIA" }, paragraph(r.economy),
    { type: "source", content: `Fonte: ${r.source}. Atualização: ${r.updatedAt}. Revisão: ${r.reviewedBy}.` }
  ], { source: r });
}
