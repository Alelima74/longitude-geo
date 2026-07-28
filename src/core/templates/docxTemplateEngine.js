import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

function formatTemplateError(error, templateName) {
  const details = error?.properties?.errors || [];
  if (details.length) {
    const messages = details.map((item) => {
      const id = item?.properties?.id || "erro";
      const explanation =
        item?.properties?.explanation ||
        item?.message ||
        "erro de template";
      const tag = item?.properties?.xtag
        ? ` Campo: ${item.properties.xtag}.`
        : "";
      return `${id}: ${explanation}.${tag}`;
    });
    return new Error(
      `Erro no modelo ${templateName}: ${messages.join(" | ")}`
    );
  }

  return new Error(
    `Erro no modelo ${templateName}: ${error?.message || "falha desconhecida"}`
  );
}

export async function fillDocxTemplate(url, data) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Modelo não encontrado: ${url}`);
  }

  try {
    const zip = new PizZip(await response.arrayBuffer());
    const document = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });

    document.render(data);

    return document.getZip().generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
  } catch (error) {
    throw formatTemplateError(error, url.split("/").pop());
  }
}
