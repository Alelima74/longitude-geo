import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import shp from "shpjs";
import html2canvas from "html2canvas";
import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import { utmToLatLon } from "./utm";
import logoLongitude from "../assets/logo-longitude-relatorio.png";
import {
  activateVersion,
  clearSession,
  cloudConfigured,
  createImportLog,
  createVersion,
  getSession,
  importFeatureBatch,
  listImports,
  listVersions,
  queryGeometry,
  queryNeighbors,
  queryPoint,
  signIn,
  updateImportLog,
  updateVersion,
  uploadOriginalZip,
} from "./cloudApi";

const FIELD_MAP = {
  SIGEF: {
    code: ["parcela_co", "PARCELA_CO", "codigo", "codigo_imo", "cod_imovel", "id"],
    name: ["nome_area", "NOME_AREA", "denominacao", "nome", "imovel"],
    title: [],
    farm: ["nome_area", "NOME_AREA", "denominacao"],
    municipality: ["municipio", "MUNICIPIO", "nome_munic"],
    registration: ["matricula", "MATRICULA", "registro"],
    cns: ["cns", "CNS"],
    status: ["situacao", "SITUACAO", "status"],
  },
  CAR: {
    code: ["NUMEROESTA", "numeroesta", "cod_imovel", "codigo"],
    name: ["NOM_IMOVEL", "nom_imovel", "nome_imovel", "denominacao"],
    title: [],
    farm: ["NOM_IMOVEL", "nom_imovel", "nome_imovel"],
    municipality: ["MUNICIPIO", "municipio", "NOM_MUNICI", "nom_munici"],
    registration: [],
    cns: [],
    status: ["SITUACAO", "situacao", "status"],
  },
  INCRA_2A_EDICAO: {
    code: ["COD_IMOVEL", "cod_imovel", "CODIGO", "codigo", "ID", "id"],
    name: ["NOME_IMOVEL", "nome_imovel", "DENOMINACAO", "denominacao", "NOME", "nome"],
    title: ["TITULO", "titulo", "PROCESSO", "processo"],
    farm: ["NOME_IMOVEL", "nome_imovel", "DENOMINACAO", "denominacao"],
    municipality: ["MUNICIPIO", "municipio", "NM_MUN", "nm_mun"],
    registration: ["MATRICULA", "matricula", "REGISTRO", "registro"],
    cns: ["CNS", "cns"],
    status: ["SITUACAO", "situacao", "STATUS", "status"],
  },
  INTERMAT: {
    code: ["OBJECTID", "objectid", "codigo", "id"],
    name: ["PROP_REQUERC", "prop_requerc", "PROP_REQUER", "prop_requer"],
    title: ["PROP_REQUERC", "prop_requerc", "PROP_REQUER", "prop_requer"],
    farm: ["PROP_DENOM", "prop_denom", "DENOMINACAO", "denominacao", "NOME_FAZEN"],
    municipality: ["MUNICIPIO", "municipio"],
    registration: ["MATRICULA", "matricula"],
    cns: ["CNS", "cns"],
    status: ["SITUACAO", "situacao", "status"],
  },
};

function pick(obj, names) {
  for (const name of names || []) {
    const value = obj?.[name];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function normalizeShpResult(result) {
  if (!result) return [];
  if (result.type === "FeatureCollection") return result.features || [];
  if (Array.isArray(result)) return result.flatMap((item) => item?.features || item?.geojson?.features || []);
  if (result.geojson?.type === "FeatureCollection") return result.geojson.features || [];
  return [];
}

function polygonGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") return geometry;
  return null;
}


function forceCoordinate2D(coordinate) {
  if (!Array.isArray(coordinate)) return coordinate;
  if (coordinate.length && typeof coordinate[0] === "number") {
    return coordinate.slice(0, 2);
  }
  return coordinate.map(forceCoordinate2D);
}

function forceGeometry2D(geometry) {
  if (!geometry) return null;
  if (geometry.type === "GeometryCollection") {
    return {
      ...geometry,
      geometries: (geometry.geometries || []).map(forceGeometry2D).filter(Boolean),
    };
  }
  return {
    ...geometry,
    coordinates: forceCoordinate2D(geometry.coordinates),
  };
}

function normalizeFeature(feature, origem) {
  const props = feature.properties || {};
  const fields = FIELD_MAP[origem];
  const geometry = forceGeometry2D(polygonGeometry(feature.geometry));
  if (!geometry) return null;
  return {
    geometry,
    codigo: pick(props, fields.code),
    nome: pick(props, fields.name),
    titulo_primitivo: pick(props, fields.title),
    nome_fazenda: pick(props, fields.farm),
    municipio: pick(props, fields.municipality),
    matricula: pick(props, fields.registration),
    cns: pick(props, fields.cns),
    situacao: pick(props, fields.status),
    atributos: props,
  };
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function fullFeatureGeometry(row) {
  return parseJson(row.geometria_geojson);
}

function intersectionGeometry(row) {
  return parseJson(row.geometria_intersecao_geojson);
}

function resultGeometry(row) {
  return intersectionGeometry(row) || fullFeatureGeometry(row);
}

function parseGeographicCoordinate(value, axis) {
  const raw = String(value || "").trim().toUpperCase().replace(",", ".");
  if (!raw) throw new Error(`Informe a ${axis === "lat" ? "latitude" : "longitude"}.`);
  const direct = Number(raw);
  if (Number.isFinite(direct)) {
    const limit = axis === "lat" ? 90 : 180;
    if (direct < -limit || direct > limit) throw new Error("Coordenada geográfica fora do limite.");
    return direct;
  }
  const direction = raw.match(/[NSEWLO]$/)?.[0] || "";
  const numbers = raw.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (!numbers.length) throw new Error("Formato geográfico inválido.");
  let result = Math.abs(numbers[0]) + (numbers[1] || 0) / 60 + (numbers[2] || 0) / 3600;
  const negative = numbers[0] < 0 || ["S", "W", "O"].includes(direction);
  if (negative) result *= -1;
  const limit = axis === "lat" ? 90 : 180;
  if (result < -limit || result > limit) throw new Error("Coordenada geográfica fora do limite.");
  return result;
}

function extractPolygonGeometries(geojson) {
  const features = geojson?.type === "FeatureCollection"
    ? geojson.features
    : geojson?.type === "Feature"
      ? [geojson]
      : geojson?.type
        ? [{ type: "Feature", geometry: geojson, properties: {} }]
        : [];
  return features.map((feature) => polygonGeometry(feature.geometry)).filter(Boolean);
}

function buildQueryGeometry(geojson) {
  const geometries = extractPolygonGeometries(geojson);
  if (!geometries.length) throw new Error("O arquivo não contém polígono ou multipolígono.");
  if (geometries.length === 1) return forceGeometry2D(geometries[0]);
  return forceGeometry2D({ type: "GeometryCollection", geometries });
}

async function readPerimeterFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "kml") {
    const documentXml = new DOMParser().parseFromString(await file.text(), "text/xml");
    return buildQueryGeometry(kmlToGeoJson(documentXml));
  }
  if (extension === "geojson" || extension === "json") {
    return buildQueryGeometry(JSON.parse(await file.text()));
  }
  if (extension === "zip") {
    return buildQueryGeometry({
      type: "FeatureCollection",
      features: normalizeShpResult(await shp(await file.arrayBuffer())),
    });
  }
  throw new Error("Use KML, GeoJSON/JSON ou ZIP Shapefile.");
}

