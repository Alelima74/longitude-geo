import * as turf from "@turf/turf";

export function verticesToFeature(vertices) {
  const valid = (vertices || []).filter((v) => Number.isFinite(v.longitude) && Number.isFinite(v.latitude));
  if (valid.length < 3) return null;
  const coordinates = valid.map((v) => [v.longitude, v.latitude]);
  if (coordinates[0][0] !== coordinates.at(-1)[0] || coordinates[0][1] !== coordinates.at(-1)[1]) coordinates.push([...coordinates[0]]);
  try { return turf.polygon([coordinates], {}); } catch { return null; }
}

function validateGeometryBase(vertices, reported = {}) {
  const issues = [];
  const valid = (vertices || []).filter((v) => Number.isFinite(v.longitude) && Number.isFinite(v.latitude));
  if (vertices.length < 3) issues.push({ level: "error", message: "A poligonal possui menos de três vértices." });
  if (valid.length !== vertices.length) issues.push({ level: "error", message: "Existem coordenadas ausentes ou inválidas." });
  const keys = valid.map((v) => `${v.longitude.toFixed(9)}:${v.latitude.toFixed(9)}`);
  if (new Set(keys).size !== keys.length) issues.push({ level: "warning", message: "Foram identificados vértices com coordenadas duplicadas." });
  const geometry = verticesToFeature(vertices);
  let calculatedArea = null; let calculatedPerimeter = null;
  if (geometry) {
    calculatedArea = turf.area(geometry) / 10000;
    calculatedPerimeter = turf.length(turf.polygonToLine(geometry), { units: "kilometers" }) * 1000;
    try { if (turf.kinks(geometry).features.length) issues.push({ level: "error", message: "A poligonal apresenta autointersecção." }); } catch { issues.push({ level: "warning", message: "Não foi possível verificar autointersecções." }); }
  }
  const areaDifferencePercent = percentDifference(calculatedArea, reported.area);
  const perimeterDifferencePercent = percentDifference(calculatedPerimeter, reported.perimeter);
  if (areaDifferencePercent != null && areaDifferencePercent > 1) issues.push({ level: areaDifferencePercent > 5 ? "error" : "warning", message: `A área calculada difere ${areaDifferencePercent.toFixed(2)}% da área informada.` });
  if (perimeterDifferencePercent != null && perimeterDifferencePercent > 1) issues.push({ level: perimeterDifferencePercent > 5 ? "error" : "warning", message: `O perímetro calculado difere ${perimeterDifferencePercent.toFixed(2)}% do informado.` });
  const status = issues.some((i) => i.level === "error") ? "INCONSISTENTE" : issues.length ? "ATENÇÃO" : geometry ? "COMPATÍVEL" : "ATENÇÃO";
  return { status, issues, calculatedArea, calculatedPerimeter, areaDifferencePercent, perimeterDifferencePercent, checkedAt: new Date().toISOString() };
}
function percentDifference(calculated, reported) { return calculated != null && Number(reported) > 0 ? Math.abs(calculated - Number(reported)) / Number(reported) * 100 : null; }

export function validateGeometry(vertices, reported = {}, tolerance = null) {
  const result = validateGeometryBase(vertices, reported);
  const areaDifferenceHa = result.calculatedArea != null && Number(reported.area) > 0 ? result.calculatedArea - Number(reported.area) : null;
  const perimeterDifferenceM = result.calculatedPerimeter != null && Number(reported.perimeter) > 0 ? result.calculatedPerimeter - Number(reported.perimeter) : null;
  const hasComparison = result.areaDifferencePercent != null || result.perimeterDifferencePercent != null;
  const structuralError = result.issues.some((item) => item.level === "error" && !/difere/i.test(item.message));
  const exceedsTolerance = tolerance && ((result.areaDifferencePercent ?? 0) > tolerance.areaPercent || (result.perimeterDifferencePercent ?? 0) > tolerance.perimeterPercent);
  const status = structuralError ? "INCONSISTENTE" : hasComparison && !tolerance ? "DIFERENÇA A CONFERIR" : exceedsTolerance ? "ATENÇÃO" : result.calculatedArea != null ? "COMPATÍVEL" : result.status;
  const issues = result.issues.filter((item) => !/difere/i.test(item.message));
  if (hasComparison && !tolerance) issues.push({ level: "warning", message: "Nenhuma tolerância técnica foi configurada; a diferença requer conferência profissional." });
  return { ...result, status, tolerance, issues, areaDifferenceHa, areaDifferenceM2: areaDifferenceHa == null ? null : areaDifferenceHa * 10000, perimeterDifferenceM };
}
