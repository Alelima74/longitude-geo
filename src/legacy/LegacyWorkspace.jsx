import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-draw";
import * as toGeoJSON from "@tmcw/togeojson";
import * as turf from "@turf/turf";
import html2canvas from "html2canvas";
import * as shpwrite from "@mapbox/shp-write";
import shp from "shpjs";
import logoLongitude from "../assets/logo-longitude.png";
import { APP_NAME, APP_VERSION, APP_BUILD, APP_STORAGE_KEY } from "../core/config/appConfig";
import { criarAssinaturaArquivo, gravarBaseSigef, lerBaseSigef, apagarBaseSigef, agruparSigefPorUf } from "../core/storage/sigefStorage";
import CloudPanel from "../cloud/CloudPanel";
import EnterpriseModules from "../components/EnterpriseModules";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";

const STORAGE_KEY = APP_STORAGE_KEY;

const initialData = {
  clientes: [],
  imoveis: [],
  analises: [],
};

const CAMADAS_FUTURAS = [
  "SIGEF / INCRA",
  "CAR / SIMCAR",
  "INTERMAT",
  "SEMA-MT",
  "IBAMA",
  "FUNAI",
  "Unidades de Conservação",
  "Hidrografia",
  "Limites Municipais",
];

const STATUS_FUNDIARIO = ["SIGEF / INCRA", "CAR / SIMCAR", "INTERMAT", "SEMA-MT", "FUNAI", "IBAMA"];

const CORES_SOBREPOSICAO = [
  "#E11D48",
  "#2563EB",
  "#16A34A",
  "#F97316",
  "#7C3AED",
  "#0891B2",
  "#CA8A04",
  "#DC2626",
  "#059669",
  "#4F46E5",
];

function corSobreposicao(indice) {
  return CORES_SOBREPOSICAO[indice % CORES_SOBREPOSICAO.length];
}

function corDocx(hex) {
  return String(hex || "#999999").replace("#", "").toUpperCase();
}

const SERVICOS_OFICIAIS = {
  sigef: "https://acervofundiario.incra.gov.br/",
  car: "https://www.car.gov.br/#/consultar",
  intermatPortal: "https://intergeo.intermat.mt.gov.br/portal/home/",
  sigefFeatureServer: "/api/sigef/query",
  carWfs: "/api/car",
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hojeBR() {
  return new Date().toLocaleDateString("pt-BR");
}

function carregarDados() {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    return bruto ? JSON.parse(bruto) : initialData;
  } catch {
    return initialData;
  }
}

