export function applyBoundarySupplement(boundary, additionalData) {
  const originalData = boundary.originalData || boundary.originalBoundary || { boundaryName: boundary.boundaryName || "", boundaryRegistration: boundary.boundaryRegistration || null, boundaryCns: boundary.boundaryCns || null, azimuthDocumentRaw: boundary.azimuthDocumentRaw || boundary.azimuthDocument || null, distanceDocumentRaw: boundary.distanceDocumentRaw || null };
  return { ...boundary, originalData, additionalData: { ...additionalData }, manualOverrides: { ...(boundary.manualOverrides || {}) }, originalBoundary: boundary.originalBoundary || originalData, editedBoundary: { ...additionalData }, boundarySource: "MEMORIAL + COMPLEMENTO MANUAL" };
}
