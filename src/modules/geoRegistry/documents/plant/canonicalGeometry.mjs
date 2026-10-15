import proj4 from "proj4";

const value = (item) => item?.value ?? item ?? "";
const coordinate = (vertex, names) => names.map((name) => vertex?.[name]).filter((item) => item !== "" && item != null).map(Number).find(Number.isFinite);
const samePoint = (a, b, tolerance = 1e-10) => Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;

export function buildCanonicalGeometry(context) {
  const vertices = (context.vertices || []).map((vertex, index) => ({
    index, code: String(vertex.code || "").trim(),
    latitudeDocument: vertex.latitudeDocument || "", longitudeDocument: vertex.longitudeDocument || "", altitude: vertex.altitude,
    latitude: coordinate(vertex, ["latitudeDecimal", "latitude"]), longitude: coordinate(vertex, ["longitudeDecimal", "longitude"]),
    east: coordinate(vertex, ["east", "easting"]), north: coordinate(vertex, ["north", "northing"]),
  }));
  const issues = [];
  if (vertices.length < 3) issues.push("A poligonal possui menos de três vértices.");
  if (vertices.some((vertex) => !vertex.code)) issues.push("Existe vértice técnico sem código.");
  if (new Set(vertices.map((vertex) => vertex.code)).size !== vertices.length) issues.push("Existem códigos de vértice duplicados.");
  const ring = geometryRing(context.geometry);
  if (ring.length !== vertices.length + 1 || !samePoint(ring[0] || [], ring.at(-1) || [])) issues.push("A geometria validada do módulo GEOMETRIA não possui fechamento ou quantidade compatível.");
  vertices.forEach((vertex, index) => { if (ring[index] && (!Number.isFinite(vertex.longitude) || !Number.isFinite(vertex.latitude) || !samePoint(ring[index], [vertex.longitude, vertex.latitude]))) issues.push(`O vértice ${vertex.code || index + 1} diverge da geometria validada.`); });
  const projection = resolveProjection(vertices, context, issues);
  const projected = projection ? vertices.map((vertex) => projection.project(vertex)) : [];
  if (projected.some((point) => !point.every(Number.isFinite))) issues.push("A projeção métrica produziu coordenada inválida.");
  const closedProjected = projected.length ? [...projected, [...projected[0]]] : [];
  if (projected.length && new Set(projected.map(([x, y]) => `${x.toFixed(6)}:${y.toFixed(6)}`)).size !== projected.length) issues.push("A projeção métrica contém vértices duplicados.");
  const surveyTraverse = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length], boundary = findBoundary(context.boundaries, vertex.code, next.code, index);
    const calculatedDistance = projected.length ? distance(projected[index], projected[(index + 1) % projected.length]) : null;
    const calculatedAzimuth = projected.length ? azimuth(projected[index], projected[(index + 1) % projected.length]) : null;
    return { from: vertex.code, to: next.code, documentAzimuth: boundary?.azimuthDocumentRaw || boundary?.azimuthDocument || boundary?.azimuth || "", documentDistance: numberOrNull(boundary?.distanceDocument ?? boundary?.distance), calculatedAzimuth, calculatedDistance, boundary };
  });
  const calculatedAreaHa = projected.length ? Math.abs(signedArea(projected)) / 10000 : null;
  const calculatedPerimeterM = surveyTraverse.reduce((sum, segment) => sum + (segment.calculatedDistance || 0), 0) || null;
  const documentaryAreaHa = numberOrNull(value(context.area)); const documentaryPerimeterM = numberOrNull(value(context.perimeter));
  if (polygonSelfIntersects(projected)) issues.push("A poligonal apresenta autointerseção.");
  return Object.freeze({
    valid: issues.length === 0, status: issues.length ? "PLANTA BLOQUEADA — DIVERGÊNCIA GEOMÉTRICA" : "INTEGRIDADE GEOMÉTRICA: VALIDADA", issues,
    vertices: Object.freeze(vertices), ring: Object.freeze(ring), projected: Object.freeze(projected), closedProjected: Object.freeze(closedProjected), surveyTraverse: Object.freeze(surveyTraverse),
    projection: projection?.description || null, datum: projection?.datum || value(context.datum), utmZone: projection?.zone || null, hemisphere: projection?.hemisphere || null,
    documentaryAreaHa, calculatedAreaHa, areaDifferenceHa: difference(calculatedAreaHa, documentaryAreaHa),
    documentaryPerimeterM, calculatedPerimeterM, perimeterDifferenceM: difference(calculatedPerimeterM, documentaryPerimeterM),
    fingerprint: geometryFingerprint(vertices),
  });
}

export function buildUniformPresentation(canonical, viewport, rotation = 0, padding = .1) {
  if (!canonical.valid) return { valid: false, points: [], scale: null, rotation };
  const centre = centroid(canonical.projected), rotated = canonical.projected.map((point) => rotate(point, rotation, centre)), bounds = boundsOf(rotated);
  const width = viewport.width * (1 - padding * 2), height = viewport.height * (1 - padding * 2);
  const scale = Math.min(width / Math.max(bounds.width, 1e-12), height / Math.max(bounds.height, 1e-12));
  const offsetX = viewport.width / 2 - scale * (bounds.minX + bounds.maxX) / 2, offsetY = viewport.height / 2 + scale * (bounds.minY + bounds.maxY) / 2;
  const points = rotated.map(([x, y]) => [offsetX + scale * x, offsetY - scale * y]);
  const audit = validateRigidTransform(canonical.projected, points, scale);
  return { valid: audit.valid, points: [...points, [...points[0]]], scale, scaleX: scale, scaleY: scale, rotation, audit, bounds };
}

