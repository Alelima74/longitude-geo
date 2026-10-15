import { buildCanonicalGeometry, buildUniformPresentation } from "./canonicalGeometry.mjs";

const CONVENTIONAL_SCALES = [500, 1000, 2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000];

export function geometryRing(_geometry, _vertices = [], context = null) { return context ? buildCanonicalGeometry(context).ring : []; }

export function buildPlantLayout(context, viewport = { width: 1122, height: 785, widthMm: 374, heightMm: 261.5 }) {
  const canonicalGeometry = buildCanonicalGeometry(context);
  if (!canonicalGeometry.valid) return { canonicalGeometry, blocked: true, status: canonicalGeometry.status, issues: canonicalGeometry.issues, ring: canonicalGeometry.ring, points: [], vertexPoints: [], boundaryLabels: [], scale: null, bounds: null, viewport };
  const rotation = bestRigidRotation(canonicalGeometry, viewport);
  const presentation = buildUniformPresentation(canonicalGeometry, viewport, rotation, .1);
  const metricBounds = boundsOf(canonicalGeometry.projected.map((point) => rotate(point, rotation, centroid(canonicalGeometry.projected))));
  const requiredScale = Math.max(metricBounds.width * 1000 / (viewport.widthMm * .8), metricBounds.height * 1000 / (viewport.heightMm * .8));
  const scale = CONVENTIONAL_SCALES.find((candidate) => candidate >= requiredScale) || Math.ceil(requiredScale / 100000) * 100000;
  const points = presentation.points;
  const polygonCentre = centroid(points.slice(0, -1));
  return {
    canonicalGeometry, blocked: !presentation.valid, status: presentation.valid ? canonicalGeometry.status : "PLANTA BLOQUEADA — DIVERGÊNCIA GEOMÉTRICA",
    ring: canonicalGeometry.ring, points, scale, bounds: metricBounds, viewport, presentationRotation: rotation * 180 / Math.PI,
    scaleX: presentation.scaleX, scaleY: presentation.scaleY, transformAudit: presentation.audit,
    vertexPoints: points.slice(0, -1).map((point, index) => ({ point, vertex: context.vertices[index], index })),
    boundaryLabels: points.slice(0, -1).map((start, index) => makeBoundaryLabel(start, points[index + 1], polygonCentre, canonicalGeometry.surveyTraverse[index], index, viewport)),
  };
}

export function generateLocationMap(context) {
  const canonicalGeometry = buildCanonicalGeometry(context), ring = canonicalGeometry.ring;
  if (!ring.length) return { canonicalGeometry, ring: [], bounds: null };
  const longitudes = ring.map(([longitude]) => longitude), latitudes = ring.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes), maxLongitude = Math.max(...longitudes), minLatitude = Math.min(...latitudes), maxLatitude = Math.max(...latitudes);
  const longitudeMargin = Math.max((maxLongitude - minLongitude) * .45, .0015), latitudeMargin = Math.max((maxLatitude - minLatitude) * .45, .0015);
  return { canonicalGeometry, ring, bounds: [[minLatitude - latitudeMargin, minLongitude - longitudeMargin], [maxLatitude + latitudeMargin, maxLongitude + longitudeMargin]] };
}

export function scaleBarFor(scale) { const target = Number(scale || 500) * .05, power = 10 ** Math.floor(Math.log10(Math.max(target, 1))), normalized = target / power, total = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * power; return { total, divisions: 5, label: total >= 1000 ? `${formatNumber(total / 1000)} km` : `${formatNumber(total)} m` }; }
export function formatScale(scale) { return scale ? `1:${Number(scale).toLocaleString("pt-BR")}` : "BLOQUEADA"; }

function bestRigidRotation(canonical, viewport) { const points = canonical.projected, hull = convexHull(points), centre = centroid(points); let best = { angle: 0, scale: -Infinity }; for (const point of hull) { const next = hull[(hull.indexOf(point) + 1) % hull.length], angle = -Math.atan2(next[1] - point[1], next[0] - point[0]), bounds = boundsOf(points.map((item) => rotate(item, angle, centre))), scale = Math.min(viewport.width / Math.max(bounds.width, 1e-12), viewport.height / Math.max(bounds.height, 1e-12)); if (scale > best.scale) best = { angle, scale }; } return best.angle; }
function boundsOf(points) { const xs = points.map(([x]) => x), ys = points.map(([, y]) => y); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }; }
function centroid(points) { return points.reduce(([x, y], point) => [x + point[0] / points.length, y + point[1] / points.length], [0, 0]); }
function rotate([x, y], angle, [cx, cy]) { const cosine = Math.cos(angle), sine = Math.sin(angle), dx = x - cx, dy = y - cy; return [cx + dx * cosine - dy * sine, cy + dx * sine + dy * cosine]; }
function convexHull(points) { const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (sorted.length < 3) return sorted; const cross = (origin, a, b) => (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]); const lower = []; for (const point of sorted) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop(); lower.push(point); } const upper = []; for (const point of [...sorted].reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop(); upper.push(point); } return [...lower.slice(0, -1), ...upper.slice(0, -1)]; }
function makeBoundaryLabel(start, end, centre, segment, index, viewport) { const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], vector = [midpoint[0] - centre[0], midpoint[1] - centre[1]], magnitude = Math.hypot(...vector) || 1, offset = 34 + index % 2 * 12, x = clamp(midpoint[0] + vector[0] / magnitude * offset, 75, viewport.width - 75), y = clamp(midpoint[1] + vector[1] / magnitude * offset, 40, viewport.height - 40); let angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI; if (angle > 90 || angle < -90) angle += 180; const boundary = segment?.boundary || {}, title = boundary.boundaryName || "CONFRONTANTE NÃO INFORMADO", details = [boundary.boundaryRegistration && `Matrícula: ${boundary.boundaryRegistration}`, boundary.boundaryCns && `CNS: ${boundary.boundaryCns}`].filter(Boolean).join(" · "); return { x, y, angle, title, details, fromVertex: segment?.from, toVertex: segment?.to }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function formatNumber(value) { return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }
