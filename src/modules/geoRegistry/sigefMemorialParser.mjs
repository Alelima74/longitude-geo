import proj4 from "proj4";
import { parseSigefSegmentTable } from "./sigefLayoutParser.mjs";

const clean = (value = "") => String(value).replace(/[\t ]+/g, " ").trim();
const normalizeText = (value = "") => String(value).replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n").trim();
export const numberBR = (value) => {
  if (value == null || value === "") return null;
  let normalized = String(value).replace(/\s/g, "").replace(/[^\d.,+-]/g, "");
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if ((normalized.match(/\./g) || []).length > 1) normalized = normalized.replace(/\./g, "");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};
const dms = (degree, minute, second, hemisphere) => {
  const result = Math.abs(Number(degree)) + Number(minute) / 60 + numberBR(second) / 3600;
  return /[SWO]/i.test(hemisphere) ? -result : result;
};
const SIGEF_VERTEX_CODE = String.raw`[A-Z0-9]{2,10}-[MPV]-\d{2,10}`;
const KNOWN_LABEL = /(?:DENOMINAÇÃO(?: DO IMÓVEL)?|PROPRIETÁRIO|DETENTOR|CPF|CNPJ|MATRÍCULA|CNS|NATUREZA DA ÁREA|MUNICÍPIO|UF|CÓDIGO INCRA|SNCR|RESPONSÁVEL TÉCNICO|PROFISSIONAL CREDENCIADO|CREDENCIAMENTO|SISTEMA GEODÉSICO|DATUM|ÁREA(?: \([^)]*\))?|PERÍMETRO(?: \([^)]*\))?|CERTIFICAÇÃO|CÓDIGO DA PARCELA|DESCRIÇÃO DO PERÍMETRO|VÉRTICES|CONFRONTAÇÕES)\s*[:\-]?/gi;

function blockField(text, labels, normalizer = clean, quality = "ALTA") {
  const labelPattern = new RegExp(`(?:${labels.join("|")})\\s*[:\\-]?`, "gi");
  const values = [];
  for (const match of text.matchAll(labelPattern)) {
    const start = match.index + match[0].length;
    KNOWN_LABEL.lastIndex = start;
    const next = KNOWN_LABEL.exec(text);
    const block = clean(text.slice(start, next?.index ?? text.length).split("\n").filter(Boolean)[0] || "");
    if (block && block.length <= 180 && !values.includes(block)) values.push(block);
  }
  return { value: values.length === 1 ? normalizer(values[0]) : "", candidates: values.map(normalizer), confidence: values.length === 1 ? quality : values.length > 1 ? "AMBÍGUA" : "NÃO IDENTIFICADA", ambiguous: values.length > 1, inconsistent: values.some((item) => item.length > 180) };
}
function candidates(text, patterns, normalizer = clean) {
  const found = [];
  for (const pattern of patterns) {
    const source = text;
    for (const match of source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))) {
      const result = normalizer(match[1]); if (result !== "" && result != null && !found.some((item) => String(item) === String(result))) found.push(result);
    }
  }
  return found;
}
function field(text, patterns, normalizer = clean, quality = "ALTA") {
  const values = candidates(text, patterns, normalizer);
  return { value: values.length === 1 ? values[0] : "", candidates: values, confidence: values.length === 1 ? quality : values.length > 1 ? "AMBÍGUA" : "NÃO IDENTIFICADA", ambiguous: values.length > 1 };
}