export function validateRigidTransform(original, rendered, scale, tolerance = 1e-8) {
  const ratios = original.map((point, index) => distance(rendered[index], rendered[(index + 1) % rendered.length]) / distance(point, original[(index + 1) % original.length]));
  const distanceError = Math.max(0, ...ratios.map((ratio) => Math.abs(ratio - scale)));
  const angleError = Math.max(0, ...original.map((_, index) => Math.abs(internalAngle(original, index) - internalAngle(rendered, index))));
  return { valid: distanceError <= tolerance && angleError <= tolerance, ratios, distanceError, angleError, uniformScale: scale };
}

export function geometryFingerprint(vertices) { const source = vertices.map((vertex) => `${vertex.code}|${fixed(vertex.longitude)}|${fixed(vertex.latitude)}|${fixed(vertex.east)}|${fixed(vertex.north)}`).join(";"); let hash = 2166136261; for (let index = 0; index < source.length; index++) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `FNV1A-${(hash >>> 0).toString(16).padStart(8, "0")}`; }
export function geometryRing(geometry) { const source = geometry?.type === "Feature" ? geometry.geometry : geometry; const ring = source?.type === "MultiPolygon" ? source.coordinates?.[0]?.[0] : source?.coordinates?.[0]; return Array.isArray(ring) ? ring.map(([x, y]) => [Number(x), Number(y)]) : []; }
export function distance(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
export function azimuth(a, b) { return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360; }

function resolveProjection(vertices, context, issues) {
  if (vertices.every((vertex) => Number.isFinite(vertex.east) && Number.isFinite(vertex.north))) return { description: "Coordenadas métricas documentais", datum: value(context.datum), zone: parseZone(value(context.utmZone)), hemisphere: hemisphereOf(vertices), project: (vertex) => [vertex.east, vertex.north] };
  if (vertices.some((vertex) => !Number.isFinite(vertex.longitude) || !Number.isFinite(vertex.latitude))) { issues.push("Coordenadas numéricas insuficientes para projeção."); return null; }
  const datum = String(value(context.datum)).replace(/\s/g, "").toUpperCase(), zone = parseZone(value(context.utmZone));
  if (!/SIRGAS2000/.test(datum)) issues.push("Datum SIRGAS 2000 não confirmado documentalmente.");
  if (!zone) issues.push("Fuso UTM não informado documentalmente; a planta definitiva foi bloqueada.");
  const hemisphere = hemisphereOf(vertices); if (!hemisphere) issues.push("Hemisfério não determinável pelas coordenadas documentais.");
  if (!zone || !hemisphere || !/SIRGAS2000/.test(datum)) return null;
  const definition = `+proj=utm +zone=${zone} ${hemisphere === "S" ? "+south" : ""} +ellps=GRS80 +units=m +no_defs`;
  return { description: `UTM fuso ${zone}${hemisphere} / SIRGAS 2000`, datum: "SIRGAS 2000", zone, hemisphere, project: (vertex) => proj4("EPSG:4326", definition, [vertex.longitude, vertex.latitude]) };
}
function hemisphereOf(vertices) { return vertices.every((vertex) => vertex.latitude < 0) ? "S" : vertices.every((vertex) => vertex.latitude >= 0) ? "N" : null; }
function parseZone(input) { const match = String(input || "").match(/\b([1-9]|[1-5]\d|60)\b/); return match ? Number(match[1]) : null; }
function findBoundary(boundaries = [], from, to, index) { return boundaries.find((item) => item.fromVertex === from && item.toVertex === to) || boundaries[index]; }
function numberOrNull(input) { const raw=value(input); if(raw===""||raw==null)return null; const number = Number(String(raw).replace(",", ".")); return Number.isFinite(number) ? number : null; }
function difference(a, b) { return a == null || b == null ? null : a - b; }
function signedArea(points) { return points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0) / 2; }
function centroid(points) { return points.reduce(([x, y], point) => [x + point[0] / points.length, y + point[1] / points.length], [0, 0]); }
function rotate([x, y], angle, [cx, cy]) { const c = Math.cos(angle), s = Math.sin(angle), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }
function boundsOf(points) { const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }; }
function internalAngle(points, index) { const previous = points[(index - 1 + points.length) % points.length], current = points[index], next = points[(index + 1) % points.length]; const a = [previous[0] - current[0], previous[1] - current[1]], b = [next[0] - current[0], next[1] - current[1]]; return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))); }
function polygonSelfIntersects(points) { for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) if (Math.abs(a - b) > 1 && !(a === 0 && b === points.length - 1) && intersects(points[a], points[(a + 1) % points.length], points[b], points[(b + 1) % points.length])) return true; return false; }
function intersects(a, b, c, d) { const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0; }
function fixed(value) { return Number.isFinite(value) ? value.toFixed(9) : ""; }