function downloadBlob(content, mime, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function coordinateText(ring) {
  return ring.map(([lon, lat, altitude = 0]) => `${lon},${lat},${altitude}`).join(" ");
}

function geometryToKml(geometry) {
  if (!geometry) return "";
  if (geometry.type === "Polygon") {
    const [outer, ...inners] = geometry.coordinates;
    return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinateText(outer)}</coordinates></LinearRing></outerBoundaryIs>${inners.map((ring) => `<innerBoundaryIs><LinearRing><coordinates>${coordinateText(ring)}</coordinates></LinearRing></innerBoundaryIs>`).join("")}</Polygon>`;
  }
  if (geometry.type === "MultiPolygon") {
    return `<MultiGeometry>${geometry.coordinates.map((polygon) => geometryToKml({ type: "Polygon", coordinates: polygon })).join("")}</MultiGeometry>`;
  }
  if (geometry.type === "GeometryCollection") {
    return `<MultiGeometry>${geometry.geometries.map(geometryToKml).join("")}</MultiGeometry>`;
  }
  return "";
}

function safeHtml(value) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function CloudPanel() {
  const mapRef = useRef(null);
  const resultLayerRef = useRef(null);
  const neighborLayerRef = useRef(null);
  const queryLayerRef = useRef(null);
  const markerRef = useRef(null);
  const baseLayerRef = useRef(null);
  const [session, setSession] = useState(getSession());
  const [login, setLogin] = useState({ email: "", password: "" });
  const [queryMode, setQueryMode] = useState("utm");
  const [utm, setUtm] = useState({ east: "", north: "", zone: "21", hemisphere: "S" });
  const [geo, setGeo] = useState({ lat: "", lon: "" });
  const [perimeterFile, setPerimeterFile] = useState(null);
  const [point, setPoint] = useState(null);
  const [queryAreaGeometry, setQueryAreaGeometry] = useState(null);
  const [queryDescription, setQueryDescription] = useState("");
  const [results, setResults] = useState([]);
  const [neighbors, setNeighbors] = useState([]);
  const [neighborDistance, setNeighborDistance] = useState("20");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [maintenance, setMaintenance] = useState({ origem: "SIGEF", uf: "MT", referenceDate: "", file: null });
  const [progress, setProgress] = useState(0);
  const [versions, setVersions] = useState([]);
  const [imports, setImports] = useState([]);
  const [mapType, setMapType] = useState("standard");

  const isAdmin = session?.user?.app_metadata?.role === "admin";
  const configured = cloudConfigured();

  useEffect(() => {
    const element = document.getElementById("cloud-coordinate-map");
    if (!element || mapRef.current) return;
    const map = L.map(element).setView([-15.6, -56.1], 5);
    baseLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 20, crossOrigin: true,
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { try { map.remove(); } catch {} mapRef.current = null; };
  }, [session]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    baseLayerRef.current = mapType === "satellite"
      ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Esri World Imagery", maxZoom: 20, crossOrigin: true })
      : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 20, crossOrigin: true });
    baseLayerRef.current.addTo(map);
    baseLayerRef.current.bringToBack();
  }, [mapType, session]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const ref of [markerRef, resultLayerRef, neighborLayerRef, queryLayerRef]) {
      if (ref.current) { try { map.removeLayer(ref.current); } catch {} ref.current = null; }
    }
    const boundsGroup = [];
    if (queryAreaGeometry) {
      queryLayerRef.current = L.geoJSON({ type: "Feature", geometry: queryAreaGeometry, properties: {} }, {
        style: { color: "#ffea00", weight: 5, fillColor: "#ffea00", fillOpacity: 0.05 },
      }).addTo(map);
      const bounds = queryLayerRef.current.getBounds();
      if (bounds.isValid()) boundsGroup.push(bounds);
    }
    if (point) {
      markerRef.current = L.circleMarker([point.lat, point.lon], {
        radius: 9, color: "#ffea00", weight: 4, fillColor: "#f59e0b", fillOpacity: 0.95,
      }).addTo(map);
      boundsGroup.push(L.latLngBounds([[point.lat, point.lon], [point.lat, point.lon]]));
    }
    const features = results.map((row) => {
      const geometry = resultGeometry(row);
      return geometry ? { type: "Feature", geometry, properties: row } : null;
    }).filter(Boolean);
    if (features.length) {
      resultLayerRef.current = L.geoJSON({ type: "FeatureCollection", features }, {
        style: (feature) => ({
          color: feature.properties.origem === "SIGEF" ? "#2563eb" : feature.properties.origem === "CAR" ? "#16a34a" : "#f97316",
          weight: 3,
          fillOpacity: 0.18,
        }),
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          layer.bindPopup(`<strong>${safeHtml(p.origem)}</strong><br>${safeHtml(p.codigo || p.nome || p.nome_fazenda)}`);
        },
      }).addTo(map);
      const bounds = resultLayerRef.current.getBounds();
      if (bounds.isValid()) boundsGroup.push(bounds);
    }
    const neighborFeatures = neighbors.map((row) => {
      const geometry = fullFeatureGeometry(row);
      return geometry ? { type: "Feature", geometry, properties: row } : null;
    }).filter(Boolean);
    if (neighborFeatures.length) {
      neighborLayerRef.current = L.geoJSON({ type: "FeatureCollection", features: neighborFeatures }, {
        style: (feature) => ({
          color: feature.properties.relacao === "CONFRONTANTE" ? "#a855f7" : "#ec4899",
          weight: 3,
          dashArray: feature.properties.relacao === "CONFRONTANTE" ? null : "8 5",
          fillOpacity: 0.05,
        }),
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          layer.bindPopup(`<strong>Vizinho — ${safeHtml(p.relacao)}</strong><br>${safeHtml(p.origem)} — ${safeHtml(p.codigo || p.nome || p.nome_fazenda)}<br>Distância: ${safeHtml(p.distancia_m)} m`);
        },
      }).addTo(map);
      const bounds = neighborLayerRef.current.getBounds();
      if (bounds.isValid()) boundsGroup.push(bounds);
    }
    if (boundsGroup.length) {
      let combined = boundsGroup[0];
      boundsGroup.slice(1).forEach((bounds) => { combined = combined.extend(bounds); });
      if (combined.isValid()) map.fitBounds(combined.pad(0.18), { maxZoom: 17 });
    }
  }, [point, queryAreaGeometry, results, neighbors]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      const next = await signIn(login.email, login.password);
      setSession(next);
      setMessage("Login realizado.");
    } catch (error) {
      setMessage(`Erro no login: ${error.message}`);
    } finally { setLoading(false); }
  }

  function logout() {
    clearSession(); setSession(null); setResults([]); setVersions([]); setImports([]);
  }

  async function consultCoordinate(event) {
    event.preventDefault(); setLoading(true); setMessage(""); setQueryAreaGeometry(null); setNeighbors([]);
    try {
      let converted;
      if (queryMode === "utm") {
        converted = utmToLatLon(utm.east, utm.north, utm.zone, utm.hemisphere);
        setQueryDescription(`UTM E ${utm.east}, N ${utm.north}, Fuso ${utm.zone}${utm.hemisphere}`);
      } else {
        converted = {
          lat: parseGeographicCoordinate(geo.lat, "lat"),
          lon: parseGeographicCoordinate(geo.lon, "lon"),
        };
        setQueryDescription(`Geográfica: latitude ${converted.lat.toFixed(8)}, longitude ${converted.lon.toFixed(8)}`);
      }
      setPoint(converted);
      const rows = await queryPoint(converted.lon, converted.lat);
      setResults(rows);
      setMessage(rows.length ? `${rows.length} ocorrência(s) encontrada(s) nas bases ativas.` : "Nenhuma feição ativa contém esta coordenada.");
    } catch (error) {
      setResults([]); setMessage(`Falha na consulta: ${error.message}`);
    } finally { setLoading(false); }
  }

  async function consultPerimeter(event) {
    event.preventDefault();
    if (!perimeterFile) { setMessage("Selecione um KML, GeoJSON ou ZIP Shapefile."); return; }
    setLoading(true); setMessage(""); setPoint(null); setNeighbors([]);
    try {
      const geometry = await readPerimeterFile(perimeterFile);
      setQueryAreaGeometry(geometry);
      setQueryDescription(`Perímetro importado: ${perimeterFile.name}`);
      const rows = await queryGeometry(geometry);
      setResults(rows);
      setMessage(rows.length ? `${rows.length} feição(ões) sobreposta(s) ao perímetro.` : "Nenhuma feição ativa sobrepõe o perímetro.");
    } catch (error) {
      setResults([]);
      const msg = String(error?.message || "");
      if (/timeout|canceling statement/i.test(msg)) {
        setMessage("A análise detalhada excedeu o tempo. Nenhuma sobreposição foi confirmada nas bases atualmente carregadas. Importe também a camada INCRA 2ª Edição quando a área estiver inserida nela.");
      } else {
        setMessage(`Não foi possível concluir a consulta: ${msg}`);
      }
    } finally { setLoading(false); }
  }

  function rowsFeatureCollection(rows, geometrySelector) {
    return {
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        geometry: geometrySelector(row),
        properties: {
          base: row.origem,
          uf: row.uf,
          codigo: row.codigo,
          nome: row.nome,
          titulo_primitivo: row.titulo_primitivo,
          fazenda: row.nome_fazenda,
          matricula: row.matricula,
          cns: row.cns,
          municipio: row.municipio,
          relacao: row.relacao,
          distancia_m: row.distancia_m,
          area_intersecao_ha: row.area_intersecao_ha,
          percentual_sobre_perimetro: row.percentual_sobre_perimetro,
          referencia: row.data_referencia,
        },
      })).filter((feature) => feature.geometry),
    };
  }

  function exportGeoJson() {
    if (!results.length) return setMessage("Faça uma consulta com resultados antes de exportar.");
    const collection = rowsFeatureCollection(results, fullFeatureGeometry);
    downloadBlob(JSON.stringify(collection, null, 2), "application/geo+json", `longitude_geo_feicoes_sobrepostas_${new Date().toISOString().slice(0, 10)}.geojson`);
  }

  function rowsToKml(rows, geometrySelector, documentName, filename) {
    if (!rows.length) return setMessage("Não existem feições para exportar.");
    const placemarks = rows.map((row, index) => {
      const geometry = geometrySelector(row);
      if (!geometry) return "";
      const description = [
        ["Base", row.origem], ["UF", row.uf], ["Código", row.codigo], ["Nome", row.nome],
        ["Título primitivo", row.titulo_primitivo], ["Fazenda", row.nome_fazenda],
        ["Matrícula", row.matricula], ["CNS", row.cns], ["Relação", row.relacao],
        ["Distância (m)", row.distancia_m], ["Área sobreposta (ha)", row.area_intersecao_ha],
        ["% do perímetro", row.percentual_sobre_perimetro],
      ].map(([key, value]) => `<b>${escapeXml(key)}:</b> ${escapeXml(value ?? "-")}<br>`).join("");
      return `<Placemark><name>${escapeXml(row.nome_fazenda || row.nome || row.codigo || `${row.origem} ${index + 1}`)}</name><description><![CDATA[${description}]]></description>${geometryToKml(geometry)}</Placemark>`;
    }).join("");
    const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(documentName)}</name>${placemarks}</Document></kml>`;
    downloadBlob(kml, "application/vnd.google-earth.kml+xml", filename);
  }

  function exportOverlappingFeaturesKml() {
    rowsToKml(
      results,
      fullFeatureGeometry,
      "Longitude Geo — Feições completas sobrepostas",
      `longitude_geo_feicoes_sobrepostas_${new Date().toISOString().slice(0, 10)}.kml`,
    );
  }

  function exportIntersectionsKml() {
    const withIntersection = results.filter((row) => intersectionGeometry(row));
    if (!withIntersection.length) return setMessage("Esta consulta foi executada em modo rápido e não possui recortes de interseção. Exporte as feições completas.");
    rowsToKml(
      withIntersection,
      intersectionGeometry,
      "Longitude Geo — Recortes das interseções",
      `longitude_geo_recortes_intersecao_${new Date().toISOString().slice(0, 10)}.kml`,
    );
  }

  function exportNeighborsKml() {
    rowsToKml(
      neighbors,
      fullFeatureGeometry,
      "Longitude Geo — Imóveis vizinhos e confrontantes",
      `longitude_geo_vizinhos_${new Date().toISOString().slice(0, 10)}.kml`,
    );
  }

  async function analyzeNeighbors() {
    if (!queryAreaGeometry) return setMessage("A análise de vizinhos exige um perímetro KML, GeoJSON ou Shapefile.");
    setLoading(true);
    setPhase("Buscando imóveis confrontantes e próximos");
    try {
      const distance = Math.max(0, Math.min(500, Number(neighborDistance) || 0));
      const rows = await queryNeighbors(queryAreaGeometry, distance);
      setNeighbors(rows);
      setMessage(rows.length
        ? `${rows.length} imóvel(is) vizinho(s), confrontante(s) ou próximo(s) encontrado(s) em até ${distance} m.`
        : `Nenhum vizinho foi encontrado nas bases ativas em até ${distance} m do perímetro.`);
    } catch (error) {
      setNeighbors([]);
      setMessage(`Não foi possível analisar os vizinhos: ${error.message}`);
    } finally {
      setLoading(false);
      setPhase("");
    }
  }

  async function assetToDataUrl(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }

  async function printReport() {
    if (!results.length) return setMessage("Faça uma consulta com resultados antes de gerar o relatório.");
    setLoading(true); setPhase("Preparando relatório");
    let mapImage = ""; let logoData = "";
    const mapElement = document.getElementById("cloud-coordinate-map");
    const controls = mapElement?.querySelectorAll(".leaflet-control-container");
    try {
      controls?.forEach((el) => { el.dataset.oldDisplay = el.style.display; el.style.display = "none"; });
      const canvas = await html2canvas(mapElement, { useCORS: true, backgroundColor: "#ffffff", scale: 2 });
      mapImage = canvas.toDataURL("image/png");
      logoData = await assetToDataUrl(logoLongitude);
    } catch {} finally { controls?.forEach((el) => { el.style.display = el.dataset.oldDisplay || ""; }); }
    const rows = results.map((row) => `<tr><td>${safeHtml(row.origem)}</td><td>${safeHtml(row.uf)}</td><td>${safeHtml(row.codigo)}</td><td>${safeHtml(row.nome || row.nome_fazenda)}</td><td>${safeHtml(row.titulo_primitivo)}</td><td>${safeHtml(row.matricula || row.cns)}</td><td>${safeHtml(row.area_intersecao_ha ?? "-")}</td><td>${safeHtml(row.percentual_sobre_perimetro ?? "-")}</td></tr>`).join("");
    const report = window.open("", "_blank", "width=1200,height=850");
    if (!report) { setLoading(false); return setMessage("O navegador bloqueou a janela do relatório. Libere pop-ups."); }
    report.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório Longitude Geo</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#14211a;margin:0}.header{display:flex;align-items:center;border-bottom:3px solid #166534;padding-bottom:10px}.logo{width:95px;height:95px;object-fit:contain;margin-right:18px}.header h1{color:#075985;margin:0 0 4px}.header h2{color:#166534;margin:0}.meta{padding:10px;background:#f1f5f9;border-left:5px solid #16a34a;margin:12px 0}.map{width:100%;height:430px;object-fit:contain;border:1px solid #94a3b8}.caption{font-size:10px;color:#475569;text-align:center}.summary{display:flex;gap:10px;margin:12px 0}.summary div{background:#ecfdf5;border:1px solid #86efac;padding:8px 12px;border-radius:6px}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}th,td{border:1px solid #cbd5e1;padding:5px;vertical-align:top;word-break:break-word}th{background:#e2e8f0}.actions{margin:10px 0}.footer{margin-top:12px;font-size:9px;color:#64748b}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div><div class="header">${logoData ? `<img class="logo" src="${logoData}">` : ""}<div><h1>Longitude Geo Intelligence</h1><h2>Relatório de Consulta Territorial</h2></div></div><div class="meta"><b>Data:</b> ${new Date().toLocaleString("pt-BR")}<br><b>Consulta:</b> ${safeHtml(queryDescription)}<br><b>Mapa:</b> ${mapType === "satellite" ? "Imagem de satélite" : "Mapa padrão"}</div><div class="summary"><div><b>Ocorrências:</b> ${results.length}</div><div><b>Bases:</b> ${[...new Set(results.map(r=>r.origem))].join(", ")}</div></div>${mapImage ? `<img class="map" src="${mapImage}"><div class="caption">Perímetro consultado e feições encontradas - ${mapType === "satellite" ? "Esri World Imagery" : "OpenStreetMap"}</div>` : ""}<h2>Feições sobrepostas</h2><table><thead><tr><th>Base</th><th>UF</th><th>Código</th><th>Nome/Fazenda</th><th>Título</th><th>Matrícula/CNS</th><th>Sobreposição ha</th><th>% perímetro</th></tr></thead><tbody>${rows}</tbody></table>${neighbors.length ? `<h2>Vizinhos e confrontantes</h2><table><thead><tr><th>Relação</th><th>Base</th><th>UF</th><th>Código</th><th>Nome/Fazenda</th><th>Matrícula/CNS</th><th>Distância (m)</th></tr></thead><tbody>${neighborRows}</tbody></table>` : ""}<p><b>Conclusão:</b> A consulta identificou ${results.length} ocorrência(s) sobreposta(s)${neighbors.length ? ` e ${neighbors.length} imóvel(is) vizinho(s)/confrontante(s)` : ""} nas versões ativas das bases geoespaciais cadastradas.</p><div class="footer">Uso técnico preliminar. Conferir os dados e documentos oficiais antes de qualquer ato registral, administrativo ou judicial.</div></body></html>`);
    report.document.close(); setLoading(false); setPhase("");
  }

  async function refreshCloudData() {
    if (!session) return;
    try {
      const [versionRows, importRows] = await Promise.all([listVersions(), isAdmin ? listImports() : Promise.resolve([])]);
      setVersions(versionRows); setImports(importRows);
    } catch (error) {
      setMessage(`Não foi possível atualizar o histórico: ${error.message}`);
    }
  }

  async function processZip(event) {
    event.preventDefault();
    const file = maintenance.file;
    if (!file) { setMessage("Selecione um ZIP."); return; }
    if (!isAdmin) { setMessage("Seu usuário não possui perfil de administrador."); return; }

    setLoading(true); setProgress(1); setMessage("");
    let version = null;
    let importLog = null;
    try {
      const largeMode = file.size > 50 * 1024 * 1024;
      let storagePath = null;
      if (largeMode) {
        setPhase("Modo grande: processando diretamente no notebook");
        setProgress(8);
      } else {
        setPhase("Enviando ZIP original");
        storagePath = await uploadOriginalZip(file, maintenance.origem, maintenance.uf, setProgress);
      }

      setPhase("Lendo SHP, removendo altitude Z e validando geometrias"); setProgress(18);
      const parsed = await shp(await file.arrayBuffer());
      const rawFeatures = normalizeShpResult(parsed);
      const features = rawFeatures.map((feature) => normalizeFeature(feature, maintenance.origem)).filter(Boolean);
      if (!features.length) throw new Error("Nenhum polígono válido foi encontrado no ZIP.");

      setPhase("Criando versão em processamento"); setProgress(25);
      version = await createVersion({
        origem: maintenance.origem,
        nome: `${maintenance.origem} ${maintenance.uf || "BR"} ${maintenance.referenceDate || new Date().toISOString().slice(0, 10)}`,
        uf: maintenance.uf || null,
        data_referencia: maintenance.referenceDate || null,
        arquivo_original: storagePath,
        quantidade_feicoes: features.length,
        status: "PROCESSANDO",
        ativa: false,
        observacoes: largeMode
          ? `Processamento local de arquivo grande, sem cópia do ZIP no Storage: ${file.name}`
          : `Arquivo original: ${file.name}`,
        metadados: { filename: file.name, size: file.size, modo: largeMode ? "LOCAL_GRANDE" : "STORAGE" },
      });

      importLog = await createImportLog({
        version_id: version.id,
        origem: maintenance.origem,
        uf: maintenance.uf || null,
        nome_arquivo: file.name,
        tamanho_bytes: file.size,
        quantidade_recebida: rawFeatures.length,
        quantidade_importada: 0,
        quantidade_erros: rawFeatures.length - features.length,
        status: "PROCESSANDO",
      });

      const batchSize =
        maintenance.origem === "SIGEF" ? 20 :
        maintenance.origem === "CAR" ? 30 :
        file.size > 200 * 1024 * 1024 ? 40 : 100;
      for (let index = 0; index < features.length; index += batchSize) {
        setPhase(`Gravando lote ${Math.floor(index / batchSize) + 1} de ${Math.ceil(features.length / batchSize)}`);
        const batch = features.slice(index, index + batchSize);
        await importFeatureBatch(version.id, maintenance.origem, maintenance.uf, batch);
        const imported = Math.min(features.length, index + batch.length);
        setProgress(25 + Math.round((imported / features.length) * 65));
        if (importLog?.id && (index % 500 === 0 || imported === features.length)) {
          await updateImportLog(importLog.id, { quantidade_importada: imported });
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setPhase("Finalizando geometrias 2D e ativando a nova versão"); setProgress(94);
      await activateVersion(version.id);
      await updateVersion(version.id, { quantidade_feicoes: features.length });
      if (importLog?.id) {
        await updateImportLog(importLog.id, {
          quantidade_importada: features.length,
          quantidade_erros: rawFeatures.length - features.length,
          status: "CONCLUIDA",
          finalizado_em: new Date().toISOString(),
        });
      }
      setProgress(100); setPhase("Concluído");
      setMessage(`${maintenance.origem}/${maintenance.uf || "BR"} ativada com ${features.length.toLocaleString("pt-BR")} feições.${largeMode ? " O ZIP grande foi processado localmente e não foi armazenado no Storage." : ""}`);
      await refreshCloudData();
    } catch (error) {
      if (version?.id) {
        try { await updateVersion(version.id, { status: "ERRO", ativa: false, observacoes: error.message }); } catch {}
      }
      if (importLog?.id) {
        try {
          await updateImportLog(importLog.id, {
            status: "ERRO",
            quantidade_erros: 1,
            erros: [{ mensagem: error.message }],
            finalizado_em: new Date().toISOString(),
          });
        } catch {}
      }
      setMessage(`Falha na importação: ${error.message}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (session) refreshCloudData(); }, [session, isAdmin]);

  if (!configured) {
    return <section className="cloud-page"><div className="cloud-alert"><h3>V70 Consulta Territorial instalada</h3><p>Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local e no Vercel.</p></div></section>;
  }

  if (!session) {
    return <section className="cloud-page"><form className="cloud-login" onSubmit={handleLogin}><h2>Longitude Geo Cloud</h2><p>Entre para consultar e administrar as bases compartilhadas.</p><input type="email" placeholder="E-mail" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} required/><input type="password" placeholder="Senha" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required/><button className="primary-button" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>{message && <p className="cloud-message">{message}</p>}</form></section>;
  }

  return <section className="cloud-page">
    <div className="cloud-header"><div><h2>Longitude Geo Cloud — V70</h2><p>Consulta por coordenada UTM, geográfica ou perímetro e manutenção das bases nacionais.</p></div><div className="cloud-header-actions"><span className={isAdmin ? "cloud-admin-badge" : "cloud-user-badge"}>{isAdmin ? "Administrador" : "Consulta"}</span><button className="secondary-action" onClick={logout}>Sair</button></div></div>

    <div className="cloud-query-tabs">
      <button type="button" className={queryMode === "utm" ? "active" : ""} onClick={() => setQueryMode("utm")}>Coordenada UTM</button>
      <button type="button" className={queryMode === "geographic" ? "active" : ""} onClick={() => setQueryMode("geographic")}>Coordenada geográfica</button>
      <button type="button" className={queryMode === "perimeter" ? "active" : ""} onClick={() => setQueryMode("perimeter")}>Importar perímetro</button>
    </div>

    <div className="cloud-grid">
      {queryMode !== "perimeter" ? <form className="cloud-card" onSubmit={consultCoordinate}>
        <h3>{queryMode === "utm" ? "Localizar área por coordenada UTM" : "Localizar área por coordenada geográfica"}</h3>
        {queryMode === "utm" ? <>
          <p>Informe Este, Norte, fuso e hemisfério.</p>
          <div className="cloud-form-grid"><label>Este (E)<input value={utm.east} onChange={(event) => setUtm({ ...utm, east: event.target.value })} required/></label><label>Norte (N)<input value={utm.north} onChange={(event) => setUtm({ ...utm, north: event.target.value })} required/></label><label>Fuso/Zona<select value={utm.zone} onChange={(event) => setUtm({ ...utm, zone: event.target.value })}>{Array.from({ length: 60 }, (_, index) => index + 1).map((zone) => <option key={zone}>{zone}</option>)}</select></label><label>Hemisfério<select value={utm.hemisphere} onChange={(event) => setUtm({ ...utm, hemisphere: event.target.value })}><option value="S">Sul</option><option value="N">Norte</option></select></label></div>
        </> : <>
          <p>Aceita graus decimais ou GMS, por exemplo: <b>-14.7872</b> ou <b>14°47'14"S</b>.</p>
          <div className="cloud-form-grid"><label>Latitude<input placeholder="-14.78726828 ou 14°47'14.2&quot;S" value={geo.lat} onChange={(event) => setGeo({ ...geo, lat: event.target.value })} required/></label><label>Longitude<input placeholder="-56.08007156 ou 56°04'48.3&quot;O" value={geo.lon} onChange={(event) => setGeo({ ...geo, lon: event.target.value })} required/></label></div>
        </>}
        <button className="primary-button" disabled={loading}>{loading ? "Consultando..." : "Consultar bases ativas"}</button>
        {point && <div className="cloud-coordinate-result"><strong>Latitude:</strong> {point.lat.toFixed(8)} &nbsp; <strong>Longitude:</strong> {point.lon.toFixed(8)}</div>}
        {message && <p className="cloud-message">{message}</p>}
      </form> : <form className="cloud-card" onSubmit={consultPerimeter}>
        <h3>Consultar por perímetro</h3>
        <p>Importe KML, GeoJSON/JSON ou ZIP Shapefile. O sistema calcula as feições sobrepostas, área e percentual.</p>
        <label className="cloud-file-label">Arquivo do perímetro<input type="file" accept=".kml,.geojson,.json,.zip" onChange={(event) => setPerimeterFile(event.target.files?.[0] || null)} required/></label>
        {perimeterFile && <div className="cloud-file-summary"><strong>{perimeterFile.name}</strong><span>{formatBytes(perimeterFile.size)}</span></div>}
        <button className="primary-button" disabled={loading}>{loading ? "Analisando..." : "Consultar sobreposições"}</button>
        {message && <p className="cloud-message">{message}</p>}
      </form>}
      <div className="cloud-card"><div className="cloud-card-title"><h3>Mapa do resultado</h3><div className="cloud-map-switch"><button type="button" className={mapType === "standard" ? "active" : ""} onClick={() => setMapType("standard")}>Mapa padrão</button><button type="button" className={mapType === "satellite" ? "active" : ""} onClick={() => setMapType("satellite")}>Satélite</button></div></div><div id="cloud-coordinate-map" className="cloud-map"></div></div>
    </div>

    <div className="cloud-card">
      <div className="cloud-card-title"><h3>Ocorrências encontradas</h3>{results.length > 0 && <div className="cloud-export-actions"><button className="secondary-action" onClick={exportOverlappingFeaturesKml}>KML das feições sobrepostas</button><button className="secondary-action" onClick={exportIntersectionsKml}>KML dos recortes</button><button className="secondary-action" onClick={exportGeoJson}>GeoJSON das feições</button><button className="primary-button compact" onClick={printReport}>Relatório / PDF</button></div>}</div>
      <div className="cloud-table-wrap"><table className="cloud-table"><thead><tr><th>Base</th><th>UF</th><th>Código</th><th>Nome/Identificação</th><th>Título primitivo</th><th>Fazenda</th><th>Matrícula/CNS</th><th>Sobreposição ha</th><th>% perímetro</th><th>Referência</th></tr></thead><tbody>{results.map((row, index) => <tr key={`${row.feature_id}-${index}`}><td><span className={`cloud-base-tag ${String(row.origem).toLowerCase()}`}>{row.origem}</span></td><td>{row.uf || "-"}</td><td>{row.codigo || "-"}</td><td>{row.nome || "-"}</td><td>{row.titulo_primitivo || "-"}</td><td>{row.nome_fazenda || "-"}</td><td>{[row.matricula, row.cns].filter(Boolean).join(" / ") || "-"}</td><td>{row.area_intersecao_ha != null ? Number(row.area_intersecao_ha).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "-"}</td><td>{row.percentual_sobre_perimetro != null ? `${Number(row.percentual_sobre_perimetro).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%` : "-"}</td><td>{row.data_referencia || "-"}</td></tr>)}{!results.length && <tr><td colSpan="10">Nenhuma consulta realizada.</td></tr>}</tbody></table></div>
    </div>

    {queryAreaGeometry && <div className="cloud-card cloud-neighbor-card">
      <div className="cloud-card-title">
        <div>
          <h3>Análise de vizinhos e confrontantes</h3>
          <p>Localiza imóveis cadastrados cujos limites tocam ou estão próximos do perímetro analisado. Use distância 0 m para confrontação exata ou uma tolerância para diferenças entre levantamentos.</p>
        </div>
        {neighbors.length > 0 && <button className="secondary-action" type="button" onClick={exportNeighborsKml}>Baixar KML dos vizinhos</button>}
      </div>
      <div className="cloud-neighbor-controls">
        <label>Distância de tolerância
          <select value={neighborDistance} onChange={(event) => setNeighborDistance(event.target.value)}>
            <option value="0">0 m — apenas limites coincidentes</option>
            <option value="2">2 m</option>
            <option value="5">5 m</option>
            <option value="10">10 m</option>
            <option value="20">20 m</option>
            <option value="50">50 m</option>
            <option value="100">100 m</option>
          </select>
        </label>
        <button type="button" className="primary-button compact" onClick={analyzeNeighbors} disabled={loading}>
          {loading && phase.includes("confrontantes") ? phase : "Analisar vizinhos"}
        </button>
      </div>
      <div className="cloud-table-wrap"><table className="cloud-table"><thead><tr><th>Relação</th><th>Base</th><th>UF</th><th>Código</th><th>Nome/Fazenda</th><th>Matrícula/CNS</th><th>Distância (m)</th><th>Referência</th></tr></thead><tbody>{neighbors.map((row, index) => <tr key={`neighbor-${row.feature_id}-${index}`}><td><span className={`cloud-relation-tag ${String(row.relacao || "").toLowerCase()}`}>{row.relacao || "PRÓXIMO"}</span></td><td>{row.origem}</td><td>{row.uf || "-"}</td><td>{row.codigo || "-"}</td><td>{row.nome_fazenda || row.nome || "-"}</td><td>{[row.matricula, row.cns].filter(Boolean).join(" / ") || "-"}</td><td>{row.distancia_m != null ? Number(row.distancia_m).toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : "-"}</td><td>{row.data_referencia || "-"}</td></tr>)}{!neighbors.length && <tr><td colSpan="8">Clique em “Analisar vizinhos” para localizar confrontantes e imóveis próximos.</td></tr>}</tbody></table></div>
    </div>}

    {isAdmin ? <>
      <form className="cloud-card maintenance-card" onSubmit={processZip}>
        <h3>Manutenção das bases nacionais</h3>
        <p>Importe uma nova versão por base e UF. A versão anterior permanece ativa até a conclusão.</p>
        <div className="cloud-form-grid"><label>Base<select value={maintenance.origem} onChange={(event) => setMaintenance({ ...maintenance, origem: event.target.value })}><option>SIGEF</option><option>CAR</option><option>INTERMAT</option><option value="INCRA_2A_EDICAO">INCRA 2ª Edição</option></select></label><label>UF<input maxLength="2" value={maintenance.uf} onChange={(event) => setMaintenance({ ...maintenance, uf: event.target.value.toUpperCase() })}/></label><label>Data de referência<input type="date" value={maintenance.referenceDate} onChange={(event) => setMaintenance({ ...maintenance, referenceDate: event.target.value })}/></label><label>Arquivo ZIP<input type="file" accept=".zip" onChange={(event) => setMaintenance({ ...maintenance, file: event.target.files?.[0] || null })} required/></label></div>
        {maintenance.file && <div className="cloud-file-summary"><strong>{maintenance.file.name}</strong><span>{formatBytes(maintenance.file.size)}</span></div>}
        <button className="primary-button" disabled={loading}>{loading ? `${phase} — ${progress}%` : "Enviar, processar e ativar base"}</button>
        {loading && <div className="cloud-progress"><progress max="100" value={progress}></progress><span>{phase}</span></div>}
        <p className="cloud-warning"><b>ZIP até 50 MB:</b> o original é armazenado no Supabase. <b>ZIP maior:</b> é processado diretamente neste notebook e as feições são gravadas na nuvem; mantenha o navegador e o notebook ligados até concluir.</p>
      </form>

      <div className="cloud-card"><div className="cloud-card-title"><h3>Versões das bases</h3><button className="secondary-action" onClick={refreshCloudData}>Atualizar</button></div><div className="cloud-table-wrap"><table className="cloud-table"><thead><tr><th>Base</th><th>UF</th><th>Nome</th><th>Feições</th><th>Status</th><th>Ativa</th><th>Referência</th></tr></thead><tbody>{versions.map((version) => <tr key={version.id}><td>{version.origem}</td><td>{version.uf || "BR"}</td><td>{version.nome}</td><td>{Number(version.quantidade_feicoes || 0).toLocaleString("pt-BR")}</td><td>{version.status}</td><td>{version.ativa ? "Sim" : "Não"}</td><td>{version.data_referencia || "-"}</td></tr>)}{!versions.length && <tr><td colSpan="7">Nenhuma versão registrada.</td></tr>}</tbody></table></div></div>

      <div className="cloud-card"><h3>Histórico das importações</h3><div className="cloud-table-wrap"><table className="cloud-table"><thead><tr><th>Arquivo</th><th>Base/UF</th><th>Recebidas</th><th>Importadas</th><th>Erros</th><th>Status</th><th>Início</th></tr></thead><tbody>{imports.map((item) => <tr key={item.id}><td>{item.nome_arquivo}</td><td>{item.origem}/{item.uf || "BR"}</td><td>{Number(item.quantidade_recebida || 0).toLocaleString("pt-BR")}</td><td>{Number(item.quantidade_importada || 0).toLocaleString("pt-BR")}</td><td>{item.quantidade_erros || 0}</td><td>{item.status}</td><td>{item.iniciado_em?.slice(0, 16).replace("T", " ")}</td></tr>)}{!imports.length && <tr><td colSpan="7">Nenhuma importação registrada.</td></tr>}</tbody></table></div></div>
    </> : <div className="cloud-alert"><h3>Perfil de consulta</h3><p>Seu usuário pode consultar as bases. Para importar ZIPs, ele precisa receber o perfil administrativo no Supabase.</p></div>}
  </section>;
}
