export async function extractNativePdfText(file) {
  validatePdf(file);
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];
  const items = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const pageItems = content.items.map((item) => ({ page: number, text: String(item.str || "").trim(), x: Number(item.transform?.[4] || 0), y: Number(item.transform?.[5] || 0), width: Number(item.width || 0), height: Number(item.height || Math.abs(item.transform?.[3] || 0)) })).filter((item) => item.text);
    items.push(...pageItems);
    pages.push(groupTextItemsByLine(pageItems));
  }
  const text = pages.join("\n");
  return { text, items, lines: reconstructLines(items), pageCount: pdf.numPages, hasNativeText: Boolean(text.trim()) };
}

function groupTextItemsByLine(items) {
  const lines = [];
  for (const item of items) {
    const text = String(item.text || "").trim();
    if (!text) continue;
    const y = Number(item.y || 0);
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!line) { line = { y, items: [] }; lines.push(line); }
    line.items.push({ x: Number(item.x || 0), text });
  }
  return lines.sort((a, b) => b.y - a.y).map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")).join("\n");
}

function reconstructLines(items) {
  return items.reduce((lines, item) => { let line = lines.find((candidate) => candidate.page === item.page && Math.abs(candidate.y - item.y) <= Math.max(2, item.height * .35)); if (!line) { line = { page: item.page, y: item.y, items: [] }; lines.push(line); } line.items.push(item); return lines; }, []).sort((a, b) => a.page - b.page || b.y - a.y).map((line) => ({ page: line.page, y: line.y, text: line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "), items: line.items }));
}

export function validatePdf(file) {
  if (!file) throw new Error("Selecione um arquivo PDF.");
  if (!/\.pdf$/i.test(file.name || "") || file.type !== "application/pdf") throw new Error("O arquivo deve possuir extensão .pdf e MIME type application/pdf.");
  if (file.size > 25 * 1024 * 1024) throw new Error("O PDF excede o limite de segurança de 25 MB.");
  if (!file.size) throw new Error("O PDF está vazio.");
}
