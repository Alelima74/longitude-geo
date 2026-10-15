export const EVALUATION_TYPES = [
  { value: "VTN_ITR", label: "Valor da Terra Nua (VTN / ITR)" },
  { value: "RURAL_MARKET", label: "Valor de mercado rural" },
  { value: "TAX_PURPOSE", label: "Avaliação para fins tributários" },
];

export const emptyEvaluationProject = () => ({
  id: `eval-${Date.now()}`,
  status: "DRAFT",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  projectName: "",
  evaluationType: "RURAL_MARKET",
  clientId: "",
  propertyId: "",
  property: { name: "", municipality: "", state: "MT", areaHa: "", registration: "", car: "", sigef: "", source: "" },
  sourceMatrix: { registry: "PENDING", cadastre: "PENDING", environmental: "PENDING", landUse: "PENDING", market: "PENDING" },
  areas: { totalHa: "", usefulHa: "", reserveHa: "", preservationHa: "", otherHa: "" },
  tax: { vtnPerHa: "", year: new Date().getFullYear(), municipality: "", declarationNotes: "" },
  market: { method: "COMPARATIVE_DIRECT", referenceDate: "", notes: "", comparables: [] },
});

export function calculateEvaluation(project) {
  const area = Number(project?.areas?.totalHa || project?.property?.areaHa || 0);
  const vtn = Number(project?.tax?.vtnPerHa || 0);
  const taxEstimate = area * vtn;
  const values = (project?.market?.comparables || []).map((item) => Number(item.unitValue || 0)).filter(Boolean);
  const marketUnit = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return { areaHa: area, taxEstimate, marketUnitValue: marketUnit, marketEstimate: area * marketUnit, comparableCount: values.length };
}

export const formatBRL = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