function salvarArquivo(nome, conteudo, tipo = "text/plain;charset=utf-8") {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function salvarBlob(nome, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function textoRelatorio(valor) {
  return String(valor ?? "-")
    .replace(/\s+/g, " ")
    .replace(/-/g, "- ")
    .replace(/(.{28})/g, "$1 ")
    .trim() || "-";
}

function nomeArquivoSeguro(valor, padrao = "parcela-consultada") {
  const texto = String(valor || padrao)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);

  return texto || padrao;
}

function obterNomeDaFeicao(geojson, padrao = "parcela-consultada") {
  const props = geojson?.features?.[0]?.properties || {};
  return (
    props.parcela_co ||
    props.PARCELA_CO ||
    props.cod_imovel ||
    props.COD_IMOVEL ||
    props.codigo_imo ||
    props.CODIGO_IMO ||
    props.cod_imovel ||
    props.nome_area ||
    props.NOME_AREA ||
    padrao
  );
}

function numeroBR(valor, casas = 4) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
function extrairAtributosParcela(feature, origem = "") {
  const p = feature?.properties || {};
  const valor = (nomes) => obterValorPossivel(p, nomes);

  const codigo = valor([
    "NUMEROESTA", "numeroesta", "NumeroEsta", "numeroEsta",
    "COD_IMOVEL", "cod_imovel", "cod_car", "COD_CAR",
    "codigo_imo", "CODIGO_IMO", "parcela_co", "PARCELA_CO", "codigo", "CODIGO"
  ]) || "-";

  const nomeBruto = valor([
    "NOMEIMOVEL", "nomeimovel", "NOME_IMOVE", "nome_imove", "NOM_IMOVE", "nom_imove",
    "NOM_IMOVEL", "nom_imovel", "NOME_IMOVEL", "nome_imovel", "NOMIMOVEL", "nomimovel",
    "NOME_AREA", "nome_area", "NOME_FAZEN", "nome_fazen", "NOMEFAZEN", "nomefazen",
    "NOME_FAZ", "nome_faz", "FAZENDA", "fazenda", "DENOMINACA", "denominaca",
    "DENOMINACAO", "denominacao", "NOME", "nome", "NOM_PROP", "nom_prop",
    "PROPRIEDAD", "propriedad", "IMOVEL", "imovel"
  ]);

  const nome = nomeBruto && String(nomeBruto).trim() && String(nomeBruto).trim() !== String(codigo).trim()
    ? nomeBruto
    : "Nome do imóvel não informado na base CAR";

  return {
    origem,
    codigo,
    sncr: valor(["codigo_imo", "CODIGO_IMO", "cod_imovel", "COD_IMOVEL", "sncr", "SNCR", "NUMEROESTA"]) || "-",
    nome,
    matricula: valor(["registro_m", "REGISTRO_M", "matricula", "MATRICULA"]) || "-",
    municipio: valor(["municipio_", "MUNICIPIO_", "municipio", "MUNICIPIO", "cod_munici", "COD_MUNICI", "MUNICIP", "municip"]) || "-",
    status: valor(["status", "STATUS", "situacao_i", "SITUACAO_I", "SITUACAO", "situacao"]) || "-",
  };
}

function bboxSobrepoe(a, b) {
  if (!a || !b) return false;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function featureCollectionDeUma(feature) {
  return { type: "FeatureCollection", features: [feature] };
}

function coordenadasIguais(a, b) {
  if (!a || !b) return false;
  return Math.abs(Number(a[0]) - Number(b[0])) < 1e-9 && Math.abs(Number(a[1]) - Number(b[1])) < 1e-9;
}

function fecharAnel(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const ring = coords.map((c) => [Number(c[0]), Number(c[1])]).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (ring.length < 3) return null;
  if (!coordenadasIguais(ring[0], ring[ring.length - 1])) ring.push([...ring[0]]);
  if (ring.length < 4) return null;
  return ring;
}

function converterFeatureParaPoligono(feature) {
  if (!feature?.geometry) return null;
  const g = feature.geometry;

  if (g.type === "Polygon" || g.type === "MultiPolygon") {
    try {
      return turf.cleanCoords(feature);
    } catch {
      return feature;
    }
  }

  if (g.type === "LineString") {
    const ring = fecharAnel(g.coordinates);
    if (!ring) return null;
    return {
      type: "Feature",
      properties: { ...(feature.properties || {}), __convertidoDeLinha: true },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  }

  if (g.type === "MultiLineString") {
    const polys = [];
    for (const linha of g.coordinates || []) {
      const ring = fecharAnel(linha);
      if (ring) polys.push([ring]);
    }
    if (!polys.length) return null;
    return {
      type: "Feature",
      properties: { ...(feature.properties || {}), __convertidoDeLinha: true },
      geometry: { type: "MultiPolygon", coordinates: polys },
    };
  }

  return null;
}

function normalizarPerimetroGeojson(geojson) {
  if (!geojson) return { type: "FeatureCollection", features: [] };

  const entrada = geojson.type === "FeatureCollection"
    ? geojson.features
    : geojson.type === "Feature"
      ? [geojson]
      : [];

  const poligonos = entrada
    .map(converterFeatureParaPoligono)
    .filter(Boolean)
    .filter((f) => {
      try { return turf.area(f) > 0.01; } catch { return false; }
    });

  return { type: "FeatureCollection", features: poligonos };
}

function obterFeaturePerimetroRobusto(geojson) {
  const normalizado = normalizarPerimetroGeojson(geojson);
  const validas = normalizado.features || [];
  if (!validas.length) return null;
  if (validas.length === 1) return validas[0];

  let uniao = validas[0];

  for (let i = 1; i < validas.length; i++) {
    try {
      const u = turf.union(turf.featureCollection([uniao, validas[i]]));
      if (u?.geometry) uniao = u;
    } catch {
      // Se a união falhar por geometria inválida, mantém o maior polígono no final.
    }
  }

  try {
    if (turf.area(uniao) > 0.01) return uniao;
  } catch {}

  return validas
    .map((f) => ({ f, area: (() => { try { return turf.area(f); } catch { return 0; } })() }))
    .sort((a, b) => b.area - a.area)[0]?.f || null;
}

function calcularIntersecaoRobusta(perimetroFeature, feature) {
  if (!perimetroFeature?.geometry || !feature?.geometry) {
    return { inter: null, areaHa: 0, metodo: "sem_geometria" };
  }

  const candidato = converterFeatureParaPoligono(feature) || feature;

  let bboxOk = false;
  try {
    bboxOk = bboxSobrepoe(turf.bbox(perimetroFeature), turf.bbox(candidato));
  } catch {
    bboxOk = false;
  }

  if (!bboxOk) return { inter: null, areaHa: 0, metodo: "bbox_fora" };

  let toca = false;
  try {
    toca = turf.booleanIntersects(perimetroFeature, candidato);
  } catch {
    toca = true; // se falhar, ainda tenta intersect pelo bbox
  }

  if (!toca) return { inter: null, areaHa: 0, metodo: "nao_intersecta" };

  const tentativas = [
    () => turf.intersect(turf.featureCollection([perimetroFeature, candidato])),
    () => turf.intersect(perimetroFeature, candidato),
    () => turf.intersect(turf.cleanCoords(perimetroFeature), turf.cleanCoords(candidato)),
    () => turf.intersect(turf.buffer(perimetroFeature, 0, { units: "meters" }), turf.buffer(candidato, 0, { units: "meters" })),
  ];

  for (const tentativa of tentativas) {
    try {
      const inter = tentativa();
      if (inter?.geometry) {
        const areaHa = turf.area(inter) / 10000;
        if (areaHa > 0.000001) return { inter, areaHa, metodo: "intersect" };
      }
    } catch {}
  }

  // Fallback conservador: se a geometria visualmente/bbox cruza, usa interseção de BBOX como diagnóstico estimado.
  try {
    const a = turf.bbox(perimetroFeature);
    const b = turf.bbox(candidato);
    const ix1 = Math.max(a[0], b[0]);
    const iy1 = Math.max(a[1], b[1]);
    const ix2 = Math.min(a[2], b[2]);
    const iy2 = Math.min(a[3], b[3]);
    if (ix2 > ix1 && iy2 > iy1) {
      const bboxPoly = turf.bboxPolygon([ix1, iy1, ix2, iy2]);
      const areaHa = turf.area(bboxPoly) / 10000;
      if (areaHa > 0.000001) return { inter: bboxPoly, areaHa, metodo: "bbox_estimado" };
    }
  } catch {}

  return { inter: null, areaHa: 0, metodo: "falhou" };
}


function geojsonParaKml(geojson, nome = "Perimetro Longitude Geo") {
  const features = geojson?.features || [];
  const placemarks = features.map((feature, index) => {
    const geom = feature.geometry;
    if (!geom) return "";

    if (geom.type === "Polygon") {
      const coords = geom.coordinates[0].map(([lng, lat]) => `${lng},${lat},0`).join(" ");
      return `<Placemark><name>${nome} ${index + 1}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
    }

    if (geom.type === "MultiPolygon") {
      return geom.coordinates.map((poly, polyIndex) => {
        const coords = poly[0].map(([lng, lat]) => `${lng},${lat},0`).join(" ");
        return `<Placemark><name>${nome} ${index + 1}.${polyIndex + 1}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
      }).join("");
    }

    if (geom.type === "LineString") {
      const coords = geom.coordinates.map(([lng, lat]) => `${lng},${lat},0`).join(" ");
      return `<Placemark><name>${nome} ${index + 1}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
    }

    return "";
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${nome}</name>
${placemarks}
</Document>
</kml>`;
}


function normalizarCodigoIncra(valor) {
  const limpo = String(valor || "").replace(/\D/g, "");
  if (limpo.length === 13) {
    return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}.${limpo.slice(9, 12)}-${limpo.slice(12)}`;
  }
  return String(valor || "").trim();
}

function somenteDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function obterValorPossivel(props, nomes) {
  if (!props) return "";

  for (const nome of nomes) {
    if (props[nome] !== undefined && props[nome] !== null && String(props[nome]).trim() !== "") {
      return props[nome];
    }
  }

  const mapa = {};
  Object.keys(props).forEach((k) => {
    mapa[String(k).toUpperCase()] = k;
  });

  for (const nome of nomes) {
    const real = mapa[String(nome).toUpperCase()];
    if (real && props[real] !== undefined && props[real] !== null && String(props[real]).trim() !== "") {
      return props[real];
    }
  }

  return "";
}

function dataUrlParaUint8Array(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}


function bboxComFolga(geojson, margemPercentual = 0.08) {
  const [minX, minY, maxX, maxY] = turf.bbox(geojson);
  const dx = Math.max((maxX - minX) * margemPercentual, 0.01);
  const dy = Math.max((maxY - minY) * margemPercentual, 0.01);
  return [minX - dx, minY - dy, maxX + dx, maxY + dy];
}

function detectarUfPorCentroide(geojson) {
  try {
    const c = turf.centroid(geojson).geometry.coordinates;
    const lng = c[0];
    const lat = c[1];

    // Regra prática para MT no MVP. Mantém estrutura para futuras UFs.
    if (lng <= -50 && lng >= -62 && lat <= -7 && lat >= -19) return "mt";
    return "mt";
  } catch {
    return "mt";
  }
}
function montarResumoFeicaoAuto(feature, origem, indice) {
  const p = feature.properties || {};
  return {
    indice,
    origem,
    codigo: obterValorPossivel(p, ["NUMEROESTA", "numeroesta", "NumeroEsta", "numeroEsta", "COD_IMOVEL", "cod_imovel", "cod_car", "COD_CAR", "codigo_imo", "CODIGO_IMO", "parcela_co", "PARCELA_CO", "codigo", "CODIGO"]) || "-",
    nome: obterValorPossivel(p, ["NOM_IMOVEL", "nom_imovel", "NOME_IMOVEL", "nome_imovel", "nome_imove", "NOME_IMOVE", "nome_area", "NOME_AREA", "nome", "NOME", "nom_imovel", "NOM_IMOVEL", "DENOMINACAO", "denominacao", "NOME_FAZ", "FAZENDA", "NOM_PROP", "PROPRIEDAD"]) || "-",
    sncr: obterValorPossivel(p, ["codigo_imo", "CODIGO_IMO", "cod_imovel", "COD_IMOVEL", "sncr", "SNCR", "NUMEROESTA"]) || "-",
    matricula: obterValorPossivel(p, ["registro_m", "REGISTRO_M", "matricula", "MATRICULA"]) || "-",
    municipio: obterValorPossivel(p, ["municipio_", "MUNICIPIO_", "municipio", "MUNICIPIO", "nom_munici", "NOM_MUNICI", "MUNICIP"]) || "-",
    status: obterValorPossivel(p, ["status", "STATUS", "situacao_i", "SITUACAO_I", "SITUACAO"]) || "-",
  };
}




function normalizarGeojsonImportado(resultado) {
  if (!resultado) return { type: "FeatureCollection", features: [] };

  if (resultado.type === "FeatureCollection") return resultado;

  if (Array.isArray(resultado)) {
    return {
      type: "FeatureCollection",
      features: resultado.flatMap((camada) => camada?.features || [])
    };
  }

  if (resultado.features) {
    return {
      type: "FeatureCollection",
      features: resultado.features
    };
  }

  return { type: "FeatureCollection", features: [] };
}


function obterFeaturePerimetro(geojson) {
  return obterFeaturePerimetroRobusto(geojson);
}

function bboxIntersectsFeature(bboxFeature, feature) {
  try { return turf.booleanIntersects(bboxFeature, feature); } catch { return false; }
}

function numeroPtBr(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;
  const s = String(valor).replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  return Number(s) || 0;
}






function normalizarChaveIntermat(valor) {
  if (valor === undefined || valor === null) return "";
  const s = String(valor).trim();
  if (!s) return "";
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return s;
}
function resumirFeatureIntermat(feature) {
  const p = feature?.properties || {};
  const valor = (nomes) => obterValorPossivel(p, nomes);
  const codigo = valor(["__codigo", "PROP_CODIG", "PROP_CODIGO", "PROP_CODIGO", "CODIGO", "codigo", "ID", "id"]);
  const tituloPrimitivo = valor(["__tituloPrimitivo", "PROP_REQUE", "prop_reque", "PROP_REQUER", "prop_requer", "REQUERENTE", "requerente", "TITULAR", "titular"]);
  const fazendaDenominacao = valor(["__nomeFazenda", "PROP_DENOM", "prop_denom", "PROP_DENOMI", "prop_denomi", "DENOMINACAO", "denominacao", "NOME_FAZ", "nome_faz", "NOME", "nome"]);
  return {
    codigo,
    tituloPrimitivo: tituloPrimitivo || (codigo ? `INTERMAT ${codigo}` : "TÍTULO NÃO IDENTIFICADO"),
    nomeFazenda: fazendaDenominacao || "Fazenda/denominação não informada na base INTERMAT",
    requerente: tituloPrimitivo || "-",
    denominacao: fazendaDenominacao || "-",
    areaTitulo: valor(["__areaTituloHa", "PROP_AREA", "AREA", "area"]),
    registro: valor(["__registro", "PROP_REGIS", "PROP_REGIST", "REGISTRO", "registro"]),
    livro: valor(["__livro", "PROP_LIVRO", "LIVRO", "livro"]),
    folha: valor(["__folha", "PROP_FOLHA", "FOLHA", "folha"]),
    local: valor(["PROP_LOCAL", "PROP_LOCALI", "LOCAL", "local"]),
    orgao: valor(["PROP_ORGAO", "PROP_ORGAOT", "ORGAO", "orgao"]),
    origem: valor(["PROP_ORIGE", "PROP_ORIGEM", "ORIGEM", "origem"]),
    matricula: valor(["__matricula", "PROP_MATRI", "PROP_MATRIC", "MATRICULA", "matricula"]),
    municipio: valor(["__municipio", "PROP_CODMU", "PROP_MUNGE", "PROP_CODMUN", "MUNICIPIO", "municipio"]),
  };
}

function normalizarAtributosIntermatFeature(feature) {
  const resumo = resumirFeatureIntermat(feature);
  return {
    ...feature,
    properties: {
      ...(feature.properties || {}),
      __origem: "INTERMAT",
      __codigo: normalizarChaveIntermat(resumo.codigo) || "-",
      __tituloPrimitivo: resumo.tituloPrimitivo || "-",
      __nomeFazenda: resumo.nomeFazenda || "-",
      __nome: resumo.tituloPrimitivo || resumo.nomeFazenda || "-",
      __requerente: resumo.requerente || "-",
      __registro: resumo.registro || "-",
      __livro: resumo.livro || "-",
      __folha: resumo.folha || "-",
      __orgao: resumo.orgao || "-",
      __matricula: resumo.matricula || "-",
      __municipio: resumo.municipio || "-",
      __status: resumo.origem || "-",
      __areaTituloHa: numeroPtBr(resumo.areaTitulo),
    }
  };
}
function nomeTituloIntermat(properties) {
  const p = properties || {};
  return (
    p.__tituloPrimitivo ||
    p.PROP_REQUE || p.prop_reque ||
    p.PROP_REQUER || p.prop_requer ||
    p.PROP_REQUERC || p.prop_requerc ||
    p.__nome ||
    "TÍTULO NÃO IDENTIFICADO"
  );
}

function nomeFazendaIntermat(properties) {
  const p = properties || {};
  return (
    p.__nomeFazenda ||
    p.PROP_DENOM || p.prop_denom ||
    p.PROP_DENOMI || p.prop_denomi ||
    p.DENOMINACAO || p.denominacao ||
    "Fazenda/denominação não informada na base INTERMAT"
  );
}

export default function LegacyWorkspace() {
  const mapRef = useRef(null);
  const geoLayerRef = useRef(null);
  const consultaLayerRef = useRef(null);
  const autoCarLayerRef = useRef(null);
  const autoSigefLayerRef = useRef(null);
  const autoIntermatLayerRef = useRef(null);
  const highlightPerimeterLayerRef = useRef(null);
  const overlapLayerRef = useRef(null);
  const mapLegendControlRef = useRef(null);
  const sobreposicaoLayerRef = useRef(null);
  const previewSigefLayerRef = useRef(null);
  const previewCarLayerRef = useRef(null);
  const legendaControlRef = useRef(null);
  const baseLayersRef = useRef({});
  const currentBaseLayerRef = useRef(null);
  const drawnItemsRef = useRef(null);

  const [tela, setTela] = useState("analise");
  const [imovelAbertoId, setImovelAbertoId] = useState("");
  const [dados, setDados] = useState(carregarDados);
  const [areaHa, setAreaHa] = useState(null);
  const [arquivoNome, setArquivoNome] = useState("");
  const [geojsonAtual, setGeojsonAtual] = useState(null);
  const [diagnostico, setDiagnostico] = useState("Aguardando envio de arquivo KML.");
  const [autoAnaliseStatus, setAutoAnaliseStatus] = useState("");
  const [carCapabilitiesInfo, setCarCapabilitiesInfo] = useState("");
  const [autoCarGeojson, setAutoCarGeojson] = useState(null);
  const [autoSigefGeojson, setAutoSigefGeojson] = useState(null);
  const [autoIntermatGeojson, setAutoIntermatGeojson] = useState(null);
  const [autoResumo, setAutoResumo] = useState(null);
  const [autoCamadas, setAutoCamadas] = useState({ car: true, sigef: true, intermat: true });
  const [basesAnaliseAtivas, setBasesAnaliseAtivas] = useState({ car: true, sigef: true, intermat: true });

  const [sigefArquivosImportados, setSigefArquivosImportados] = useState([]);
  const [sigefPersistenciaAtiva, setSigefPersistenciaAtiva] = useState(true);
  const [mapaBase, setMapaBase] = useState("padrao");

  const [clienteForm, setClienteForm] = useState({ nome: "", documento: "", telefone: "", email: "" });
  const [imovelForm, setImovelForm] = useState({
    nome: "", municipio: "", matricula: "", car: "", sigef: "", clienteId: "", observacoes: "",
  });
  const [propostaForm, setPropostaForm] = useState({
    servico: "Diagnóstico Fundiário Preliminar", valor: "", prazo: "7 dias úteis",
  });
  const [consultaForm, setConsultaForm] = useState({ codigoCar: "", codigoSigef: "", layerIntermat: "" });
  const [statusOnline, setStatusOnline] = useState({ intermat: "Não testado", sigef: "Consulta via proxy", car: "Consulta via proxy" });
  const [catalogoIntermat, setCatalogoIntermat] = useState([]);
  const [resultadoIntermat, setResultadoIntermat] = useState("");
  const [resultadoConsulta, setResultadoConsulta] = useState("");
  const [diagnosticoOnline, setDiagnosticoOnline] = useState("");
  const [consultaGeojson, setConsultaGeojson] = useState(null);
  const [mostrarPreviewSigef, setMostrarPreviewSigef] = useState(false);
  const [mostrarPreviewCar, setMostrarPreviewCar] = useState(false);
  const [sigefLocalGeojson, setSigefLocalGeojson] = useState(null);
  const [sigefLocalNome, setSigefLocalNome] = useState("");
  const [sigefLocalInfo, setSigefLocalInfo] = useState("");
  const [intermatLocalGeojson, setIntermatLocalGeojson] = useState(null);
  const [intermatLocalNome, setIntermatLocalNome] = useState("");
  const [intermatLocalInfo, setIntermatLocalInfo] = useState("");
  const [intermatIndex, setIntermatIndex] = useState({});
  const [carLocalGeojson, setCarLocalGeojson] = useState(null);
  const [carLocalNome, setCarLocalNome] = useState("");
  const [carLocalInfo, setCarLocalInfo] = useState("");
  const [ultimoCruzamento, setUltimoCruzamento] = useState(null);
  const [resultadoSobreposicaoDetalhado, setResultadoSobreposicaoDetalhado] = useState(null);
  const [mapaRelatorioDataUrl, setMapaRelatorioDataUrl] = useState(null);
  const [analiseSobreposicao, setAnaliseSobreposicao] = useState(null);
  const [analisandoSobreposicao, setAnalisandoSobreposicao] = useState(false);
  const [carregandoOnline, setCarregandoOnline] = useState(false);


  useEffect(() => {
    carregarSigefSalvoDoNavegador();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  }, [dados]);

  useEffect(() => {
    if (tela !== "analise" && tela !== "integracoes") return;

    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    if (mapRef.current && mapRef.current.getContainer && document.body.contains(mapRef.current.getContainer())) {
      setTimeout(() => mapRef.current.invalidateSize(), 120);
      return;
    }

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {}
    }

    geoLayerRef.current = null;
    if (typeof consultaLayerRef !== "undefined") consultaLayerRef.current = null;
    if (typeof sobreposicaoLayerRef !== "undefined") sobreposicaoLayerRef.current = null;
    if (typeof previewSigefLayerRef !== "undefined") previewSigefLayerRef.current = null;
    if (typeof previewCarLayerRef !== "undefined") previewCarLayerRef.current = null;
    if (typeof legendaControlRef !== "undefined") legendaControlRef.current = null;
    drawnItemsRef.current = null;
    currentBaseLayerRef.current = null;

    const map = L.map("map", { zoomControl: false }).setView([-15.601, -56.097], 6);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const mapaPadrao = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 20,
      crossOrigin: true,
    });

    const mapaSatelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles © Esri",
      maxZoom: 20,
      crossOrigin: true,
    });

    baseLayersRef.current = { padrao: mapaPadrao, satelite: mapaSatelite };
    currentBaseLayerRef.current = mapaPadrao;
    mapaPadrao.addTo(map);

    const drawnItems = new L.FeatureGroup();
    drawnItemsRef.current = drawnItems;
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        marker: false,
        circle: false,
        circlemarker: false,
        rectangle: true,
        polyline: true,
        polygon: { allowIntersection: false, showArea: true, metric: true },
      },
      edit: { featureGroup: drawnItems, remove: true },
    });

    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (event) {
      const layer = event.layer;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);

      if (geoLayerRef.current) {
        map.removeLayer(geoLayerRef.current);
        geoLayerRef.current = null;
      }

      const geojson = drawnItems.toGeoJSON();
      const hectares = turf.area(geojson) / 10000;

      setArquivoNome("desenho-manual.geojson");
      setGeojsonAtual(geojson);
      setAreaHa(Number(hectares.toFixed(4)));
      setDiagnostico("Perímetro desenhado manualmente. Preencha os dados do imóvel e salve a análise.");
    });

    mapRef.current = map;

    if (geojsonAtual) {
      const layer = L.geoJSON(geojsonAtual, {
        style: { color: "#ffea00", weight: 7, fillColor: "#3D8B37", fillOpacity: 0.10, opacity: 1 },
      }).addTo(map);
      geoLayerRef.current = layer;
      try { map.fitBounds(layer.getBounds(), { padding: [30, 30] }); } catch {}
    }

    if (typeof consultaGeojson !== "undefined" && consultaGeojson) {
      const layerConsulta = L.geoJSON(consultaGeojson, {
        style: { color: "#00b7ff", weight: 4, fillColor: "#00b7ff", fillOpacity: 0.18 },
        onEachFeature: (feature, camada) => {
          const props = feature.properties || {};
          const linhas = Object.entries(props).slice(0, 12).map(([k, v]) => `<strong>${k}</strong>: ${v ?? ""}`).join("<br/>");
          camada.bindPopup(`<strong>Feição consultada</strong><br/>${linhas}`);
        },
      }).addTo(map);
      consultaLayerRef.current = layerConsulta;
      try { map.fitBounds(layerConsulta.getBounds(), { padding: [30, 30] }); } catch {}
    }

    if (analiseSobreposicao?.feicoesSobrepostas?.features?.length) {
      desenharSobreposicoesNoMapa(analiseSobreposicao);
    }

    setTimeout(() => map.invalidateSize(), 150);
  }, [tela]);

  const estatisticas = useMemo(() => {
    const totalArea = dados.analises.reduce((soma, a) => soma + Number(a.areaHa || 0), 0);
    return {
      clientes: dados.clientes.length,
      imoveis: dados.imoveis.length,
      analises: dados.analises.length,
      area: totalArea.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
    };
  }, [dados]);

  function trocarMapaBase(tipo) {
    setMapaBase(tipo);
    const map = mapRef.current;
    if (!map) return;

    const novaCamada = baseLayersRef.current[tipo];
    if (!novaCamada) return;

    if (currentBaseLayerRef.current) map.removeLayer(currentBaseLayerRef.current);
    novaCamada.addTo(map);
    novaCamada.bringToBack();
    currentBaseLayerRef.current = novaCamada;

    if (geoLayerRef.current) geoLayerRef.current.bringToFront();
    if (consultaLayerRef.current) consultaLayerRef.current.bringToFront();
  }

  function carregarKML(event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setArquivoNome(arquivo.name);
    const leitor = new FileReader();

    leitor.onload = (e) => {
      try {
        const texto = e.target.result;
        const parser = new DOMParser();
        const kml = parser.parseFromString(texto, "text/xml");
        const geojson = toGeoJSON.kml(kml);

        if (!geojson.features || geojson.features.length === 0) {
          setDiagnostico("O KML foi lido, mas nenhum polígono ou linha foi encontrado.");
          return;
        }

        aplicarPerimetroAtual(geojson, arquivo.name, "Perímetro KML carregado com sucesso.");
      } catch (error) {
        console.error(error);
        setDiagnostico("Erro ao processar o KML. Verifique se o arquivo está válido.");
      }
    };

    leitor.readAsText(arquivo);
  }

  function aplicarPerimetroAtual(geojson, nomeArquivo, mensagem) {
    const map = mapRef.current;
    if (!map) return;

    const geojsonNormalizado = normalizarPerimetroGeojson(geojson);
    const perimetroFeature = obterFeaturePerimetro(geojsonNormalizado);

    if (!perimetroFeature) {
      alert("O arquivo foi carregado, mas não contém polígono válido. Se for KML de linha, a linha precisa estar fechada para virar perímetro.");
      return;
    }

    const fcNormalizado = { type: "FeatureCollection", features: [perimetroFeature] };

    if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);
    if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();

    const layer = L.geoJSON(fcNormalizado, {
      style: { color: "#ffea00", weight: 7, fillColor: "#3D8B37", fillOpacity: 0.10, opacity: 1 },
    }).addTo(map);

    geoLayerRef.current = layer;
    map.fitBounds(layer.getBounds(), { padding: [30, 30] });

    const hectares = turf.area(perimetroFeature) / 10000;
    setGeojsonAtual(fcNormalizado);
    setAreaHa(Number(hectares.toFixed(4)));
    setArquivoNome(nomeArquivo);
    setDiagnostico(`${mensagem}
Perímetro normalizado para análise: ${Number(hectares.toFixed(4)).toLocaleString("pt-BR")} ha.`);

    setTimeout(() => {
      executarAnaliseAutomaticaDoPerimetro(fcNormalizado);
    }, 250);
  }

  function desenharCamadaConsulta(geojson, origem) {
    const map = mapRef.current;
    if (!map || !geojson) return;

    if (consultaLayerRef.current) map.removeLayer(consultaLayerRef.current);

    const cor = origem === "CAR/SICAR" ? "#00b7ff" : "#ffcc00";

    const layer = L.geoJSON(geojson, {
      style: { color: cor, weight: 4, fillColor: cor, fillOpacity: 0.18 },
      onEachFeature: (feature, camada) => {
        const props = feature.properties || {};
        const linhas = Object.entries(props).slice(0, 12).map(([k, v]) => `<strong>${k}</strong>: ${v ?? ""}`).join("<br/>");
        camada.bindPopup(`<strong>${origem}</strong><br/>${linhas}`);
      },
    }).addTo(map);

    consultaLayerRef.current = layer;
    try {
      map.fitBounds(layer.getBounds(), { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 150);
    } catch (error) {
      console.error("Não foi possível enquadrar a feição no mapa", error);
    }
  }

  function calcularSobreposicao(baseGeojson, consultaGeojsonParam, origem) {
    try {
      if (!baseGeojson || !consultaGeojsonParam) return null;

      const areaConsulta = turf.area(consultaGeojsonParam) / 10000;
      const areaBase = turf.area(baseGeojson) / 10000;
      let areaIntersecao = 0;

      for (const b of baseGeojson.features || []) {
        for (const c of consultaGeojsonParam.features || []) {
          try {
            let inter = null;
            try {
              inter = turf.intersect(turf.featureCollection([b, c]));
            } catch {
              inter = turf.intersect(b, c);
            }
            if (inter) areaIntersecao += turf.area(inter) / 10000;
          } catch {}
        }
      }

      return {
        origem,
        areaBase: Number(areaBase.toFixed(4)),
        areaConsulta: Number(areaConsulta.toFixed(4)),
        areaIntersecao: Number(areaIntersecao.toFixed(4)),
        percentualBase: areaBase > 0 ? Number(((areaIntersecao / areaBase) * 100).toFixed(2)) : 0,
        percentualConsulta: areaConsulta > 0 ? Number(((areaIntersecao / areaConsulta) * 100).toFixed(2)) : 0,
      };
    } catch {
      return null;
    }
  }

  function aplicarResultadoConsulta(geojson, origem, codigo) {
    if (!geojson?.features?.length) {
      setResultadoConsulta(`${origem}: nenhuma feição encontrada para o código informado.`);
      return;
    }

    desenharCamadaConsulta(geojson, origem);
    setConsultaGeojson(geojson);

    const areaConsulta = turf.area(geojson) / 10000;
    const cruzamento = geojsonAtual ? calcularSobreposicao(geojsonAtual, geojson, origem) : null;
    setUltimoCruzamento(cruzamento);

    const cruzamentoDetalhado = geojsonAtual ? calcularSobreposicaoDetalhada(geojsonAtual, geojson, origem) : null;
    setResultadoSobreposicaoDetalhado(cruzamentoDetalhado);
    if (cruzamentoDetalhado) {
      desenharSobreposicoesDetalhadas(cruzamentoDetalhado);
    }

    let texto = `${origem}: feição encontrada e carregada no mapa.\n`;
    texto += `Código pesquisado: ${codigo}\n`;
    texto += `Quantidade de feições: ${geojson.features.length}\n`;
    texto += `Área da feição consultada: ${areaConsulta.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha\n`;

    if (cruzamento) {
      texto += `\nCRUZAMENTO COM O PERÍMETRO ATUAL\n`;
      texto += `Área do perímetro atual: ${cruzamento.areaBase.toLocaleString("pt-BR")} ha\n`;
      texto += `Área consultada: ${cruzamento.areaConsulta.toLocaleString("pt-BR")} ha\n`;
      texto += `Área de sobreposição: ${cruzamento.areaIntersecao.toLocaleString("pt-BR")} ha\n`;
      texto += `Sobreposição sobre o perímetro atual: ${cruzamento.percentualBase.toLocaleString("pt-BR")}%\n`;
      texto += `Sobreposição sobre a feição consultada: ${cruzamento.percentualConsulta.toLocaleString("pt-BR")}%\n`;
    } else {
      texto += `\nPara calcular sobreposição, carregue/desenhe primeiro um perímetro base.`;
    }

    setResultadoConsulta(texto);
  }

  async function testarSigef() {
    setCarregandoOnline(true);
    setDiagnosticoOnline("Testando SIGEF/INCRA...");

    try {
      const params = new URLSearchParams({
        f: "geojson",
        where: "1=1",
        outFields: "*",
        returnGeometry: "false",
        resultRecordCount: "5",
      });

      const resposta = await fetch(`${SERVICOS_OFICIAIS.sigefFeatureServer}?${params.toString()}`);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      const json = await resposta.json();
      const features = json.features || [];
      const linhas = features.map((f, i) => {
        const p = f.properties || {};
        return `${i + 1}. ${JSON.stringify(p).slice(0, 500)}`;
      }).join("\n\n");

      setDiagnosticoOnline(`SIGEF respondeu corretamente. Amostras:\n${linhas || "Sem amostras retornadas."}`);
    } catch (error) {
      console.error(error);
      setDiagnosticoOnline(`Falha no teste SIGEF: ${error.message}`);
    } finally {
      setCarregandoOnline(false);
    }
  }

  
function limparUuidSigef(valor) {
  return String(valor || "").replace(/\s+/g, "").replace(/[–—]/g, "-").trim().toLowerCase();
}

function valorCampo(props, nomes) {
  for (const nome of nomes) {
    if (props && props[nome] !== undefined && props[nome] !== null) return props[nome];
  }
  return "";
}

function resumirFeatureSigef(feature) {
  const p = feature?.properties || {};
  return {
    parcela_co: valorCampo(p, ["parcela_co", "PARCELA_CO", "cod_parcela", "COD_PARCELA"]),
    codigo_imo: valorCampo(p, ["codigo_imo", "CODIGO_IMO", "cod_imovel", "COD_IMOVEL", "sncr", "SNCR"]),
    nome_area: valorCampo(p, ["nome_area", "NOME_AREA", "nome_imove", "NOME_IMOVE"]),
    registro_m: valorCampo(p, ["registro_m", "REGISTRO_M", "matricula", "MATRICULA"]),
    municipio: valorCampo(p, ["municipio_", "MUNICIPIO_", "municipio", "MUNICIPIO"]),
    status: valorCampo(p, ["status", "STATUS"]),
  };
}

function normalizarComparacao(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }function normalizarResultadoShpZip(resultado) {
    if (!resultado) return { type: "FeatureCollection", features: [] };

    if (resultado.type === "FeatureCollection") return resultado;

    if (Array.isArray(resultado)) {
      return {
        type: "FeatureCollection",
        features: resultado.flatMap((item) => {
          const fc = item?.geojson || item;
          return Array.isArray(fc?.features) ? fc.features : [];
        }),
      };
    }

    if (resultado.geojson?.type === "FeatureCollection") return resultado.geojson;

    return { type: "FeatureCollection", features: [] };
  }

  function detectarUfPorNomeArquivo(nome = "") {
    const ufs = [
      "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
      "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
    ];

    const upper = String(nome).toUpperCase();
    for (const uf of ufs) {
      const rx = new RegExp(`(^|[^A-Z])${uf}([^A-Z]|$)`);
      if (rx.test(upper)) return uf;
    }

    return "";
  }

  async function lerArquivoZipSigef(file) {
    const arrayBuffer = await file.arrayBuffer();
    const resultado = await shp(arrayBuffer);
    const fc = normalizarResultadoShpZip(resultado);
    const uf = detectarUfPorNomeArquivo(file.name);

    return {
      nome: file.name,
      uf,
      geojson: {
        type: "FeatureCollection",
        features: (fc.features || []).map((feature, idx) => ({
          ...feature,
          properties: {
            ...(feature.properties || {}),
            __origem_base: "SIGEF LOCAL",
            __arquivo_zip: file.name,
            __uf_arquivo: uf,
            __idx_zip: idx + 1,
          },
        })),
      },
    };
  }const SIGEF_STORAGE_KEY = "longitude_sigef_brasil_local_v1";
  const SIGEF_META_STORAGE_KEY = "longitude_sigef_brasil_meta_v1";

  function calcularAssinaturaArquivo(file) {
    return criarAssinaturaArquivo(file);
  }

  function salvarSigefNoNavegador(geojson, arquivos) {
    if (!sigefPersistenciaAtiva) return;
    try {
      gravarBaseSigef(geojson, arquivos);
    } catch (error) {
      console.warn("Não foi possível salvar SIGEF no navegador", error);
      setSigefLocalInfo("Base SIGEF carregada, mas grande demais para salvar no navegador. Continue usando normalmente nesta sessão.");
    }
  }

  function carregarSigefSalvoDoNavegador() {
    try {
      const salvo = lerBaseSigef();
      if (!salvo) return;
      const { geojson, arquivos } = salvo;
      setSigefLocalGeojson(geojson);
      setSigefArquivosImportados(arquivos);
      setSigefLocalNome(`SIGEF BRASIL LOCAL — ${geojson.features.length} feições`);
      setSigefLocalInfo(`SIGEF restaurado do navegador: ${geojson.features.length} feições em ${arquivos.length} arquivo(s).`);
      setBasesAnaliseAtivas((prev) => ({ ...prev, sigef: true }));
    } catch (error) {
      console.warn("Não foi possível restaurar SIGEF salvo", error);
    }
  }

  function limparBaseSigefBrasil() {
    const confirmar = window.confirm("Deseja limpar a base SIGEF LOCAL importada e remover o cache do navegador?");
    if (!confirmar) return;
    setSigefLocalGeojson(null);
    setSigefLocalNome("");
    setSigefLocalInfo("Base SIGEF LOCAL limpa.");
    setSigefArquivosImportados([]);
    try {
      apagarBaseSigef();
    } catch {}
  }

  function resumoUfSigef(arquivos = sigefArquivosImportados) {
    return agruparSigefPorUf(arquivos);
  }async function importarSigefZipNacional(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const zips = files.filter((f) => /\.zip$/i.test(f.name));

    if (!zips.length) {
      alert("Selecione um ou mais arquivos ZIP baixados do SIGEF.");
      event.target.value = "";
      return;
    }

    try {
      setSigefLocalInfo(`Importando ${zips.length} arquivo(s) ZIP do SIGEF...`);

      const assinaturasExistentes = new Set(sigefArquivosImportados.map((item) => item.assinatura));
      const zipsNovos = zips.filter((file) => !assinaturasExistentes.has(calcularAssinaturaArquivo(file)));
      const duplicados = zips.length - zipsNovos.length;

      if (!zipsNovos.length) {
        alert("Todos os ZIPs selecionados já foram importados. Nenhuma feição nova foi adicionada.");
        setSigefLocalInfo(`Nenhum ZIP novo importado. ${duplicados} arquivo(s) duplicado(s) ignorado(s).`);
        event.target.value = "";
        return;
      }

      const importados = [];
      const erros = [];

      for (const file of zipsNovos) {
        try {
          const item = await lerArquivoZipSigef(file);
          if (item.geojson.features.length) {
            importados.push({
              ...item,
              assinatura: calcularAssinaturaArquivo(file),
              tamanho: file.size,
              ultimaModificacao: file.lastModified,
            });
          } else {
            erros.push(`${file.name}: nenhum polígono encontrado`);
          }
        } catch (error) {
          erros.push(`${file.name}: ${error.message}`);
        }
      }

      const baseAtual = sigefLocalGeojson?.features?.length ? sigefLocalGeojson.features : [];
      const novas = importados.flatMap((item) => item.geojson.features);
      const mesclado = { type: "FeatureCollection", features: [...baseAtual, ...novas] };

      const novosArquivos = [
        ...sigefArquivosImportados,
        ...importados.map((item) => ({
          nome: item.nome,
          uf: item.uf || "",
          features: item.geojson.features.length,
          assinatura: item.assinatura,
          tamanho: item.tamanho,
          ultimaModificacao: item.ultimaModificacao,
          dataImportacao: new Date().toISOString(),
        })),
      ];

      setSigefLocalGeojson(mesclado);
      setSigefArquivosImportados(novosArquivos);
      setSigefLocalNome(`SIGEF BRASIL LOCAL — ${mesclado.features.length} feições`);
      setBasesAnaliseAtivas((prev) => ({ ...prev, sigef: true }));
      salvarSigefNoNavegador(mesclado, novosArquivos);

      const resumoUf = resumoUfSigef(novosArquivos);
      const resumoTexto = Object.entries(resumoUf)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([uf, qtd]) => `${uf}: ${qtd}`)
        .join(" • ");

      setSigefLocalInfo(
        `SIGEF nacional importado: ${importados.length} ZIP(s) novo(s), ${novas.length} nova(s) feição(ões), total atual ${mesclado.features.length}. Duplicados ignorados: ${duplicados}. ${resumoTexto}`
      );

      if (erros.length) {
        console.warn("Erros na importação SIGEF ZIP:", erros);
        alert(`Importação concluída com ${erros.length} aviso(s). Veja o console para detalhes.`);
      }
    } catch (error) {
      console.error("Erro ao importar ZIP SIGEF", error);
      alert(`Erro ao importar ZIP SIGEF: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  function importarBaseSigefLocal(event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    const leitor = new FileReader();

    leitor.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target.result);

        if (!geojson.features || geojson.features.length === 0) {
          alert("A base SIGEF GeoJSON não possui feições.");
          return;
        }

        setSigefLocalGeojson(geojson);
        setSigefLocalNome(arquivo.name);

        const primeira = resumirFeatureSigef(geojson.features[0]);
        const campos = Object.keys(geojson.features[0].properties || {});

        setSigefLocalInfo(
          `Base SIGEF local importada com sucesso.\n` +
          `Arquivo: ${arquivo.name}\n` +
          `Feições: ${geojson.features.length}\n` +
          `Campos detectados: ${campos.slice(0, 35).join(", ")}\n\n` +
          `Primeiro registro lido:\n` +
          `parcela_co: ${primeira.parcela_co || "-"}\n` +
          `codigo_imo: ${primeira.codigo_imo || "-"}\n` +
          `nome_area: ${primeira.nome_area || "-"}\n` +
          `registro_m: ${primeira.registro_m || "-"}\n` +
          `municipio: ${primeira.municipio || "-"}\n` +
          `status: ${primeira.status || "-"}`
        );
      } catch (error) {
        console.error(error);
        alert("Erro ao importar base SIGEF GeoJSON. Confirme se o arquivo está em GeoJSON válido.");
      }
    };

    leitor.readAsText(arquivo);
  }


  async function importarBaseCarLocal(event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    try {
      setCarLocalInfo("Importando base CAR local...");

      let geojsonCar = null;
      const nome = arquivo.name.toLowerCase();

      if (nome.endsWith(".zip")) {
        const buffer = await arquivo.arrayBuffer();
        const resultado = await shp(buffer);
        geojsonCar = normalizarGeojsonImportado(resultado);
      } else if (nome.endsWith(".geojson") || nome.endsWith(".json")) {
        const texto = await arquivo.text();
        geojsonCar = JSON.parse(texto);
      } else {
        alert("Para importar CAR local, use ZIP de Shapefile ou GeoJSON.");
        return;
      }

      if (!geojsonCar?.features?.length) {
        alert("A base CAR local não possui feições válidas.");
        return;
      }

      setCarLocalGeojson(geojsonCar);
      setCarLocalNome(arquivo.name);

      const campos = Object.keys(geojsonCar.features[0].properties || {});
      setCarLocalInfo(
        `Base CAR local importada com sucesso.\n` +
        `Arquivo: ${arquivo.name}\n` +
        `Feições: ${geojsonCar.features.length}\n` +
        `Campos detectados: ${campos.slice(0, 35).join(", ")}`
      );

      if (geojsonAtual?.features?.length) {
        setTimeout(() => executarAnaliseAutomaticaDoPerimetro(geojsonAtual), 250);
      }
    } catch (error) {
      console.error(error);
      alert(`Erro ao importar base CAR local: ${error.message}`);
      setCarLocalInfo(`Erro ao importar base CAR local: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  async function importarBaseIntermatLocal(event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    try {
      setIntermatLocalInfo("Importando base INTERMAT...");

      let geojson = null;
      const nome = arquivo.name.toLowerCase();

      if (nome.endsWith(".zip")) {
        const buffer = await arquivo.arrayBuffer();
        const resultado = await shp(buffer);
        geojson = normalizarGeojsonImportado(resultado);
      } else if (nome.endsWith(".geojson") || nome.endsWith(".json")) {
        const texto = await arquivo.text();
        geojson = JSON.parse(texto);
      } else {
        alert("Para importar base INTERMAT, use ZIP de Shapefile ou GeoJSON.");
        return;
      }

      if (!geojson?.features?.length) {
        alert("A base INTERMAT não possui feições válidas.");
        return;
      }

      const intermatNormalizado = {
        type: "FeatureCollection",
        features: (geojson.features || []).map(normalizarAtributosIntermatFeature)
      };

      const indiceIntermat = {};
      for (const feature of intermatNormalizado.features) {
        const r = resumirFeatureIntermat(feature);
        const chave = normalizarChaveIntermat(r.codigo);
        if (chave) indiceIntermat[chave] = r;
      }

      setIntermatLocalGeojson(intermatNormalizado);
      setIntermatIndex(indiceIntermat);
      setIntermatLocalNome(arquivo.name);

      const campos = Object.keys(intermatNormalizado.features[0].properties || {});
      const resumo = resumirFeatureIntermat(intermatNormalizado.features[0]);

      setIntermatLocalInfo(
        `Base INTERMAT importada com sucesso.\n` +
        `Arquivo: ${arquivo.name}\n` +
        `Feições: ${intermatNormalizado.features.length}\n` +
        `Campos detectados: ${campos.slice(0, 35).join(", ")}\n\n` +
        `Primeiro título/propriedade:\n` +
        `Código: ${resumo.codigo || "-"}\n` +
        `Título primitivo: ${resumo.tituloPrimitivo || "-"}\n` +
        `Fazenda/denominação: ${resumo.nomeFazenda || "-"}\n` +
        `Registro: ${resumo.registro || "-"}`
      );

      if (geojsonAtual?.features?.length) {
        setTimeout(() => executarAnaliseAutomaticaDoPerimetro(geojsonAtual), 250);
      }
    } catch (error) {
      console.error(error);
      alert(`Erro ao importar base INTERMAT: ${error.message}`);
      setIntermatLocalInfo(`Erro ao importar base INTERMAT: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  function buscarSigefNaBaseLocal() {
    const codigoDigitado = consultaForm.codigoSigef;
    const codigoUuid = limparUuidSigef(codigoDigitado);
    const codigoTexto = normalizarComparacao(codigoDigitado);
    const codigoIncraMascarado = normalizarCodigoIncra(codigoDigitado);
    const codigoIncraDigitos = somenteDigitos(codigoDigitado);

    if (!codigoUuid && !codigoTexto) {
      alert("Informe o código SIGEF, SNCR, matrícula ou nome da área.");
      return;
    }

    if (!sigefLocalGeojson?.features?.length) {
      alert("Importe primeiro uma base SIGEF em GeoJSON.");
      return;
    }

    const encontrados = [];

    for (const feature of sigefLocalGeojson.features) {
      const props = feature.properties || {};
      const resumo = resumirFeatureSigef(feature);

      const parcela = limparUuidSigef(resumo.parcela_co);
      const codigoImo = limparUuidSigef(resumo.codigo_imo);
      const codigoImoDigitos = somenteDigitos(resumo.codigo_imo);
      const registroM = limparUuidSigef(resumo.registro_m);
      const nomeArea = normalizarComparacao(resumo.nome_area);

      let bateu = false;

      if (parcela && parcela === codigoUuid) bateu = true;
      if (!bateu && codigoImo && codigoImo === codigoUuid) bateu = true;
      if (!bateu && codigoImoDigitos && codigoIncraDigitos && codigoImoDigitos === codigoIncraDigitos) bateu = true;
      if (!bateu && codigoImo && codigoIncraMascarado && normalizarComparacao(codigoImo) === normalizarComparacao(codigoIncraMascarado)) bateu = true;
      if (!bateu && registroM && registroM === codigoUuid) bateu = true;
      if (!bateu && codigoTexto && nomeArea && nomeArea.includes(codigoTexto)) bateu = true;

      if (!bateu) {
        for (const valor of Object.values(props)) {
          const vUuid = limparUuidSigef(valor);
          const vTexto = normalizarComparacao(valor);
          const vDigitos = somenteDigitos(valor);
          if (vUuid && vUuid === codigoUuid) { bateu = true; break; }
          if (codigoIncraDigitos && vDigitos && vDigitos === codigoIncraDigitos) { bateu = true; break; }
          if (codigoTexto && vTexto && vTexto.includes(codigoTexto)) { bateu = true; break; }
        }
      }

      if (bateu && feature.geometry) encontrados.push(feature);
      if (encontrados.length >= 50) break;
    }

    if (encontrados.length === 0) {
      const amostra = resumirFeatureSigef(sigefLocalGeojson.features[0]);
      setResultadoConsulta(
        `SIGEF LOCAL: nenhuma feição encontrada para "${codigoDigitado}".\n\n` +
        `A base local está carregada com ${sigefLocalGeojson.features.length} feições, mas a busca não encontrou esse valor.\n\n` +
        `Amostra do primeiro registro:\n` +
        `parcela_co: ${amostra.parcela_co || "-"}\n` +
        `codigo_imo: ${amostra.codigo_imo || "-"}\n` +
        `nome_area: ${amostra.nome_area || "-"}\n` +
        `registro_m: ${amostra.registro_m || "-"}`
      );
      return;
    }

    const resultado = { type: "FeatureCollection", features: encontrados };
    aplicarResultadoConsulta(resultado, "SIGEF LOCAL", codigoDigitado);

    const primeiro = resumirFeatureSigef(encontrados[0]);
    setResultadoConsulta((anterior) =>
      `SIGEF LOCAL: feição encontrada na base importada.\n` +
      `Arquivo: ${sigefLocalNome}\n` +
      `Feições encontradas: ${encontrados.length}\n\n` +
      `Registro encontrado:\n` +
      `parcela_co: ${primeiro.parcela_co || "-"}\n` +
      `codigo_imo: ${primeiro.codigo_imo || "-"}\n` +
      `nome_area: ${primeiro.nome_area || "-"}\n` +
      `registro_m: ${primeiro.registro_m || "-"}\n` +
      `municipio: ${primeiro.municipio || "-"}\n` +
      `status: ${primeiro.status || "-"}\n\n` +
      `${anterior}`
    );
  }

  async function consultarSigefPorCodigo() {
    const codigo = consultaForm.codigoSigef.trim();
    if (!codigo) {
      alert("Informe o código da parcela SIGEF, código do imóvel, matrícula ou parte do nome da área.");
      return;
    }

    setCarregandoOnline(true);
    setResultadoConsulta("Consultando SIGEF/INCRA via proxy local...");

    try {
      const valor = codigo.replace(/'/g, "''").trim();
      const filtros = [
        `parcela_co LIKE '%${valor}%'`,
        `codigo_imo LIKE '%${valor}%'`,
        `nome_area LIKE '%${valor}%'`,
        `registro_m LIKE '%${valor}%'`,
      ];

      if (/^\d+$/.test(valor)) filtros.unshift(`objectid=${valor}`);

      const params = new URLSearchParams({
        f: "geojson",
        where: filtros.join(" OR "),
        outFields: "*",
        returnGeometry: "true",
        resultRecordCount: "25",
        outSR: "4326",
      });

      const resposta = await fetch(`${SERVICOS_OFICIAIS.sigefFeatureServer}?${params.toString()}`);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      const geojson = await resposta.json();

      if (!geojson.features || geojson.features.length === 0) {
        setResultadoConsulta(`SIGEF/INCRA: nenhuma feição encontrada para "${codigo}".\n\nA parcela existe em portal agregador como FAZENDA SÃO JOSÉ I e aparece vinculada ao código SNCR 9500178396043, mas pode não estar publicada na camada pública PAMGIA/IBAMA usada no MVP.\n\nTente pesquisar também por: 9500178396043 ou por SAO JOSE.\n\nUse "Testar SIGEF" para ver campos/valores reais retornados pela base pública atual.`);
        return;
      }

      aplicarResultadoConsulta(geojson, "SIGEF/INCRA", codigo);
    } catch (error) {
      console.error(error);
      setResultadoConsulta(`Erro ao consultar SIGEF/INCRA: ${error.message}`);
    } finally {
      setCarregandoOnline(false);
    }
  }

  async function consultarCarPorCodigo() {
    const codigo = consultaForm.codigoCar.trim();
    if (!codigo) {
      alert("Informe o código CAR. Exemplo: MT-5103700-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
      return;
    }

    const uf = codigo.slice(0, 2).toLowerCase();
    if (!/^[a-z]{2}$/.test(uf)) {
      alert("Código CAR inválido. Ele deve começar com a UF, exemplo MT-...");
      return;
    }

    setCarregandoOnline(true);
    setResultadoConsulta("Consultando CAR/SICAR via proxy local...");

    try {
      const typeNames = [
        `sicar:sicar_imoveis_${uf}`,
        `sicar:imoveis_${uf}`,
        `sicar:area_imovel_${uf}`,
        `sicar:car_imoveis_${uf}`,
      ];

      const filtros = [
        `cod_imovel='${codigo.replace(/'/g, "''")}'`,
        `COD_IMOVEL='${codigo.replace(/'/g, "''")}'`,
        `codigo='${codigo.replace(/'/g, "''")}'`,
        `CODIGO='${codigo.replace(/'/g, "''")}'`,
      ];

      let encontrado = null;
      let ultimoErro = "";

      for (const typeName of typeNames) {
        for (const filtro of filtros) {
          try {
            const params = new URLSearchParams({
              service: "WFS",
              version: "1.1.0",
              request: "GetFeature",
              typeName,
              outputFormat: "application/json",
              CQL_FILTER: filtro,
              srsName: "EPSG:4326",
            });

            const resposta = await fetch(`${SERVICOS_OFICIAIS.carWfs}?${params.toString()}`);
            if (!resposta.ok) {
              ultimoErro = `${typeName}: HTTP ${resposta.status}`;
              continue;
            }

            const geojson = await resposta.json();
            if (geojson.features && geojson.features.length > 0) {
              encontrado = geojson;
              break;
            }
          } catch (e) {
            ultimoErro = `${typeName}: ${e.message}`;
          }
        }
        if (encontrado) break;
      }

      if (!encontrado) {
        setResultadoConsulta(`CAR/SICAR: nenhuma feição encontrada para "${codigo}". Última tentativa: ${ultimoErro || "sem resposta útil"}.`);
        return;
      }

      aplicarResultadoConsulta(encontrado, "CAR/SICAR", codigo);
    } catch (error) {
      console.error(error);
      setResultadoConsulta(`Erro ao consultar CAR/SICAR: ${error.message}`);
    } finally {
      setCarregandoOnline(false);
    }
  }

  function calcularIntersecaoEntreFeatures(baseFeature, candidatoFeature) {
    try {
      let inter = null;
      try {
        inter = turf.intersect(turf.featureCollection([baseFeature, candidatoFeature]));
      } catch {
        inter = turf.intersect(baseFeature, candidatoFeature);
      }
      if (!inter) return { areaHa: 0, geometry: null };
      return { areaHa: turf.area(inter) / 10000, geometry: inter };
    } catch (error) {
      return { areaHa: 0, geometry: null };
    }
  }

  function limparCamadasSobreposicao() {
    const map = mapRef.current;
    if (!map) return;

    if (sobreposicaoLayerRef.current) {
      map.removeLayer(sobreposicaoLayerRef.current);
      sobreposicaoLayerRef.current = null;
    }

    if (legendaControlRef.current) {
      map.removeControl(legendaControlRef.current);
      legendaControlRef.current = null;
    }
  }


  function nomeCarParaRelatorio(item) {
    if (!item || item.origem !== "CAR") return item?.nome || "-";
    const nome = item.nome && item.nome !== item.codigo ? item.nome : "Nome do imóvel não informado na base CAR";
    return `${item.codigo || "-"} / ${nome}`;
  }

  function identificacaoRelatorio(item) {
    if (!item) return "-";
    if (item.origem === "INTERMAT") {
      return `Titular: ${nomeIntermatParaRelatorio(item)} | Fazenda: ${fazendaIntermatParaRelatorio(item)}`;
    }
    if (item.origem === "CAR") {
      return nomeCarParaRelatorio(item);
    }
    return item.nome && item.nome !== "-" ? `${item.codigo || "-"} / ${item.nome}` : (item.codigo || "-");
  }

  function desenharSobreposicoesNoMapa(resumo) {
    const map = mapRef.current;
    if (!map || !resumo?.feicoesSobrepostas?.features?.length) return;

    limparCamadasSobreposicao();

    const grupo = L.layerGroup().addTo(map);

    L.geoJSON(resumo.feicoesSobrepostas, {
      style: (feature) => {
        const cor = feature?.properties?.cor || "#E11D48";
        return {
          color: cor,
          weight: 2,
          opacity: 0.95,
          fillColor: cor,
          fillOpacity: 0.08,
        };
      },
      onEachFeature: (feature, camada) => {
        const p = feature.properties || {};
        camada.bindPopup(`
          <strong>${p.origem || "Sobreposição"}</strong><br/>
          <strong>Código:</strong> ${p.codigo || "-"}<br/>
          <strong>Nome:</strong> ${p.nome || "-"}<br/>
          <strong>Área sobreposta:</strong> ${p.area_sobreposta_ha || "-"} ha<br/>
          <strong>Percentual:</strong> ${p.percentual_base || "-"}%
        `);
      },
    }).addTo(grupo);

    if (resumo.intersecoes?.features?.length) {
      L.geoJSON(resumo.intersecoes, {
        style: (feature) => {
          const cor = feature?.properties?.cor || "#111827";
          return {
            color: cor,
            weight: 4,
            opacity: 1,
            fillColor: cor,
            fillOpacity: 0.10,
          };
        },
      }).addTo(grupo);
    }

    sobreposicaoLayerRef.current = grupo;

    const legenda = L.control({ position: "bottomleft" });
    legenda.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-overlap-legend");
      const itens = resumo.resultados.slice(0, 12).map((r, idx) => `
        <div class="legend-item">
          <span class="legend-color" style="background:${r.cor}"></span>
          <span>${idx + 1}. ${r.origem} — ${String(identificacaoRelatorio(r)).slice(0, 44)}</span>
        </div>
      `).join("");
      div.innerHTML = `<strong>Sobreposições</strong>${itens}`;
      return div;
    };
    legenda.addTo(map);
    legendaControlRef.current = legenda;

    try {
      const bounds = L.geoJSON(resumo.feicoesSobrepostas).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    } catch {}
  }


  function resolverDadosIntermat(featureOuProps) {
    const props = featureOuProps?.properties || featureOuProps || {};
    const codigo = normalizarChaveIntermat(
      props.__codigo || props.PROP_CODIGO || props.PROP_CODIG || props.CODIGO || props.codigo || props.ID || props.id
    );

    if (codigo && intermatIndex[codigo]) {
      return intermatIndex[codigo];
    }

    const direto = resumirFeatureIntermat({ properties: props });
    const titulo = String(direto.tituloPrimitivo || "").trim();

    if (titulo && !/^INTERMAT\s+\d+$/i.test(titulo) && titulo !== "TÍTULO NÃO IDENTIFICADO") {
      return direto;
    }

    for (const feature of intermatLocalGeojson?.features || []) {
      const p = feature.properties || {};
      const c = normalizarChaveIntermat(p.__codigo || p.PROP_CODIGO || p.PROP_CODIG || p.codigo || p.CODIGO);
      if (codigo && c === codigo) return resumirFeatureIntermat(feature);
    }

    return direto;
  }

  function nomeIntermatParaRelatorio(item) {
    if (!item || item.origem !== "INTERMAT") return item?.nome || "-";
    const codigo = normalizarChaveIntermat(item.codigo || item.__codigo || item.PROP_CODIG);

    // 1) Procura diretamente na base INTERMAT importada atual. Isso evita usar camada antiga em memória.
    for (const feature of intermatLocalGeojson?.features || []) {
      const p = feature.properties || {};
      const c = normalizarChaveIntermat(p.__codigo || p.PROP_CODIGO || p.PROP_CODIG || p.CODIGO || p.codigo);
      if (codigo && c === codigo) {
        return p.__tituloPrimitivo || p.PROP_REQUE || p.prop_reque || p.PROP_REQUERC || p.prop_requerc || p.__nomeFazenda || p.PROP_DENOM || p.prop_denom || `INTERMAT ${codigo}`;
      }
    }

    // 2) Usa índice se existir.
    if (codigo && intermatIndex[codigo]) {
      return intermatIndex[codigo].tituloPrimitivo || intermatIndex[codigo].nomeFazenda || `INTERMAT ${codigo}`;
    }

    // 3) Fallback nos próprios dados do item.
    const dados = resolverDadosIntermat({
      __codigo: codigo || item.codigo,
      __tituloPrimitivo: item.tituloPrimitivo,
      __nomeFazenda: item.nomeFazenda,
      __nome: item.nome,
      PROP_CODIG: codigo || item.codigo,
    });

    return dados.tituloPrimitivo || item.tituloPrimitivo || item.nome || `INTERMAT ${codigo || ""}`.trim();
  }

  function fazendaIntermatParaRelatorio(item) {
    if (!item || item.origem !== "INTERMAT") return item?.nomeFazenda || "-";
    const codigo = normalizarChaveIntermat(item.codigo || item.__codigo || item.PROP_CODIG);

    for (const feature of intermatLocalGeojson?.features || []) {
      const p = feature.properties || {};
      const c = normalizarChaveIntermat(p.__codigo || p.PROP_CODIGO || p.PROP_CODIG || p.CODIGO || p.codigo);
      if (codigo && c === codigo) {
        return p.__nomeFazenda || p.PROP_DENOM || p.prop_denom || p.PROP_DENOMI || p.prop_denomi || p.DENOMINACAO || p.denominacao || "Fazenda/denominação não informada na base INTERMAT";
      }
    }

    if (codigo && intermatIndex[codigo]) {
      return intermatIndex[codigo].nomeFazenda || "Fazenda/denominação não informada na base INTERMAT";
    }

    const dados = resolverDadosIntermat({
      __codigo: codigo || item.codigo,
      __nomeFazenda: item.nomeFazenda,
      __tituloPrimitivo: item.tituloPrimitivo,
      PROP_CODIG: codigo || item.codigo,
    });

    return dados.nomeFazenda || item.nomeFazenda || "Fazenda/denominação não informada na base INTERMAT";
  }

  function executarAnaliseSobreposicao() {
    const base = geojsonAtual;
    const perimetroFeature = obterFeaturePerimetro(base);

    if (!base?.features?.length || !perimetroFeature) {
      alert("Carregue, consulte ou desenhe primeiro um perímetro base.");
      return;
    }

    const candidatos = [];

    // Preferência 1: usar as camadas automáticas já cruzadas/desenhadas.
    if (basesAnaliseAtivas.car) {
      for (const feature of autoCarGeojson?.features || []) {
        candidatos.push({ origem: "CAR", feature });
      }
    }

    if (basesAnaliseAtivas.sigef) {
      for (const feature of autoSigefGeojson?.features || []) {
        candidatos.push({ origem: "SIGEF LOCAL", feature });
      }
    }

    if (intermatLocalGeojson?.features?.length) {
      const bboxIntermat = turf.bboxPolygon(bboxComFolga(base, 0.10));
      for (const feature of intermatLocalGeojson.features) {
        try {
          if (feature?.geometry && turf.booleanIntersects(bboxIntermat, feature)) {
            candidatos.push({ origem: "INTERMAT", feature: normalizarAtributosIntermatFeature(feature) });
          }
        } catch {}
      }
    } else {
      for (const feature of autoIntermatGeojson?.features || []) {
        candidatos.push({ origem: "INTERMAT", feature: normalizarAtributosIntermatFeature(feature) });
      }
    }

    // Preferência 2: se ainda não houver análise automática, usa as bases brutas carregadas.
    if (basesAnaliseAtivas.sigef && candidatos.length === 0 && sigefLocalGeojson?.features?.length) {
      for (const feature of sigefLocalGeojson.features) {
        candidatos.push({ origem: "SIGEF LOCAL", feature });
      }
    }

    if (consultaGeojson?.features?.length && consultaGeojson !== geojsonAtual) {
      for (const feature of consultaGeojson.features) {
        candidatos.push({ origem: "FEIÇÃO CONSULTADA", feature });
      }
    }

    if (candidatos.length === 0) {
      alert("Não há base ativa para cruzar com o perímetro atual. Ligue CAR, SIGEF ou INTERMAT, ou importe uma base antes de executar.");
      return;
    }

    setAnalisandoSobreposicao(true);

    setTimeout(() => {
      try {
        const areaBaseHa = turf.area(perimetroFeature) / 10000;
        const bboxBase = turf.bbox(perimetroFeature);
        const resultados = [];
        const geometriasIntersecao = [];
        const feicoesSobrepostas = [];
        const usados = new Set();

        for (const item of candidatos) {
          const f = item.feature;
          if (!f?.geometry) continue;

          let bboxCandidato;
          try {
            bboxCandidato = turf.bbox(f);
          } catch {
            continue;
          }

          if (!bboxSobrepoe(bboxBase, bboxCandidato)) continue;

          const calculoRobusto = calcularIntersecaoRobusta(perimetroFeature, f);
          const interGeom = calculoRobusto.inter;
          let areaSobreposta = calculoRobusto.areaHa || Number(f.properties?.__areaSobrepostaHa || 0);

          if (areaSobreposta <= 0.0001) continue;

          const p = f.properties || {};
          const chave = `${item.origem}-${p.__codigo || p.parcela_co || p.PARCELA_CO || p.cod_imovel || p.COD_IMOVEL || p.PROP_CODIG || JSON.stringify(turf.bbox(f))}`;
          if (usados.has(chave)) continue;
          usados.add(chave);

          let atributos;
          if (item.origem === "INTERMAT") {
            const r = resolverDadosIntermat({ ...f.properties, ...p });
            atributos = {
              codigo: p.__codigo || r.codigo || p.PROP_LOCAL || "-",
              sncr: "-",
              nome: r.tituloPrimitivo || p.__tituloPrimitivo || p.__nome || "TÍTULO NÃO IDENTIFICADO",
              nomeFazenda: r.nomeFazenda || p.__nomeFazenda || "-",
              matricula: p.__matricula || r.matricula || "-",
              municipio: p.__municipio || r.municipio || "-",
              status: p.__status || r.origem || "-",
              requerente: p.__requerente || r.requerente || "-",
              registro: p.__registro || r.registro || "-",
              livro: p.__livro || r.livro || "-",
              folha: p.__folha || r.folha || "-",
              areaTituloHa: p.__areaTituloHa || numeroPtBr(r.areaTitulo),
            };
          } else {
            const r = extrairAtributosParcela(f, item.origem);
            atributos = {
              codigo: p.__codigo || r.codigo || "-",
              sncr: p.__sncr || r.sncr || "-",
              nome: r.nome || p.__nome || "-",
              matricula: p.__matricula || r.matricula || "-",
              municipio: p.__municipio || r.municipio || "-",
              status: p.__status || r.status || "-",
              requerente: p.__requerente || "-",
              registro: p.__registro || "-",
              livro: p.__livro || "-",
              folha: p.__folha || "-",
              areaTituloHa: p.__areaTituloHa || 0,
            };
          }

          const areaParcelaHa = turf.area(featureCollectionDeUma(f)) / 10000;
          const indiceResultado = resultados.length;
          const cor = p.__cor || corSobreposicao(indiceResultado);
          const percentualBase = areaBaseHa > 0 ? (areaSobreposta / areaBaseHa) * 100 : 0;
          const percentualParcela = areaParcelaHa > 0 ? (areaSobreposta / areaParcelaHa) * 100 : 0;
          const percentualTitulo = atributos.areaTituloHa > 0 ? (areaSobreposta / atributos.areaTituloHa) * 100 : 0;

          const resultadoItem = {
            id: `${item.origem}-${indiceResultado + 1}`,
            origem: item.origem,
            codigo: atributos.codigo,
            sncr: atributos.sncr,
            nome: atributos.nome,
            tituloPrimitivo: item.origem === "INTERMAT" ? atributos.nome : "-",
            nomeFazenda: item.origem === "INTERMAT" ? (atributos.nomeFazenda || "Fazenda/denominação não informada na base INTERMAT") : (item.origem === "CAR" ? atributos.nome : "-"),
            matricula: atributos.matricula,
            municipio: atributos.municipio,
            status: atributos.status,
            requerente: atributos.requerente,
            registro: atributos.registro,
            livro: atributos.livro,
            folha: atributos.folha,
            cor,
            areaParcelaHa: Number(areaParcelaHa.toFixed(4)),
            areaTituloHa: Number((atributos.areaTituloHa || 0).toFixed(4)),
            areaSobrepostaHa: Number(areaSobreposta.toFixed(4)),
            percentualSobreBase: Number(percentualBase.toFixed(4)),
            percentualSobreParcela: Number(percentualParcela.toFixed(4)),
            percentualSobreTitulo: Number(percentualTitulo.toFixed(4)),
            metodoIntersecao: calculoRobusto.metodo,
          };

          resultados.push(resultadoItem);

          feicoesSobrepostas.push({
            type: "Feature",
            geometry: f.geometry,
            properties: {
              ...resultadoItem,
              area_sobreposta_ha: resultadoItem.areaSobrepostaHa,
              percentual_base: resultadoItem.percentualSobreBase,
            },
          });

          if (interGeom?.geometry) {
            geometriasIntersecao.push({
              ...interGeom,
              properties: {
                origem: item.origem,
                codigo: atributos.codigo,
                nome: atributos.nome,
                tituloPrimitivo: atributos.tituloPrimitivo || atributos.nome,
                nomeFazenda: atributos.nomeFazenda || "-",
                sncr: atributos.sncr,
                matricula: atributos.matricula,
                municipio: atributos.municipio,
                status: atributos.status,
                requerente: atributos.requerente,
                registro: atributos.registro,
                livro: atributos.livro,
                folha: atributos.folha,
                __origem: item.origem,
                __codigo: atributos.codigo,
                __nome: atributos.nome,
                __tituloPrimitivo: atributos.tituloPrimitivo || atributos.nome,
                __nomeFazenda: atributos.nomeFazenda || "-",
                __sncr: atributos.sncr,
                __matricula: atributos.matricula,
                __municipio: atributos.municipio,
                __status: atributos.status,
                __requerente: atributos.requerente,
                __registro: atributos.registro,
                __livro: atributos.livro,
                __folha: atributos.folha,
                __areaSobrepostaHa: Number(areaSobreposta.toFixed(4)),
                __percentualBase: Number(percentualBase.toFixed(4)),
                __percentualTitulo: Number(percentualTitulo.toFixed(4)),
                __cor: cor,
                cor,
                area_ha: Number(areaSobreposta.toFixed(4)),
              },
            });
          }
        }

        resultados.sort((a, b) => b.areaSobrepostaHa - a.areaSobrepostaHa);

        const totalSobreposto = resultados.reduce((soma, r) => soma + r.areaSobrepostaHa, 0);
        const resumo = {
          data: hojeBR(),
          areaBaseHa: Number(areaBaseHa.toFixed(4)),
          totalSobrepostoHa: Number(totalSobreposto.toFixed(4)),
          percentualTotal: areaBaseHa > 0 ? Number(((totalSobreposto / areaBaseHa) * 100).toFixed(4)) : 0,
          quantidade: resultados.length,
          resultados,
          feicoesSobrepostas: { type: "FeatureCollection", features: feicoesSobrepostas },
          intersecoes: { type: "FeatureCollection", features: geometriasIntersecao },
        };

        setAnaliseSobreposicao(resumo);
        desenharSobreposicoesNoMapa(resumo);
        setTimeout(() => destacarPerimetroAnalise(), 150);

        const detalhado = montarResultadoAutomaticoParaRelatorio?.();
        if (detalhado) {
          setResultadoSobreposicaoDetalhado(detalhado);
        }

        if (resultados.length === 0) {
          setResultadoConsulta("Análise concluída: nenhuma sobreposição foi identificada com as bases carregadas.");
        } else {
          setResultadoConsulta(`Análise concluída: ${resultados.length} sobreposição(ões) identificada(s). Área total sobreposta: ${numeroBR(totalSobreposto)} ha. Motor robusto aplicado ao perímetro normalizado.`);
        }
      } finally {
        setAnalisandoSobreposicao(false);
      }
    }, 80);
  }

  function exportarIntersecoesGeoJSON() {
    if (!analiseSobreposicao?.intersecoes?.features?.length) {
      alert("Execute uma análise com sobreposição antes de exportar as interseções.");
      return;
    }
    salvarArquivo("intersecoes-sobreposicao-longitude.geojson", JSON.stringify(analiseSobreposicao.intersecoes, null, 2), "application/geo+json;charset=utf-8");
  }

  async function logoComoBytes() {
    try {
      const resposta = await fetch(logoLongitude);
      return await resposta.arrayBuffer();
    } catch {
      return null;
    }
  }
  function hexToRgba(hex, alpha = 0.2) {
    const normal = String(hex || "#2563eb").replace("#", "");
    const bigint = parseInt(normal.length === 3 ? normal.split("").map((c) => c + c).join("") : normal, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function nomeCurtoLegendaRelatorio(r) {
    if (!r) return "-";
    if (r.origem === "INTERMAT") return nomeIntermatParaRelatorio(r);
    if (r.origem === "CAR") return r.nomeFazenda || r.nome || r.codigo || "CAR";
    if (r.origem === "SIGEF LOCAL") return r.nome || r.nomeFazenda || r.codigo || "SIGEF";
    return r.nome || r.codigo || "-";
  }function desenharLegendaRelatorioNoCanvas(ctx, boxX = 24, boxY = 24, maxItens = 8) {
    const itens = (analiseSobreposicao?.resultados || []).slice(0, maxItens);
    if (!itens.length) return;

    const boxW = 640;
    const lineH = 23;
    const boxH = 48 + itens.length * lineH;

    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.strokeStyle = "rgba(15, 76, 92, 0.85)";
    ctx.lineWidth = 2;

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
    }

    ctx.fillStyle = "#0f4c5c";
    ctx.font = "bold 21px Arial";
    ctx.fillText("Legenda técnica", boxX + 16, boxY + 30);

    ctx.font = "15px Arial";
    itens.forEach((r, idx) => {
      const yy = boxY + 60 + idx * lineH;
      ctx.fillStyle = r.cor || corSobreposicao(idx);
      ctx.fillRect(boxX + 16, yy - 13, 16, 16);
      ctx.strokeStyle = "#333333";
      ctx.strokeRect(boxX + 16, yy - 13, 16, 16);

      const area = Number(r.areaSobrepostaHa || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
      const texto = `${idx + 1}. ${r.origem || ""} — ${String(nomeCurtoLegendaRelatorio(r)).slice(0, 44)} (${area} ha)`;
      ctx.fillStyle = "#111827";
      ctx.fillText(texto, boxX + 42, yy);
    });
  }

  function desenharMapaTecnicoFallback(ctx, larguraFinal, alturaFinal) {
    const resultados = analiseSobreposicao?.resultados || [];
    const maxArea = Math.max(...resultados.map((r) => Number(r.areaSobrepostaHa || 0)), 1);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, larguraFinal, alturaFinal);

    ctx.fillStyle = "#0f4c5c";
    ctx.font = "bold 36px Arial";
    ctx.fillText("Mapa técnico de sobreposição", 44, 62);

    ctx.fillStyle = "#334155";
    ctx.font = "20px Arial";
    ctx.fillText("Representação visual das feições interceptadas pelo perímetro analisado.", 44, 96);

    const mapaX = 80;
    const mapaY = 145;
    const mapaW = larguraFinal - 160;
    const mapaH = alturaFinal - 285;

    ctx.fillStyle = "#eef6ef";
    ctx.fillRect(mapaX, mapaY, mapaW, mapaH);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 4;
    ctx.strokeRect(mapaX, mapaY, mapaW, mapaH);

    // Perímetro base
    ctx.fillStyle = "rgba(34, 197, 94, 0.10)";
    ctx.strokeStyle = "#14532d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(mapaX + mapaW * 0.18, mapaY + mapaH * 0.24);
    ctx.lineTo(mapaX + mapaW * 0.78, mapaY + mapaH * 0.16);
    ctx.lineTo(mapaX + mapaW * 0.86, mapaY + mapaH * 0.68);
    ctx.lineTo(mapaX + mapaW * 0.33, mapaY + mapaH * 0.82);
    ctx.lineTo(mapaX + mapaW * 0.18, mapaY + mapaH * 0.24);
    ctx.fill();
    ctx.stroke();

    resultados.slice(0, 12).forEach((r, idx) => {
      const area = Number(r.areaSobrepostaHa || 0);
      const escala = Math.max(0.22, Math.min(1, area / maxArea));
      const w = mapaW * (0.18 + escala * 0.24);
      const h = mapaH * (0.12 + escala * 0.20);
      const x = mapaX + mapaW * (0.10 + (idx % 4) * 0.20);
      const y = mapaY + mapaH * (0.14 + Math.floor(idx / 4) * 0.22);

      ctx.fillStyle = hexToRgba(r.cor || corSobreposicao(idx), 0.18);
      ctx.strokeStyle = r.cor || corSobreposicao(idx);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#111827";
      ctx.font = "bold 18px Arial";
      ctx.fillText(String(idx + 1), x + 8, y + 24);
    });

    desenharLegendaRelatorioNoCanvas(ctx, 95, alturaFinal - 185, 8);
  }function gerarMapaFallbackRelatorio() {
    const larguraFinal = 2000;
    const alturaFinal = 1125;
    const canvas = document.createElement("canvas");
    canvas.width = larguraFinal;
    canvas.height = alturaFinal;
    const ctx = canvas.getContext("2d");

    desenharMapaTecnicoFallback(ctx, larguraFinal, alturaFinal);

    ctx.strokeStyle = "#0f4c5c";
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, larguraFinal - 16, alturaFinal - 16);

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillRect(0, alturaFinal - 46, larguraFinal, 46);
    ctx.fillStyle = "#1f2937";
    ctx.font = "18px Arial";
    ctx.fillText(`Longitude Geo Intelligence • Data: ${hojeBR()} • Mapa técnico explicativo de sobreposição`, 30, alturaFinal - 17);

    const dataUrl = canvas.toDataURL("image/png", 1.0);
    setMapaRelatorioDataUrl(dataUrl);
    return dataUrl;
  }async function capturarMapaComoImagem() {
    const mapElement = document.getElementById("map") || document.querySelector(".leaflet-container");

    if (!mapElement) {
      return gerarMapaFallbackRelatorio();
    }

    const elementosOcultados = [];
    const estilosAlterados = [];

    try {
      if (mapRef.current) {
        mapRef.current.invalidateSize(true);

        const prioridade = [overlapLayerRef.current, geoLayerRef.current].filter(Boolean);
        const secundarios = [autoCarLayerRef.current, autoSigefLayerRef.current, autoIntermatLayerRef.current].filter(Boolean);
        const grupos = prioridade.length ? prioridade : secundarios;

        const bounds = grupos.map((g) => {
          try { return g.getBounds?.(); } catch { return null; }
        }).filter((b) => b && b.isValid && b.isValid());

        if (bounds.length) {
          let total = bounds[0];
          bounds.slice(1).forEach((b) => total.extend(b));
          mapRef.current.fitBounds(total, { padding: [4, 4], animate: false });
        }
      }

      const ocultarSeletores = [
        ".leaflet-control-zoom",
        ".leaflet-draw",
        ".leaflet-control-attribution",
        ".leaflet-control-layers",
        ".map-legend",
        ".leaflet-control",
        ".leaflet-overlap-legend"
      ];

      ocultarSeletores.forEach((selector) => {
        mapElement.querySelectorAll(selector).forEach((el) => {
          elementosOcultados.push({ el, display: el.style.display });
          el.style.display = "none";
        });
      });

      mapElement.querySelectorAll(".leaflet-overlay-pane path").forEach((el) => {
        estilosAlterados.push({
          el,
          fillOpacity: el.getAttribute("fill-opacity"),
          strokeOpacity: el.getAttribute("stroke-opacity"),
          strokeWidth: el.getAttribute("stroke-width"),
        });
        el.setAttribute("fill-opacity", "0.13");
        el.setAttribute("stroke-opacity", "0.98");
        el.setAttribute("stroke-width", "3");
      });

      await new Promise((resolve) => setTimeout(resolve, 1600));

      const largura = Math.max(mapElement.clientWidth || 1100, 1100);
      const altura = Math.max(mapElement.clientHeight || 700, 700);

      const capturaOriginal = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 3,
        logging: false,
        width: largura,
        height: altura,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      // Ponto principal da V46:
      // remove a faixa branca que estava indo para o Word.
      const canvas = recortarAreaUtilCanvas(capturaOriginal);

      const larguraFinal = 2000;
      const alturaFinal = 1125;
      const saida = document.createElement("canvas");
      saida.width = larguraFinal;
      saida.height = alturaFinal;
      const ctx = saida.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, larguraFinal, alturaFinal);

      // COVER: preenche toda a página. Como já recortamos o branco, não sobra área vazia.
      const escala = Math.max(larguraFinal / canvas.width, alturaFinal / canvas.height);
      const w = canvas.width * escala;
      const h = canvas.height * escala;
      const x = (larguraFinal - w) / 2;
      const y = (alturaFinal - h) / 2;

      ctx.drawImage(canvas, x, y, w, h);

      ctx.strokeStyle = "#0f4c5c";
      ctx.lineWidth = 5;
      ctx.strokeRect(8, 8, larguraFinal - 16, alturaFinal - 16);

      desenharLegendaRelatorioNoCanvas(ctx, 28, 28, 8);

      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fillRect(0, alturaFinal - 46, larguraFinal, 46);
      ctx.fillStyle = "#1f2937";
      ctx.font = "18px Arial";
      ctx.fillText(`Longitude Geo Intelligence • Data: ${hojeBR()} • Mapa técnico ampliado de sobreposição`, 30, alturaFinal - 17);

      const dataUrl = saida.toDataURL("image/png", 1.0);
      setMapaRelatorioDataUrl(dataUrl);
      return dataUrl;
    } catch (error) {
      console.error("Erro ao capturar mapa para relatório; usando fallback", error);
      return gerarMapaFallbackRelatorio();
    } finally {
      elementosOcultados.forEach(({ el, display }) => {
        el.style.display = display;
      });

      estilosAlterados.forEach(({ el, fillOpacity, strokeOpacity, strokeWidth }) => {
        if (fillOpacity === null) el.removeAttribute("fill-opacity"); else el.setAttribute("fill-opacity", fillOpacity);
        if (strokeOpacity === null) el.removeAttribute("stroke-opacity"); else el.setAttribute("stroke-opacity", strokeOpacity);
        if (strokeWidth === null) el.removeAttribute("stroke-width"); else el.setAttribute("stroke-width", strokeWidth);
      });
    }
  }


  function destacarPerimetroAnalise() {
    const map = mapRef.current;
    const perimetro = obterFeaturePerimetro(geojsonAtual);
    if (!map || !perimetro) return null;

    try {
      if (highlightPerimeterLayerRef.current) {
        map.removeLayer(highlightPerimeterLayerRef.current);
        highlightPerimeterLayerRef.current = null;
      }
    } catch {}

    const layer = L.geoJSON(perimetro, {
      pane: "markerPane",
      style: {
        color: "#ffea00",
        weight: 8,
        opacity: 1,
        fillColor: "#ffea00",
        fillOpacity: 0.03,
        dashArray: "10 6",
      },
      interactive: false,
    }).addTo(map);

    highlightPerimeterLayerRef.current = layer;
    return layer;
  }

  function desenharNorteEscalaCanvas(ctx, largura, altura) {
    const x = largura - 110;
    const y = 95;

    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x - 36, y - 58, 72, 112, 10);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x - 36, y - 58, 72, 112);
      ctx.strokeRect(x - 36, y - 58, 72, 112);
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 22px Arial";
    ctx.fillText("N", x - 8, y - 32);

    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x - 16, y + 22);
    ctx.lineTo(x, y + 10);
    ctx.lineTo(x + 16, y + 22);
    ctx.closePath();
    ctx.fill();

    const scaleY = altura - 96;
    const scaleX = 72;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + 210, scaleY);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY - 13);
    ctx.lineTo(scaleX, scaleY + 13);
    ctx.moveTo(scaleX + 210, scaleY - 13);
    ctx.lineTo(scaleX + 210, scaleY + 13);
    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "17px Arial";
    ctx.fillText("Escala visual aproximada", scaleX, scaleY + 36);
  }

  function desenharCabecalhoImagemSatelite(ctx, largura) {
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillRect(0, 0, largura, 66);

    ctx.fillStyle = "#0f4c5c";
    ctx.font = "bold 26px Arial";
    ctx.fillText("Longitude Geo Intelligence — Imagem de Satélite da Análise Territorial", 30, 38);

    ctx.fillStyle = "#334155";
    ctx.font = "17px Arial";
    ctx.fillText(`Data de geração: ${hojeBR()} • Perímetro analisado destacado em amarelo`, 30, 59);
  }
  function baixarDataUrl(dataUrl, nomeArquivo) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function desenharElementosTecnicosImagem(ctx, largura, altura, titulo = "Imagem de satélite da análise") {
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillRect(0, 0, largura, 70);

    ctx.fillStyle = "#0f4c5c";
    ctx.font = "bold 28px Arial";
    ctx.fillText(`Longitude Geo Intelligence — ${titulo}`, 30, 38);

    ctx.fillStyle = "#334155";
    ctx.font = "18px Arial";
    ctx.fillText(`Data: ${hojeBR()} • Perímetro analisado destacado em amarelo`, 30, 61);

    // Norte
    const x = largura - 100;
    const y = 115;
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x - 34, y - 55, 68, 105, 10);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x - 34, y - 55, 68, 105);
      ctx.strokeRect(x - 34, y - 55, 68, 105);
    }
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 22px Arial";
    ctx.fillText("N", x - 8, y - 30);
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x - 15, y + 22);
    ctx.lineTo(x, y + 10);
    ctx.lineTo(x + 15, y + 22);
    ctx.closePath();
    ctx.fill();

    // Rodapé
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(0, altura - 48, largura, 48);
    ctx.fillStyle = "#1f2937";
    ctx.font = "18px Arial";
    ctx.fillText("Fonte: camada visível no mapa web • Uso técnico preliminar • Conferir em ambiente SIG para peças oficiais", 30, altura - 18);
  }async function exportarImagemSateliteRecortada(formato = "png") {
    const map = mapRef.current;
    const mapElement = document.getElementById("map") || document.querySelector(".leaflet-container");

    if (!map || !mapElement) {
      alert("Mapa não encontrado para exportação.");
      return;
    }

    const perimetro = obterFeaturePerimetro(geojsonAtual);
    if (!perimetro) {
      alert("Carregue um perímetro antes de exportar a imagem.");
      return;
    }

    const elementosOcultados = [];
    const estilosAlterados = [];

    try {
      destacarPerimetroAnalise();
      map.invalidateSize(true);

      const bounds = L.geoJSON(perimetro).getBounds();
      if (bounds && bounds.isValid()) {
        // Enquadra pelo perímetro, com margem técnica para evitar corte.
        map.fitBounds(bounds, { padding: [90, 90], animate: false });
        const centro = bounds.getCenter();
        setTimeout(() => {
          try { map.panTo(centro, { animate: false }); } catch {}
        }, 80);
      }

      const ocultarSeletores = [
        ".leaflet-control-zoom",
        ".leaflet-draw",
        ".leaflet-control-attribution",
        ".leaflet-control-layers",
        ".map-legend",
        ".leaflet-control",
        ".leaflet-overlap-legend"
      ];

      ocultarSeletores.forEach((selector) => {
        mapElement.querySelectorAll(selector).forEach((el) => {
          elementosOcultados.push({ el, display: el.style.display });
          el.style.display = "none";
        });
      });

      mapElement.querySelectorAll(".leaflet-overlay-pane path").forEach((el) => {
        estilosAlterados.push({
          el,
          fillOpacity: el.getAttribute("fill-opacity"),
          strokeOpacity: el.getAttribute("stroke-opacity"),
          strokeWidth: el.getAttribute("stroke-width"),
        });

        el.setAttribute("fill-opacity", "0.08");
        el.setAttribute("stroke-opacity", "0.98");
        el.setAttribute("stroke-width", "3");
      });

      await new Promise((resolve) => setTimeout(resolve, 1700));

      const captura = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 3,
        logging: false,
        width: mapElement.clientWidth,
        height: mapElement.clientHeight,
      });

      const canvasUtil = typeof recortarAreaUtilCanvas === "function" ? recortarAreaUtilCanvas(captura) : captura;

      // V49: saída dinâmica, preservando a proporção do mapa útil.
      // Isso elimina deslocamento e corte causados por composição tipo "cover".
      const outW = 2000;
      const margemTopo = 72;
      const margemRodape = 52;
      const mapaW = outW;
      const mapaH = Math.round(outW * (canvasUtil.height / canvasUtil.width));
      const outH = margemTopo + mapaH + margemRodape;

      const saida = document.createElement("canvas");
      saida.width = outW;
      saida.height = outH;
      const ctx = saida.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);

      // Preserva proporção sem cortar. O mapa ocupa a largura total.
      ctx.drawImage(canvasUtil, 0, margemTopo, mapaW, mapaH);

      // Moldura técnica discreta. Não usar amarelo para não confundir com o perímetro real.
      ctx.strokeStyle = "#0f4c5c";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, margemTopo + 10, outW - 20, mapaH - 20);

      if (typeof desenharLegendaRelatorioNoCanvas === "function") {
        desenharLegendaExportacaoImagem(ctx, 30, margemTopo + 18, 10);
      }

      desenharElementosTecnicosImagem(ctx, outW, outH, "Imagem de satélite da análise territorial");

      const mime = formato === "jpg" || formato === "jpeg" ? "image/jpeg" : "image/png";
      const extensao = mime === "image/jpeg" ? "jpg" : "png";
      const dataUrl = saida.toDataURL(mime, mime === "image/jpeg" ? 0.95 : 1.0);

      baixarDataUrl(dataUrl, `imagem_satelite_sobreposicao_${new Date().toISOString().slice(0,10)}.${extensao}`);
    } catch (error) {
      console.error("Erro ao exportar imagem", error);
      alert(`Erro ao exportar imagem: ${error.message}`);
    } finally {
      elementosOcultados.forEach(({ el, display }) => {
        el.style.display = display;
      });

      estilosAlterados.forEach(({ el, fillOpacity, strokeOpacity, strokeWidth }) => {
        if (fillOpacity === null) el.removeAttribute("fill-opacity"); else el.setAttribute("fill-opacity", fillOpacity);
        if (strokeOpacity === null) el.removeAttribute("stroke-opacity"); else el.setAttribute("stroke-opacity", strokeOpacity);
        if (strokeWidth === null) el.removeAttribute("stroke-width"); else el.setAttribute("stroke-width", strokeWidth);
      });
    }
  }  function perguntarOpcoesImagemSatelite() {
    const modoResposta = window.prompt(
      "Exportar imagem com quais informações?\n\n1 = Com todas as feições da análise\n2 = Somente com o perímetro analisado\n\nDigite 1 ou 2:",
      "1"
    );

    if (modoResposta === null) return null;

    const somentePerimetro = String(modoResposta).trim() === "2";

    const fonteResposta = window.prompt(
      "Escolha a fonte da imagem de satélite:\n\n1 = Esri World Imagery (atual/padrão)\n2 = Google Satélite (experimental)\n3 = Bing Satélite (experimental)\n\nDigite 1, 2 ou 3:",
      "1"
    );

    if (fonteResposta === null) return null;

    const fonteTexto = String(fonteResposta).trim();
    const fonte = fonteTexto === "2" ? "google" : fonteTexto === "3" ? "bing" : "esri";

    return { somentePerimetro, fonte };
  }  function criarCamadaSatelitePorFonte(fonte) {
    if (fonte === "google") {
      return L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        attribution: "Imagem: Google Satellite",
        maxZoom: 21,
        crossOrigin: true,
      });
    }

    if (fonte === "bing") {
      const BingLayer = L.TileLayer.extend({
        getTileUrl: function(coords) {
          const q = quadKeyBing(coords.x, coords.y, coords.z);
          const sub = ["0", "1", "2", "3"][Math.abs(coords.x + coords.y) % 4];
          return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/a${q}.jpeg?g=129&mkt=pt-BR&n=z`;
        },
        options: {
          attribution: "Imagem: Bing Maps",
          maxZoom: 21,
          crossOrigin: true,
        }
      });
      return new BingLayer();
    }

    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Imagem: Esri World Imagery",
      maxZoom: 20,
      crossOrigin: true,
    });
  }  function nomeFonteSatelite(fonte) {
    if (fonte === "google") return "Google Satellite";
    if (fonte === "bing") return "Bing Maps Satellite";
    return "Esri World Imagery";
  }async function exportarImagemSateliteRecortada(formato = "png") {
    const opcoes = perguntarOpcoesImagemSatelite();
    if (!opcoes) return;

    const { somentePerimetro, fonte } = opcoes;

    const map = mapRef.current;
    const mapElement = document.getElementById("map") || document.querySelector(".leaflet-container");

    if (!map || !mapElement) {
      alert("Mapa não encontrado para exportação.");
      return;
    }

    const perimetro = obterFeaturePerimetro(geojsonAtual);
    if (!perimetro) {
      alert("Carregue um perímetro antes de exportar a imagem.");
      return;
    }

    const elementosOcultados = [];
    const estilosAlterados = [];
    const layersRemovidos = [];
    let camadaExportacao = null;

    try {
      destacarPerimetroAnalise();
      map.invalidateSize(true);

      layersRemovidos.push(...removerTileLayersBase(map));

      camadaExportacao = criarCamadaSatelitePorFonte(fonte);
      camadaExportacao.addTo(map);
      try { camadaExportacao.bringToBack(); } catch {}

      if (somentePerimetro) {
        [overlapLayerRef.current, autoCarLayerRef.current, autoSigefLayerRef.current, autoIntermatLayerRef.current]
          .filter(Boolean)
          .forEach((layer) => {
            try {
              if (map.hasLayer(layer)) {
                map.removeLayer(layer);
                layersRemovidos.push(layer);
              }
            } catch {}
          });
      }

      enquadrarPerimetroParaExportacao(perimetro);

      const ocultarSeletores = [
        ".leaflet-control-zoom",
        ".leaflet-draw",
        ".leaflet-control-attribution",
        ".leaflet-control-layers",
        ".map-legend",
        ".leaflet-control",
        ".leaflet-overlap-legend"
      ];

      ocultarSeletores.forEach((selector) => {
        mapElement.querySelectorAll(selector).forEach((el) => {
          elementosOcultados.push({ el, display: el.style.display });
          el.style.display = "none";
        });
      });

      mapElement.querySelectorAll(".leaflet-overlay-pane path").forEach((el) => {
        estilosAlterados.push({
          el,
          fillOpacity: el.getAttribute("fill-opacity"),
          strokeOpacity: el.getAttribute("stroke-opacity"),
          strokeWidth: el.getAttribute("stroke-width"),
        });

        el.setAttribute("fill-opacity", somentePerimetro ? "0.025" : "0.07");
        el.setAttribute("stroke-opacity", "0.98");
        el.setAttribute("stroke-width", "3");
      });

      await new Promise((resolve) => setTimeout(resolve, 2800));

      const captura = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 3,
        logging: false,
        width: mapElement.clientWidth,
        height: mapElement.clientHeight,
      });

      const canvasUtil = typeof recortarAreaUtilCanvas === "function" ? recortarAreaUtilCanvas(captura) : captura;

      // V54: composição profissional, sem deformar e sem empurrar o imóvel para o topo.
      const outW = 2000;
      const outH = 1350;
      const headerH = 74;
      const footerH = 54;
      const mapX = 18;
      const mapY = headerH;
      const mapW = outW - 36;
      const mapH = outH - headerH - footerH;

      const saida = document.createElement("canvas");
      saida.width = outW;
      saida.height = outH;
      const ctx = saida.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);

      // CONTAIN com fundo técnico: não corta o perímetro e mantém centralização.
      const escala = Math.min(mapW / canvasUtil.width, mapH / canvasUtil.height);
      const w = canvasUtil.width * escala;
      const h = canvasUtil.height * escala;
      const x = mapX + (mapW - w) / 2;
      const y = mapY + (mapH - h) / 2;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.drawImage(canvasUtil, x, y, w, h);

      ctx.strokeStyle = "#0f4c5c";
      ctx.lineWidth = 4;
      ctx.strokeRect(mapX, mapY, mapW, mapH);

      if (!somentePerimetro && typeof desenharLegendaRelatorioNoCanvas === "function") {
        desenharLegendaExportacaoImagem(ctx, mapX + 18, mapY + 18, 10);
      }

      desenharElementosTecnicosImagem(
        ctx,
        outW,
        outH,
        somentePerimetro
          ? `Imagem de satélite do perímetro analisado — ${nomeFonteSatelite(fonte)}`
          : `Imagem de satélite com feições da análise — ${nomeFonteSatelite(fonte)}`
      );

      const mime = formato === "jpg" || formato === "jpeg" ? "image/jpeg" : "image/png";
      const extensao = mime === "image/jpeg" ? "jpg" : "png";
      const dataUrl = saida.toDataURL(mime, mime === "image/jpeg" ? 0.95 : 1.0);

      const sufixo = somentePerimetro ? "somente_perimetro" : "com_feicoes";
      baixarDataUrl(dataUrl, `imagem_satelite_${sufixo}_${fonte}_${new Date().toISOString().slice(0,10)}.${extensao}`);
    } catch (error) {
      console.error("Erro ao exportar imagem", error);
      alert(`Erro ao exportar imagem: ${error.message}`);
    } finally {
      elementosOcultados.forEach(({ el, display }) => {
        el.style.display = display;
      });

      estilosAlterados.forEach(({ el, fillOpacity, strokeOpacity, strokeWidth }) => {
        if (fillOpacity === null) el.removeAttribute("fill-opacity"); else el.setAttribute("fill-opacity", fillOpacity);
        if (strokeOpacity === null) el.removeAttribute("stroke-opacity"); else el.setAttribute("stroke-opacity", strokeOpacity);
        if (strokeWidth === null) el.removeAttribute("stroke-width"); else el.setAttribute("stroke-width", strokeWidth);
      });

      try {
        if (camadaExportacao && map.hasLayer(camadaExportacao)) {
          map.removeLayer(camadaExportacao);
        }
      } catch {}

      layersRemovidos.forEach((layer) => {
        try {
          if (!map.hasLayer(layer)) layer.addTo(map);
        } catch {}
      });

      try { destacarPerimetroAnalise(); } catch {}
    }
  }


  function quadKeyBing(x, y, z) {
    let quad = "";
    for (let i = z; i > 0; i--) {
      let digit = 0;
      const mask = 1 << (i - 1);
      if ((x & mask) !== 0) digit += 1;
      if ((y & mask) !== 0) digit += 2;
      quad += digit.toString();
    }
    return quad;
  }

  function criarCamadaSatelitePorFonte(fonte) {
    if (fonte === "google") {
      return L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        attribution: "Imagem: Google Satellite",
        maxZoom: 21,
        crossOrigin: true,
      });
    }

    if (fonte === "bing") {
      const BingLayer = L.TileLayer.extend({
        getTileUrl: function(coords) {
          const q = quadKeyBing(coords.x, coords.y, coords.z);
          const sub = ["0", "1", "2", "3"][Math.abs(coords.x + coords.y) % 4];
          return `https://ecn.t${sub}.tiles.virtualearth.net/tiles/a${q}.jpeg?g=129&mkt=pt-BR&n=z`;
        },
        options: {
          attribution: "Imagem: Bing Maps",
          maxZoom: 21,
          crossOrigin: true,
        }
      });
      return new BingLayer();
    }

    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Imagem: Esri World Imagery",
      maxZoom: 20,
      crossOrigin: true,
    });
  }

  function perguntarOpcoesImagemSatelite() {
    const modoResposta = window.prompt(
      "Exportar imagem com quais informações?\n\n1 = Com todas as feições da análise\n2 = Somente com o perímetro analisado\n\nDigite 1 ou 2:",
      "1"
    );

    if (modoResposta === null) return null;

    const somentePerimetro = String(modoResposta).trim() === "2";

    const fonteResposta = window.prompt(
      "Escolha a fonte da imagem de satélite:\n\n1 = Esri World Imagery (atual/padrão)\n2 = Google Satélite (experimental)\n3 = Bing Satélite (experimental)\n\nDigite 1, 2 ou 3:",
      "1"
    );

    if (fonteResposta === null) return null;

    const fonteTexto = String(fonteResposta).trim();
    const fonte = fonteTexto === "2" ? "google" : fonteTexto === "3" ? "bing" : "esri";

    return { somentePerimetro, fonte };
  }

  function nomeFonteSatelite(fonte) {
    if (fonte === "google") return "Google Satellite";
    if (fonte === "bing") return "Bing Maps Satellite";
    return "Esri World Imagery";
  }

  function removerTileLayersBase(map) {
    const removidas = [];
    try {
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          try {
            map.removeLayer(layer);
            removidas.push(layer);
          } catch {}
        }
      });
    } catch {}
    return removidas;
  }

  function calcularBboxPixelPerimetro(perimetro, canvas, mapElement) {
    const map = mapRef.current;
    if (!map || !perimetro || !canvas || !mapElement) return null;

    try {
      const coords = turf.coordAll(perimetro);
      if (!coords?.length) return null;

      const scaleX = canvas.width / mapElement.clientWidth;
      const scaleY = canvas.height / mapElement.clientHeight;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      coords.forEach(([lng, lat]) => {
        const p = map.latLngToContainerPoint([lat, lng]);
        const x = p.x * scaleX;
        const y = p.y * scaleY;

        if (Number.isFinite(x) && Number.isFinite(y)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      });

      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
      }

      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    } catch (error) {
      console.warn("Não foi possível calcular bbox pixel do perímetro", error);
      return null;
    }
  }

  function recortarCanvasCentralizadoNoPerimetro(canvas, bbox, aspectoDestino, fatorMargem = 2.35) {
    if (!canvas || !bbox || bbox.width <= 0 || bbox.height <= 0) return canvas;

    try {
      const centroX = (bbox.minX + bbox.maxX) / 2;
      const centroY = (bbox.minY + bbox.maxY) / 2;

      let cropW = bbox.width * fatorMargem;
      let cropH = bbox.height * fatorMargem;

      if (cropW / cropH < aspectoDestino) {
        cropW = cropH * aspectoDestino;
      } else {
        cropH = cropW / aspectoDestino;
      }

      cropW = Math.max(cropW, canvas.width * 0.38);
      cropH = Math.max(cropH, canvas.height * 0.38);

      cropW = Math.min(cropW, canvas.width);
      cropH = Math.min(cropH, canvas.height);

      let x = centroX - cropW / 2;
      let y = centroY - cropH / 2;

      x = Math.max(0, Math.min(x, canvas.width - cropW));
      y = Math.max(0, Math.min(y, canvas.height - cropH));

      const out = document.createElement("canvas");
      out.width = Math.round(cropW);
      out.height = Math.round(cropH);
      const ctx = out.getContext("2d");
      ctx.drawImage(canvas, x, y, cropW, cropH, 0, 0, out.width, out.height);

      return out;
    } catch (error) {
      console.warn("Falha ao recortar canvas centralizado no perímetro", error);
      return canvas;
    }
  }
  function detectarBboxPerimetroAmareloNoCanvas(canvas) {
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let count = 0;

      // Detecta a linha amarela grossa do perímetro.
      // Esta é a forma mais confiável porque usa a imagem final capturada,
      // não depende mais de fitBounds/pan/latLngToContainerPoint.
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          const amareloPerimetro = a > 120 && r > 210 && g > 185 && b < 80;

          if (amareloPerimetro) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            count++;
          }
        }
      }

      if (count < 40 || maxX <= minX || maxY <= minY) {
        return null;
      }

      return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
        count,
      };
    } catch (error) {
      console.warn("Falha ao detectar perímetro amarelo", error);
      return null;
    }
  }

  function recortarCanvasPeloPerimetroAmarelo(canvas, aspectoDestino, somentePerimetro) {
    const bbox = detectarBboxPerimetroAmareloNoCanvas(canvas);
    if (!bbox) return canvas;

    try {
      const centroX = (bbox.minX + bbox.maxX) / 2;
      const centroY = (bbox.minY + bbox.maxY) / 2;

      // Margem cartográfica ao redor do perímetro.
      let fator = somentePerimetro ? 2.35 : 2.85;

      let cropW = bbox.width * fator;
      let cropH = bbox.height * fator;

      if (cropW / cropH < aspectoDestino) {
        cropW = cropH * aspectoDestino;
      } else {
        cropH = cropW / aspectoDestino;
      }

      // Evita recorte excessivamente fechado.
      cropW = Math.max(cropW, canvas.width * 0.42);
      cropH = Math.max(cropH, canvas.height * 0.42);

      cropW = Math.min(cropW, canvas.width);
      cropH = Math.min(cropH, canvas.height);

      let x = centroX - cropW / 2;
      let y = centroY - cropH / 2;

      x = Math.max(0, Math.min(x, canvas.width - cropW));
      y = Math.max(0, Math.min(y, canvas.height - cropH));

      const out = document.createElement("canvas");
      out.width = Math.round(cropW);
      out.height = Math.round(cropH);
      const outCtx = out.getContext("2d");
      outCtx.drawImage(canvas, x, y, cropW, cropH, 0, 0, out.width, out.height);

      return out;
    } catch (error) {
      console.warn("Falha ao recortar canvas pelo perímetro amarelo", error);
      return canvas;
    }
  }


  function desenharLegendaExportacaoImagem(ctx, x = 30, y = 90, maxItens = 10) {
    const itens = (analiseSobreposicao?.resultados || []).slice(0, maxItens);
    if (!itens.length) return;

    const boxW = 700;
    const lineH = 25;
    const boxH = 52 + itens.length * lineH;

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "#0f4c5c";
    ctx.lineWidth = 2;

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, 12);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, boxW, boxH);
      ctx.strokeRect(x, y, boxW, boxH);
    }

    ctx.fillStyle = "#0f4c5c";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Legenda das feições da análise", x + 16, y + 32);

    ctx.font = "16px Arial";
    itens.forEach((r, idx) => {
      const yy = y + 64 + idx * lineH;
      ctx.fillStyle = r.cor || corSobreposicao(idx);
      ctx.fillRect(x + 16, yy - 14, 17, 17);
      ctx.strokeStyle = "#1f2937";
      ctx.strokeRect(x + 16, yy - 14, 17, 17);

      const nome = r.origem === "INTERMAT"
        ? nomeIntermatParaRelatorio(r)
        : (r.nomeFazenda || r.nome || r.codigo || "-");
      const area = Number(r.areaSobrepostaHa || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

      ctx.fillStyle = "#111827";
      ctx.fillText(`${idx + 1}. ${r.origem || ""} — ${String(nome).slice(0, 48)} (${area} ha)`, x + 43, yy);
    });
  }function enquadrarPerimetroComFolgaSuperior(perimetro, modo = "relatorio") {
    const map = mapRef.current;
    if (!map || !perimetro) return;

    try {
      const bounds = L.geoJSON(perimetro).getBounds();
      if (!bounds || !bounds.isValid()) return;

      // Margem superior maior = imóvel desce visualmente na prancha.
      // Isso evita o perímetro colado no topo em PNG/JPG e relatório.
      const top = modo === "imagem" ? 310 : 260;
      const bottom = modo === "imagem" ? 90 : 120;
      const lateral = modo === "imagem" ? 180 : 160;

      map.fitBounds(bounds, {
        paddingTopLeft: [lateral, top],
        paddingBottomRight: [lateral, bottom],
        animate: false,
      });
    } catch (error) {
      console.warn("Falha no enquadramento com folga superior", error);
    }
  }async function exportarImagemSateliteRecortada(formato = "png") {
    const opcoes = perguntarOpcoesImagemSatelite();
    if (!opcoes) return;

    const { somentePerimetro, fonte } = opcoes;

    const map = mapRef.current;
    const mapElement = document.getElementById("map") || document.querySelector(".leaflet-container");

    if (!map || !mapElement) {
      alert("Mapa não encontrado para exportação.");
      return;
    }

    const perimetro = obterFeaturePerimetro(geojsonAtual);
    if (!perimetro) {
      alert("Carregue um perímetro antes de exportar a imagem.");
      return;
    }

    const elementosOcultados = [];
    const estilosAlterados = [];
    const layersRemovidos = [];
    let camadaExportacao = null;

    try {
      destacarPerimetroAnalise();
      map.invalidateSize(true);

      layersRemovidos.push(...removerTileLayersBase(map));

      camadaExportacao = criarCamadaSatelitePorFonte(fonte);
      camadaExportacao.addTo(map);
      try { camadaExportacao.bringToBack(); } catch {}

      if (somentePerimetro) {
        [overlapLayerRef.current, autoCarLayerRef.current, autoSigefLayerRef.current, autoIntermatLayerRef.current]
          .filter(Boolean)
          .forEach((layer) => {
            try {
              if (map.hasLayer(layer)) {
                map.removeLayer(layer);
                layersRemovidos.push(layer);
              }
            } catch {}
          });
      }

      enquadrarPerimetroComFolgaSuperior(perimetro, "imagem");

      const ocultarSeletores = [
        ".leaflet-control-zoom",
        ".leaflet-draw",
        ".leaflet-control-attribution",
        ".leaflet-control-layers",
        ".map-legend",
        ".leaflet-control",
        ".leaflet-overlap-legend"
      ];

      ocultarSeletores.forEach((selector) => {
        mapElement.querySelectorAll(selector).forEach((el) => {
          elementosOcultados.push({ el, display: el.style.display });
          el.style.display = "none";
        });
      });

      mapElement.querySelectorAll(".leaflet-overlay-pane path").forEach((el) => {
        estilosAlterados.push({
          el,
          fillOpacity: el.getAttribute("fill-opacity"),
          strokeOpacity: el.getAttribute("stroke-opacity"),
          strokeWidth: el.getAttribute("stroke-width"),
        });

        el.setAttribute("fill-opacity", somentePerimetro ? "0.025" : "0.07");
        el.setAttribute("stroke-opacity", "0.98");
        el.setAttribute("stroke-width", "3");
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const captura = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 3,
        logging: false,
        width: mapElement.clientWidth,
        height: mapElement.clientHeight,
      });

      const outW = 2000;
      const outH = 1350;
      const headerH = 74;
      const footerH = 54;
      const legendH = somentePerimetro ? 0 : 170;
      const gap = somentePerimetro ? 0 : 12;

      const mapX = 18;
      const mapY = headerH;
      const mapW = outW - 36;
      const mapH = outH - headerH - footerH - legendH - gap;

      const saida = document.createElement("canvas");
      saida.width = outW;
      saida.height = outH;
      const ctx = saida.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outW, outH);

      // COVER: preenche o quadro todo sem faixas brancas laterais.
      // Como o mapa foi enquadrado com folga superior antes da captura, o imóvel não fica colado no topo.
      const escala = Math.max(mapW / captura.width, mapH / captura.height);
      const w = captura.width * escala;
      const h = captura.height * escala;
      const x = mapX + (mapW - w) / 2;
      const y = mapY + (mapH - h) / 2;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.drawImage(captura, x, y, w, h);

      ctx.strokeStyle = "#0f4c5c";
      ctx.lineWidth = 4;
      ctx.strokeRect(mapX, mapY, mapW, mapH);

      if (!somentePerimetro) {
        desenharLegendaRelatorioForaDoMapa(ctx, mapX, mapY + mapH + gap, mapW, legendH, 10);
      }

      desenharElementosTecnicosImagem(
        ctx,
        outW,
        outH,
        somentePerimetro
          ? `Imagem de satélite do perímetro analisado — ${nomeFonteSatelite(fonte)}`
          : `Imagem de satélite com feições da análise — ${nomeFonteSatelite(fonte)}`
      );

      const mime = formato === "jpg" || formato === "jpeg" ? "image/jpeg" : "image/png";
      const extensao = mime === "image/jpeg" ? "jpg" : "png";
      const dataUrl = saida.toDataURL(mime, mime === "image/jpeg" ? 0.95 : 1.0);

      const sufixo = somentePerimetro ? "somente_perimetro" : "com_feicoes";
      baixarDataUrl(dataUrl, `imagem_satelite_${sufixo}_${fonte}_${new Date().toISOString().slice(0,10)}.${extensao}`);
    } catch (error) {
      console.error("Erro ao exportar imagem", error);
      alert(`Erro ao exportar imagem: ${error.message}`);
    } finally {
      elementosOcultados.forEach(({ el, display }) => {
        el.style.display = display;
      });

      estilosAlterados.forEach(({ el, fillOpacity, strokeOpacity, strokeWidth }) => {
        if (fillOpacity === null) el.removeAttribute("fill-opacity"); else el.setAttribute("fill-opacity", fillOpacity);
        if (strokeOpacity === null) el.removeAttribute("stroke-opacity"); else el.setAttribute("stroke-opacity", strokeOpacity);
        if (strokeWidth === null) el.removeAttribute("stroke-width"); else el.setAttribute("stroke-width", strokeWidth);
      });

      try {
        if (camadaExportacao && map.hasLayer(camadaExportacao)) {
          map.removeLayer(camadaExportacao);
        }
      } catch {}

      layersRemovidos.forEach((layer) => {
        try {
          if (!map.hasLayer(layer)) layer.addTo(map);
        } catch {}
      });

      try { destacarPerimetroAnalise(); } catch {}
    }
  }

