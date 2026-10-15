import test from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { EVALUATION_DEMOS } from "../src/modules/evaluations/evaluationDemoData.mjs";
import { composeEvaluationDocument } from "../src/modules/evaluations/evaluationDocumentComposer/composeEvaluationDocument.mjs";
import { createEvaluationPdf } from "../src/modules/evaluations/documentRenderers/renderPdf.mjs";

// Fixtures locais: não gravam no navegador nem acessam o Supabase.
for (const project of EVALUATION_DEMOS) {
  test(`PDF ${project.evaluationType} mantém texto, tabelas e páginas após atualização`, async () => {
    const model = composeEvaluationDocument(project);
    const generated = createEvaluationPdf(model);
    const task = getDocument({ data: new Uint8Array(generated.output("arraybuffer")), useSystemFonts: true });
    try {
      const pdf = await task.promise;
      assert.equal(pdf.numPages, generated.getNumberOfPages());
      assert.ok(pdf.numPages > 2);
      const pages = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str || "").join(" "));
        assert.ok(page.view[2] > 0 && page.view[3] > 0);
      }
      const text = pages.join(" ");
      assert.ok(text.includes(project.property.name), "nome do imóvel presente na capa");
      assert.ok(text.includes("SUMÁRIO"), "sumário preservado com acentuação");
      assert.ok(text.includes("DEMONSTRATIVO"), "identificação demonstrativa preservada");
      for (const section of model.sections) {
        for (const block of section.blocks) {
          if (block.type === "table") {
            for (const header of block.headers) {
              // O extrator pode separar palavras por quebras de linha da tabela.
              const compact = (value) => String(value).replace(/\s+/g, "");
              assert.ok(compact(text).includes(compact(header)), `coluna preservada: ${header}`);
            }
          }
        }
      }
    } finally {
      await task.destroy();
    }
  });
}
