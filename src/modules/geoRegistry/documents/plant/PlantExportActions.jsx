import React, { useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PizZip from "pizzip";
import { buildPlantDxf, safeCadBaseName } from "./plantCadExport.mjs";
import { buildCanonicalGeometry } from "./canonicalGeometry.mjs";

export function PlantExportActions({ context }) {
  const [busy, setBusy] = useState("");
  const integrity = buildCanonicalGeometry(context);
  const base = safeCadBaseName(context.property?.name);
  const imageName = `${base}_LOCALIZACAO.png`;
  const dxfName = `${base}_PLANTA.dxf`;
  let cadReady = false; try { if (integrity.valid) { buildPlantDxf(context, imageName); cadReady = true; } } catch { cadReady = false; }
  async function savePdf() {
    setBusy("PDF");
    try {
      const canvas = await capture(".plant-master", 2);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a2", compress: true });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 594, 420, undefined, "FAST");
      pdf.save(`${base}_PLANTA.pdf`);
    } finally { setBusy(""); }
  }
  async function saveCadPackage() {
    setBusy("CAD");
    try {
      const location = await capture(".plant-location-map", 3);
      const image = location.toDataURL("image/png").split(",")[1];
      const zip = new PizZip();
      zip.file(dxfName, buildPlantDxf(context, imageName));
      zip.file(imageName, image, { base64: true });
      download(zip.generate({ type: "blob", mimeType: "application/zip", compression: "DEFLATE" }), `${base}_PLANTA_CAD.zip`);
    } finally { setBusy(""); }
  }
  return <nav className={`plant-export-actions ${integrity.valid ? "validated" : "blocked"}`} data-html2canvas-ignore="true" aria-label="Exportação da planta"><strong>{integrity.status}</strong>{integrity.valid && <small>Fingerprint: {integrity.fingerprint} · DXF round-trip: {cadReady ? "VÁLIDO" : "BLOQUEADO"}</small>}<button onClick={savePdf} disabled={Boolean(busy) || !integrity.valid}>SALVAR PDF</button><button onClick={saveCadPackage} disabled={Boolean(busy) || !cadReady}>{busy === "CAD" ? "GERANDO..." : "EXPORTAR DXF"}</button></nav>;
}
async function capture(selector, scale) { const element = document.querySelector(selector); if (!element) throw new Error("Planta não encontrada para exportação."); return html2canvas(element, { scale, useCORS: true, backgroundColor: "#fff", logging: false }); }
function download(blob, name) { const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