export function parseSigefMemorialText(rawText, layout = {}) {
  const text = normalizeText(rawText);
  if (!text) return emptyResult("O PDF não contém texto pesquisável.");
  const parsed = {
    property: {
      name: blockField(text, ["DENOMINAÇÃO(?: DO IMÓVEL)?", "NOME DO IMÓVEL"]),
      municipality: blockField(text, ["MUNICÍPIO"]),
      state: field(text, [/(?:UF|Estado)\s*[:\-]\s*([A-Z]{2})\b/i]),
      area: field(text, [/Área(?:\s*\([^)]*\)|\s+(?:total|certificada|do imóvel))?\s*[:\-]?\s*([\d.]+,\d+)\s*(?:ha|hectares?)/i], numberBR),
      perimeter: field(text, [/Perímetro(?:\s*\([^)]*\)|\s+(?:total|certificado))?\s*[:\-]?\s*([\d.]+,\d+)\s*m(?:etros?)?\b/i], numberBR),
    },
    registry: {
      registrationNumber: field(text, [/(?:Registro\s*\/\s*)?Matrícula(?:\s+do\s+imóvel)?\s*(?:n[º°o.]*)?\s*[:\-]?\s*([\d./-]+)/i]),
      cns: field(text, [/CNS\s*[:\-]?\s*([\d.-]+)/i]),
      registryOffice: field(text, [/(?:Cartório|Serventia)\s*[:\-]\s*([^\n;]+)/i]),
      owner: blockField(text, ["PROPRIETÁRIO", "DETENTOR"]),
    },
    sigef: {
      certificationId: field(text, [/(?:Certificação|Código da certificação|UUID)\s*[:\-]?\s*([\w-]{8,})/i]),
      parcelId: field(text, [/(?:Código da parcela|Parcela)\s*[:\-]?\s*([\w.-]+)/i]),
      certificationDate: field(text, [/(?:Data da certificação|Certificado em)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i]),
      surveyor: field(text, [/(?:Responsável técnico|Profissional credenciado|Credenciado)\s*[:\-]\s*([^\n;]+)/i]),
      accreditationCode: field(text, [/(?:Código de credenciamento|Credenciamento(?: INCRA)?)\s*[:\-]?\s*([\w.-]+)/i]),
      status: field(text, [/(?:Situação|Status)\s*[:\-]\s*([^\n;]+)/i], clean, "MÉDIA"),
    },
    geodesy: {
      datum: field(text, [/(?:Datum|Sistema geodésico)\s*[:\-]\s*([^\n;]+)/i]),
      coordinateSystem: field(text, [/(?:Sistema de coordenadas|Projeção)\s*[:\-]\s*([^\n;]+)/i]),
      utmZone: field(text, [/(?:Fuso|Zona UTM)\s*[:\-]?\s*(\d{1,2}[A-Z]?)/i]),
      centralMeridian: field(text, [/Meridiano central\s*[:\-]?\s*([^\n;]+)/i]),
      hemisphere: field(text, [/(?:Hemisfério)\s*[:\-]?\s*(Norte|Sul|N|S)/i]),
    },
  };
  const coordinateResult = parseVertices(text, parsed.geodesy);
  const validCode = new RegExp(`^${SIGEF_VERTEX_CODE}$`, "i");
  const extractedSegments = [...parseSigefSegmentTable(layout.items, layout.lines), ...parseStrictSegments(text)]
    .filter((item) => validCode.test(item.fromVertex) && validCode.test(item.toVertex))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.fromVertex === item.fromVertex && candidate.toVertex === item.toVertex) === index);
  const rawSegmentStructure = extractRawSegmentStructure(text, coordinateResult.vertices);
  const data = unwrap(parsed);
  if (data.property.area === "") data.property.area = null;
  if (data.property.perimeter === "") data.property.perimeter = null;
  applyStructuredFieldFallbacks(data, text, parsed);
  if (!data.sigef.status) data.sigef.status = "Não informado no Memorial";
  data.sigef.statusSource = "MEMORIAL";
  if (!data.sigef.parcelId) data.sigef.parcelId = "Não informado no Memorial";
  data.sigef.parcelIdSource = "MEMORIAL";
  data.vertices = coordinateResult.vertices; data.boundaries = buildOrderedSegments(coordinateResult.vertices, extractedSegments, text);
  const fieldDiagnostics = flattenFields(parsed);
  const warnings = [];
  const ambiguousFields = fieldDiagnostics.filter((item) => item.ambiguous);
  if (ambiguousFields.length) warnings.push("Mais de uma informação possível encontrada. Selecione o valor correto.");
  if (!data.vertices.some((item) => item.status === "OK")) warnings.push("Não foi possível identificar coordenadas estruturadas suficientes no memorial.");
  if (coordinateResult.coordinateType === "UTM" && !coordinateResult.converted) warnings.push("Não foi possível converter as coordenadas UTM porque o documento não forneceu parâmetros suficientes.");
  return { data, warnings, confidence: overallConfidence(fieldDiagnostics), fieldDiagnostics, coordinateType: coordinateResult.coordinateType, coordinateMessage: coordinateResult.message, extractedSegments, reconstructedSegments: data.boundaries.filter((item) => item.origin === "RECONSTRUÍDO"), rawSegmentStructure, rawPdfItems: layout.items || [], reconstructedPdfLines: layout.lines || [], rawVertexRecords: coordinateResult.vertices, rawSegmentRecords: data.boundaries, ambiguousFields };
}

