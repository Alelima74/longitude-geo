import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import shp from "shpjs";

export async function parseGeospatialFile(file) {
  const extension = file?.name?.split(".").pop()?.toLowerCase();
  if (!["kml", "geojson", "json", "zip"].includes(extension)) throw new Error("Formato não suportado nesta etapa. Use KML, GeoJSON ou SHP compactado em ZIP.");
  let result;
  if (extension === "kml") result = kmlToGeoJson(new DOMParser().parseFromString(await file.text(), "text/xml"));
  else if (extension === "zip") result = await shp(await file.arrayBuffer());
  else result = JSON.parse(await file.text());
  const collection = normalize(result);
  const feature = collection.features.find((item) => /Polygon/.test(item?.geometry?.type));
  if (!feature) throw new Error("O arquivo não contém polígono utilizável.");
  return feature;
}
function normalize(value) {
  if (Array.isArray(value)) return { type: "FeatureCollection", features: value.flatMap((item) => normalize(item).features) };
  if (value?.type === "FeatureCollection") return value;
  if (value?.type === "Feature") return { type: "FeatureCollection", features: [value] };
  return { type: "FeatureCollection", features: [] };
}
