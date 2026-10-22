export function findInLocalSigef(value, base) {
  const needle = normalize(value);
  if (!needle || !base?.features?.length) return null;
  return base.features.find((feature) => Object.values(feature.properties || {}).some((item) => normalize(item) === needle)) || null;
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[–—]/g, "-").trim().toLowerCase();
}
