import { getCanonicalProjectData } from "../canonicalProjectData.mjs";
import { canonicalSurveyGeometry, validateGeometry } from "../geometryValidationService.mjs";
import { enrichCalculatedSegments } from "../segmentCalculations.mjs";

const present = (value) => value !== "" && value != null;
const segmentKey = (from, to) => `${String(from || "").toUpperCase()}→${String(to || "").toUpperCase()}`;

export function buildCanonicalSegments(vertices = [], boundaries = []) {
  if (vertices.length < 2) return [];
  const boundaryByPair = new Map(boundaries.map((item) => [segmentKey(item.fromVertex, item.toVertex), item]));
  const ordered = vertices.map((from, index) => {
    const to = vertices[(index + 1) % vertices.length];
    const boundary = boundaryByPair.get(segmentKey(from.code, to.code)) || {};
    return {
      ...boundary,
      id: segmentKey(from.code || index, to.code || ((index + 1) % vertices.length)),
      order: index + 1,
      fromVertex: from.code,
      toVertex: to.code,
      vertexType: from.type || "",
      from,
      to,
      status: boundary.status || (from.status === "OK" && to.status === "OK" ? "Validado" : "Incompleto"),
    };
  });
  return enrichCalculatedSegments(ordered, vertices);
}

export function groupCanonicalBoundaries(segments = []) {
  const groups = new Map();
  for (const segment of segments) {
    const name = segment.editedBoundary?.boundaryName || segment.additionalData?.boundaryName || segment.boundaryName || "Confrontante não identificado";
    const key = name.trim().toLocaleLowerCase("pt-BR");
    if (!groups.has(key)) groups.set(key, { id:key, name, type:segment.boundaryType || "Outro", segments:[] });
    groups.get(key).segments.push(segment);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    segmentCount: group.segments.length,
    totalLength: group.segments.reduce((total, item) => total + Number(item.distanceDocument ?? item.distanceCalculated ?? 0), 0),
    firstVertex: group.segments[0]?.fromVertex || "",
    lastVertex: group.segments.at(-1)?.toVertex || "",
  }));
}

export function buildCanonicalSurveyData(project = {}, parserDiagnostic = null) {
  const canonical = getCanonicalProjectData(project);
  const vertices = [...(project.vertices || [])].sort((a,b) => (a.documentOrder ?? 0) - (b.documentOrder ?? 0));
  const segments = buildCanonicalSegments(vertices, project.boundaries || []);
  const geometry = canonicalSurveyGeometry(vertices);
  const validation = validateGeometry(vertices, { area:canonical.property.area, perimeter:canonical.property.perimeter });
  const rejected = parserDiagnostic?.parsed?.rejectedVertices || vertices.filter((item) => item.status !== "OK").map((item) => ({ code:item.code, page:item.page || null, originalText:item.raw || "", reason:item.error || item.status }));
  const integrity = {
    documentaryVertices: parserDiagnostic?.parsed?.vertexDiagnostic?.found ?? vertices.length,
    structuredVertices: vertices.filter((item) => item.status === "OK").length,
    rejectedVertices: rejected.length,
    segments: segments.length,
    closed: Boolean(geometry && segments.length === vertices.length),
    status: !geometry || rejected.length ? "Incompleto" : validation.status === "COMPATÍVEL" ? "Validado" : "Revisar",
  };
  return {
    project:{ id:project.id, createdAt:project.createdAt, updatedAt:project.updatedAt },
    property:canonical.property,
    registry:canonical.registry,
    owner:canonical.owner,
    sigef:{ ...(project.sigef || {}), certificationId:canonical.sigef.certificationId },
    vertices,
    segments,
    boundaries:groupCanonicalBoundaries(segments),
    geometry,
    technicalProfessional:project.technicalProfessional || {},
    validation,
    integrity,
    rejectedVertices:rejected,
    sources:project.dataOrigins || {},
    complete:present(canonical.property.name) && present(canonical.registry.registrationNumber) && Boolean(geometry),
  };
}

export function segmentSelectionId(segment) { return segment?.id || segmentKey(segment?.fromVertex, segment?.toVertex); }
