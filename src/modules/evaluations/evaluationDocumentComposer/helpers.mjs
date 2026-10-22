export const pending = "[INFORMAÇÃO PENDENTE DE REVISÃO]";
export const text = value => String(value || "").trim() || pending;
export const numberBR = (value, digits = 4) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const moneyBR = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const paragraph = content => ({ type: "paragraph", content });
export const table = (headers, rows, caption) => ({ type: "table", headers, rows, caption });
export const callout = (title, items) => ({ type: "result", title, items });
export const figure = (caption, label = "FIGURA TÉCNICA / MAPA A INSERIR") => ({ type: "figure", caption, label });
export const bullets = items => ({ type: "bullets", items });
export function statistics(comparables = []) {
  const values = comparables.map(x => Number(x.homogenizedValue)).filter(Number.isFinite);
  if (!values.length) return { mean: 0, median: 0, sd: 0, cv: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const sd = values.length > 1 ? Math.sqrt(values.reduce((a, x) => a + (x - mean) ** 2, 0) / (values.length - 1)) : 0;
  return { mean, median, sd, cv: mean ? sd / mean * 100 : 0, min: Math.min(...values), max: Math.max(...values) };
}
export function section(id, number, title, blocks, options = {}) { return { id, number, title, blocks, ...options }; }
