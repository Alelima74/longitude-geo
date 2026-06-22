import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-draw";
import * as toGeoJSON from "@tmcw/togeojson";
import * as turf from "@turf/turf";
import html2canvas from "html2canvas";
import * as shpwrite from "@mapbox/shp-write";
import logoLongitude from "./assets/logo-longitude.png";
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

const STORAGE_KEY = "longitude_geo_mvp_v8_corrigido";

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
  return {
    origem,
    codigo:
      p.parcela_co || p.PARCELA_CO || p.cod_imovel || p.COD_IMOVEL ||
      p.cod_imovel || p.codigo_imo || p.CODIGO_IMO || p.codigo || p.CODIGO || "-",
    sncr: p.codigo_imo || p.CODIGO_IMO || p.cod_imovel || p.COD_IMOVEL || p.sncr || p.SNCR || "-",
    nome: p.nome_area || p.NOME_AREA || p.nome_imove || p.NOME_IMOVE || p.nome || p.NOME || "-",
    matricula: p.registro_m || p.REGISTRO_M || p.matricula || p.MATRICULA || "-",
    municipio: p.municipio_ || p.MUNICIPIO_ || p.municipio || p.MUNICIPIO || p.cod_munici || p.COD_MUNICI || "-",
    status: p.status || p.STATUS || p.situacao_i || p.SITUACAO_I || "-",
  };
}

