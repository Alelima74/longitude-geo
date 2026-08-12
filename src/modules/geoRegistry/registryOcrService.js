export { assessNativeText, chooseRegistryText } from "./registryOcrPolicy.mjs";

export async function recognizeRegistryPdf(file, onProgress = () => {}) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule, tesseract] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url"), import("tesseract.js")]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  let currentPage = 0; const pages = []; const confidences = [];
  const worker = await tesseract.createWorker("por", 1, { logger: (message) => onProgress({ ...message, page: currentPage, totalPages: pdf.numPages }) });
  try {
    for (currentPage = 1; currentPage <= pdf.numPages; currentPage += 1) {
      onProgress({ status: "rendering", page: currentPage, totalPages: pdf.numPages, progress: 0 });
      const page = await pdf.getPage(currentPage); const viewport = page.getViewport({ scale: 3 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height; const context = canvas.getContext("2d", { willReadFrequently: true }); await page.render({ canvasContext: context, viewport }).promise; preprocessForOcr(context, canvas.width, canvas.height); const result = await worker.recognize(canvas); pages.push(result.data.text || ""); confidences.push(Number(result.data.confidence || 0));
      onProgress({ status: "recognized", page: currentPage, totalPages: pdf.numPages, progress: 1 });
    }
  } finally { await worker.terminate(); }
  return { text: pages.join("\n"), pages, confidence: confidences.length ? confidences.reduce((sum, item) => sum + item, 0) / confidences.length : 0, pageCount: pdf.numPages };
}

function preprocessForOcr(context, width, height) {
  const image = context.getImageData(0, 0, width, height); const pixels = image.data;
  let sum = 0; for (let index = 0; index < pixels.length; index += 4) sum += pixels[index] * .299 + pixels[index + 1] * .587 + pixels[index + 2] * .114;
  const threshold = Math.max(120, Math.min(210, sum / (pixels.length / 4) * .88));
  for (let index = 0; index < pixels.length; index += 4) { const gray = pixels[index] * .299 + pixels[index + 1] * .587 + pixels[index + 2] * .114; const value = gray >= threshold ? 255 : 0; pixels[index] = value; pixels[index + 1] = value; pixels[index + 2] = value; }
  context.putImageData(image, 0, 0);
}
