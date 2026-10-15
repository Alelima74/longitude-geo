import { composeApplicantIdentification, composeLimitations, composeOwnerIdentification, composePurpose } from "./blocks/identification.mjs";
import { composeRegionalCharacterization } from "./blocks/regional.mjs";
import { composeProperty } from "./blocks/property.mjs";
import { composeFactors, composeFundamentation, composeHomogenization, composeMarket, composeMethodology, composeResult, composeStatistics } from "./blocks/valuation.mjs";
import { composeFinalConsiderations, composeReferencesAndAnnexes, composeTaxAnalysis, composeTechnicalConclusion } from "./blocks/taxConclusion.mjs";
import { pending } from "./helpers.mjs";

const titles = { VTN_ITR: "LAUDO TÉCNICO DE AVALIAÇÃO DO VALOR DA TERRA NUA - VTN", RURAL_MARKET: "LAUDO TÉCNICO DE AVALIAÇÃO DE IMÓVEL RURAL", TAX_PURPOSE: "LAUDO TÉCNICO PARA FINALIDADE DE GARANTIA TRIBUTÁRIA" };
function applyOverride(section, overrides = {}) {
  const override = overrides[section.id];
  return override ? { ...section, generatedBlocks: section.blocks, blocks: [{ type: "paragraph", content: override.text }], manuallyEdited: true, editedAt: override.editedAt } : { ...section, manuallyEdited: false };
}
export function composeEvaluationDocument(project) {
  const rawSections = [composeApplicantIdentification(project), composeOwnerIdentification(project), composePurpose(project), composeLimitations(project), composeRegionalCharacterization(project), composeProperty(project), composeMethodology(project), composeMarket(project), composeFactors(project), composeHomogenization(project), composeStatistics(project), composeFundamentation(project), composeResult(project), composeTaxAnalysis(project), composeFinalConsiderations(project), composeTechnicalConclusion(project), ...composeReferencesAndAnnexes(project)];
  const sections = rawSections.map(s => applyOverride(s, project.documentOverrides));
  const critical = [];
  if (!project.property?.name) critical.push("Nome do imóvel");
  if (!project.property?.municipality || !project.property?.state) critical.push("Município/UF");
  if (!Number(project.adoptedArea || project.property?.areaHa)) critical.push("Área adotada");
  if (!(project.market?.comparables || []).length) critical.push("Pesquisa de mercado");
  if (!project.technical?.responsible) critical.push("Responsável técnico");
  const occurrences = JSON.stringify(sections).split(pending).length - 1;
  return { id: project.id, title: titles[project.evaluationType], subtitle: project.purpose || "Avaliação técnica rural", property: project.property, metadata: { municipality: project.property?.municipality, state: project.property?.state, dateBase: project.market?.referenceDate || "01/01/2025", responsible: project.technical?.responsible, registration: project.technical?.registration, demo: project.isDemo }, summary: sections.map(({ number, title, id }) => ({ number, title, id })), sections, validation: { critical, pendingOccurrences: occurrences, canFinalize: critical.length === 0 && occurrences === 0 } };
}
export function setSectionOverride(project, sectionId, text) { return { ...project, documentOverrides: { ...(project.documentOverrides || {}), [sectionId]: { text, editedAt: new Date().toISOString() } } }; }
export function regenerateSection(project, sectionId) { const next = { ...(project.documentOverrides || {}) }; delete next[sectionId]; return { ...project, documentOverrides: next }; }
