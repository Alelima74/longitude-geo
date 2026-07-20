export function criarAssinaturaArquivo(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function gravarBaseSigef(geojson, arquivos) {
  localStorage.setItem("longitude_sigef_brasil_local_v1", JSON.stringify(geojson || { type: "FeatureCollection", features: [] }));
  localStorage.setItem("longitude_sigef_brasil_meta_v1", JSON.stringify(arquivos || []));
}

export function lerBaseSigef() {
  const raw = localStorage.getItem("longitude_sigef_brasil_local_v1");
  if (!raw) return null;
  const metaRaw = localStorage.getItem("longitude_sigef_brasil_meta_v1");
  const geojson = JSON.parse(raw);
  const arquivos = metaRaw ? JSON.parse(metaRaw) : [];
  if (geojson?.type !== "FeatureCollection" || !Array.isArray(geojson.features)) return null;
  return { geojson, arquivos: Array.isArray(arquivos) ? arquivos : [] };
}

export function apagarBaseSigef() {
  localStorage.removeItem("longitude_sigef_brasil_local_v1");
  localStorage.removeItem("longitude_sigef_brasil_meta_v1");
}

export function agruparSigefPorUf(arquivos = []) {
  return arquivos.reduce((acc, item) => {
    const uf = item.uf || "UF?";
    acc[uf] = (acc[uf] || 0) + Number(item.features || 0);
    return acc;
  }, {});
}
