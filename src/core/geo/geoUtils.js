export function featureCollection(features = []) {
  return { type: "FeatureCollection", features: Array.isArray(features) ? features : [] };
}

export function isFeatureCollection(value) {
  return value?.type === "FeatureCollection" && Array.isArray(value.features);
}
