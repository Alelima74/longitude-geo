export function assessNativeText(text = "") {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  const words = normalized.match(/[A-Za-zÀ-ÿ]{3,}/g) || [];
  return { sufficient: normalized.length >= 120 && words.length >= 15, characterCount: normalized.length, wordCount: words.length };
}

export async function chooseRegistryText(nativeText, ocrRunner) {
  const quality = assessNativeText(nativeText);
  if (quality.sufficient) return { text: nativeText, method: "Texto nativo", documentType: "Texto pesquisável", confidence: 100, quality };
  const ocr = await ocrRunner();
  return { text: ocr.text || "", method: "OCR", documentType: "Documento digitalizado", confidence: Number(ocr.confidence || 0), quality };
}
