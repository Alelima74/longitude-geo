export const FORBIDDEN_DOCUMENT_TOKENS = [", ,", " ,.", "undefined", "null", "PREENCHER", "DADO PENDENTE", "...", "fuso ,", "Meridiano Central nº ,", "Métrica TOPO"];
export function documentTextIssues(text = "") { const source=String(text).toLocaleLowerCase("pt-BR"); return FORBIDDEN_DOCUMENT_TOKENS.filter((token)=>source.includes(token.toLocaleLowerCase("pt-BR"))); }
export function cleanDocumentText(text = "") { return String(text).replace(/\s+,/g, ",").replace(/,\s*,+/g, ", ").replace(/\s+\./g, ".").replace(/[ \t]{2,}/g, " ").replace(/\n[ \t]+/g, "\n").trim(); }
export function safeValue(value, fallback = "") { const result=String(value?.value??value??"").trim(); return /^(undefined|null|\[?dado pendente\]?|preencher)$/i.test(result)?fallback:result; }
export function optionalSentence(value,builder){const clean=safeValue(value);return clean?builder(clean):"";}
