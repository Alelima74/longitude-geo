const VERTEX = /\b[A-Z0-9]{2,10}-[MPV]-\d{2,10}\b/i;

export function parseSigefSegmentRows(rawLines = []) {
  const records = [];
  for (const entry of rawLines) {
    const raw = clean(typeof entry === "string" ? entry : entry?.text);
    if (!raw) continue;
    const codes = [...raw.matchAll(new RegExp(VERTEX.source, "gi"))];
    if (codes.length < 2 || codes[0].index !== 0) continue;
    const fromVertex = codes[0][0].toUpperCase();
    const toVertex = codes[1][0].toUpperCase();
    const tail = raw.slice(codes[1].index + codes[1][0].length).trim();
    const technical = tail.match(/^(\d{1,3}\s*[°º]\s*\d{1,2}\s*['’′](?:\s*\d{1,2}(?:[.,]\d+)?\s*["”″])?)\s+(\d+(?:\.\d{3})*,\d+)\s*(?:m\b)?\s*(.*)$/i);
    if (!technical) continue;
    const azimuthDocumentRaw = clean(technical[1]).replace(/\s+/g, "");
    const distanceDocumentRaw = technical[2];
    const distanceDocumentMeters = numberBR(distanceDocumentRaw);
    const remainder = clean(technical[3]).replace(/^[-|;:,\s]+/, "");
    const boundaryCns = clean((remainder.match(/\bCNS\s*:\s*([\d.-]+)/i) || [])[1]) || null;
    const boundaryRegistration = clean((remainder.match(/\bMat\.?(?:r[ií]cula)?\s*[:.]?\s*([^|]+?)(?=\s*\||$)/i) || [])[1]) || null;
    const boundaryName = clean(remainder
      .replace(/\bCNS\s*:\s*[\d.-]+\s*\|?/ig, "")
      .replace(/\bMat\.?(?:r[ií]cula)?\s*[:.]?\s*[^|]+\|?/ig, "")
      .replace(/^[-|;:,\s]+/, ""));
    const parts = [...azimuthDocumentRaw.matchAll(/\d+(?:[.,]\d+)?/g)].map((item) => numberBR(item[0]));
    const azimuthDocumentDegrees = parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
    records.push({ fromVertex, toVertex, azimuthDocumentRaw, azimuthDocumentDegrees, distanceDocumentRaw, distanceDocumentMeters, azimuth: azimuthDocumentRaw, distance: distanceDocumentMeters, boundaryCns, boundaryRegistration, boundaryName, boundaryType: "", raw, origin: "MEMORIAL", status: "OK" });
  }
  return records;
}

export function reconstructPdfLines(items = []) {
  const lines = [];
  for (const item of items) {
    if (!item?.text?.trim()) continue;
    const tolerance = Math.max(2, Number(item.height || 0) * 0.35);
    let line = lines.find((candidate) => candidate.page === item.page && Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) { line = { page: item.page, y: item.y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  return lines.sort((a, b) => a.page - b.page || b.y - a.y).map((line) => ({ ...line, items: line.items.sort((a, b) => a.x - b.x), text: line.items.map((item) => item.text).join(" ") }));
}

export function parseSigefSegmentTableFromLayout(items = [], suppliedLines = null) {
  const lines = suppliedLines?.length ? suppliedLines : reconstructPdfLines(items);
  const records = [];
  for (let headerIndex = 0; headerIndex < lines.length; headerIndex += 1) {
    const header = lines[headerIndex];
    if (!/azimute/i.test(header.text) || !/dist[aâ]ncia/i.test(header.text) || !/confront/i.test(header.text)) continue;
    const columns = locateColumns(header.items);
    const rows = [];
    for (let index = headerIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.page !== header.page || (/azimute/i.test(line.text) && /dist[aâ]ncia/i.test(line.text))) break;
      const codes = line.text.match(new RegExp(VERTEX.source, "gi")) || [];
      if (codes.length) rows.push({ line, codes: codes.map((code) => code.toUpperCase()), cells: assignCells(line.items, columns) });
      else if (rows.length && line.text.trim() && line.y < rows.at(-1).line.y) rows.at(-1).cells.boundary = `${rows.at(-1).cells.boundary || ""} ${line.text}`.trim();
    }
    rows.forEach((row, index) => {
      const fromVertex = row.codes[0];
      const toVertex = row.codes[1] || rows[index + 1]?.codes[0] || rows[0]?.codes[0];
      const azimuth = clean(row.cells.azimuth); const distance = numberBR(row.cells.distance); const boundaryCell = clean(row.cells.boundary); const boundaryRegistration = clean((boundaryCell.match(/(?:Matrícula|Mat\.)\s*(?:n[º°o.]*)?\s*[:\-]?\s*([\d./-]+)/i) || [])[1]); const boundaryCns = clean((boundaryCell.match(/CNS\s*[:\-]?\s*([\d.-]+)/i) || [])[1]); const boundaryName = clean(boundaryCell.replace(/(?:Matrícula|Mat\.)\s*(?:n[º°o.]*)?\s*[:\-]?\s*[\d./-]+/ig, "").replace(/CNS\s*[:\-]?\s*[\d.-]+/ig, "").replace(/[,;\s]+$/, ""));
      if (fromVertex && toVertex && (azimuth || distance != null || boundaryName)) records.push({ fromVertex, toVertex, azimuth: azimuth || null, distance, boundaryName, boundaryRegistration, boundaryCns, boundaryType: "", raw: row.line.text, status: azimuth && distance != null && boundaryName ? "OK" : "incompleto", layout: { page: row.line.page, y: row.line.y } });
    });
  }
  return [...new Map(records.map((item) => [`${item.fromVertex}>${item.toVertex}`, item])).values()];
}
export const parseSigefSegmentTable = parseSigefSegmentTableFromLayout;

function locateColumns(items) { const result = {}; for (const item of items) { if (/v[eé]rtice|c[oó]digo/i.test(item.text)) result.vertex = item.x; if (/azimute/i.test(item.text)) result.azimuth = item.x; if (/dist[aâ]ncia/i.test(item.text)) result.distance = item.x; if (/confront/i.test(item.text)) result.boundary = item.x; } return result; }
function assignCells(items, columns) { const entries = Object.entries(columns).sort((a, b) => a[1] - b[1]); const cells = {}; for (const item of items) { let selected = entries[0]?.[0]; for (let index = 0; index < entries.length; index += 1) { const current = entries[index]; const next = entries[index + 1]; if (!next || item.x < (current[1] + next[1]) / 2) { selected = current[0]; break; } } cells[selected] = `${cells[selected] || ""} ${item.text}`.trim(); } return cells; }
function numberBR(value) { if (!value) return null; let normalized = String(value).replace(/\s/g, "").replace(/[^\d.,+-]/g, ""); if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", "."); const result = Number(normalized); return Number.isFinite(result) ? result : null; }
function clean(value = "") { return String(value).replace(/[\t ]+/g, " ").trim(); }