function detectarBboxPerimetroAmareloRelatorio(canvas) {
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let count = 0;

      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Perímetro analisado: amarelo forte.
          const amarelo = a > 120 && r > 205 && g > 175 && b < 95;

          if (amarelo) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            count++;
          }
        }
      }

      if (count < 40 || maxX <= minX || maxY <= minY) return null;

      return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
        count,
      };
    } catch (error) {
      console.warn("Não foi possível detectar perímetro amarelo do relatório", error);
      return null;
    }
  }

  function recortarCanvasSeguroParaRelatorioWord(canvas, aspectoDestino) {
    const bbox = detectarBboxPerimetroAmareloRelatorio(canvas);
    if (!canvas || !bbox) return canvas;

    try {
      const centroX = (bbox.minX + bbox.maxX) / 2;
      const centroY = (bbox.minY + bbox.maxY) / 2;

      // Regra do relatório:
      // não pode cortar perímetro. Por isso a margem é ampla e controlada.
      const margemX = Math.max(bbox.width * 0.90, canvas.width * 0.12);
      const margemY = Math.max(bbox.height * 1.15, canvas.height * 0.16);

      let cropW = bbox.width + margemX * 2;
      let cropH = bbox.height + margemY * 2;

      if (cropW / cropH < aspectoDestino) {
        cropW = cropH * aspectoDestino;
      } else {
        cropH = cropW / aspectoDestino;
      }

      // Não permitir recorte pequeno demais no Word.
      cropW = Math.max(cropW, canvas.width * 0.72);
      cropH = Math.max(cropH, canvas.height * 0.72);

      cropW = Math.min(cropW, canvas.width);
      cropH = Math.min(cropH, canvas.height);

      let x = centroX - cropW / 2;
      let y = centroY - cropH / 2;

      // Se o perímetro está perto da borda, desloca o recorte para garantir folga.
      const folga = Math.max(24, Math.min(canvas.width, canvas.height) * 0.025);

      if (bbox.minX - x < folga) x = bbox.minX - folga;
      if (bbox.maxX > x + cropW - folga) x = bbox.maxX - cropW + folga;
      if (bbox.minY - y < folga) y = bbox.minY - folga;
      if (bbox.maxY > y + cropH - folga) y = bbox.maxY - cropH + folga;

      x = Math.max(0, Math.min(x, canvas.width - cropW));
      y = Math.max(0, Math.min(y, canvas.height - cropH));

      const out = document.createElement("canvas");
      out.width = Math.round(cropW);
      out.height = Math.round(cropH);
      const outCtx = out.getContext("2d");
      outCtx.drawImage(canvas, x, y, cropW, cropH, 0, 0, out.width, out.height);

      return out;
    } catch (error) {
      console.warn("Falha ao recortar mapa seguro para relatório", error);
      return canvas;
    }
  }function desenharLegendaRelatorioForaDoMapa(ctx, x, y, w, h, maxItens = 10) {
    const itens = (analiseSobreposicao?.resultados || []).slice(0, maxItens);
    if (!itens.length) return;

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeStyle = "#0f4c5c";
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#0f4c5c";
    ctx.font = "bold 21px Arial";
    ctx.fillText("Legenda das feições sobrepostas", x + 16, y + 30);

    const colW = (w - 34) / 2;
    const lineH = 23;

    ctx.font = "15px Arial";
    itens.forEach((r, idx) => {
      const col = idx < Math.ceil(itens.length / 2) ? 0 : 1;
      const row = col === 0 ? idx : idx - Math.ceil(itens.length / 2);
      const xx = x + 16 + col * colW;
      const yy = y + 58 + row * lineH;

      ctx.fillStyle = r.cor || corSobreposicao(idx);
      ctx.fillRect(xx, yy - 14, 16, 16);
      ctx.strokeStyle = "#1f2937";
      ctx.strokeRect(xx, yy - 14, 16, 16);

      const nome = r.origem === "INTERMAT"
        ? nomeIntermatParaRelatorio(r)
        : (r.nomeFazenda || r.nome || r.codigo || "-");
      const area = Number(r.areaSobrepostaHa || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

      ctx.fillStyle = "#111827";
      ctx.fillText(`${idx + 1}. ${r.origem || ""} — ${String(nome).slice(0, 34)} (${area} ha)`, xx + 24, yy);
    });
  }async function capturarMapaComoImagem() {
    const mapElement = document.getElementById("map") || document.querySelector(".leaflet-container");

    if (!mapElement) {
      return typeof gerarMapaFallbackRelatorio === "function" ? gerarMapaFallbackRelatorio() : null;
    }

    const elementosOcultados = [];
    const estilosAlterados = [];

    try {
      const map = mapRef.current;
      const perimetro = obterFeaturePerimetro(geojsonAtual);

      if (map) {
        map.invalidateSize(true);
        if (perimetro) enquadrarPerimetroComFolgaSuperior(perimetro, "relatorio");
        try { destacarPerimetroAnalise(); } catch {}
      }

      const ocultarSeletores = [
        ".leaflet-control-zoom",
        ".leaflet-draw",
        ".leaflet-control-attribution",
        ".leaflet-control-layers",
        ".map-legend",
        ".leaflet-control",
        ".leaflet-overlap-legend"
      ];

      ocultarSeletores.forEach((selector) => {
        mapElement.querySelectorAll(selector).forEach((el) => {
          elementosOcultados.push({ el, display: el.style.display });
          el.style.display = "none";
        });
      });

      mapElement.querySelectorAll(".leaflet-overlay-pane path").forEach((el) => {
        estilosAlterados.push({
          el,
          fillOpacity: el.getAttribute("fill-opacity"),
          strokeOpacity: el.getAttribute("stroke-opacity"),
          strokeWidth: el.getAttribute("stroke-width"),
        });

        el.setAttribute("fill-opacity", "0.08");
        el.setAttribute("stroke-opacity", "0.98");
        el.setAttribute("stroke-width", "3");
      });

      await new Promise((resolve) => setTimeout(resolve, 2200));

      const captura = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 3,
        logging: false,
        width: mapElement.clientWidth,
        height: mapElement.clientHeight,
      });

      // Página técnica do relatório: mapa grande + legenda em faixa externa.
      const larguraFinal = 2000;
      const alturaFinal = 1125;
      const headerH = 70;
      const footerH = 42;
      const legendH = 170;
      const gap = 12;

      const mapX = 18;
      const mapY = headerH;
      const mapW = larguraFinal - 36;
      const mapH = alturaFinal - headerH - footerH - legendH - gap;

      const saida = document.createElement("canvas");
      saida.width = larguraFinal;
      saida.height = alturaFinal;
      const ctx = saida.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, larguraFinal, alturaFinal);

      // Não recorta agressivamente no relatório. Usa a captura inteira, centralizada no quadro.
      const escala = Math.min(mapW / captura.width, mapH / captura.height);
      const w = captura.width * escala;
      const h = captura.height * escala;
      const x = mapX + (mapW - w) / 2;
      const y = mapY + (mapH - h) / 2;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.drawImage(captura, x, y, w, h);

      ctx.strokeStyle = "#0f4c5c";
      ctx.lineWidth = 4;
      ctx.strokeRect(mapX, mapY, mapW, mapH);

      // Legenda fora do mapa: não cobre perímetro nem feições.
      desenharLegendaRelatorioForaDoMapa(ctx, mapX, mapY + mapH + gap, mapW, legendH, 10);

      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillRect(0, 0, larguraFinal, headerH);
      ctx.fillStyle = "#0f4c5c";
      ctx.font = "bold 28px Arial";
      ctx.fillText("Longitude Geo Intelligence — Mapa técnico da análise de sobreposição", 30, 38);
      ctx.fillStyle = "#334155";
      ctx.font = "18px Arial";
      ctx.fillText(`Data: ${hojeBR()} • Perímetro analisado destacado em amarelo`, 30, 62);

      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillRect(0, alturaFinal - footerH, larguraFinal, footerH);
      ctx.fillStyle = "#1f2937";
      ctx.font = "17px Arial";
      ctx.fillText("Fonte: mapa visível no sistema • Uso técnico preliminar • Conferir em ambiente SIG para peças oficiais", 30, alturaFinal - 15);

      const dataUrl = saida.toDataURL("image/png", 1.0);
      setMapaRelatorioDataUrl(dataUrl);
      return dataUrl;
    } catch (error) {
      console.error("Erro ao capturar mapa para relatório", error);
      if (typeof gerarMapaFallbackRelatorio === "function") return gerarMapaFallbackRelatorio();
      return null;
    } finally {
      elementosOcultados.forEach(({ el, display }) => {
        el.style.display = display;
      });

      estilosAlterados.forEach(({ el, fillOpacity, strokeOpacity, strokeWidth }) => {
        if (fillOpacity === null) el.removeAttribute("fill-opacity"); else el.setAttribute("fill-opacity", fillOpacity);
        if (strokeOpacity === null) el.removeAttribute("stroke-opacity"); else el.setAttribute("stroke-opacity", strokeOpacity);
        if (strokeWidth === null) el.removeAttribute("stroke-width"); else el.setAttribute("stroke-width", strokeWidth);
      });
    }
  }

  async function exportarRelatorioWordSobreposicao() {
    if (!analiseSobreposicao) {
      alert("Execute primeiro a análise de sobreposição.");
      return;
    }

    const logoBytes = await logoComoBytes();
    const mapaRelatorioDataUrl = await capturarMapaComoImagem();
    const mapaRelatorioBytes = mapaRelatorioDataUrl ? dataUrlParaUint8Array(mapaRelatorioDataUrl) : null;

    const azul = "003B5C";
    const verde = "3D8B37";
    const cinzaClaro = "E8EEF3";
    const borda = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };

    const p = (texto, opts = {}) => new Paragraph({
      spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
      alignment: opts.alignment || AlignmentType.LEFT,
      heading: opts.heading,
      children: [
        new TextRun({
          text: texto,
          bold: opts.bold || false,
          size: opts.size || 22,
          color: opts.color || "1F2933",
        }),
      ],
    });

    const tituloSecao = (texto) => new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: texto, bold: true, size: 24, color: azul })],
    });

    const celula = (texto, opts = {}) => new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.header ? { fill: azul } : opts.fill ? { fill: opts.fill } : undefined,
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      borders: { top: borda, bottom: borda, left: borda, right: borda },
      children: [
        new Paragraph({
          alignment: opts.align || AlignmentType.LEFT,
          children: [
            new TextRun({
              text: textoRelatorio(texto),
              bold: opts.bold || opts.header || false,
              color: opts.header ? "FFFFFF" : "1F2933",
              size: opts.size || (opts.header ? 14 : 14),
            }),
          ],
        }),
      ],
    });

    const tabelaResumo = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        ["Data da análise", analiseSobreposicao.data],
        ["Área do perímetro analisado", `${numeroBR(analiseSobreposicao.areaBaseHa)} ha`],
        ["Área total sobreposta", `${numeroBR(analiseSobreposicao.totalSobrepostoHa)} ha`],
        ["Percentual sobre o perímetro", `${numeroBR(analiseSobreposicao.percentualTotal, 2)}%`],
        ["Quantidade de sobreposições", analiseSobreposicao.quantidade],
      ].map(([a, b]) => new TableRow({
        children: [celula(a, { bold: true, fill: cinzaClaro, width: 42, size: 18 }), celula(String(b), { width: 58, size: 18 })],
      })),
    });

    const cabecalho = new Paragraph({
      spacing: { after: 120 },
      children: [
        ...(logoBytes ? [new ImageRun({ data: logoBytes, transformation: { width: 82, height: 105 } })] : []),
      ],
    });

    const linhas = analiseSobreposicao.resultados.map((r, i) => new TableRow({
      children: [
        celula(String(i + 1), { width: 4, align: AlignmentType.CENTER }),
        celula("", { width: 4, fill: corDocx(r.cor), align: AlignmentType.CENTER }),
        celula(r.origem, { width: 9 }),
        celula(r.codigo, { width: 16 }),
        celula(r.sncr, { width: 13 }),
        celula(identificacaoRelatorio(r), { width: 18 }),
        celula(r.matricula, { width: 8 }),
        celula(r.municipio, { width: 9 }),
        celula(r.status, { width: 7 }),
        celula(numeroBR(r.areaParcelaHa), { width: 6, align: AlignmentType.RIGHT }),
        celula(numeroBR(r.areaSobrepostaHa), { width: 6, align: AlignmentType.RIGHT }),
      ],
    }));

    const tabelaLegenda = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            celula("Cor", { header: true, width: 10, align: AlignmentType.CENTER }),
            celula("Origem", { header: true, width: 18 }),
            celula("Código", { header: true, width: 34 }),
            celula("Identificação/Título/Fazenda", { header: true, width: 38 }),
          ],
        }),
        ...analiseSobreposicao.resultados.map((r) => new TableRow({
          children: [
            celula("", { width: 10, fill: corDocx(r.cor), align: AlignmentType.CENTER }),
            celula(r.origem, { width: 18, size: 16 }),
            celula(r.codigo, { width: 34, size: 16 }),
            celula(identificacaoRelatorio(r), { width: 38, size: 16 }),
          ],
        })),
      ],
    });

    const tabelaSobreposicoes = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            celula("#", { header: true, width: 4, align: AlignmentType.CENTER }),
            celula("Cor", { header: true, width: 4, align: AlignmentType.CENTER }),
            celula("Origem", { header: true, width: 9 }),
            celula("Código", { header: true, width: 16 }),
            celula("SNCR/Cód. Imóvel", { header: true, width: 13 }),
            celula("Identificação/Título/Fazenda", { header: true, width: 18 }),
            celula("Matrícula", { header: true, width: 8 }),
            celula("Município", { header: true, width: 9 }),
            celula("Status", { header: true, width: 7 }),
            celula("Área Parcela", { header: true, width: 6 }),
            celula("Sobreposição", { header: true, width: 6 }),
          ],
        }),
        ...(linhas.length ? linhas : [new TableRow({ children: [celula("Nenhuma sobreposição identificada.", { width: 100 })] })]),
      ],
    });

    const doc = new Document({
      creator: "Longitude Geo Intelligence",
      title: "Relatório de Análise de Sobreposição",
      description: "Relatório técnico preliminar gerado pela plataforma Longitude Geo Intelligence.",
      styles: {
        default: {
          document: { run: { font: "Arial", size: 22 } },
        },
      },
      sections: [
        {
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              size: { orientation: PageOrientation.LANDSCAPE },
              margin: { top: 220, right: 220, bottom: 220, left: 220 },
            },
          },
          children: [
            ...(logoBytes ? [cabecalho] : []),
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: "RELATÓRIO DE ANÁLISE DE SOBREPOSIÇÃO", bold: true, size: 30, color: azul })],
            }),
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: azul } },
              spacing: { after: 260 },
              children: [new TextRun({ text: "Longitude Assessoria Rural e Urbano", bold: true, size: 20, color: verde })],
            }),
            tituloSecao("1. Identificação"),
            tabelaResumo,
            tituloSecao("2. Bases analisadas"),
            p("Foram consideradas as feições carregadas/consultadas no sistema Longitude Geo Intelligence, incluindo base SIGEF local importada, CAR/SICAR consultado e demais perímetros disponíveis no momento da análise.", { size: 20 }),
            tituloSecao("3. Síntese técnica"),
            p(`Foram identificadas ${analiseSobreposicao.quantidade} sobreposição(ões), totalizando ${numeroBR(analiseSobreposicao.totalSobrepostoHa)} ha, equivalente a ${numeroBR(analiseSobreposicao.percentualTotal, 2)}% do perímetro analisado.`, { size: 20 }),
            tituloSecao("4. Mapa da análise de sobreposição"),
            ...(mapaRelatorioBytes ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [new ImageRun({ data: mapaRelatorioBytes, transformation: { width: 1008, height: 567 } })],
              }),
              p("Figura 01 – Mapa técnico ampliado da análise de sobreposição. O perímetro analisado é confrontado com as feições CAR, SIGEF e INTERMAT; as cores da legenda identificam cada feição interceptada e a tabela seguinte detalha área e origem.", { size: 17, color: "475569", alignment: AlignmentType.CENTER }),
            ] : [p("Mapa técnico não disponível.", { size: 16, color: "B91C1C" })]),
          ],
        },
        {
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              size: { orientation: PageOrientation.LANDSCAPE },
              margin: { top: 540, right: 360, bottom: 540, left: 360 },
            },
          },
          children: [
            tituloSecao("5. Legenda das feições sobrepostas"),
            p("Cada feição interceptada recebeu uma cor opaca para identificação visual no mapa e no quadro técnico.", { size: 18, after: 100 }),
            tabelaLegenda,
            tituloSecao("6. Quadro de sobreposições identificadas"),
            p("Tabela consolidada das feições interceptadas pelo perímetro analisado.", { size: 18, after: 100 }),
            tabelaSobreposicoes,
          ],
        },
        {
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children: [
            tituloSecao("7. Conclusão técnica preliminar"),
            p("Após o cruzamento espacial realizado, foram identificadas as sobreposições descritas no quadro acima. Este relatório possui caráter técnico preliminar e deve ser validado com conferência da origem, data de atualização das bases, sistema de referência geodésico e documentação dominial/cadastral do imóvel.", { size: 20 }),
            p("Observação: o cálculo foi realizado em ambiente web com base nas geometrias carregadas no sistema. Para uso cartorial, judicial ou bancário, recomenda-se conferência em ambiente SIG profissional e emissão com assinatura técnica.", { size: 16, color: "475569", before: 160 }),
            new Paragraph({ spacing: { before: 620, after: 40 }, children: [new TextRun({ text: "______________________________________________", size: 20 })] }),
            p("Alexandre Magno Gomes de Lima", { bold: true, size: 20, after: 0 }),
            p("Longitude Assessoria Rural e Urbano", { size: 18, after: 0 }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    salvarBlob("Relatorio_Sobreposicao_Longitude.docx", blob);
  }  function exportarConsultaGeoJSON() {
    if (!consultaGeojson?.features?.length) {
      alert("Não existe parcela consultada para exportar.");
      return;
    }

    const nome = nomeArquivoSeguro(obterNomeDaFeicao(consultaGeojson), "parcela-consultada");
    salvarArquivo(`${nome}.geojson`, JSON.stringify(consultaGeojson, null, 2), "application/geo+json;charset=utf-8");
  }

  function exportarConsultaKML() {
    if (!consultaGeojson?.features?.length) {
      alert("Não existe parcela consultada para exportar.");
      return;
    }

    const nome = nomeArquivoSeguro(obterNomeDaFeicao(consultaGeojson), "parcela-consultada");
    const kml = geojsonParaKml(consultaGeojson, nome);
    salvarArquivo(`${nome}.kml`, kml, "application/vnd.google-earth.kml+xml;charset=utf-8");
  }

  function exportarConsultaShapefile() {
    if (!consultaGeojson?.features?.length) {
      alert("Não existe parcela consultada para exportar.");
      return;
    }

    try {
      const nome = nomeArquivoSeguro(obterNomeDaFeicao(consultaGeojson), "parcela-consultada");

      const writer = shpwrite.default || shpwrite;

      writer.download(consultaGeojson, {
        folder: nome,
        filename: nome,
        outputType: "blob",
        compression: "STORE",
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao exportar Shapefile. Tente exportar em GeoJSON ou KML.");
    }
  }  function desenharPreviewSigef() {
    const map = mapRef.current;
    if (!map || !sigefLocalGeojson?.features?.length || !geojsonAtual) {
      alert("Para pré-visualizar SIGEF, importe a base SIGEF local e carregue/desenhe um perímetro primeiro.");
      return;
    }

    if (previewSigefLayerRef.current) {
      map.removeLayer(previewSigefLayerRef.current);
      previewSigefLayerRef.current = null;
      setMostrarPreviewSigef(false);
      return;
    }

    const baseBbox = turf.bbox(geojsonAtual);
    const candidatos = [];

    for (const feature of sigefLocalGeojson.features) {
      if (!feature.geometry) continue;
      try {
        if (!bboxSobrepoe(baseBbox, turf.bbox(feature))) continue;
        if (turf.booleanIntersects(geojsonAtual.features?.[0] || geojsonAtual, feature)) candidatos.push(feature);
      } catch {}
      if (candidatos.length >= 500) break;
    }

    const fc = { type: "FeatureCollection", features: candidatos };

    const layer = L.geoJSON(fc, {
      style: {
        color: "#16a34a",
        weight: 2,
        fillColor: "#16a34a",
        fillOpacity: 0.10,
      },
      onEachFeature: (feature, camada) => {
        const p = feature.properties || {};
        const cod = obterValorPossivel(p, ["parcela_co", "PARCELA_CO", "codigo_imo", "CODIGO_IMO"]);
        const nome = obterValorPossivel(p, ["nome_area", "NOME_AREA", "nome_imove", "NOME_IMOVE"]);
        camada.bindPopup(`<strong>SIGEF local</strong><br/>${nome || ""}<br/>${cod || ""}`);
      },
    }).addTo(map);

    previewSigefLayerRef.current = layer;
    setMostrarPreviewSigef(true);

    if (!candidatos.length) alert("Nenhuma parcela SIGEF intersectando o perímetro atual foi encontrada na pré-visualização.");
  }

  function desenharPreviewCar() {
    const map = mapRef.current;
    if (!map || !consultaGeojson?.features?.length) {
      alert("Para pré-visualizar CAR, carregue primeiro uma feição CAR/SICAR consultada.");
      return;
    }

    if (previewCarLayerRef.current) {
      map.removeLayer(previewCarLayerRef.current);
      previewCarLayerRef.current = null;
      setMostrarPreviewCar(false);
      return;
    }

    const layer = L.geoJSON(consultaGeojson, {
      style: {
        color: "#2563eb",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 0.10,
      },
      onEachFeature: (feature, camada) => {
        const p = feature.properties || {};
        const cod = obterValorPossivel(p, ["cod_imovel", "COD_IMOVEL", "codigo", "CODIGO", "cod_car", "COD_CAR"]);
        camada.bindPopup(`<strong>CAR/SICAR</strong><br/>${cod || "Feição consultada"}`);
      },
    }).addTo(map);

    previewCarLayerRef.current = layer;
    setMostrarPreviewCar(true);
  }  function calcularSobreposicaoDetalhada(perimetroBase, feicoesConsulta, origemPadrao = "FEIÇÃO CONSULTADA") {
    try {
      if (!perimetroBase?.features?.length || !feicoesConsulta?.features?.length) return null;

      const baseFeatures = perimetroBase.features.filter((f) => f.geometry);
      const consultaFeatures = feicoesConsulta.features.filter((f) => f.geometry);
      const intersecoes = [];

      let indice = 0;

      for (const base of baseFeatures) {
        for (const feature of consultaFeatures) {
          try {
            let inter = null;

            try {
              inter = turf.intersect(turf.featureCollection([base, feature]));
            } catch {
              inter = turf.intersect(base, feature);
            }

            if (!inter || !inter.geometry) continue;

            const areaInterHa = turf.area(inter) / 10000;
            if (areaInterHa <= 0.000001) continue;

            const props = feature.properties || {};
            const codigo = obterValorPossivel(props, [
              "parcela_co", "PARCELA_CO", "cod_imovel", "COD_IMOVEL", "codigo_imo", "CODIGO_IMO",
              "cod_car", "COD_CAR", "codigo", "CODIGO"
            ]);
            const nome = obterValorPossivel(props, ["nome_area", "NOME_AREA", "nome", "NOME", "nom_imovel", "NOM_IMOVEL"]);
            const sncr = obterValorPossivel(props, ["codigo_imo", "CODIGO_IMO", "cod_imovel", "COD_IMOVEL", "sncr", "SNCR"]);
            const matricula = obterValorPossivel(props, ["registro_m", "REGISTRO_M", "matricula", "MATRICULA"]);
            const municipio = obterValorPossivel(props, ["municipio_", "MUNICIPIO_", "municipio", "MUNICIPIO", "nom_munici", "NOM_MUNICI"]);
            const status = obterValorPossivel(props, ["status", "STATUS", "situacao_i", "SITUACAO_I"]);
            const cor = corSobreposicao(indice);

            inter.properties = {
              ...props,
              __origem: props.__origem || origemPadrao,
              __codigo: codigo || "-",
              __nome: nome || "-",
              __sncr: sncr || "-",
              __matricula: matricula || "-",
              __municipio: municipio || "-",
              __status: status || "-",
              __areaSobrepostaHa: Number(areaInterHa.toFixed(4)),
              __cor: cor,
            };

            intersecoes.push(inter);
            indice++;
          } catch (e) {
            console.warn("Falha ao calcular interseção individual", e);
          }
        }
      }

      const areaBaseHa = turf.area(perimetroBase) / 10000;
      const areaSomadaHa = intersecoes.reduce((soma, f) => soma + (f.properties.__areaSobrepostaHa || 0), 0);

      let areaUniaoHa = 0;
      let uniaoGeom = null;

      for (const inter of intersecoes) {
        try {
          if (!uniaoGeom) {
            uniaoGeom = inter;
          } else {
            uniaoGeom = turf.union(turf.featureCollection([uniaoGeom, inter]));
          }
        } catch {
          // Fallback: mantém soma, mas marca tecnicamente.
        }
      }

      if (uniaoGeom) {
        areaUniaoHa = turf.area(uniaoGeom) / 10000;
      } else {
        areaUniaoHa = Math.min(areaSomadaHa, areaBaseHa);
      }

      const percentualUniao = areaBaseHa > 0 ? (areaUniaoHa / areaBaseHa) * 100 : 0;
      const areaLivreHa = Math.max(areaBaseHa - areaUniaoHa, 0);

      return {
        areaBaseHa: Number(areaBaseHa.toFixed(4)),
        areaSobrepostaSomadaHa: Number(areaSomadaHa.toFixed(4)),
        areaSobrepostaUniaoHa: Number(areaUniaoHa.toFixed(4)),
        areaLivreHa: Number(areaLivreHa.toFixed(4)),
        percentualSobreposto: Number(percentualUniao.toFixed(2)),
        quantidade: intersecoes.length,
        intersecoes: {
          type: "FeatureCollection",
          features: intersecoes
        },
        uniao: uniaoGeom || null
      };
    } catch (error) {
      console.error("Erro no cálculo detalhado de sobreposição", error);
      return null;
    }
  }

  function desenharSobreposicoesDetalhadas(resultado) {
    const map = mapRef.current;
    if (!map || !resultado?.intersecoes?.features?.length) return;

    if (overlapLayerRef.current) {
      map.removeLayer(overlapLayerRef.current);
      overlapLayerRef.current = null;
    }

    if (mapLegendControlRef.current) {
      map.removeControl(mapLegendControlRef.current);
      mapLegendControlRef.current = null;
    }

    const layer = L.geoJSON(resultado.intersecoes, {
      style: (feature) => ({
        color: feature.properties.__cor || "#ef4444",
        weight: 3,
        fillColor: feature.properties.__cor || "#ef4444",
        fillOpacity: 0.18,
      }),
      onEachFeature: (feature, camada) => {
        const p = feature.properties || {};
        camada.bindPopup(`
          <strong>${p.__origem || "Sobreposição"}</strong><br/>
          ${origem === "CAR" ? "Número CAR" : "Código"}: ${p.__codigo || "-"}<br/>
          Nome: ${p.__nome || "-"}<br/>
          Área sobreposta: ${p.__areaSobrepostaHa || 0} ha
        `);
      },
    }).addTo(map);

    overlapLayerRef.current = layer;

    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "map-legend");
      const itens = resultado.intersecoes.features.slice(0, 12).map((f, idx) => {
        const p = f.properties || {};
        return `<div><span style="background:${p.__cor};"></span>${idx + 1}. ${p.__origem || ""} ${String(p.__codigo || "").slice(0, 24)}</div>`;
      }).join("");

      div.innerHTML = `<strong>Sobreposições</strong>${itens}`;
      return div;
    };
    legend.addTo(map);
    mapLegendControlRef.current = legend;

    try {
      map.fitBounds(layer.getBounds(), { padding: [30, 30] });
      setTimeout(() => map.invalidateSize(), 180);
    } catch {}
  }

  async function recalcularSobreposicaoParaRelatorio() {
    if (!geojsonAtual || !consultaGeojson) {
      alert("Carregue um perímetro base e uma feição/camada consultada para calcular sobreposição.");
      return null;
    }

    const resultado = calcularSobreposicaoDetalhada(geojsonAtual, consultaGeojson, "FEIÇÃO CONSULTADA");

    if (!resultado) {
      alert("Não foi possível calcular a sobreposição.");
      return null;
    }

    setResultadoSobreposicaoDetalhado(resultado);

    setUltimoCruzamento({
      origem: "Análise detalhada",
      areaBase: resultado.areaBaseHa,
      areaConsulta: resultado.areaSobrepostaSomadaHa,
      areaIntersecao: resultado.areaSobrepostaUniaoHa,
      percentualBase: resultado.percentualSobreposto,
      percentualConsulta: 0,
    });

    desenharSobreposicoesDetalhadas(resultado);
    await capturarMapaComoImagem();

    return resultado;
  }

  function usarConsultaComoPerimetroAtual() {
    if (!consultaGeojson) {
      alert("Não existe feição consultada para usar como perímetro.");
      return;
    }
    aplicarPerimetroAtual(consultaGeojson, "feicao-consultada-online.geojson", "Feição consultada usada como perímetro atual.");
  }

  function baixarRelatorioSobreposicao() {
    const cruzamentoDisponivel = garantirCruzamentoParaRelatorio();

    if (!cruzamentoDisponivel) {
      alert("Ainda não existe cruzamento calculado. Carregue um KML/perímetro e aguarde a análise automática, ou clique em Reanalisar perímetro.");
      return;
    }

    const texto = `RELATÓRIO PRELIMINAR DE SOBREPOSIÇÃO - LONGITUDE GEO INTELLIGENCE

Data: ${hojeBR()}

Origem da feição consultada: ${c.origem}

Área do perímetro base: ${c.areaBase.toLocaleString("pt-BR")} ha
Área da feição consultada: ${c.areaConsulta.toLocaleString("pt-BR")} ha
Área de sobreposição: ${c.areaIntersecao.toLocaleString("pt-BR")} ha

Percentual sobre o perímetro base: ${c.percentualBase.toLocaleString("pt-BR")}%
Percentual sobre a feição consultada: ${c.percentualConsulta.toLocaleString("pt-BR")}%

Observação:
Este cálculo é preliminar e depende da qualidade da geometria consultada e do perímetro base utilizado.`;

    salvarArquivo("relatorio-sobreposicao-longitude-geo.txt", texto);
  }

  async function carregarCatalogoIntermat() {
    setCarregandoOnline(true);
    setResultadoIntermat("Consultando catálogo do INTERMAT...");

    try {
      const resposta = await fetch(`/api/intermat?f=pjson`);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      const json = await resposta.json();
      const layers = json.layers || [];
      setCatalogoIntermat(layers);
      setStatusOnline((s) => ({ ...s, intermat: "Online" }));
      setResultadoIntermat(`INTERMAT online. ${layers.length} camadas encontradas.`);
    } catch (error) {
      console.error(error);
      setStatusOnline((s) => ({ ...s, intermat: "Falhou" }));
      setResultadoIntermat(`Falha ao acessar INTERMAT: ${error.message}`);
    } finally {
      setCarregandoOnline(false);
    }
  }

  async function consultarLayerIntermat() {
    if (!consultaForm.layerIntermat.trim()) {
      alert("Informe o ID da camada INTERMAT.");
      return;
    }

    setCarregandoOnline(true);
    setResultadoIntermat("Consultando camada INTERMAT...");

    try {
      const layerId = consultaForm.layerIntermat.trim();
      const respostaInfo = await fetch(`/api/intermat/${layerId}?f=pjson`);
      if (!respostaInfo.ok) throw new Error(`HTTP ${respostaInfo.status}`);

      const info = await respostaInfo.json();

      let resumo = `Camada INTERMAT encontrada.\n\n`;
      resumo += `Nome: ${info.name || "não informado"}\n`;
      resumo += `Tipo: ${info.type || "não informado"}\n`;
      resumo += `Geometria: ${info.geometryType || "não informado"}\n`;
      resumo += `Campos: ${(info.fields || []).length}\n`;

      setResultadoIntermat(resumo);
      setStatusOnline((s) => ({ ...s, intermat: "Online" }));
    } catch (error) {
      console.error(error);
      setResultadoIntermat(`Erro ao consultar camada INTERMAT: ${error.message}`);
    } finally {
      setCarregandoOnline(false);
    }
  }

  function prepararConsultaSigef() {
    window.open(SERVICOS_OFICIAIS.sigef, "_blank", "noopener,noreferrer");
  }

  function prepararConsultaCar() {
    window.open(SERVICOS_OFICIAIS.car, "_blank", "noopener,noreferrer");
  }

  function importarGeoJSON(event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target.result);
        if (!geojson.features || geojson.features.length === 0) {
          alert("GeoJSON sem feições.");
          return;
        }
        aplicarPerimetroAtual(geojson, arquivo.name, "GeoJSON importado com sucesso.");
      } catch (error) {
        console.error(error);
        alert("Erro ao importar GeoJSON.");
      }
    };
    leitor.readAsText(arquivo);
  }



  function montarResultadoAutomaticoParaRelatorio() {
    const features = [
      ...(autoCarGeojson?.features || []),
      ...(autoSigefGeojson?.features || []),
      ...(autoIntermatGeojson?.features || [])
    ].filter((f) => f?.properties?.__sobrepoe);

    if (!geojsonAtual?.features?.length || features.length === 0) return null;

    const intersecoes = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];

      try {
        let inter = null;
        try {
          inter = turf.intersect(turf.featureCollection([geojsonAtual.features[0], feature]));
        } catch {
          inter = turf.intersect(geojsonAtual.features[0], feature);
        }

        if (!inter?.geometry) continue;

        const areaHa = turf.area(inter) / 10000;
        const p = feature.properties || {};
        const cor = p.__cor || corSobreposicao(i);

        const dadosIntermat = p.__origem === "INTERMAT" ? resolverDadosIntermat(p) : null;
        inter.properties = {
          ...p,
          __origem: p.__origem || "ANÁLISE AUTOMÁTICA",
          __codigo: p.__codigo || dadosIntermat?.codigo || "-",
          __nome: p.__origem === "INTERMAT" ? (dadosIntermat?.tituloPrimitivo || nomeTituloIntermat(p)) : (p.__nome || "-"),
          __tituloPrimitivo: p.__origem === "INTERMAT" ? (dadosIntermat?.tituloPrimitivo || nomeTituloIntermat(p)) : (p.__tituloPrimitivo || p.__nome || "-"),
          __nomeFazenda: p.__origem === "INTERMAT" ? (dadosIntermat?.nomeFazenda || nomeFazendaIntermat(p)) : (p.__nomeFazenda || "-"),
          __sncr: p.__sncr || "-",
          __matricula: p.__matricula || "-",
          __municipio: p.__municipio || "-",
          __status: p.__status || "-",
          __areaSobrepostaHa: Number(areaHa.toFixed(4)),
          __cor: cor,
        };

        intersecoes.push(inter);
      } catch (error) {
        console.warn("Falha ao montar interseção automática para relatório", error);
      }
    }

    if (intersecoes.length === 0) return null;

    const areaBaseHa = turf.area(geojsonAtual) / 10000;
    const areaSomadaHa = intersecoes.reduce((soma, f) => soma + (f.properties.__areaSobrepostaHa || 0), 0);

    let areaUniaoHa = 0;
    let uniaoGeom = null;

    for (const inter of intersecoes) {
      try {
        if (!uniaoGeom) {
          uniaoGeom = inter;
        } else {
          uniaoGeom = turf.union(turf.featureCollection([uniaoGeom, inter]));
        }
      } catch {
        // fallback
      }
    }

    if (uniaoGeom) {
      areaUniaoHa = turf.area(uniaoGeom) / 10000;
    } else {
      areaUniaoHa = Math.min(areaSomadaHa, areaBaseHa);
    }

    return {
      areaBaseHa: Number(areaBaseHa.toFixed(4)),
      areaSobrepostaSomadaHa: Number(areaSomadaHa.toFixed(4)),
      areaSobrepostaUniaoHa: Number(areaUniaoHa.toFixed(4)),
      areaLivreHa: Number(Math.max(areaBaseHa - areaUniaoHa, 0).toFixed(4)),
      percentualSobreposto: Number(((areaUniaoHa / areaBaseHa) * 100).toFixed(2)),
      quantidade: intersecoes.length,
      intersecoes: {
        type: "FeatureCollection",
        features: intersecoes
      },
      uniao: uniaoGeom || null
    };
  }

  function garantirCruzamentoParaRelatorio() {
    if (resultadoSobreposicaoDetalhado?.intersecoes?.features?.length) {
      return resultadoSobreposicaoDetalhado;
    }

    const automatico = montarResultadoAutomaticoParaRelatorio();

    if (automatico) {
      setResultadoSobreposicaoDetalhado(automatico);
      setUltimoCruzamento({
        origem: "Análise automática CAR/SIGEF",
        areaBase: automatico.areaBaseHa,
        areaConsulta: automatico.areaSobrepostaSomadaHa,
        areaIntersecao: automatico.areaSobrepostaUniaoHa,
        percentualBase: automatico.percentualSobreposto,
        percentualConsulta: 0,
      });

      if (typeof desenharSobreposicoesDetalhadas === "function") {
        desenharSobreposicoesDetalhadas(automatico);
      }

      return automatico;
    }

    if (ultimoCruzamento) {
      return ultimoCruzamento;
    }

    return null;
  }function alternarBaseAnalise(base) {
    setBasesAnaliseAtivas((prev) => {
      const novo = { ...prev, [base]: !prev[base] };
      const map = mapRef.current;

      setTimeout(() => {
        try {
          const controlar = (layerRef, ativo) => {
            const layer = layerRef?.current;
            if (!map || !layer) return;
            if (ativo) {
              if (!map.hasLayer(layer)) layer.addTo(map);
            } else {
              if (map.hasLayer(layer)) map.removeLayer(layer);
            }
          };

          if (base === "sigef") controlar(autoSigefLayerRef, novo.sigef);
          if (base === "car") controlar(autoCarLayerRef, novo.car);
          if (base === "intermat") controlar(autoIntermatLayerRef, novo.intermat);

          try { destacarPerimetroAnalise(); } catch {}
        } catch (error) {
          console.warn("Falha ao alternar camada de análise", error);
        }
      }, 0);

      return novo;
    });
  }

  function limparCamadasAutomaticas() {
    const map = mapRef.current;
    if (!map) return;

    if (autoCarLayerRef.current) {
      map.removeLayer(autoCarLayerRef.current);
      autoCarLayerRef.current = null;
    }

    if (autoSigefLayerRef.current) {
      map.removeLayer(autoSigefLayerRef.current);
      autoSigefLayerRef.current = null;
    }

    if (autoIntermatLayerRef.current) {
      map.removeLayer(autoIntermatLayerRef.current);
      autoIntermatLayerRef.current = null;
    }
  }

  function desenharCamadaAutomatica(geojson, origem) {
    const map = mapRef.current;
    if (!map || !geojson?.features?.length) return;

    const isCar = origem === "CAR";
    const isIntermat = origem === "INTERMAT";
    const ref = isCar ? autoCarLayerRef : (isIntermat ? autoIntermatLayerRef : autoSigefLayerRef);

    if (ref.current) {
      map.removeLayer(ref.current);
      ref.current = null;
    }

    const cor = isCar ? "#2563eb" : (isIntermat ? "#f59e0b" : "#16a34a");

    const layer = L.geoJSON(geojson, {
      style: (feature) => ({
        color: feature.properties?.__sobrepoe ? "#ef4444" : cor,
        weight: feature.properties?.__sobrepoe ? 4 : 2,
        fillColor: feature.properties?.__sobrepoe ? "#ef4444" : cor,
        fillOpacity: feature.properties?.__sobrepoe ? 0.16 : 0.05,
      }),
      onEachFeature: (feature, camada) => {
        const p = feature.properties || {};
        camada.bindPopup(`
          <strong>${origem}</strong><br/>
          ${origem === "INTERMAT" ? `<strong>Título primitivo:</strong> ${nomeTituloIntermat(p)}<br/><strong>Fazenda/denominação:</strong> ${nomeFazendaIntermat(p)}<br/><strong>Requerente:</strong> ${p.__requerente || "-"}<br/>` : `${p.__nome || ""}<br/>`}
          Código: ${p.__codigo || "-"}<br/>
          Sobrepõe: ${p.__sobrepoe ? "SIM" : "NÃO"}<br/>
          Área sobreposta: ${p.__areaSobrepostaHa || 0} ha<br/>
          Percentual no perímetro: ${p.__percentualBase || 0}%
        `);
      },
    }).addTo(map);

    ref.current = layer;
  }

  async function descobrirCamadasCarWfs() {
    try {
      const params = new URLSearchParams({
        service: "WFS",
        version: "1.1.0",
        request: "GetCapabilities",
      });

      const resposta = await fetch(`${SERVICOS_OFICIAIS.carWfs}?${params.toString()}`);
      const texto = await resposta.text();

      const nomes = [...texto.matchAll(/<Name>([^<]+)<\/Name>/g)]
        .map((m) => m[1])
        .filter((nome) => /imovel|imoveis|area/i.test(nome))
        .filter((nome) => !/app|reserva|vegetacao|hidrografia|servidao|nascente/i.test(nome));

      const unicos = [...new Set(nomes)];
      setCarCapabilitiesInfo(`Camadas CAR detectadas: ${unicos.slice(0, 12).join(", ") || "nenhuma camada compatível"}`);
      return unicos;
    } catch (error) {
      setCarCapabilitiesInfo(`Erro ao ler GetCapabilities do CAR: ${error.message}`);
      return [];
    }
  }

  async function buscarCarOnlinePorPerimetro(perimetro) {
    const uf = detectarUfPorCentroide(perimetro);
    const bbox = bboxComFolga(perimetro, 0.10);

    const camadasDetectadas = await descobrirCamadasCarWfs();

    const typeNames = [
      ...camadasDetectadas,
      `sicar:area_imovel`,
      `sicar:AREA_IMOVEL`,
      `sicar:imoveis`,
      `sicar:IMOVEIS`,
      `sicar:area_imovel_${uf}`,
      `sicar:imoveis_${uf}`,
      `sicar:sicar_imoveis_${uf}`
    ].filter(Boolean);

    const unicos = [...new Set(typeNames)];
    const erros = [];

    for (const typeName of unicos) {
      const tentativas = [
        {
          version: "1.1.0",
          bbox: `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]},EPSG:4326`,
          srsName: "EPSG:4326",
        },
        {
          version: "1.0.0",
          bbox: `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`,
          srsName: "EPSG:4326",
        }
      ];

      for (const tentativa of tentativas) {
        try {
          const params = new URLSearchParams({
            service: "WFS",
            version: tentativa.version,
            request: "GetFeature",
            typeName,
            outputFormat: "application/json",
            srsName: tentativa.srsName,
            bbox: tentativa.bbox,
            maxFeatures: "250",
          });

          const resposta = await fetch(`${SERVICOS_OFICIAIS.carWfs}?${params.toString()}`);
          const texto = await resposta.text();

          if (!resposta.ok) {
            erros.push(`${typeName}: HTTP ${resposta.status}`);
            continue;
          }

          let geojson = null;
          try {
            geojson = JSON.parse(texto);
          } catch {
            erros.push(`${typeName}: resposta não JSON (${texto.slice(0, 80)})`);
            continue;
          }

          if (geojson?.features?.length) {
            setCarCapabilitiesInfo(`CAR OK: camada ${typeName}, ${geojson.features.length} feição(ões) no entorno.`);
            return { geojson, camada: typeName };
          }

          erros.push(`${typeName}: 0 feições`);
        } catch (error) {
          erros.push(`${typeName}: ${error.message}`);
        }
      }
    }

    const resumoErro = erros.slice(-8).join(" | ");
    setCarCapabilitiesInfo(`CAR não retornou feições no entorno. Últimos testes: ${resumoErro}`);
    console.warn("CAR automático não retornou feições:", resumoErro);
    return { geojson: { type: "FeatureCollection", features: [] }, camada: "", erro: resumoErro };
  }


  function cruzarFeicoesComPerimetro(perimetro, feicoes, origem) {
    const resultado = [];
    let idx = 0;
    const perimetroFeature = obterFeaturePerimetro(perimetro);
    const areaBaseHa = perimetroFeature ? turf.area(perimetroFeature) / 10000 : 0;

    if (!perimetroFeature || areaBaseHa <= 0) {
      return { type: "FeatureCollection", features: [] };
    }

    for (const feature of feicoes?.features || []) {
      if (!feature.geometry) continue;

      const calculo = calcularIntersecaoRobusta(perimetroFeature, feature);
      const areaSobrepostaHa = calculo.areaHa || 0;
      const sobrepoe = areaSobrepostaHa > 0.0001;

      const featureBase = origem === "INTERMAT" ? normalizarAtributosIntermatFeature(feature) : feature;
      const resumo = origem === "INTERMAT" ? resolverDadosIntermat(featureBase.properties) : montarResumoFeicaoAuto(featureBase, origem, idx + 1);
      const areaTituloNumero = numeroPtBr(resumo.areaTitulo);
      const percentualBase = areaBaseHa > 0 ? (areaSobrepostaHa / areaBaseHa) * 100 : 0;
      const percentualTitulo = areaTituloNumero > 0 ? (areaSobrepostaHa / areaTituloNumero) * 100 : 0;

      resultado.push({
        ...featureBase,
        properties: {
          ...(featureBase.properties || {}),
          __origem: origem,
          __codigo: resumo.codigo || "-",
          __tituloPrimitivo: origem === "INTERMAT" ? (resumo.tituloPrimitivo || nomeTituloIntermat(featureBase.properties)) : (resumo.tituloPrimitivo || resumo.denominacao || resumo.nome || "-"),
          __nomeFazenda: origem === "INTERMAT" ? (resumo.nomeFazenda || nomeFazendaIntermat(featureBase.properties)) : (resumo.nomeFazenda || resumo.denominacao || resumo.nome || "-"),
          __nome: origem === "INTERMAT" ? (resumo.tituloPrimitivo || nomeTituloIntermat(featureBase.properties)) : (resumo.denominacao || resumo.nome || "-"),
          __sncr: resumo.sncr || "-",
          __matricula: resumo.matricula || "-",
          __municipio: resumo.municipio || "-",
          __status: resumo.status || resumo.origem || "-",
          __requerente: resumo.requerente || "-",
          __registro: resumo.registro || "-",
          __livro: resumo.livro || "-",
          __folha: resumo.folha || "-",
          __orgao: resumo.orgao || "-",
          __areaTituloHa: areaTituloNumero,
          __sobrepoe: sobrepoe,
          __areaSobrepostaHa: Number(areaSobrepostaHa.toFixed(4)),
          __percentualBase: Number(percentualBase.toFixed(2)),
          __percentualTitulo: Number(percentualTitulo.toFixed(2)),
          __metodoIntersecao: calculo.metodo,
          __cor: sobrepoe ? corSobreposicao(idx) : undefined,
        }
      });
      idx++;
    }

    return { type: "FeatureCollection", features: resultado };
  }

  async function executarAnaliseAutomaticaDoPerimetro(perimetro = geojsonAtual) {
    if (!perimetro?.features?.length) {
      alert("Carregue primeiro um KML, Shape ou GeoJSON.");
      return;
    }

    setAutoAnaliseStatus("Executando análise automática: buscando CAR online, SIGEF local e INTERMAT local...");
    limparCamadasAutomaticas();

    const resumo = {
      carTotal: 0,
      carSobrepostos: 0,
      sigefTotal: 0,
      sigefSobrepostos: 0,
      carCamada: "",
      erroCar: "",
    };

    try {
      // 1. CAR online por BBOX + CAR local, quando disponível
      const car = basesAnaliseAtivas.car ? await buscarCarOnlinePorPerimetro(perimetro) : { geojson: { type: "FeatureCollection", features: [] }, camada: "", erro: "CAR desativado pelo usuário" };
      resumo.carCamada = car.camada || "";
      resumo.erroCar = car.erro || "";

      let carFeatures = [...(car.geojson?.features || [])];

      if (carLocalGeojson?.features?.length) {
        const bboxCarLocal = turf.bboxPolygon(bboxComFolga(perimetro, 0.10));
        const candidatosCarLocal = [];

        for (const feature of carLocalGeojson.features) {
          if (!feature.geometry) continue;
          try {
            if (turf.booleanIntersects(bboxCarLocal, feature)) candidatosCarLocal.push(feature);
          } catch {}
          if (candidatosCarLocal.length >= 1500) break;
        }

        carFeatures = [...carFeatures, ...candidatosCarLocal];
      }

      const carCruzado = cruzarFeicoesComPerimetro(perimetro, { type: "FeatureCollection", features: carFeatures }, "CAR");
      resumo.carTotal = carCruzado.features.length;
      resumo.carSobrepostos = carCruzado.features.filter((f) => f.properties.__sobrepoe).length;
      resumo.carLocal = carLocalGeojson?.features?.length || 0;

      setAutoCarGeojson(carCruzado);
      if (autoCamadas.car && carCruzado.features.length) desenharCamadaAutomatica(carCruzado, "CAR");

      // 2. SIGEF local, se houver base importada
      let sigefCruzado = { type: "FeatureCollection", features: [] };

      if (sigefLocalGeojson?.features?.length) {
        const bbox = turf.bboxPolygon(bboxComFolga(perimetro, 0.10));
        const candidatos = [];

        for (const feature of sigefLocalGeojson.features) {
          if (!feature.geometry) continue;
          try {
            if (turf.booleanIntersects(bbox, feature)) candidatos.push(feature);
          } catch {}
          if (candidatos.length >= 1000) break;
        }

        sigefCruzado = cruzarFeicoesComPerimetro(perimetro, { type: "FeatureCollection", features: candidatos }, "SIGEF LOCAL");
      }

      resumo.sigefTotal = sigefCruzado.features.length;
      resumo.sigefSobrepostos = sigefCruzado.features.filter((f) => f.properties.__sobrepoe).length;

      setAutoSigefGeojson(sigefCruzado);
      if (autoCamadas.sigef && sigefCruzado.features.length) desenharCamadaAutomatica(sigefCruzado, "SIGEF");

      // 3. INTERMAT local, se houver base importada
      let intermatCruzado = { type: "FeatureCollection", features: [] };

      if (intermatLocalGeojson?.features?.length) {
        const bboxIntermat = turf.bboxPolygon(bboxComFolga(perimetro, 0.10));
        const candidatosIntermat = [];

        for (const feature of intermatLocalGeojson.features) {
          if (!feature.geometry) continue;
          try {
            if (turf.booleanIntersects(bboxIntermat, feature)) candidatosIntermat.push(normalizarAtributosIntermatFeature(feature));
          } catch {}
          if (candidatosIntermat.length >= 1500) break;
        }

        intermatCruzado = cruzarFeicoesComPerimetro(perimetro, { type: "FeatureCollection", features: candidatosIntermat }, "INTERMAT");
      }

      resumo.intermatTotal = intermatCruzado.features.length;
      resumo.intermatSobrepostos = intermatCruzado.features.filter((f) => f.properties.__sobrepoe).length;

      setAutoIntermatGeojson(intermatCruzado);
      if (autoCamadas.intermat && intermatCruzado.features.length) desenharCamadaAutomatica(intermatCruzado, "INTERMAT");

      setAutoResumo(resumo);

      setAutoAnaliseStatus(
        `Análise automática concluída. CAR: ${resumo.carSobrepostos}/${resumo.carTotal} sobrepostas. SIGEF: ${resumo.sigefSobrepostos}/${resumo.sigefTotal} sobrepostas. INTERMAT: ${resumo.intermatSobrepostos || 0}/${resumo.intermatTotal || 0} sobrepostas.`
      );
    } catch (error) {
      console.error(error);
      setAutoAnaliseStatus(`Erro na análise automática: ${error.message}`);
    }
  }

  function alternarCamadaAutomatica(tipo) {
    if (tipo === "car") {
      const novo = !autoCamadas.car;
      setAutoCamadas((s) => ({ ...s, car: novo }));

      if (!novo && autoCarLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(autoCarLayerRef.current);
        autoCarLayerRef.current = null;
      }

      if (novo && autoCarGeojson?.features?.length) {
        desenharCamadaAutomatica(autoCarGeojson, "CAR");
      }
    }

    if (tipo === "sigef") {
      const novo = !autoCamadas.sigef;
      setAutoCamadas((s) => ({ ...s, sigef: novo }));

      if (!novo && autoSigefLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(autoSigefLayerRef.current);
        autoSigefLayerRef.current = null;
      }

      if (novo && autoSigefGeojson?.features?.length) {
        desenharCamadaAutomatica(autoSigefGeojson, "SIGEF");
      }
    }
    if (tipo === "intermat") {
      const novo = !autoCamadas.intermat;
      setAutoCamadas((s) => ({ ...s, intermat: novo }));

      if (!novo && autoIntermatLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(autoIntermatLayerRef.current);
        autoIntermatLayerRef.current = null;
      }

      if (novo && autoIntermatGeojson?.features?.length) {
        desenharCamadaAutomatica(autoIntermatGeojson, "INTERMAT");
      }
    }

  }

  function limparPerimetroAtual() {
    const map = mapRef.current;

    if (geoLayerRef.current && map) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();

    setAreaHa(null);
    setGeojsonAtual(null);
    setArquivoNome("");
    setDiagnostico("Perímetro limpo. Envie um KML/GeoJSON ou desenhe novamente no mapa.");
  }

  function exportarGeoJSON() {
    if (!geojsonAtual) {
      alert("Não existe perímetro para exportar.");
      return;
    }
    salvarArquivo("perimetro-longitude-geo.geojson", JSON.stringify(geojsonAtual, null, 2), "application/geo+json;charset=utf-8");
  }

  function exportarKML() {
    if (!geojsonAtual) {
      alert("Não existe perímetro para exportar.");
      return;
    }
    const kml = geojsonParaKml(geojsonAtual, imovelForm.nome || "Perimetro Longitude Geo");
    salvarArquivo("perimetro-longitude-geo.kml", kml, "application/vnd.google-earth.kml+xml;charset=utf-8");
  }

  function salvarCliente(e) {
    e.preventDefault();
    if (!clienteForm.nome.trim()) {
      alert("Informe o nome do cliente.");
      return;
    }
    const novo = { id: uid(), criadoEm: hojeBR(), ...clienteForm };
    setDados((d) => ({ ...d, clientes: [novo, ...d.clientes] }));
    setClienteForm({ nome: "", documento: "", telefone: "", email: "" });
    alert("Cliente salvo.");
  }

  function salvarImovelEAnalise(e) {
    e.preventDefault();

    if (!imovelForm.nome.trim()) {
      alert("Informe o nome do imóvel.");
      return;
    }

    if (!areaHa || !geojsonAtual) {
      alert("Envie primeiro um KML/GeoJSON válido ou desenhe um perímetro.");
      return;
    }

    const imovel = { id: uid(), criadoEm: hojeBR(), ...imovelForm, areaHa };
    const analise = {
      id: uid(),
      criadoEm: hojeBR(),
      imovelId: imovel.id,
      nomeImovel: imovel.nome,
      clienteId: imovel.clienteId,
      areaHa,
      arquivoNome,
      diagnostico,
      status: "Preliminar",
      geojson: geojsonAtual,
    };

    setDados((d) => ({ ...d, imoveis: [imovel, ...d.imoveis], analises: [analise, ...d.analises] }));
    setDiagnostico("Análise salva no histórico. Próxima etapa: gerar relatório ou proposta.");
    alert("Imóvel e análise salvos.");
  }

  function baixarRelatorio(analise = null) {
    const alvo = analise || dados.analises[0];

    if (!alvo && !areaHa) {
      alert("Não existe análise para gerar relatório.");
      return;
    }

    const imovel = alvo ? dados.imoveis.find((i) => i.id === alvo.imovelId) : imovelForm;
    const cliente = imovel?.clienteId ? dados.clientes.find((c) => c.id === imovel.clienteId) : null;

    const texto = `RELATÓRIO PRELIMINAR - LONGITUDE GEO INTELLIGENCE

Data: ${hojeBR()}

1. CLIENTE
Nome: ${cliente?.nome || "Não informado"}
CPF/CNPJ: ${cliente?.documento || "Não informado"}
Telefone: ${cliente?.telefone || "Não informado"}
E-mail: ${cliente?.email || "Não informado"}

2. IMÓVEL
Nome: ${imovel?.nome || "Não informado"}
Município: ${imovel?.municipio || "Não informado"}
Matrícula: ${imovel?.matricula || "Não informado"}
CAR/SIMCAR: ${imovel?.car || "Não informado"}
SIGEF: ${imovel?.sigef || "Não informado"}
Área calculada: ${(alvo?.areaHa || areaHa || 0).toLocaleString("pt-BR")} ha

3. DIAGNÓSTICO PRELIMINAR
${alvo?.diagnostico || diagnostico}`;

    salvarArquivo("relatorio-preliminar-longitude-geo.txt", texto);
  }

  function gerarProposta() {
    const ultima = dados.analises[0];
    if (!ultima) {
      alert("Salve uma análise antes de gerar proposta.");
      return;
    }

    const imovel = dados.imoveis.find((i) => i.id === ultima.imovelId);
    const cliente = imovel?.clienteId ? dados.clientes.find((c) => c.id === imovel.clienteId) : null;

    const texto = `PROPOSTA COMERCIAL - LONGITUDE ASSESSORIA RURAL E URBANO

Data: ${hojeBR()}

Cliente: ${cliente?.nome || "Não informado"}
Imóvel: ${imovel?.nome || ultima.nomeImovel}
Município: ${imovel?.municipio || "Não informado"}
Área analisada: ${Number(ultima.areaHa).toLocaleString("pt-BR")} ha

Serviço proposto:
${propostaForm.servico}

Prazo estimado:
${propostaForm.prazo}

Valor:
R$ ${propostaForm.valor || "A definir"}`;

    salvarArquivo("proposta-longitude-geo.txt", texto);
  }

  function abrirImovel(imovelId) {
    setImovelAbertoId(imovelId);
    setTela("imovelDetalhe");
  }

  function voltarParaImoveis() {
    setImovelAbertoId("");
    setTela("imoveis");
  }

  function obterImovelAberto() {
    return dados.imoveis.find((i) => i.id === imovelAbertoId) || null;
  }

  function obterAnalisesDoImovel(imovelId) {
    return dados.analises.filter((a) => a.imovelId === imovelId);
  }

  function abrirAnaliseSalva(analiseId) {
    const analise = dados.analises.find((a) => a.id === analiseId);
    if (!analise) {
      alert("Análise não encontrada.");
      return;
    }
    if (analise.geojson) {
      aplicarPerimetroAtual(analise.geojson, analise.arquivoNome || "analise-salva.geojson", `Análise salva reaberta: ${analise.nomeImovel || "imóvel"}`);
    }
    setTela("analise");
  }

  function excluirAnalise(analiseId) {
    if (!confirm("Deseja excluir esta análise salva?")) return;
    setDados((d) => ({ ...d, analises: d.analises.filter((a) => a.id !== analiseId) }));
  }


  async function gerarRelatorioWordCartograficoV22() {
    let resultado = resultadoSobreposicaoDetalhado || montarResultadoAutomaticoParaRelatorio();

    if (!resultado && geojsonAtual && consultaGeojson) {
      resultado = await recalcularSobreposicaoParaRelatorio();
    }

    if (!resultado) {
      alert("Não há sobreposição disponível para o relatório. Carregue o KML/perímetro, aguarde a análise automática ou clique em Reanalisar perímetro.");
      return;
    }

    setResultadoSobreposicaoDetalhado(resultado);
    if (typeof desenharSobreposicoesDetalhadas === "function") {
      desenharSobreposicoesDetalhadas(resultado);
    }

    const mapaDataUrl = await capturarMapaComoImagem();

    const linhas = resultado.intersecoes.features.map((f, idx) => {
      const p = f.properties || {};
      const nomePrincipal = p.__origem === "INTERMAT" ? (resolverDadosIntermat(p).tituloPrimitivo || nomeTituloIntermat(p)) : (p.__nome || "-");
      const fazendaDenominacao = p.__origem === "INTERMAT" ? (resolverDadosIntermat(p).nomeFazenda || nomeFazendaIntermat(p)) : "-";

      return [
        String(idx + 1),
        p.__origem || "-",
        p.__codigo || "-",
        p.__sncr || "-",
        nomePrincipal,
        fazendaDenominacao,
        p.__matricula || "-",
        p.__municipio || "-",
        p.__status || "-",
        `${Number(p.__areaSobrepostaHa || 0).toLocaleString("pt-BR")} ha`,
        `${Number(p.__percentualBase || 0).toLocaleString("pt-BR")}%`,
        `${Number(p.__percentualTitulo || 0).toLocaleString("pt-BR")}%`,
        p.__requerente || "-",
        p.__registro || "-"
      ];
    });

    const conteudoMapa = mapaDataUrl
      ? `<p><strong>4. Mapa da análise de sobreposição</strong></p><p style="text-align:center;"><img src="${mapaDataUrl}" style="width:960px;max-width:100%;height:auto;border:1px solid #999;object-fit:contain;" /></p><p><em>Figura 01 – Mapa técnico limpo da análise de sobreposição, com legenda cartográfica e feições coloridas.</em></p>`
      : `<p><strong>4. Mapa da análise de sobreposição</strong></p><p><em>Mapa não capturado automaticamente. Recomenda-se gerar o relatório com o mapa visível na tela.</em></p>`;

    const legendaHtml = resultado.intersecoes.features.map((f, idx) => {
      const p = f.properties || {};
      return `<tr>
        <td>${idx + 1}</td>
        <td><span style="display:inline-block;width:14px;height:14px;background:${p.__cor};border:1px solid #333"></span></td>
        <td>${p.__origem || "-"}</td>
        <td>${p.__codigo || "-"}</td>
        <td>${p.__origem === "INTERMAT" ? `${nomeTituloIntermat(p)} / ${nomeFazendaIntermat(p)}` : (p.__nome || "-")}</td>
      </tr>`;
    }).join("");

    const tabelaHtml = linhas.map((linha) => `
      <tr>${linha.map((cel) => `<td>${cel}</td>`).join("")}</tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 1.5cm; }
  body { font-family: Arial, sans-serif; color: #111; font-size: 11px; }
  h1 { color: #163b22; font-size: 20px; margin: 0 0 6px; }
  h2 { color: #163b22; font-size: 15px; margin-top: 18px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 16px; }
  th, td { border: 1px solid #777; padding: 5px; vertical-align: top; }
  th { background: #e9efe9; font-weight: bold; }
  .header { border-bottom: 3px solid #c9a400; margin-bottom: 14px; padding-bottom: 10px; }
  .muted { color: #555; }
  .note { font-size: 10px; color: #555; }
</style>
</head>
<body>
  <div class="header">
    <h1>RELATÓRIO DE ANÁLISE DE SOBREPOSIÇÃO</h1>
    <div>Longitude Assessoria Rural e Urbano</div>
  </div>

  <h2>1. Identificação</h2>
  <table>
    <tr><th>Data da análise</th><td>${hojeBR()}</td></tr>
    <tr><th>Área do perímetro analisado</th><td>${resultado.areaBaseHa.toLocaleString("pt-BR")} ha</td></tr>
    <tr><th>Área sobreposta efetiva</th><td>${resultado.areaSobrepostaUniaoHa.toLocaleString("pt-BR")} ha</td></tr>
    <tr><th>Área livre estimada</th><td>${resultado.areaLivreHa.toLocaleString("pt-BR")} ha</td></tr>
    <tr><th>Percentual sobre o perímetro</th><td>${resultado.percentualSobreposto.toLocaleString("pt-BR")}%</td></tr>
    <tr><th>Quantidade de sobreposições</th><td>${resultado.quantidade}</td></tr>
  </table>

  <h2>2. Bases analisadas</h2>
  <p>Foram consideradas as feições carregadas/consultadas no sistema Longitude Geo Intelligence, incluindo base SIGEF local importada, CAR/SICAR consultado e demais perímetros disponíveis no momento da análise.</p>

  <h2>3. Síntese técnica</h2>
  <p>Foram identificadas ${resultado.quantidade} sobreposição(ões). O cálculo técnico considera a <strong>união geométrica das interseções</strong>, evitando duplicidade quando mais de uma feição recobre a mesma parte do perímetro analisado.</p>

  ${conteudoMapa}

  <h2>5. Legenda das feições sobrepostas</h2>
  <table>
    <tr><th>#</th><th>Cor</th><th>Origem</th><th>Código/Nº CAR</th><th>Nome/Identificação</th></tr>
    ${legendaHtml}
  </table>

  <h2>6. Quadro técnico de sobreposições</h2>
  <table>
    <tr><th>#</th><th>Origem</th><th>Código</th><th>SNCR/Nº CAR</th><th>Título Primitivo</th><th>Fazenda/Denominação</th><th>Matrícula</th><th>Município</th><th>Status/Origem</th><th>Área Sobreposta</th><th>% Perímetro</th><th>% Título</th><th>Requerente</th><th>Registro</th></tr>
    ${tabelaHtml}
  </table>

  <h2>7. Conclusão técnica preliminar</h2>
  <p>Após o cruzamento espacial realizado, foram identificadas as sobreposições descritas neste relatório. Este documento possui caráter técnico preliminar e deve ser validado com conferência da origem, data de atualização das bases, sistema de referência geodésico e documentação dominial/cadastral do imóvel.</p>
  <p class="note">Observação: para uso cartorial, judicial ou bancário, recomenda-se conferência em ambiente SIG profissional e emissão com assinatura técnica.</p>

  <br><br>
  <p>______________________________________________<br>
  Alexandre Magno Gomes de Lima<br>
  Longitude Assessoria Rural e Urbano</p>
</body>
</html>`;

    salvarArquivo("Relatorio_Sobreposicao_Longitude_Cartografico.doc", html, "application/msword;charset=utf-8");
  }

  function limparBase() {
    if (!confirm("Tem certeza que deseja apagar todos os dados salvos neste navegador?")) return;
    setDados(initialData);
    localStorage.removeItem(STORAGE_KEY);
    alert("Base local apagada.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={logoLongitude} alt="Longitude Assessoria Rural e Urbano" />
          <div>
            <div className="brand-title-row">
              <h1>{APP_NAME}</h1>
              <span className="app-version-badge" title={`Build ${APP_BUILD}`}>{APP_VERSION}</span>
            </div>
            <p>Regularização Fundiária • SIGEF • CAR • INTERMAT</p>
          </div>
        </div>

        <nav className="nav">
          <button className={tela === "dashboard" ? "active" : ""} onClick={() => setTela("dashboard")}>🏠 Dashboard</button>

              <label className="file-button secondary-action">
                Importar ZIPs SIGEF Brasil
                <input
                  type="file"
                  accept=".zip"
                  multiple
                  onChange={importarSigefZipNacional}
                  hidden
                />
              </label>

          <button className={tela === "analise" ? "active" : ""} onClick={() => setTela("analise")}>🗺️ Análise Territorial</button>
          <button className={tela === "clientes" ? "active" : ""} onClick={() => setTela("clientes")}>👤 Clientes</button>
          <button className={tela === "imoveis" ? "active" : ""} onClick={() => setTela("imoveis")}>🏡 Imóveis</button>
          <button className={tela === "integracoes" ? "active" : ""} onClick={() => setTela("integracoes")}>📍 SIGEF / CAR / INTERMAT</button>
          <button className={tela === "cloud" ? "active" : ""} onClick={() => setTela("cloud")}>⭐ Cloud / Consulta Territorial</button>
          <button className={tela === "relatorios" ? "active" : ""} onClick={() => setTela("relatorios")}>📑 Relatórios</button>
          <button className={tela === "propostas" ? "active" : ""} onClick={() => setTela("propostas")}>💰 Propostas</button>
          <button className={tela === "config" ? "active" : ""} onClick={() => setTela("config")}>⚙️ Configurações</button>
        </nav>

        <div className="upload-card">
          <h2>Nova análise</h2>
          <p>Envie um KML/GeoJSON ou desenhe no mapa para calcular área e montar o diagnóstico inicial.</p>
          <label className="upload-button">
            Selecionar KML
            <input type="file" accept=".kml" onChange={carregarKML} />
          </label>
          <label className="secondary-upload-button">
            Importar GeoJSON
            <input type="file" accept=".geojson,.json" onChange={importarGeoJSON} />
          </label>
          {arquivoNome && <small>Arquivo: {arquivoNome}</small>}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>{tituloTela(tela)}</h2>
            <p>Plataforma de Inteligência Fundiária e Regularização Territorial</p>
          </div>
          {["analise", "integracoes", "cloud"].includes(tela) && <button className="report-button" onClick={() => baixarRelatorio()}>Gerar relatório</button>}
        </header>

        {["dashboard", "clientes", "imoveis", "relatorios", "propostas", "config"].includes(tela) && (
          <EnterpriseModules module={tela} />
        )}

        {tela === "dashboard_legacy" && (
          <section className="page">
            <div className="cards-grid">
              <Metric label="Clientes" value={estatisticas.clientes} />
              <Metric label="Imóveis" value={estatisticas.imoveis} />
              <Metric label="Análises" value={estatisticas.analises} />
              <Metric label="Área total analisada" value={`${estatisticas.area} ha`} />
            </div>
            <div className="panel">
              <h3>Últimas análises</h3>
              <TabelaAnalises analises={dados.analises.slice(0, 5)} onRelatorio={baixarRelatorio} />
            </div>
          </section>
        )}

        {tela === "analise" && (
          <section className="content">
            <div className="map-panel"><div id="map"></div></div>
            <aside className="info-panel">
              <div className="metric-card">
                <span>Área calculada</span>
                <strong>{areaHa ? `${areaHa.toLocaleString("pt-BR")} ha` : "--"}</strong>
              </div>

              <div className="base-map-card">
                <h3>Mapa de fundo</h3>
                <div className="base-map-options">
                  <button type="button" className={mapaBase === "padrao" ? "selected" : ""} onClick={() => trocarMapaBase("padrao")}>Mapa padrão</button>
                  <button type="button" className={mapaBase === "satelite" ? "selected" : ""} onClick={() => trocarMapaBase("satelite")}>Satélite</button>
                </div>
              </div>


              <div className="auto-analysis-card">
                <h3>Análise automática CAR/SIGEF</h3>
                <p className="muted">
                  Ao carregar KML/GeoJSON ou desenhar um perímetro, o sistema busca CAR online pelo entorno e cruza com a base SIGEF local importada.
                </p>

                <div className="auto-toggle-row">
                  <button type="button" className={autoCamadas.car ? "selected" : ""} onClick={() => alternarCamadaAutomatica("car")}>
                    {autoCamadas.car ? "CAR ligado" : "CAR desligado"}
                  </button>
                  <button type="button" className={autoCamadas.sigef ? "selected" : ""} onClick={() => alternarCamadaAutomatica("sigef")}>
                    {autoCamadas.sigef ? "SIGEF ligado" : "SIGEF desligado"}
                  </button>
                  <button type="button" className={autoCamadas.intermat ? "selected" : ""} onClick={() => alternarCamadaAutomatica("intermat")}>
                    {autoCamadas.intermat ? "INTERMAT ligado" : "INTERMAT desligado"}
                  </button>
                </div>

                <button className="primary-button" type="button" onClick={() => executarAnaliseAutomaticaDoPerimetro()}>
                  Reanalisar perímetro
                </button>

                {autoAnaliseStatus && <pre className="result-box compact-result">{autoAnaliseStatus}</pre>}

                {carCapabilitiesInfo && <pre className="result-box compact-result">{carCapabilitiesInfo}</pre>}

                {autoResumo && (
                  <div className="auto-summary">
                    <span>CAR próximos: <strong>{autoResumo.carTotal}</strong></span>
                    <span>CAR sobrepostos: <strong>{autoResumo.carSobrepostos}</strong></span>
                    <span>SIGEF próximos: <strong>{autoResumo.sigefTotal}</strong></span>
                    <span>SIGEF sobrepostos: <strong>{autoResumo.sigefSobrepostos}</strong></span>
                    <span>INTERMAT próximos: <strong>{autoResumo.intermatTotal || 0}</strong></span>
                    <span>INTERMAT sobrepostos: <strong>{autoResumo.intermatSobrepostos || 0}</strong></span>
                  </div>
                )}
              </div>

              <div className="tools-card">
                <h3>Ferramentas do perímetro</h3>
                <p>Use os ícones no canto superior esquerdo do mapa para desenhar polígono, linha ou retângulo.</p>
                <div className="tool-buttons">
                  <button type="button" onClick={exportarGeoJSON}>Exportar GeoJSON</button>
                  <button type="button" onClick={exportarKML}>Exportar KML</button>
                  <button type="button" onClick={limparPerimetroAtual}>Limpar perímetro</button>
                </div>
              </div>

              <form className="form-card" onSubmit={salvarImovelEAnalise}>
                <h3>Dados do imóvel</h3>
                <input placeholder="Nome do imóvel" value={imovelForm.nome} onChange={(e) => setImovelForm({ ...imovelForm, nome: e.target.value })} />
                <input placeholder="Município" value={imovelForm.municipio} onChange={(e) => setImovelForm({ ...imovelForm, municipio: e.target.value })} />
                <input placeholder="Matrícula" value={imovelForm.matricula} onChange={(e) => setImovelForm({ ...imovelForm, matricula: e.target.value })} />
                <input placeholder="CAR/SIMCAR" value={imovelForm.car} onChange={(e) => setImovelForm({ ...imovelForm, car: e.target.value })} />
                <input placeholder="Código SIGEF" value={imovelForm.sigef} onChange={(e) => setImovelForm({ ...imovelForm, sigef: e.target.value })} />
                <select value={imovelForm.clienteId} onChange={(e) => setImovelForm({ ...imovelForm, clienteId: e.target.value })}>
                  <option value="">Vincular cliente, se houver</option>
                  {dados.clientes.map((c) => <option value={c.id} key={c.id}>{c.nome}</option>)}
                </select>
                <textarea placeholder="Observações técnicas" value={imovelForm.observacoes} onChange={(e) => setImovelForm({ ...imovelForm, observacoes: e.target.value })} />
                <button className="primary-button" type="submit">Salvar imóvel e análise</button>
              </form>

              <div className="diagnosis-card">
                <h3>Diagnóstico preliminar</h3>
                <p>{diagnostico}</p>
              </div>
            </aside>
          </section>
        )}

        {tela === "clientes_legacy" && (
          <section className="page two-columns">
            <form className="form-card" onSubmit={salvarCliente}>
              <h3>Novo cliente</h3>
              <input placeholder="Nome / Razão social" value={clienteForm.nome} onChange={(e) => setClienteForm({ ...clienteForm, nome: e.target.value })} />
              <input placeholder="CPF/CNPJ" value={clienteForm.documento} onChange={(e) => setClienteForm({ ...clienteForm, documento: e.target.value })} />
              <input placeholder="Telefone" value={clienteForm.telefone} onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })} />
              <input placeholder="E-mail" value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} />
              <button className="primary-button" type="submit">Salvar cliente</button>
            </form>
            <div className="panel">
              <h3>Clientes cadastrados</h3>
              {dados.clientes.length === 0 ? <p className="muted">Nenhum cliente cadastrado.</p> : dados.clientes.map((c) => (
                <div className="list-item" key={c.id}>
                  <strong>{c.nome}</strong>
                  <span>{c.documento || "Sem CPF/CNPJ"} • {c.telefone || "Sem telefone"}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tela === "imoveis_legacy" && (
          <section className="page">
            <div className="panel">
              <h3>Imóveis cadastrados</h3>
              {dados.imoveis.length === 0 ? (
                <p className="muted">Nenhum imóvel salvo ainda.</p>
              ) : (
                dados.imoveis.map((i) => {
                  const totalAnalises = obterAnalisesDoImovel(i.id).length;
                  return (
                    <div className="list-item imovel-card" key={i.id}>
                      <div className="imovel-card-info">
                        <strong>{i.nome}</strong>
                        <span>{i.municipio || "Município não informado"} • {Number(i.areaHa || 0).toLocaleString("pt-BR")} ha</span>
                        <small>Matrícula: {i.matricula || "não informada"} | CAR: {i.car || "não informado"} | SIGEF: {i.sigef || "não informado"}</small>
                        <small>Histórico: {totalAnalises} análise(s) salva(s)</small>
                      </div>
                      <div className="imovel-card-actions">
                        <button className="primary-button" type="button" onClick={() => abrirImovel(i.id)}>Abrir imóvel</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {tela === "imovelDetalhe" && (() => {
          const imovel = obterImovelAberto();
          const analisesImovel = imovel ? obterAnalisesDoImovel(imovel.id) : [];
          if (!imovel) {
            return <section className="page"><div className="panel"><h3>Imóvel não encontrado</h3><button className="primary-button" type="button" onClick={voltarParaImoveis}>Voltar</button></div></section>;
          }
          return (
            <section className="page">
              <div className="property-header">
                <div>
                  <button className="back-button" type="button" onClick={voltarParaImoveis}>← Voltar aos imóveis</button>
                  <h3>{imovel.nome}</h3>
                  <p>{imovel.municipio || "Município não informado"} • {Number(imovel.areaHa || 0).toLocaleString("pt-BR")} ha</p>
                </div>
                <button className="primary-button" type="button" onClick={() => setTela("analise")}>Nova análise</button>
              </div>
              <div className="property-grid">
                <div className="panel"><h3>Dados gerais</h3><div className="data-grid">
                  <span>Matrícula</span><strong>{imovel.matricula || "Não informada"}</strong>
                  <span>CAR/SIMCAR</span><strong>{imovel.car || "Não informado"}</strong>
                  <span>SIGEF</span><strong>{imovel.sigef || "Não informado"}</strong>
                  <span>Área</span><strong>{Number(imovel.areaHa || 0).toLocaleString("pt-BR")} ha</strong>
                  <span>Data de cadastro</span><strong>{imovel.criadoEm || "-"}</strong>
                  <span>Observações</span><strong>{imovel.observacoes || "Sem observações"}</strong>
                </div></div>
                <div className="panel"><h3>Resumo</h3><div className="cards-grid compact"><Metric label="Análises" value={analisesImovel.length} /><Metric label="Área" value={`${Number(imovel.areaHa || 0).toLocaleString("pt-BR")} ha`} /></div></div>
              </div>
              <div className="panel"><h3>Histórico de análises</h3>{analisesImovel.length === 0 ? <p className="muted">Nenhuma análise salva para este imóvel.</p> : <div className="analysis-history"><div className="analysis-head"><span>Data</span><span>Status</span><span>Área</span><span>Arquivo</span><span>Ações</span></div>{analisesImovel.map((a) => <div className="analysis-row" key={a.id}><span>{a.criadoEm}</span><span>{a.status || "Preliminar"}</span><span>{Number(a.areaHa || 0).toLocaleString("pt-BR")} ha</span><span>{a.arquivoNome || "sem arquivo"}</span><span className="row-actions"><button type="button" onClick={() => abrirAnaliseSalva(a.id)}>Abrir mapa</button><button type="button" onClick={() => baixarRelatorio(a)}>Relatório</button><button type="button" className="danger-mini" onClick={() => excluirAnalise(a.id)}>Excluir</button></span></div>)}</div>}</div>
              <div className="panel"><h3>Módulos do imóvel</h3><div className="module-pills"><span>📂 Documentos</span><span>🗺️ Mapas</span><span>📄 Relatórios</span><span>💰 Propostas</span><span>✅ Pendências</span></div></div>
            </section>
          );
        })()}

        {tela === "integracoes" && (
          <section className="page online-layout">
            <div className="integration-left">
              <div className="base-map-card integration-basemap">
                <h3>Mapa de fundo</h3>
                <div className="base-map-options">
                  <button type="button" className={mapaBase === "padrao" ? "selected" : ""} onClick={() => trocarMapaBase("padrao")}>Mapa padrão</button>
                  <button type="button" className={mapaBase === "satelite" ? "selected" : ""} onClick={() => trocarMapaBase("satelite")}>Satélite</button>
                </div>
              </div>

              <div className="map-panel integration-map">
                <div id="map"></div>
              </div>
            </div>

            <div className="online-grid">
              <div className="online-card">
              <h3>SIGEF / INCRA</h3>
              <p className="muted">Consulta de feição SIGEF via proxy local. Use “Testar SIGEF” para ver amostras reais.</p>
              <input placeholder="Código SIGEF, SNCR, matrícula ou nome da área" value={consultaForm.codigoSigef} onChange={(e) => setConsultaForm({ ...consultaForm, codigoSigef: e.target.value })} />

              <label className="secondary-upload-button sigef-local-upload">
                Importar Base SIGEF GeoJSON
                <input type="file" accept=".geojson,.json" onChange={importarBaseSigefLocal} />
              </label>

              {sigefLocalNome && (
                <p className="muted">Base local: {sigefLocalNome}</p>
              )}

              <label className="secondary-upload-button sigef-local-upload">
                Importar Base CAR ZIP/GeoJSON
                <input type="file" accept=".zip,.geojson,.json" onChange={importarBaseCarLocal} />
              </label>

              {carLocalNome && (
                <p className="muted">Base CAR local: {carLocalNome}</p>
              )}

              {carLocalInfo && (
                <pre className="result-box compact-result">{carLocalInfo}</pre>
              )}

              <label className="secondary-upload-button sigef-local-upload">
                Importar Base INTERMAT ZIP/GeoJSON
                <input type="file" accept=".zip,.geojson,.json" onChange={importarBaseIntermatLocal} />
              </label>

              {intermatLocalNome && (
                <p className="muted">Base INTERMAT: {intermatLocalNome}</p>
              )}
              <small className="muted">Arquivo ZIP obrigatório: .SHP + .DBF + .PRJ + .SHX. SBN/SBX não substituem SHX.</small>

              {intermatLocalInfo && (
                <pre className="result-box compact-result">{intermatLocalInfo}</pre>
              )}

              <div className="online-actions">
                <button className="primary-button" type="button" onClick={consultarSigefPorCodigo} disabled={carregandoOnline}>Buscar online</button>
                <button className="primary-button" type="button" onClick={buscarSigefNaBaseLocal}>Buscar na base local</button>
                <button className="secondary-action" type="button" onClick={testarSigef} disabled={carregandoOnline}>Testar SIGEF online</button>
                <button className="secondary-action" type="button" onClick={prepararConsultaSigef}>Abrir portal oficial</button>
              </div>
              <StatusBadge label="Fonte" value={statusOnline.sigef} />
            </div>

            <div className="online-card">
              <h3>CAR / SICAR</h3>
              <p className="muted">Consulta de feição CAR por código. Exemplo de formato: MT-5103700-...</p>
              <input placeholder="Código CAR/SICAR" value={consultaForm.codigoCar} onChange={(e) => setConsultaForm({ ...consultaForm, codigoCar: e.target.value })} />
              <div className="online-actions">
                <button className="primary-button" type="button" onClick={consultarCarPorCodigo} disabled={carregandoOnline}>Carregar feição no mapa</button>
                <button className="secondary-action" type="button" onClick={prepararConsultaCar}>Abrir portal oficial</button>
              </div>
              <StatusBadge label="Fonte" value={statusOnline.car} />
            </div>

            <div className="online-card wide">
              <h3>Resultado da consulta SIGEF/CAR</h3>
              <div className="online-actions">
                <button className="primary-button" type="button" onClick={usarConsultaComoPerimetroAtual}>Usar feição como perímetro atual</button>
                <button className="secondary-action" type="button" onClick={baixarRelatorioSobreposicao}>Baixar relatório de sobreposição</button>
                <button className="secondary-action" type="button" onClick={gerarRelatorioWordCartograficoV22}>Relatório Word com mapa</button>
                  <button type="button" className="secondary-action" onClick={() => exportarImagemSateliteRecortada("png")}>
                    Imagem satélite PNG
                  </button>
                  <button type="button" className="secondary-action" onClick={() => exportarImagemSateliteRecortada("jpg")}>
                    Imagem satélite JPG
                  </button>
                <small className="muted">Relatórios usam a análise automática CAR/SIGEF quando não houver consulta manual.</small>
              </div>

              
              <div className="sigef-brasil-panel">
                <div className="sigef-brasil-header">
                  <strong>Base SIGEF Brasil importada</strong>
                  <button type="button" className="danger-lite" onClick={limparBaseSigefBrasil}>
                    Limpar SIGEF
                  </button>
                </div>

                <p>
                  {sigefLocalGeojson?.features?.length || 0} feição(ões) carregada(s) em {sigefArquivosImportados.length} arquivo(s).
                </p>

                <label className="persist-toggle">
                  <input
                    type="checkbox"
                    checked={sigefPersistenciaAtiva}
                    onChange={(e) => setSigefPersistenciaAtiva(e.target.checked)}
                  />
                  Salvar base SIGEF no navegador para a próxima abertura
                </label>

                {sigefArquivosImportados.length > 0 && (
                  <div className="sigef-files-table">
                    <table>
                      <thead>
                        <tr>
                          <th>UF</th>
                          <th>Arquivo</th>
                          <th>Feições</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sigefArquivosImportados.slice(-12).map((item) => (
                          <tr key={item.assinatura || item.nome}>
                            <td>{item.uf || "-"}</td>
                            <td title={item.nome}>{item.nome}</td>
                            <td>{item.features}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sigefArquivosImportados.length > 12 && (
                      <small>Mostrando os 12 arquivos mais recentes.</small>
                    )}
                  </div>
                )}
              </div>

<div className="preview-card">
                <h4>Pré-visualização de parcelas</h4>
                <p className="muted">Ligue/desligue as camadas para avaliar visualmente sobreposição com KML, desenho ou GeoJSON importado.</p>
                <div className="preview-buttons">
                  <button type="button" className={mostrarPreviewSigef ? "selected" : ""} onClick={desenharPreviewSigef}>
                    {mostrarPreviewSigef ? "Desligar SIGEF local" : "Ligar SIGEF local"}
                  </button>
                  <button type="button" className={mostrarPreviewCar ? "selected" : ""} onClick={desenharPreviewCar}>
                    {mostrarPreviewCar ? "Desligar CAR" : "Ligar CAR"}
                  </button>
                </div>
              </div>

              
              <div className="analysis-layer-selector">
                <strong>Bases que entram na análise</strong>
                <p>Escolha quais camadas serão consideradas no cruzamento.</p>
                <div className="analysis-layer-buttons">
                  <button
                    type="button"
                    className={basesAnaliseAtivas.sigef ? "layer-toggle active" : "layer-toggle"}
                    onClick={() => alternarBaseAnalise("sigef")}
                  >
                    {basesAnaliseAtivas.sigef ? "SIGEF ligado" : "SIGEF desligado"}
                  </button>
                  <button
                    type="button"
                    className={basesAnaliseAtivas.car ? "layer-toggle active" : "layer-toggle"}
                    onClick={() => alternarBaseAnalise("car")}
                  >
                    {basesAnaliseAtivas.car ? "CAR ligado" : "CAR desligado"}
                  </button>
                  <button
                    type="button"
                    className={basesAnaliseAtivas.intermat ? "layer-toggle active" : "layer-toggle"}
                    onClick={() => alternarBaseAnalise("intermat")}
                  >
                    {basesAnaliseAtivas.intermat ? "INTERMAT ligado" : "INTERMAT desligado"}
                  </button>
                </div>
              </div>

<div className="analysis-card">
                <h4>Análise de sobreposição</h4>
                <p className="muted">Cruza o perímetro atual com a base SIGEF local e/ou a feição CAR/SIGEF consultada.</p>
                <div className="export-buttons">
                  <button type="button" onClick={executarAnaliseSobreposicao} disabled={analisandoSobreposicao}>{analisandoSobreposicao ? "Analisando..." : "Executar análise"}</button>
                  <button type="button" onClick={exportarRelatorioWordSobreposicao}>Exportar Word</button>
                  <button type="button" onClick={exportarIntersecoesGeoJSON}>Exportar interseções GeoJSON</button>
                </div>
                {analiseSobreposicao && (
                  <div className="analysis-result">
                    <strong>{analiseSobreposicao.quantidade} sobreposição(ões)</strong>
                    <span>Área analisada: {numeroBR(analiseSobreposicao.areaBaseHa)} ha</span>
                    <span>Área sobreposta: {numeroBR(analiseSobreposicao.totalSobrepostoHa)} ha</span>
                    <span>Percentual: {numeroBR(analiseSobreposicao.percentualTotal, 2)}%</span>
                    <div className="mini-table">
                      <div className="mini-head"><span>Cor</span><span>Origem</span><span>Código</span><span>Nome</span><span>Sobrep. ha</span><span>%</span></div>
                      {analiseSobreposicao.resultados.slice(0, 20).map((r) => (
                        <div className="mini-row" key={r.id}>
                          <span><i className="color-chip" style={{ background: r.cor }}></i></span>
                          <span>{r.origem}</span>
                          <span>{r.codigo}</span>
                          <span>{r.nome}</span>
                          <span>{numeroBR(r.areaSobrepostaHa)}</span>
                          <span>{numeroBR(r.percentualSobreBase, 2)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="export-card">
                <h4>Exportar parcela consultada</h4>
                <p className="muted">Use estes botões após carregar uma feição do CAR ou SIGEF local.</p>
                <div className="export-buttons">
                  <button type="button" onClick={exportarConsultaKML}>Exportar KML</button>
                  <button type="button" onClick={exportarConsultaGeoJSON}>Exportar GeoJSON</button>
                  <button type="button" onClick={exportarConsultaShapefile}>Exportar Shapefile ZIP</button>
                </div>
              </div>
              {sigefLocalInfo && <pre className="result-box">{sigefLocalInfo}</pre>}
              {diagnosticoOnline && <pre className="result-box">{diagnosticoOnline}</pre>}
              {resultadoConsulta ? <pre className="result-box">{resultadoConsulta}</pre> : <p className="muted">Nenhuma consulta executada ainda.</p>}
            </div>

            <div className="online-card wide">
              <h3>INTERMAT Online</h3>
              <p className="muted">Leitura do serviço público INTERGEO/Base_Cartografica.</p>
              <div className="online-actions">
                <button className="primary-button" type="button" onClick={carregarCatalogoIntermat} disabled={carregandoOnline}>Carregar catálogo INTERMAT</button>
                <button className="secondary-action" type="button" onClick={() => window.open(SERVICOS_OFICIAIS.intermatPortal, "_blank")}>Abrir portal INTERMAT</button>
              </div>
              <div className="inline-form">
                <input placeholder="ID da camada INTERMAT" value={consultaForm.layerIntermat} onChange={(e) => setConsultaForm({ ...consultaForm, layerIntermat: e.target.value })} />
                <button className="primary-button" type="button" onClick={consultarLayerIntermat} disabled={carregandoOnline}>Consultar camada</button>
              </div>
              <StatusBadge label="Status INTERMAT" value={statusOnline.intermat} />
              {resultadoIntermat && <pre className="result-box">{resultadoIntermat}</pre>}
              {catalogoIntermat.length > 0 && (
                <div className="catalog-box">
                  <h4>Camadas encontradas</h4>
                  {catalogoIntermat.slice(0, 40).map((layer) => (
                    <button key={layer.id} type="button" onClick={() => setConsultaForm({ ...consultaForm, layerIntermat: String(layer.id) })}>
                      ID {layer.id} — {layer.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

              <div className="layers-card wide">
                <h3>Camadas previstas para cruzamento espacial</h3>
                {CAMADAS_FUTURAS.map((camada) => (
                  <label key={camada}><input type="checkbox" disabled />{camada}</label>
                ))}
              </div>
            </div>
          </section>
        )}

        {tela === "cloud" && <CloudPanel />}

        {tela === "relatorios_legacy" && (
          <section className="page">
            <div className="panel">
              <h3>Relatórios disponíveis</h3>
              <TabelaAnalises analises={dados.analises} onRelatorio={baixarRelatorio} />
            </div>
          </section>
        )}

        {tela === "propostas_legacy" && (
          <section className="page two-columns">
            <form className="form-card" onSubmit={(e) => { e.preventDefault(); gerarProposta(); }}>
              <h3>Gerar proposta</h3>
              <input placeholder="Serviço" value={propostaForm.servico} onChange={(e) => setPropostaForm({ ...propostaForm, servico: e.target.value })} />
              <input placeholder="Valor em R$" value={propostaForm.valor} onChange={(e) => setPropostaForm({ ...propostaForm, valor: e.target.value })} />
              <input placeholder="Prazo" value={propostaForm.prazo} onChange={(e) => setPropostaForm({ ...propostaForm, prazo: e.target.value })} />
              <button className="primary-button" type="submit">Baixar proposta</button>
            </form>
            <div className="panel"><h3>Base da proposta</h3><p className="muted">A proposta usa a última análise salva.</p></div>
          </section>
        )}

        {tela === "config_legacy" && (
          <section className="page">
            <div className="panel danger-panel">
              <h3>Configurações locais</h3>
              <p className="muted">Nesta versão, os dados ficam salvos apenas neste navegador.</p>
              <button className="danger-button" onClick={limparBase}>Apagar base local</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function tituloTela(tela) {
  const titulos = {
    dashboard: "Dashboard",
    analise: "Análise Territorial",
    clientes: "Clientes",
    imoveis: "Imóveis",
    imovelDetalhe: "Detalhe do Imóvel",
    integracoes: "SIGEF / CAR / INTERMAT",
    cloud: "Cloud / Consulta Territorial",
    relatorios: "Relatórios",
    propostas: "Propostas",
    config: "Configurações",
  };
  return titulos[tela] || "Longitude Geo";
}

function StatusBadge({ label, value }) {
  return (
    <div className="status-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TabelaAnalises({ analises, onRelatorio }) {
  if (!analises || analises.length === 0) return <p className="muted">Nenhuma análise salva.</p>;

  return (
    <div className="table">
      <div className="table-head">
        <span>Data</span>
        <span>Imóvel</span>
        <span>Área</span>
        <span>Ação</span>
      </div>
      {analises.map((a) => (
        <div className="table-row" key={a.id}>
          <span>{a.criadoEm}</span>
          <span>{a.nomeImovel}</span>
          <span>{Number(a.areaHa).toLocaleString("pt-BR")} ha</span>
          <button onClick={() => onRelatorio(a)}>Relatório</button>
        </div>
      ))}
    </div>
  );
}
  function recortarAreaUtilCanvas(canvas) {
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      // Detecta área realmente ocupada: ignora branco puro/quase branco.
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          const quaseBranco = r > 245 && g > 245 && b > 245;
          const transparente = a < 10;

          if (!quaseBranco && !transparente) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX <= minX || maxY <= minY) return canvas;

      const margem = 16;
      minX = Math.max(0, minX - margem);
      minY = Math.max(0, minY - margem);
      maxX = Math.min(width, maxX + margem);
      maxY = Math.min(height, maxY + margem);

      const cropW = maxX - minX;
      const cropH = maxY - minY;

      // Se o corte for quase igual ao canvas, mantém.
      if (cropW > width * 0.92 && cropH > height * 0.92) return canvas;

      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      const outCtx = out.getContext("2d");
      outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      return out;
    } catch (error) {
      console.warn("Não foi possível recortar área útil do mapa", error);
      return canvas;
    }
  }