function bboxSobrepoe(a, b) {
  if (!a || !b) return false;
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function featureCollectionDeUma(feature) {
  return { type: "FeatureCollection", features: [feature] };
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
  for (const nome of nomes) {
    if (props && props[nome] !== undefined && props[nome] !== null && String(props[nome]).trim() !== "") {
      return props[nome];
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

export default function App() {
  const mapRef = useRef(null);
  const geoLayerRef = useRef(null);
  const consultaLayerRef = useRef(null);
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
  const [ultimoCruzamento, setUltimoCruzamento] = useState(null);
  const [resultadoSobreposicaoDetalhado, setResultadoSobreposicaoDetalhado] = useState(null);
  const [mapaRelatorioDataUrl, setMapaRelatorioDataUrl] = useState(null);
  const [analiseSobreposicao, setAnaliseSobreposicao] = useState(null);
  const [analisandoSobreposicao, setAnalisandoSobreposicao] = useState(false);
  const [carregandoOnline, setCarregandoOnline] = useState(false);

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
        style: { color: "#F0D500", weight: 4, fillColor: "#3D8B37", fillOpacity: 0.28 },
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

    if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);
    if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();

    const layer = L.geoJSON(geojson, {
      style: { color: "#F0D500", weight: 4, fillColor: "#3D8B37", fillOpacity: 0.28 },
    }).addTo(map);

    geoLayerRef.current = layer;
    map.fitBounds(layer.getBounds(), { padding: [30, 30] });

    const hectares = turf.area(geojson) / 10000;
    setGeojsonAtual(geojson);
    setAreaHa(Number(hectares.toFixed(4)));
    setArquivoNome(nomeArquivo);
    setDiagnostico(mensagem);
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
          fillOpacity: 0.22,
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
            fillOpacity: 0.48,
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
          <span>${idx + 1}. ${r.origem} — ${String(r.nome || r.codigo || "-").slice(0, 32)}</span>
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

  function executarAnaliseSobreposicao() {
    const base = geojsonAtual;
    if (!base?.features?.length) {
      alert("Carregue, consulte ou desenhe primeiro um perímetro base e clique em 'Usar feição como perímetro atual', quando necessário.");
      return;
    }

    const candidatos = [];

    if (sigefLocalGeojson?.features?.length) {
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
      alert("Não há base SIGEF local ou feição CAR/SIGEF consultada para cruzar com o perímetro atual.");
      return;
    }

    setAnalisandoSobreposicao(true);

    setTimeout(() => {
      try {
        const baseFeatures = base.features || [];
        const areaBaseHa = turf.area(base) / 10000;
        const bboxBase = turf.bbox(base);
        const resultados = [];
        const geometriasIntersecao = [];
        const feicoesSobrepostas = [];

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

          let areaSobreposta = 0;
          const partesIntersecao = [];

          for (const bf of baseFeatures) {
            const inter = calcularIntersecaoEntreFeatures(bf, f);
            if (inter.areaHa > 0.000001) {
              areaSobreposta += inter.areaHa;
              if (inter.geometry) partesIntersecao.push(inter.geometry);
            }
          }

          if (areaSobreposta > 0.0001) {
            const areaParcelaHa = turf.area(featureCollectionDeUma(f)) / 10000;
            const atributos = extrairAtributosParcela(f, item.origem);

            const indiceResultado = resultados.length;
            const cor = corSobreposicao(indiceResultado);
            const resultadoItem = {
              id: `${item.origem}-${indiceResultado + 1}`,
              origem: item.origem,
              codigo: atributos.codigo,
              sncr: atributos.sncr,
              nome: atributos.nome,
              matricula: atributos.matricula,
              municipio: atributos.municipio,
              status: atributos.status,
              cor,
              areaParcelaHa: Number(areaParcelaHa.toFixed(4)),
              areaSobrepostaHa: Number(areaSobreposta.toFixed(4)),
              percentualSobreBase: Number(((areaSobreposta / areaBaseHa) * 100).toFixed(4)),
              percentualSobreParcela: areaParcelaHa > 0 ? Number(((areaSobreposta / areaParcelaHa) * 100).toFixed(4)) : 0,
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

            for (const geom of partesIntersecao) {
              geometriasIntersecao.push({
                ...geom,
                properties: {
                  origem: item.origem,
                  codigo: atributos.codigo,
                  cor,
                  area_ha: Number(areaSobreposta.toFixed(4)),
                },
              });
            }
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

        if (resultados.length === 0) {
          setResultadoConsulta("Análise concluída: nenhuma sobreposição foi identificada com as bases carregadas.");
        } else {
          setResultadoConsulta(`Análise concluída: ${resultados.length} sobreposição(ões) identificada(s). Área total sobreposta: ${numeroBR(totalSobreposto)} ha.`);
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
        celula(r.nome, { width: 18 }),
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
            celula("Nome/Identificação", { header: true, width: 38 }),
          ],
        }),
        ...analiseSobreposicao.resultados.map((r) => new TableRow({
          children: [
            celula("", { width: 10, fill: corDocx(r.cor), align: AlignmentType.CENTER }),
            celula(r.origem, { width: 18, size: 16 }),
            celula(r.codigo, { width: 34, size: 16 }),
            celula(r.nome, { width: 38, size: 16 }),
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
            celula("Nome", { header: true, width: 18 }),
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
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
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
                children: [new ImageRun({ data: mapaRelatorioBytes, transformation: { width: 610, height: 410 } })],
              }),
              p("Figura 01 – Visualização cartográfica das feições sobrepostas ao perímetro analisado. As cores correspondem à legenda técnica apresentada na seção seguinte.", { size: 16, color: "475569", alignment: AlignmentType.CENTER }),
            ] : [p("Mapa não foi capturado automaticamente. Gere o relatório a partir da tela de mapa após executar a análise de sobreposição.", { size: 16, color: "B91C1C" })]),
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
  }
  function exportarConsultaGeoJSON() {
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
  }

  async function capturarMapaComoImagem() {
    try {
      const mapElement = document.getElementById("map");
      if (!mapElement) return null;

      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }

      await new Promise((resolve) => setTimeout(resolve, 600));

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        scale: 1.4,
        logging: false,
      });

      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Erro ao capturar mapa para relatório", error);
      return null;
    }
  }

  function desenharPreviewSigef() {
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
        fillOpacity: 0.16,
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
        fillOpacity: 0.16,
      },
      onEachFeature: (feature, camada) => {
        const p = feature.properties || {};
        const cod = obterValorPossivel(p, ["cod_imovel", "COD_IMOVEL", "codigo", "CODIGO", "cod_car", "COD_CAR"]);
        camada.bindPopup(`<strong>CAR/SICAR</strong><br/>${cod || "Feição consultada"}`);
      },
    }).addTo(map);

    previewCarLayerRef.current = layer;
    setMostrarPreviewCar(true);
  }


  async function capturarMapaComoImagem() {
    try {
      const mapElement = document.getElementById("map");
      if (!mapElement) return null;

      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scale: 1.35,
        logging: false,
      });

      const dataUrl = canvas.toDataURL("image/png");
      setMapaRelatorioDataUrl(dataUrl);
      return dataUrl;
    } catch (error) {
      console.error("Erro ao capturar mapa para relatório", error);
      return null;
    }
  }

  function calcularSobreposicaoDetalhada(perimetroBase, feicoesConsulta, origemPadrao = "FEIÇÃO CONSULTADA") {
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
        fillOpacity: 0.38,
      }),
      onEachFeature: (feature, camada) => {
        const p = feature.properties || {};
        camada.bindPopup(`
          <strong>${p.__origem || "Sobreposição"}</strong><br/>
          Código: ${p.__codigo || "-"}<br/>
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
    if (!ultimoCruzamento) {
      alert("Ainda não existe cruzamento calculado.");
      return;
    }

    const texto = `RELATÓRIO PRELIMINAR DE SOBREPOSIÇÃO - LONGITUDE GEO INTELLIGENCE

Data: ${hojeBR()}

Origem da feição consultada: ${ultimoCruzamento.origem}

Área do perímetro base: ${ultimoCruzamento.areaBase.toLocaleString("pt-BR")} ha
Área da feição consultada: ${ultimoCruzamento.areaConsulta.toLocaleString("pt-BR")} ha
Área de sobreposição: ${ultimoCruzamento.areaIntersecao.toLocaleString("pt-BR")} ha

Percentual sobre o perímetro base: ${ultimoCruzamento.percentualBase.toLocaleString("pt-BR")}%
Percentual sobre a feição consultada: ${ultimoCruzamento.percentualConsulta.toLocaleString("pt-BR")}%

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
    const resultado = resultadoSobreposicaoDetalhado || await recalcularSobreposicaoParaRelatorio();
    if (!resultado) return;

    const mapaDataUrl = mapaRelatorioDataUrl || await capturarMapaComoImagem();

    const linhas = resultado.intersecoes.features.map((f, idx) => {
      const p = f.properties || {};
      return [
        String(idx + 1),
        p.__origem || "-",
        p.__codigo || "-",
        p.__sncr || "-",
        p.__nome || "-",
        p.__matricula || "-",
        p.__municipio || "-",
        p.__status || "-",
        `${Number(p.__areaSobrepostaHa || 0).toLocaleString("pt-BR")} ha`
      ];
    });

    const conteudoMapa = mapaDataUrl
      ? `<p><strong>4. Mapa da análise de sobreposição</strong></p><p><img src="${mapaDataUrl}" style="width:680px;max-width:100%;border:1px solid #999" /></p><p><em>Figura 01 – Perímetro analisado e feições sobrepostas identificadas no cruzamento espacial.</em></p>`
      : `<p><strong>4. Mapa da análise de sobreposição</strong></p><p><em>Mapa não capturado automaticamente. Recomenda-se gerar o relatório com o mapa visível na tela.</em></p>`;

    const legendaHtml = resultado.intersecoes.features.map((f, idx) => {
      const p = f.properties || {};
      return `<tr>
        <td>${idx + 1}</td>
        <td><span style="display:inline-block;width:14px;height:14px;background:${p.__cor};border:1px solid #333"></span></td>
        <td>${p.__origem || "-"}</td>
        <td>${p.__codigo || "-"}</td>
        <td>${p.__nome || "-"}</td>
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
    <tr><th>#</th><th>Cor</th><th>Origem</th><th>Código</th><th>Nome/Identificação</th></tr>
    ${legendaHtml}
  </table>

  <h2>6. Quadro técnico de sobreposições</h2>
  <table>
    <tr><th>#</th><th>Origem</th><th>Código</th><th>SNCR/Cód. Imóvel</th><th>Nome</th><th>Matrícula</th><th>Município</th><th>Status</th><th>Área Sobreposta</th></tr>
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
            <h1>Longitude Geo Intelligence</h1>
            <p>Regularização Fundiária • SIGEF • CAR • INTERMAT</p>
          </div>
        </div>

        <nav className="nav">
          <button className={tela === "dashboard" ? "active" : ""} onClick={() => setTela("dashboard")}>🏠 Dashboard</button>
          <button className={tela === "analise" ? "active" : ""} onClick={() => setTela("analise")}>🗺️ Análise Territorial</button>
          <button className={tela === "clientes" ? "active" : ""} onClick={() => setTela("clientes")}>👤 Clientes</button>
          <button className={tela === "imoveis" ? "active" : ""} onClick={() => setTela("imoveis")}>🏡 Imóveis</button>
          <button className={tela === "integracoes" ? "active" : ""} onClick={() => setTela("integracoes")}>📍 SIGEF / CAR / INTERMAT</button>
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
          <button className="report-button" onClick={() => baixarRelatorio()}>Gerar relatório</button>
        </header>

        {tela === "dashboard" && (
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

        {tela === "clientes" && (
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

        {tela === "imoveis" && (
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

        {tela === "relatorios" && (
          <section className="page">
            <div className="panel">
              <h3>Relatórios disponíveis</h3>
              <TabelaAnalises analises={dados.analises} onRelatorio={baixarRelatorio} />
            </div>
          </section>
        )}

        {tela === "propostas" && (
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

        {tela === "config" && (
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
