import { lerBaseSigef } from "../../core/storage/sigefStorage";
import { findInLocalSigef } from "./localSigefSearch.mjs";

const SIGEF_QUERY_URL = import.meta.env.DEV ? "/proxy/sigef/query" : "/api/sigef/query";
export async function findSigefParcel(identifier) {
  const value = String(identifier || "").trim();
  if (!value) throw new Error("Informe o número da certificação ou UUID.");
  let stored = null;
  if (typeof localStorage !== "undefined") {
    try { stored = lerBaseSigef()?.geojson || null; } catch { stored = null; }
  }
  const local = findInLocalSigef(value, stored);
  if (local) return normalizeFeature(local, value, "SIGEF LOCAL");
  const params = new URLSearchParams({ where: buildWhere(value), outFields: "*", returnGeometry: "true", f: "geojson" });
  const response = await fetch(`${SIGEF_QUERY_URL}?${params}`);
  const contentType = response.headers.get("content-type") || "não informado";
  if (import.meta.env.DEV) console.info("[SIGEF DEBUG] resposta ao frontend", { service: SIGEF_QUERY_URL, status: response.status, contentType });
  if (!response.ok) {
    const preview = (await response.text()).slice(0, 500);
    throw new Error(`O proxy ${SIGEF_QUERY_URL} respondeu HTTP ${response.status}. Resposta: ${preview || "sem conteúdo"}`);
  }
  const geojson = await response.json();
  if (geojson?.error) throw new Error(`Consulta automática ao SIGEF indisponível nesta fonte. ${geojson.error.message || "Resposta inválida."}`);
  if (!geojson?.features?.length) return null;
  return normalizeFeature(geojson.features[0], value, "PAMGIA/IBAMA — SIGEF Público");
}
function normalizeFeature(feature, value, source) {
  const p = feature.properties || {};
  if (import.meta.env.DEV) console.info("[Averbação GEO][SIGEF] campos recebidos", Object.keys(p));
  const pick = (...keys) => keys.map((key) => p[key]).find((item) => item != null && item !== "") || "";
  return {
    property: { name: pick("nome_area", "NOME_AREA", "nome_imovel", "NOME_IMOVEL"), municipality: pick("municipio_", "MUNICIPIO_", "municipio", "MUNICIPIO"), state: pick("uf", "UF"), area: Number(pick("area_ha", "AREA_HA")) || null },
    registry: { registrationNumber: pick("registro_m", "REGISTRO_M", "matricula", "MATRICULA"), owner: pick("proprietario", "PROPRIETARIO") },
    sigef: { certificationId: value, parcelId: pick("parcela_co", "PARCELA_CO", "cod_imovel", "COD_IMOVEL"), status: pick("situacao", "SITUACAO") },
    geometry: feature,
    rawProperties: p,
    source,
  };
}
function buildWhere(value) {
  const safe = value.replace(/'/g, "''");
  return ["parcela_co", "codigo_imo", "registro_m", "nome_area"].map((field) => `${field} LIKE '%${safe}%'`).join(" OR ");
}
