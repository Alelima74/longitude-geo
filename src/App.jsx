import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-draw";
import * as toGeoJSON from "@tmcw/togeojson";
import * as turf from "@turf/turf";
import * as shpwrite from "@mapbox/shp-write";
import logoLongitude from "./assets/logo-longitude.png";

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

export default function App() {
  const mapRef = useRef(null);
  const geoLayerRef = useRef(null);
  const consultaLayerRef = useRef(null);
  const baseLayersRef = useRef({});
  const currentBaseLayerRef = useRef(null);
  const drawnItemsRef = useRef(null);

  const [tela, setTela] = useState("analise");
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
  const [sigefLocalGeojson, setSigefLocalGeojson] = useState(null);
  const [sigefLocalNome, setSigefLocalNome] = useState("");
  const [sigefLocalInfo, setSigefLocalInfo] = useState("");
  const [ultimoCruzamento, setUltimoCruzamento] = useState(null);
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
    drawnItemsRef.current = null;
    currentBaseLayerRef.current = null;

    const map = L.map("map", { zoomControl: false }).setView([-15.601, -56.097], 6);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const mapaPadrao = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 20,
    });

    const mapaSatelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles © Esri",
      maxZoom: 20,
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
      const registroM = limparUuidSigef(resumo.registro_m);
      const nomeArea = normalizarComparacao(resumo.nome_area);

      let bateu = false;

      if (parcela && parcela === codigoUuid) bateu = true;
      if (!bateu && codigoImo && codigoImo === codigoUuid) bateu = true;
      if (!bateu && registroM && registroM === codigoUuid) bateu = true;
      if (!bateu && codigoTexto && nomeArea && nomeArea.includes(codigoTexto)) bateu = true;

      if (!bateu) {
        for (const valor of Object.values(props)) {
          const vUuid = limparUuidSigef(valor);
          const vTexto = normalizarComparacao(valor);
          if (vUuid && vUuid === codigoUuid) { bateu = true; break; }
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

            resultados.push({
              id: `${item.origem}-${resultados.length + 1}`,
              origem: item.origem,
              codigo: atributos.codigo,
              sncr: atributos.sncr,
              nome: atributos.nome,
              matricula: atributos.matricula,
              municipio: atributos.municipio,
              status: atributos.status,
              areaParcelaHa: Number(areaParcelaHa.toFixed(4)),
              areaSobrepostaHa: Number(areaSobreposta.toFixed(4)),
              percentualSobreBase: Number(((areaSobreposta / areaBaseHa) * 100).toFixed(4)),
              percentualSobreParcela: areaParcelaHa > 0 ? Number(((areaSobreposta / areaParcelaHa) * 100).toFixed(4)) : 0,
            });

            for (const geom of partesIntersecao) {
              geometriasIntersecao.push({
                ...geom,
                properties: {
                  origem: item.origem,
                  codigo: atributos.codigo,
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
          intersecoes: { type: "FeatureCollection", features: geometriasIntersecao },
        };

        setAnaliseSobreposicao(resumo);

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

  async function logoComoDataUrl() {
    try {
      const resposta = await fetch(logoLongitude);
      const blob = await resposta.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  }

  async function exportarRelatorioWordSobreposicao() {
    if (!analiseSobreposicao) {
      alert("Execute primeiro a análise de sobreposição.");
      return;
    }

    const logo = await logoComoDataUrl();
    const linhas = analiseSobreposicao.resultados.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.origem}</td>
        <td>${r.codigo}</td>
        <td>${r.sncr}</td>
        <td>${r.nome}</td>
        <td>${r.matricula}</td>
        <td>${r.municipio}</td>
        <td>${r.status}</td>
        <td>${numeroBR(r.areaParcelaHa)}</td>
        <td>${numeroBR(r.areaSobrepostaHa)}</td>
        <td>${numeroBR(r.percentualSobreBase, 2)}%</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Relatório de Análise de Sobreposição</title>
<style>
  body { font-family: Arial, sans-serif; color: #1f2933; }
  .cabecalho { display: flex; align-items: center; border-bottom: 3px solid #003b5c; padding-bottom: 12px; margin-bottom: 22px; }
  .cabecalho img { width: 110px; height: auto; margin-right: 18px; }
  h1 { color: #003b5c; font-size: 22px; margin: 0; }
  h2 { color: #003b5c; font-size: 16px; margin-top: 22px; }
  .sub { color: #3d8b37; font-weight: bold; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #003b5c; color: white; padding: 6px; border: 1px solid #cbd5e1; }
  td { padding: 5px; border: 1px solid #cbd5e1; vertical-align: top; }
  .resumo td { font-size: 12px; }
  .nota { font-size: 11px; color: #475569; margin-top: 18px; }
  .assinatura { margin-top: 60px; }
</style>
</head>
<body>
  <div class="cabecalho">
    ${logo ? `<img src="${logo}" />` : ""}
    <div>
      <h1>RELATÓRIO DE ANÁLISE DE SOBREPOSIÇÃO</h1>
      <div class="sub">Longitude Assessoria Rural e Urbano</div>
    </div>
  </div>

  <h2>1. Identificação</h2>
  <table class="resumo">
    <tr><td><b>Data da análise</b></td><td>${analiseSobreposicao.data}</td></tr>
    <tr><td><b>Área do perímetro analisado</b></td><td>${numeroBR(analiseSobreposicao.areaBaseHa)} ha</td></tr>
    <tr><td><b>Área total sobreposta</b></td><td>${numeroBR(analiseSobreposicao.totalSobrepostoHa)} ha</td></tr>
    <tr><td><b>Percentual sobre o perímetro</b></td><td>${numeroBR(analiseSobreposicao.percentualTotal, 2)}%</td></tr>
    <tr><td><b>Quantidade de sobreposições</b></td><td>${analiseSobreposicao.quantidade}</td></tr>
  </table>

  <h2>2. Bases analisadas</h2>
  <p>Foram consideradas as feições carregadas/consultadas no sistema Longitude Geo Intelligence, incluindo base SIGEF local importada, CAR/SICAR consultado e demais perímetros disponíveis no momento da análise.</p>

  <h2>3. Quadro de sobreposições identificadas</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Origem</th><th>Código</th><th>SNCR/Código Imóvel</th><th>Nome</th><th>Matrícula</th><th>Município</th><th>Status</th><th>Área Parcela (ha)</th><th>Sobreposição (ha)</th><th>% sobre perímetro</th>
      </tr>
    </thead>
    <tbody>${linhas || `<tr><td colspan="11">Nenhuma sobreposição identificada.</td></tr>`}</tbody>
  </table>

  <h2>4. Conclusão técnica preliminar</h2>
  <p>Após o cruzamento espacial realizado, foram identificadas as sobreposições descritas no quadro acima. Este relatório possui caráter técnico preliminar e deve ser validado com conferência da origem, data de atualização das bases, sistema de referência geodésico e documentação dominial/cadastral do imóvel.</p>

  <p class="nota">Observação: o cálculo foi realizado em ambiente web com base nas geometrias carregadas no sistema. Para uso cartorial, judicial ou bancário, recomenda-se conferência em ambiente SIG profissional e emissão com assinatura técnica.</p>

  <div class="assinatura">
    <p>______________________________________________</p>
    <p><b>Alexandre Magno Gomes de Lima</b><br/>Longitude Assessoria Rural e Urbano</p>
  </div>
</body>
</html>`;

    salvarArquivo("Relatorio_Sobreposicao_Longitude.doc", html, "application/msword;charset=utf-8");
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
              {dados.imoveis.length === 0 ? <p className="muted">Nenhum imóvel salvo ainda.</p> : dados.imoveis.map((i) => (
                <div className="list-item" key={i.id}>
                  <strong>{i.nome}</strong>
                  <span>{i.municipio || "Município não informado"} • {Number(i.areaHa).toLocaleString("pt-BR")} ha</span>
                  <small>Matrícula: {i.matricula || "não informada"} | CAR: {i.car || "não informado"} | SIGEF: {i.sigef || "não informado"}</small>
                </div>
              ))}
            </div>
          </section>
        )}

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
                      <div className="mini-head"><span>Origem</span><span>Código</span><span>Nome</span><span>Sobrep. ha</span><span>%</span></div>
                      {analiseSobreposicao.resultados.slice(0, 20).map((r) => (
                        <div className="mini-row" key={r.id}>
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
