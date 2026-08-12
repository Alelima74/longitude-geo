const pending = (value) => value === "" || value == null ? "[DADO PENDENTE]" : value;
export function buildPerimeterNarrative(context) {
  const segments = context.boundaries.filter((item) => item.origin === "MEMORIAL" && item.fromVertex && item.toVertex);
  if (!segments.length) return "[DADO PENDENTE: descrição documental do perímetro]";
  const groups = [];
  for (const segment of segments) { const name = segment.boundaryName || "[DADO PENDENTE]"; const last = groups.at(-1); if (last?.name === name) last.items.push(segment); else groups.push({ name, items: [segment] }); }
  const first = segments[0]; const firstVertex = context.vertices.find((item) => item.code === first.fromVertex);
  const parts = [`Inicia-se a descrição deste perímetro no vértice ${first.fromVertex}, de coordenadas longitude ${pending(firstVertex?.longitudeDocument)} e latitude ${pending(firstVertex?.latitudeDocument)}.`];
  for (const group of groups) { const descriptions = group.items.map((item) => `azimute ${pending(item.azimuthDocumentRaw || item.azimuthDocument)} e distância ${pending(item.distanceDocumentRaw || item.distanceDocument)} m, até o vértice ${item.toVertex}`); parts.push(`Deste, segue confrontando com ${group.name}, com os seguintes azimutes e distâncias: ${descriptions.join("; ")}.`); }
  parts.push(`Chega-se ao vértice ${first.fromVertex}, ponto inicial da descrição deste perímetro.`);
  return parts.join(" ");
}
