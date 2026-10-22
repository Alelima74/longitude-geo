const clean = (value = "") => String(value).replace(/[\t ]+/g, " ").trim();
const normalize = (raw = "") => String(raw).replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n");
const capture = (source, pattern) => clean((source.match(pattern) || [])[1]);
const numberBR = (value) => { if (!value) return null; let normalized = String(value).replace(/\s/g, "").replace(/[^\d.,+-]/g, ""); if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", "."); const result = Number(normalized); return Number.isFinite(result) ? result : null; };

export function parseRegistryDocument(rawText) {
  const source = normalize(rawText);
  if (!source.trim()) return { fields: emptyFields(), fieldValidation: validationsFor(emptyFields()), acts: [], warnings: ["A matrícula não contém texto pesquisável."] };
  const municipalityUf = source.match(/(?:Município|Imóvel situado em)\s*(?:\/\s*UF)?\s*[:\-]?\s*([^\n,;]+?)\s*(?:\/|-(?=[A-Z]{2}\b)|,\s*)\s*([A-Z]{2})\b/i);
  const registrationCandidate = capture(source, /(?:Matrícula|Registro)(?:\s+n[º°o.]*)?\s*[:\-]?\s*([\d./-]+)/i);
  const fields = {
    registrationNumber: validRegistration(registrationCandidate) ? registrationCandidate : "", cns: capture(source, /CNS\s*[:\-]?\s*([\d.-]+)/i), registryOffice: limited(capture(source, /(?:Cartório|Serventia|Ofício de Registro de Imóveis)\s*[:\-]?\s*([^\n;,]{2,100})/i), 100), district: limited(capture(source, /Comarca\s*[:\-]?\s*([^\n;,]{2,60})/i), 60), municipality: validPlace(clean(municipalityUf?.[1] || capture(source, /Município\s*[:\-]\s*([^\n/;,]{2,60})/i))), state: clean(municipalityUf?.[2] || capture(source, /(?:UF|Estado)\s*[:\-]\s*([A-Z]{2})\b/i)), propertyName: limited(capture(source, /(?:Denominação(?: do imóvel)?|Imóvel denominado)\s*[:\-]?\s*([^\n;]{2,120})/i), 120), owner: limited(capture(source, /(?:Proprietário(?: atual)?|Proprietária(?: atual)?|Adquirente)\s*(?:\(a\))?\s*[:\-]?\s*([^\n;]{2,120})/i), 120), ownerDocument: capture(source, /(?:CPF|CNPJ)(?:\s+do proprietário)?\s*[:\-]?\s*([\d./-]+)/i), previousArea: numberBR(capture(source, /(?:Área registral|Área do imóvel|Área)\s*[:\-]?\s*([\d.]+,\d+)\s*(?:ha|hectares?)/i)), incraCode: capture(source, /(?:Código INCRA|SNCR)\s*[:\-]?\s*([\d.-]+)/i), ccir: capture(source, /CCIR\s*[:\-]?\s*([\d.-]+)/i), nirfCib: capture(source, /(?:NIRF|CIB)\s*[:\-]?\s*([\w.-]+)/i), car: capture(source, /(?:CAR|Cadastro Ambiental Rural)\s*[:\-]?\s*([\w.-]+)/i),
  };
  const acts = source.split("\n").map(clean).filter((line) => /^(?:R|AV)[.-]?\s*\d+/i.test(line));
  const fieldValidation = validationsFor(fields);
  if (registrationCandidate && !fields.registrationNumber) fieldValidation.registrationNumber = { status: "REJEITADO", reason: "Número incompatível com o contexto de matrícula." };
  return { fields, fieldValidation, acts, warnings: Object.values(fields).some((value) => value !== "" && value != null) ? [] : ["Nenhum campo registral estruturado foi identificado."] };
}
function emptyFields() { return { registrationNumber: "", cns: "", registryOffice: "", district: "", municipality: "", state: "", propertyName: "", owner: "", ownerDocument: "", previousArea: null, incraCode: "", ccir: "", nirfCib: "", car: "" }; }
function validRegistration(value) { const digits = String(value || "").replace(/\D/g, ""); return digits.length >= 2 && digits.length <= 20; }
function limited(value, maximum) { const result = clean(value); return result.length <= maximum ? result : ""; }
function validPlace(value) { const result = limited(value, 60); return /\b(?:propriet[aá]ri[oa]|cpf|cnpj|matr[ií]cula|registro)\b/i.test(result) ? "" : result; }
function validationsFor(fields) { return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { status: value === "" || value == null ? "NÃO IDENTIFICADO" : "CONFERIR", reason: value === "" || value == null ? "Campo não localizado em contexto válido." : "Valor proposto para revisão do usuário." }])); }