function parseVertices(text, geodesy) {
  const records = []; const matchedLines = new Set();
  const dmsPattern = new RegExp(`\\b(${SIGEF_VERTEX_CODE})\\b[^\\n]{0,100}?(\\d{1,3})[°º]\\s*(\\d{1,2})['’′]\\s*([\\d.,]+)[\"”″]?\\s*([NS])[^\\n]{0,70}?(\\d{1,3})[°º]\\s*(\\d{1,2})['’′]\\s*([\\d.,]+)[\"”″]?\\s*([EWLO])`, "gi");
  for (const match of text.matchAll(dmsPattern)) { matchedLines.add(lineFor(text, match.index)); records.push(vertex(match[1], dms(match[2], match[3], match[4], match[5]), dms(match[6], match[7], match[8], match[9]), null, null, null, match[0], "geodésicas", "", `${match[2]}°${match[3]}'${match[4]}\" ${match[5].toUpperCase()}`, `${match[6]}°${match[7]}'${match[8]}\" ${match[9].toUpperCase()}`)); }
  const decimalPattern = new RegExp(`\\b(${SIGEF_VERTEX_CODE})\\b[^\\n]{0,60}?(-?\\d{1,2}[.,]\\d{4,})\\s*[,;\\s]+(-?\\d{2,3}[.,]\\d{4,})`, "gi");
  for (const match of text.matchAll(decimalPattern)) { const line = lineFor(text, match.index); if (!matchedLines.has(line)) records.push(vertex(match[1], numberBR(match[2]), numberBR(match[3]), null, null, null, match[0], "latitude/longitude")); }
  const utmPattern = new RegExp(`\\b(${SIGEF_VERTEX_CODE})\\b[^\\n]{0,80}?(?:E|Este)\\s*[:=]?\\s*([\\d.,]+)[^\\n]{0,35}?(?:N|Norte)\\s*[:=]?\\s*([\\d.,]+)(?:[^\\n]{0,25}?(?:H|Altitude)\\s*[:=]?\\s*([\\d.,]+))?`, "gi");
  const zone = parseInt(geodesy.utmZone.value, 10); const south = /^s(ul)?$/i.test(geodesy.hemisphere.value) || /sul/i.test(geodesy.coordinateSystem.value);
  const datum = geodesy.datum.value; const canConvert = Number.isInteger(zone) && zone >= 1 && zone <= 60 && !!datum && (/SIRGAS\s*2000/i.test(datum) || /WGS\s*84/i.test(datum));
  for (const match of text.matchAll(utmPattern)) { const east = numberBR(match[2]); const north = numberBR(match[3]); let longitude = null; let latitude = null; if (canConvert) [longitude, latitude] = proj4(`+proj=utm +zone=${zone} ${south ? "+south" : ""} +datum=WGS84 +units=m +no_defs`, "EPSG:4326", [east, north]); records.push(vertex(match[1], latitude, longitude, east, north, numberBR(match[4]), match[0], "UTM", canConvert ? "" : "Parâmetros UTM insuficientes")); }
  parseMultilineDmsVertices(text, records);
  const codeRegex = new RegExp(`\\b${SIGEF_VERTEX_CODE}\\b`, "i");
  const possible = text.split("\n").filter((line) => codeRegex.test(line) && /(?:°|Este|Norte|\bE\b.*\bN\b)/i.test(line));
  for (const raw of possible) { const code = (raw.match(codeRegex) || [""])[0]; if (!records.some((item) => item.code === code.toUpperCase())) records.push(vertex(code, null, null, null, null, null, raw, "outra representação", "Registro não interpretado")); }
  const unique = [...records.filter((item) => /\d/.test(item.code)).reduce((map, item) => { const current = map.get(item.code); if (!current || (current.status !== "OK" && item.status === "OK")) map.set(item.code, item); return map; }, new Map()).values()];
  const types = [...new Set(unique.map((item) => item.coordinateType))];
  return { vertices: unique, coordinateType: types.length === 1 ? types[0] : types.length ? types.join(" + ") : "Não identificado", converted: !unique.some((item) => item.coordinateType === "UTM") || canConvert, message: canConvert ? "Coordenadas UTM convertidas com proj4." : "" };
}
function parseMultilineDmsVertices(text, records) { const codePattern = new RegExp(`\\b(${SIGEF_VERTEX_CODE})\\b`, "gi"); const matches = [...text.matchAll(codePattern)]; for (let index = 0; index < matches.length; index += 1) { const code = matches[index][1].toUpperCase(); if (records.some((item) => item.code === code)) continue; const block = text.slice(matches[index].index + matches[index][0].length, matches[index + 1]?.index ?? Math.min(text.length, matches[index].index + 500)); const values = [...block.matchAll(/(-?\d{1,3})[°º]\s*(\d{1,2})['’′]\s*([\d.,]+)["”″]?\s*([NSEWLO])?/gi)].slice(0, 2); if (values.length < 2) continue; const first = signedDms(values[0]); const second = signedDms(values[1]); const longitudeMatch = Math.abs(first) > 30 ? values[0] : values[1]; const latitudeMatch = Math.abs(first) > 30 ? values[1] : values[0]; const longitude = Math.abs(first) > 30 ? first : second; const latitude = Math.abs(first) > 30 ? second : first; const altitude = numberBR((block.match(/(?:^|\n)\s*([\d.]+,\d{1,3})\s*(?:m)?\s*(?:\n|$)/m) || [])[1]); records.push(vertex(code, latitude, longitude, null, null, altitude, `${code} ${block.slice(0, 180)}`, "geodésicas", "", documentDms(latitudeMatch, "S"), documentDms(longitudeMatch, "W"))); } }
function documentDms(match, fallbackHemisphere) { return `${String(match[1]).replace(/^-/, "")}°${match[2]}'${match[3]}\" ${(match[4] || fallbackHemisphere).toUpperCase()}`; }
function signedDms(match) { const sign = String(match[1]).startsWith("-") ? -1 : 1; return sign * (Math.abs(Number(match[1])) + Number(match[2]) / 60 + numberBR(match[3]) / 3600); }
function parseStrictSegments(text) {
  const records = [];
  const pattern = new RegExp(`\\b(${SIGEF_VERTEX_CODE})\\s*(?:a|→|->)\\s*(${SIGEF_VERTEX_CODE})\\b([^\\n]{0,300})`, "gi");
  for (const match of text.matchAll(pattern)) {
    const tail = match[3];
    const distance = numberBR((tail.match(/(?:distância\s*[:\-]?\s*)?([\d.]+,\d+)\s*m\b/i) || [])[1]);
    const azimuth = clean((tail.match(/azimute\s*[:\-]?\s*(.+?)(?=\s+distância|$)/i) || [])[1]);
    const boundaryName = clean((tail.match(/(?:confrontando com|confrontante\s*[:\-])\s*(.{3,}?)(?=$|[.;])/i) || [])[1]);
    records.push({ fromVertex: match[1].toUpperCase(), toVertex: match[2].toUpperCase(), azimuth: azimuth || null, distance, boundaryName, boundaryType: "", raw: clean(match[0]), status: distance != null && boundaryName ? "OK" : "incompleto" });
  }
  return records;
}
function applyStructuredFieldFallbacks(data, text, parsed) {
  const capture = (pattern) => clean((text.match(pattern) || [])[1]);
  const municipalityUf = text.match(/Município\s*\/\s*UF\s*[:\-]?\s*([^\n/]+?)\s*(?:\/|\s+-\s*|-(?=[A-Z]{2}\b))\s*([A-Z]{2})\b/i);
  if (!data.property.municipality || data.property.municipality === "/") data.property.municipality = clean(municipalityUf?.[1] || capture(/Município\s*[:\-]\s*([^\n/;]+)/i));
  if (!data.property.state) data.property.state = clean(municipalityUf?.[2] || capture(/(?:UF|Estado)\s*[:\-]\s*([A-Z]{2})\b/i));
  if (!data.registry.registrationNumber && !parsed.registry.registrationNumber.ambiguous) data.registry.registrationNumber = capture(/(?:Registro\s*\/\s*)?Matrícula(?:\s+do\s+imóvel)?(?:\s*n[º°o.]*)?\s*[:\-]?\s*([\d./-]+)/i);
  if (!data.registry.owner) data.registry.owner = capture(/Proprietário(?:\(a\))?\s*[:\-]\s*([^\n;]+)/i);
  if (!data.sigef.surveyor) data.sigef.surveyor = capture(/Responsável Técnico(?:\(a\))?\s*[:\-]\s*([^\n;]+)/i);
  data.registry.owner = clean(data.registry.owner).replace(/^\(a\)\s*:\s*/i, "");
  data.sigef.surveyor = clean(data.sigef.surveyor).replace(/^\(a\)\s*:\s*/i, "");
  const geodesy = capture(/Sistema Geodésico de referência\s*[:\-]\s*([^\n;]+)/i);
  if (!data.geodesy.datum) data.geodesy.datum = geodesy || capture(/Datum\s*[:\-]\s*([^\n;]+)/i);
  if (!data.geodesy.coordinateSystem) data.geodesy.coordinateSystem = geodesy || capture(/Sistema de coordenadas\s*[:\-]\s*([^\n;]+)/i);
  const strictParcel = capture(/Código da parcela\s*[:\-]\s*([\w.-]+)/i);
  if (strictParcel) data.sigef.parcelId = strictParcel;
}
function buildOrderedSegments(vertices, extracted, text) {
  const valid = vertices.filter((item) => item.status === "OK");
  if (valid.length < 2) return extracted;
  return valid.map((item, index) => {
    const next = valid[(index + 1) % valid.length];
    const found = extracted.find((segment) => segment.fromVertex === item.code && segment.toVertex === next.code);
    if (found) return { ...found, origin: "MEMORIAL", azimuthDocument: found.azimuth, distanceDocument: found.distance };
    const boundaryName = boundaryForPair(text, item.code, next.code);
    return { fromVertex: item.code, toVertex: next.code, azimuth: null, distance: null, azimuthDocument: null, distanceDocument: null, boundaryName, boundaryType: "", raw: "", origin: "RECONSTRUÍDO", status: boundaryName ? "incompleto" : "segmento reconstruído; dados técnicos não identificados" };
  });
}
function extractRawSegmentStructure(text, vertices) {
  const codes = new Set(vertices.map((item) => item.code));
  const lines = text.split("\n");
  const selected = [];
  lines.forEach((line, index) => {
    const foundCodes = [...line.matchAll(new RegExp(SIGEF_VERTEX_CODE, "gi"))].map((match) => match[0].toUpperCase()).filter((code) => codes.has(code));
    if (foundCodes.length || /azimute|distância|confronta|vértice\s+(?:de|inicial|final)|lado/i.test(line)) {
      for (let cursor = Math.max(0, index - 1); cursor <= Math.min(lines.length - 1, index + 2); cursor += 1) selected.push({ line: cursor + 1, text: lines[cursor] });
    }
  });
  return [...new Map(selected.map((item) => [item.line, item])).values()].sort((a, b) => a.line - b.line);
}
function boundaryForPair(text, from, to) {
  const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const context = new RegExp(`${escaped(from)}[\\s\\S]{0,500}?${escaped(to)}[\\s\\S]{0,300}?(?:confrontando com|confrontante\\s*[:\\-])\\s*([^.;\\n]{3,180})`, "i").exec(text);
  return clean(context?.[1] || "");
}
function vertex(code, latitude, longitude, east, north, altitude, raw, coordinateType, error = "", latitudeDocument = null, longitudeDocument = null) { const complete = Number.isFinite(latitude) && Number.isFinite(longitude); const invalid = [latitude, longitude].some((item) => item != null && !Number.isFinite(item)) || (complete && (Math.abs(latitude) > 90 || Math.abs(longitude) > 180)); const parts = String(code || "").toUpperCase().split("-"); return { code: code?.toUpperCase() || "", prefix: parts[0] || "", type: parts[1] || "", sequence: parts[2] || "", latitudeDocument, longitudeDocument, latitudeDecimal: latitude, longitudeDecimal: longitude, latitude, longitude, east, north, altitude, coordinateSource: latitudeDocument && longitudeDocument ? "SIGEF/MEMORIAL" : "CÁLCULO", raw: clean(raw), coordinateType, status: invalid ? "inválido" : complete ? "OK" : "incompleto", error }; }
function parseSegments(text) { const records = []; const pattern = /\b([A-Z]{1,5}[-_]?[A-Z0-9]{1,15})\s*(?:a|→|->)\s*([A-Z]{1,5}[-_]?[A-Z0-9]{1,15})\b([^\n]{0,240})/gi; for (const match of text.matchAll(pattern)) { const tail = match[3]; const distance = numberBR((tail.match(/(?:distância\s*[:\-]?\s*)?([\d.,]+)\s*m\b/i) || [])[1]); const azimuth = clean((tail.match(/(?:azimute\s*[:\-]?\s*)([^,;]+?)(?=\s+distância|\s+[\d.,]+\s*m|$)/i) || [])[1]); const boundaryName = clean((tail.match(/(?:confrontando com|confrontante\s*[:\-])\s*([^.;\n]+)/i) || [])[1]); records.push({ fromVertex: match[1], toVertex: match[2], azimuth: azimuth || null, distance, boundaryName, boundaryType: "", raw: clean(match[0]), status: match[1] && match[2] && distance != null ? "OK" : "incompleto" }); } return records; }
function unwrap(parsed) { const map = (group) => Object.fromEntries(Object.entries(group).map(([key, item]) => [key, item.value])); return { property: map(parsed.property), registry: map(parsed.registry), sigef: map(parsed.sigef), geodesy: map(parsed.geodesy) }; }
function flattenFields(parsed) { return Object.entries(parsed).flatMap(([group, items]) => Object.entries(items).map(([key, item]) => ({ field: `${group}.${key}`, ...item }))); }
function overallConfidence(items) { return Math.round(items.reduce((sum, item) => sum + (item.confidence === "ALTA" ? 1 : item.confidence === "MÉDIA" ? .6 : 0), 0) / items.length * 100); }
function lineFor(text, index) { return text.slice(0, index).split("\n").length; }
function emptyResult(warning) { return { data: { property: {}, registry: {}, sigef: {}, geodesy: {}, vertices: [], boundaries: [] }, warnings: [warning], confidence: 0, fieldDiagnostics: [], coordinateType: "Não identificado", extractedSegments: [], reconstructedSegments: [], rawSegmentStructure: [], rawVertexRecords: [], rawSegmentRecords: [], ambiguousFields: [] }; }
