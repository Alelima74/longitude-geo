import React, { useMemo, useState } from "react";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import "./technical-pieces.css";
import { registryDelete, registryList, registryMode, registryUpsert } from "../../core/registry/registryApi";
import { searchConfrontants, searchOwners, searchProperties, masterDataMode } from "../../core/masterData/masterDataApi";
import { fillDocxTemplate } from "../../core/templates/docxTemplateEngine";

const STORAGE_KEY = "longitude_geo_technical_processes_v73";
const PROCEDURES = [
  "Averbação de georreferenciamento",
  "Retificação de área",
  "Desmembramento",
  "Remembramento",
  "Reconhecimento de limites",
];
const DOCUMENTS = [
  { id: "memorial", label: "Memorial descritivo", source: "Modelo Fazenda Nascimento" },
  { id: "limites", label: "Declaração de reconhecimento de limites", source: "Modelo Fazenda Aguassu" },
  { id: "requerimento", label: "Requerimento de retificação/averbação", source: "Modelo Renan" },
  { id: "quadro", label: "Quadro de confrontantes", source: "Modelo Longitude aprimorado" },
];

const EMPTY = {
  id: "",
  name: "",
  procedure: "Averbação de georreferenciamento",
  propertyName: "",
  ownerName: "",
  ownerDocument: "",
  ownerRg: "",
  ownerQualification: "",
  ownerAddress: "",
  spouseName: "",
  spouseDocument: "",
  spouseRg: "",
  registration: "",
  cns: "",
  sncr: "",
  sigefCode: "",
  municipality: "",
  state: "MT",
  areaHa: "",
  perimeterM: "",
  datum: "SIRGAS2000",
  registryOffice: "",
  technicalResponsible: "Alexandre Magno Gomes de Lima",
  technicalRg: "729451-4 SSP-MT",
  technicalCpf: "495.391.401-53",
  professionalRegistry: "CFT 49539140153/MT",
  credentialCode: "G61",
  trt: "",
  observations: "",
  documents: ["memorial", "limites", "requerimento", "quadro"],
  neighbors: [],
  updatedAt: "",
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function loadProcesses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveProcesses(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function safeFile(value, fallback = "documento") {
  return String(value || fallback)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
}
function p(text = "", options = {}) {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : options.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    heading: options.heading,
    spacing: { after: options.after ?? 120, line: options.line ?? 276 },
    children: [new TextRun({ text: String(text), bold: !!options.bold, size: options.size || 22 })],
  });
}
function field(label, value) {
  return new TableRow({
    children: [
      new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, children: [p(label, { bold: true, after: 0 })] }),
      new TableCell({ width: { size: 68, type: WidthType.PERCENTAGE }, children: [p(value || "-", { after: 0 })] }),
    ],
  });
}
function tableFields(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([a, b]) => field(a, b)),
  });
}
function formatDate() {
  return new Date().toLocaleDateString("pt-BR");
}

async function docxBlob(document) {
  return Packer.toBlob(document);
}

function memorialDocument(data) {
  const neighborParagraphs = data.neighbors.length
    ? data.neighbors.map((n, index) =>
        p(
          `${index === 0 ? "Inicia-se a descrição deste perímetro" : "Deste"}, seguindo confrontando com ${n.propertyName || "-"}, matrícula nº ${n.registration || "-"}, CNS ${n.cns || "-"}, cadastrado no INCRA sob nº ${n.incraCode || "-"}, certificação SIGEF ${n.sigefCode || "-"}, de propriedade ou posse de ${n.name || "-"}, CPF/CNPJ nº ${n.document || "-"}, no trecho compreendido entre os vértices ${n.startVertex || "-"} e ${n.endVertex || "-"}, limite caracterizado como ${n.boundaryType || "não informado"}, com extensão de ${n.lengthM || "-"} m.`,
          { justify: true }
        )
      )
    : [p("Os confrontantes e os trechos técnicos deverão ser complementados a partir da geometria vinculada ao processo.", { justify: true })];

  return new Document({
    sections: [{
      children: [
        p("M E M O R I A L  D E S C R I T I V O", { center: true, bold: true, size: 30 }),
        p("LONGITUDE ASSESSORIA RURAL", { center: true, bold: true, size: 23, after: 0 }),
        p("ALEXANDRE M G LIMA - ME", { center: true, bold: true, size: 21, after: 0 }),
        p("AVENIDA GENERAL MELO, 3206 - PRAEIRO - CUIABÁ/MT", { center: true, size: 18, after: 0 }),
        p("longitudecba@gmail.com", { center: true, size: 18, after: 220 }),
        tableFields([
          ["Imóvel", data.propertyName],
          ["Comarca/Município", `${data.municipality || "-"}-${data.state || "-"}`],
          ["Proprietário", data.ownerName],
          ["Matrícula", data.registration],
          ["Código SNCR", data.sncr],
          ["Código SIGEF", data.sigefCode],
          ["Área SGL (ha)", data.areaHa],
          ["Perímetro (m)", data.perimeterM],
        ]),
        p("CAMINHAMENTO DO PERÍMETRO", { center: true, bold: true, size: 24, after: 180 }),
        ...neighborParagraphs,
        p(`Todas as coordenadas aqui descritas estão georreferenciadas ao Sistema Geodésico Brasileiro, tendo como datum o ${data.datum || "SIRGAS2000"}. A área deverá ser obtida pelas coordenadas cartesianas locais, referenciada ao Sistema Geodésico Local (SGL-SIGEF). Os azimutes, perímetro e distâncias deverão ser calculados conforme os dados técnicos vinculados ao processo.`, { justify: true }),
        p("Observações:", { bold: true, after: 40 }),
        p("A planta anexa é parte integrante deste memorial descritivo.", { justify: true }),
        p(`${data.municipality || "Cuiabá"}-${data.state || "MT"}, ${formatDate()}.`, { after: 340 }),
        p("__________________________________", { center: true, after: 0 }),
        p(data.technicalResponsible || "Alexandre Magno Gomes de Lima", { center: true, bold: true, after: 0 }),
        p("Técnico em Agrimensura", { center: true, after: 0 }),
        p(`${data.professionalRegistry || "-"} • TRT nº ${data.trt || "-"} • Credenciamento INCRA: ${data.credentialCode || "-"}`, { center: true }),
      ],
    }],
  });
}

function limitDeclarationDocument(data, neighbor) {
  return new Document({
    sections: [{
      children: [
        p("Longitude Assessoria Rural, Agrária e Urbano", { bold: true, size: 23, after: 0 }),
        p("CNPJ: 15.493.259/0002-70", { size: 18, after: 0 }),
        p("Email: longitudecba@gmail.com", { size: 18, after: 180 }),
        p("Declaração de Reconhecimento de Limite", { center: true, bold: true, size: 30, after: 200 }),
        p(`Propriedade denominada '${data.propertyName || "-"}', matrícula ${data.registration || "-"}, propriedade de ${data.ownerName || "-"}.`, { justify: true }),
        p(`Área certificada no SIGEF sob o código: ${data.sigefCode || "-"}.`, { justify: true }),
        p(`Confrontante: ${neighbor?.name || "-"}. Imóvel confrontante: ${neighbor?.propertyName || "-"}.`, { justify: true }),
        p(`Por um lado, ${data.ownerName || "-"}, inscrito no CPF/CNPJ sob nº ${data.ownerDocument || "-"}, adiante denominado Proprietário; considerando que é legítimo possuidor ou detentor dos direitos dominiais relativos ao imóvel rural denominado ${data.propertyName || "-"}, registrado sob matrícula nº ${data.registration || "-"}, CNS ${data.cns || "-"}, cadastrado no INCRA sob o código nº ${data.sncr || "-"}; e, do outro lado, ${neighbor?.name || "-"}, CPF/CNPJ nº ${neighbor?.document || "-"}, na qualidade de proprietário ou possuidor do imóvel rural denominado ${neighbor?.propertyName || "-"}, matrícula nº ${neighbor?.registration || "-"}, CNS ${neighbor?.cns || "-"}, adiante denominado Confrontante.`, { justify: true }),
        p(`Considerando que o Confrontante foi informado e teve acesso aos dados da planta e do memorial descritivo referentes ao imóvel ${data.propertyName || "-"}, preparados pelo credenciado ${data.technicalResponsible || "-"} (${data.credentialCode || "-"}), concorda expressamente com as informações contidas nos documentos mencionados, especialmente quanto ao trecho de confrontação com o imóvel de sua propriedade ou posse.`, { justify: true }),
        p(`Por este instrumento, declara formalmente que não existem controvérsias ou litígios referentes aos limites comuns entre os imóveis mencionados. O trecho confrontante está compreendido entre os vértices ${neighbor?.startVertex || "-"} e ${neighbor?.endVertex || "-"}, com extensão de ${neighbor?.lengthM || "-"} m e tipo de limite ${neighbor?.boundaryType || "-"}.`, { justify: true }),
        new Paragraph({ children: [new PageBreak()] }),
        p("Representação Gráfica do Limite", { center: true, bold: true, size: 28, after: 180 }),
        tableFields([
          ["Denominação", data.propertyName],
          ["Matrícula do imóvel", data.registration],
          ["Área geodésica local", data.areaHa],
          ["Proprietário", data.ownerName],
          ["Identificação", data.ownerDocument],
          ["Confrontante", neighbor?.name],
          ["CPF/CNPJ", neighbor?.document],
          ["Imóvel confrontante", neighbor?.propertyName],
          ["Matrícula confrontante", neighbor?.registration],
          ["CNS", neighbor?.cns],
          ["Código INCRA", neighbor?.incraCode],
          ["Certificação SIGEF", neighbor?.sigefCode],
          ["Trecho confrontante", `${neighbor?.startVertex || "-"} a ${neighbor?.endVertex || "-"}`],
          ["Extensão", neighbor?.lengthM],
        ]),
        p("CROQUI DO TRECHO CONFRONTANTE", { center: true, bold: true, size: 22, after: 80 }),
        p("[O croqui será inserido automaticamente quando o processo estiver vinculado à geometria da Cloud.]", { center: true, after: 300 }),
        p("Declaro que minha concordância está estritamente delimitada à descrição apresentada na planta e no memorial técnico.", { justify: true }),
        p("___________________________________________", { center: true, after: 0 }),
        p(neighbor?.name || "CONFRONTANTE", { center: true, bold: true, after: 0 }),
        p(`CPF/CNPJ: ${neighbor?.document || "-"}`, { center: true }),
        new Paragraph({ children: [new PageBreak()] }),
        p(`${data.municipality || "Cuiabá"}-${data.state || "MT"}, ${formatDate()}.`, { after: 320 }),
        p("_______________________________", { center: true, after: 0 }),
        p("Proprietário", { center: true, after: 0 }),
        p(data.ownerName || "-", { center: true, bold: true, after: 0 }),
        p(`CPF/CNPJ nº ${data.ownerDocument || "-"}`, { center: true, after: 260 }),
        p("_______________________________", { center: true, after: 0 }),
        p("Confrontante Proprietário(a)", { center: true, after: 0 }),
        p(neighbor?.name || "-", { center: true, bold: true, after: 0 }),
        p(`CPF/CNPJ nº ${neighbor?.document || "-"}`, { center: true, after: 260 }),
        p("_______________________________", { center: true, after: 0 }),
        p("Credenciado como testemunha:", { center: true, after: 0 }),
        p(data.technicalResponsible || "-", { center: true, bold: true, after: 0 }),
        p(`Técnico em Agrimensura • ${data.professionalRegistry || "-"} • Código ${data.credentialCode || "-"}`, { center: true }),
      ],
    }],
  });
}

function requestDocument(data) {
  return new Document({
    sections: [{
      children: [
        p("LONGITUDE ASSESSORIA RURAL", { center: true, bold: true, size: 22, after: 0 }),
        p("ALEXANDRE M G LIMA - ME", { center: true, bold: true, size: 20, after: 0 }),
        p("AVENIDA GENERAL MELO, 3206 - PRAEIRO - CUIABÁ/MT", { center: true, size: 18, after: 0 }),
        p("longitudecba@gmail.com", { center: true, size: 18, after: 200 }),
        p(`REQUERIMENTO ${data.procedure.toUpperCase()}`, { center: true, bold: true, size: 29, after: 220 }),
        p(`Eu, ${data.ownerName || "-"}, inscrito no CPF/CNPJ sob nº ${data.ownerDocument || "-"}, na qualidade de proprietário(a) ou interessado(a), venho, por meio deste, requerer ${data.procedure.toLowerCase()} do imóvel rural denominado ${data.propertyName || "-"}, matrícula nº ${data.registration || "-"}, CNS ${data.cns || "-"}, cadastrado no INCRA sob o código nº ${data.sncr || "-"}, conforme levantamento topográfico e georreferenciamento realizado.`, { justify: true }),
        p("O pedido é formulado nos termos do art. 213, inciso II, da Lei nº 6.015/1973, da Lei nº 10.267/2001 e do Decreto nº 4.449/2002, observadas as normas técnicas aplicáveis ao georreferenciamento de imóveis rurais.", { justify: true }),
        p("As divisas foram respeitadas, sem alteração deliberada dos limites nem prejuízo aos direitos dos confrontantes. Declara-se serem verdadeiras as informações prestadas e que os documentos técnicos anexos representam o levantamento realizado por profissional legalmente habilitado.", { justify: true }),
        p("JUSTIFICATIVA TÉCNICA", { center: true, bold: true, size: 23, after: 100 }),
        p(data.observations || "A divergência eventualmente existente entre a descrição registral e a área tecnicamente apurada decorre da evolução dos métodos de levantamento e da necessidade de adequação da descrição do imóvel à realidade física atualmente identificada.", { justify: true }),
        p(`O imóvel apresenta área apurada de ${data.areaHa || "-"} ha e perímetro de ${data.perimeterM || "-"} m, com certificação SIGEF ${data.sigefCode || "-"}.`, { justify: true }),
        p("Seguem anexas a planta, o memorial descritivo, o documento de responsabilidade técnica e os demais documentos necessários para a qualificação registral.", { justify: true }),
        p("Termos em que, pede deferimento.", { after: 300 }),
        p(`${data.municipality || "Cuiabá"}-${data.state || "MT"}, ${formatDate()}.`, { after: 360 }),
        p("_________________________________________________", { center: true, after: 0 }),
        p(data.ownerName || "PROPRIETÁRIO(A)", { center: true, bold: true }),
      ],
    }],
  });
}

function neighborsTableDocument(data) {
  const header = new TableRow({
    children: ["Confrontante", "CPF/CNPJ", "Imóvel", "Matrícula/CNS", "INCRA", "SIGEF", "CAR", "Município/UF", "Trecho", "Tipo", "Extensão", "Observações"].map(text =>
      new TableCell({ children: [p(text, { bold: true, after: 0 })] })
    ),
  });
  const rows = data.neighbors.map(n => new TableRow({
    children: [
      n.name || "-", n.document || "-", n.propertyName || "-", [n.registration, n.cns].filter(Boolean).join(" / ") || "-",
      n.incraCode || "-", n.sigefCode || "-", n.carCode || "-", `${n.municipality || "-"} / ${n.state || "-"}`,
      `${n.startVertex || "-"} a ${n.endVertex || "-"}`, n.boundaryType || "-", n.lengthM ? `${n.lengthM} m` : "-", n.notes || "-"
    ].map(text => new TableCell({ children: [p(text, { after: 0 })] })),
  }));
  return new Document({
    sections: [{
      children: [
        p("QUADRO DE CONFRONTANTES", { center: true, bold: true, size: 30, after: 220 }),
        p(`Imóvel: ${data.propertyName || "-"} • Matrícula: ${data.registration || "-"}`, { after: 180 }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }),
      ],
    }],
  });
}

export default function TechnicalPiecesModule() {
  const [processes, setProcesses] = useState(loadProcesses);
  const [form, setForm] = useState({ ...EMPTY, id: uid(), updatedAt: new Date().toISOString() });
  const [neighbor, setNeighbor] = useState({ id: "", name: "", document: "", propertyName: "", registration: "", cns: "", incraCode: "", sigefCode: "", carCode: "", municipality: "", state: "MT", startVertex: "", endVertex: "", lengthM: "", boundaryType: "", notes: "" });
  const [tab, setTab] = useState("process");
  const [message, setMessage] = useState("");
  const [editingNeighborId, setEditingNeighborId] = useState("");
  const [registrySearch, setRegistrySearch] = useState("");
  const [registryRows, setRegistryRows] = useState([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerMatches, setOwnerMatches] = useState([]);
  const [propertySearch, setPropertySearch] = useState("");
  const [propertyMatches, setPropertyMatches] = useState([]);
  const [masterLoading, setMasterLoading] = useState(false);

  const selectedDocs = useMemo(
    () => DOCUMENTS.filter(d => form.documents.includes(d.id)),
    [form.documents]
  );

  async function searchOwnerByDocument() {
    const term = ownerSearch.replace(/\D/g, "");
    if (!term) return setMessage("Informe o CPF ou CNPJ para pesquisar.");
    setMasterLoading(true);
    try {
      const matches = await searchOwners(term);
      setOwnerMatches(matches);
      setMessage(matches.length ? `${matches.length} proprietário(s) encontrado(s).` : "Nenhum proprietário encontrado. Cadastre os dados abaixo.");
    } catch (error) {
      setMessage(`Não foi possível pesquisar proprietários: ${error.message}`);
    } finally {
      setMasterLoading(false);
    }
  }

  function useOwner(item) {
    update("ownerName", item.name || "");
    update("ownerDocument", item.document || "");
    setOwnerMatches([]);
    setOwnerSearch(item.document || "");
    setMessage("Proprietário existente vinculado ao processo.");
  }

  async function searchProperties() {
    const term = propertySearch.trim().toLowerCase();
    if (!term) return setMessage("Digite parte do nome da fazenda.");
    setMasterLoading(true);
    try {
      const matches = await searchProperties(term);
      setPropertyMatches(matches);
      setMessage(matches.length ? `${matches.length} imóvel(is) encontrado(s).` : "Nenhum imóvel encontrado.");
    } catch (error) {
      setMessage(`Não foi possível pesquisar imóveis: ${error.message}`);
    } finally {
      setMasterLoading(false);
    }
  }

  function useProperty(item) {
    setForm((current) => ({
      ...current,
      propertyName: item.name || "",
      registration: item.registration || "",
      cns: item.cns || "",
      sncr: item.sncr || "",
      sigefCode: item.sigef_code || "",
      municipality: item.municipality || "",
      state: item.state || "MT",
      areaHa: item.area_ha || "",
      perimeterM: item.perimeter_m || "",
      updatedAt: new Date().toISOString(),
    }));
    setPropertyMatches([]);
    setPropertySearch(item.name || "");
    setMessage("Imóvel cadastrado carregado no processo.");
  }

  function update(key, value) {
    setForm(prev => ({ ...prev, [key]: value, updatedAt: new Date().toISOString() }));
  }
  function saveProcess() {
    const next = [form, ...processes.filter(p => p.id !== form.id)];
    setProcesses(next);
    saveProcesses(next);
    setMessage("Processo salvo localmente.");
  }
  function newProcess() {
    setForm({ ...EMPTY, id: uid(), updatedAt: new Date().toISOString() });
    setMessage("");
    setTab("process");
  }
  function loadProcess(item) {
    setForm({ ...EMPTY, ...item });
    setTab("process");
    setMessage(`Processo “${item.name || item.propertyName}” carregado.`);
  }
  function deleteProcess(id) {
    const next = processes.filter(p => p.id !== id);
    setProcesses(next);
    saveProcesses(next);
    if (form.id === id) newProcess();
  }
  async function searchNeighborRegistry() {
    setRegistryLoading(true);
    try {
      setRegistryRows(await searchConfrontants(registrySearch));
      setMessage(`Consulta realizada em ${masterDataMode()}.`);
    } catch (error) {
      setMessage(`Falha ao buscar confrontantes: ${error.message}`);
    } finally {
      setRegistryLoading(false);
    }
  }

  async function addNeighbor() {
    if (!neighbor.name && !neighbor.propertyName) {
      setMessage("Informe o nome do confrontante ou o imóvel confrontante.");
      return;
    }

    const nextNeighbor = {
      ...neighbor,
      id: editingNeighborId || neighbor.id || uid(),
    };

    const nextNeighbors = editingNeighborId
      ? form.neighbors.map((item) => item.id === editingNeighborId ? nextNeighbor : item)
      : [...form.neighbors, nextNeighbor];

    update("neighbors", nextNeighbors);
    setEditingNeighborId("");
    setNeighbor({ id: "", name: "", document: "", propertyName: "", registration: "", cns: "", incraCode: "", sigefCode: "", carCode: "", municipality: "", state: "MT", startVertex: "", endVertex: "", lengthM: "", boundaryType: "", notes: "" });

    try {
      await registryUpsert("cad_confrontantes", {
        id: nextNeighbor.registry_id || nextNeighbor.id,
        nome: nextNeighbor.name,
        documento: nextNeighbor.document,
        imovel: nextNeighbor.propertyName,
        matricula: nextNeighbor.registration,
        cns: nextNeighbor.cns,
        codigo_incra: nextNeighbor.incraCode,
        codigo_sigef: nextNeighbor.sigefCode,
        codigo_car: nextNeighbor.carCode,
        municipio: nextNeighbor.municipality,
        uf: nextNeighbor.state,
        observacoes: nextNeighbor.notes,
      });
      setMessage(editingNeighborId ? "Confrontante alterado e atualizado no cadastro." : "Confrontante adicionado e salvo no cadastro.");
    } catch (error) {
      setMessage(`Confrontante incluído no processo, mas não foi possível atualizar o cadastro: ${error.message}`);
    }
  }

  function editNeighbor(item) {
    setEditingNeighborId(item.id);
    setNeighbor({ ...item });
    setMessage(`Editando confrontante: ${item.name || item.propertyName}.`);
  }

  function useRegistryNeighbor(item) {
    setEditingNeighborId("");
    setNeighbor({
      id: "",
      registry_id: item.id,
      name: item.nome || "",
      document: item.documento || "",
      propertyName: item.imovel || "",
      registration: item.matricula || "",
      cns: item.cns || "",
      incraCode: item.codigo_incra || "",
      sigefCode: item.codigo_sigef || "",
      carCode: item.codigo_car || "",
      municipality: item.municipio || "",
      state: item.uf || "MT",
      startVertex: "",
      endVertex: "",
      lengthM: "",
      boundaryType: "",
      notes: item.observacoes || "",
    });
    setMessage("Cadastro carregado. Complete os dados do trecho e clique em Adicionar confrontante.");
  }

  function removeNeighbor(id) {
    update("neighbors", form.neighbors.filter(n => n.id !== id));
    if (editingNeighborId === id) {
      setEditingNeighborId("");
      setNeighbor({ id: "", name: "", document: "", propertyName: "", registration: "", cns: "", incraCode: "", sigefCode: "", carCode: "", municipality: "", state: "MT", startVertex: "", endVertex: "", lengthM: "", boundaryType: "", notes: "" });
    }
  }
  function toggleDocument(id) {
    update("documents", form.documents.includes(id) ? form.documents.filter(x => x !== id) : [...form.documents, id]);
  }

  function values(n={}) {
    return {
      IMOVEL: form.propertyName || "-",
      PROPRIETARIO: form.ownerName || "-",
      CPF_PROPRIETARIO: form.ownerDocument || "-",
      RG_PROPRIETARIO: form.ownerRg || "-",
      QUALIFICACAO_PROPRIETARIO: form.ownerQualification || "brasileiro(a)",
      CONJUGE: form.spouseName || "-",
      CPF_CONJUGE: form.spouseDocument || "-",
      RG_CONJUGE: form.spouseRg || "-",
      ENDERECO: form.ownerAddress || "-",
      MATRICULA: form.registration || "-",
      CNS: form.cns || "-",
      SNCR: form.sncr || "-",
      SIGEF: form.sigefCode || "-",
      MUNICIPIO_UF: `${form.municipality || "-"}/${form.state || "-"}`,
      AREA_HA: form.areaHa || "-",
      PERIMETRO_M: form.perimeterM || "-",
      RESP_TECNICO: form.technicalResponsible || "-",
      REGISTRO_PROF: form.professionalRegistry || "-",
      REGISTRO_PROF_NUM: String(form.professionalRegistry || "").replace(/\D/g, ""),
      CREDENCIAMENTO: form.credentialCode || "-",
      TRT: form.trt || "-",
      RG_TECNICO: form.technicalRg || "-",
      CPF_TECNICO: form.technicalCpf || "-",
      LOCAL_DATA: `${form.municipality || "Cuiabá"}-${form.state || "MT"}, ${new Date().toLocaleDateString("pt-BR",{dateStyle:"long"})}.`,
      DESCRICAO_PARCELA: (form.neighbors || []).map((x,i) => `${i ? "Deste" : "Inicia-se a descrição deste perímetro"}, no vértice ${x.startVertex || "-"}, seguindo confrontando com ${x.name || "-"}, imóvel ${x.propertyName || "-"}, matrícula ${x.registration || "-"}, com azimute ${x.azimuth || "-"} e distância ${x.lengthM || "-"} m até o vértice ${x.endVertex || "-"}.`).join("\n") || "Descrição técnica pendente de vinculação aos vértices.",
      CONFRONTANTE: n.name || "-",
      CPF_CONFRONTANTE: n.document || "-",
      RG_CONFRONTANTE: n.rg || "-",
      QUALIFICACAO_CONFRONTANTE: n.qualification || "brasileiro(a)",
      IMOVEL_CONFRONTANTE: n.propertyName || "-",
      MATRICULA_CONFRONTANTE: n.registration || "-",
      CARTORIO: form.registryOffice || "Registro de Imóveis competente",
      CARTORIO_CONFRONTANTE: n.registryOffice || "-",
      SITUACAO_CONFRONTANTE: n.status || "Registrada",
      VERTICE_INICIAL: n.startVertex || "-",
      VERTICE_FINAL: n.endVertex || "-",
      DISTANCIA: n.lengthM || "-",
      AZIMUTE: n.azimuth || "-",
      LONGITUDE: n.longitude || "-",
      LATITUDE: n.latitude || "-",
      ALTITUDE: n.altitude || "-",
      ESCALA: n.scale || "Automática",
      CROQUI_IMAGEM: "Croqui vinculado à geometria do processo",
      LOCAL_IMOVEL: `${form.municipality || "-"}-${form.state || "-"}`,
      COMARCA: `${form.municipality || "-"}-${form.state || "-"}`,
      CAMINHAMENTO: (form.neighbors || []).map((x,i)=>({texto:`${i ? "Deste" : "Inicia-se a descrição deste perímetro"}, no vértice ${x.startVertex || "-"}, seguindo confrontando com ${x.name || "-"}, imóvel ${x.propertyName || "-"}, matrícula ${x.registration || "-"}, CNS ${x.cns || "-"}, código INCRA ${x.incraCode || "-"}, certificação SIGEF ${x.sigefCode || "-"}, com azimute ${x.azimuth || "-"} e distância ${x.lengthM || "-"} m até o vértice ${x.endVertex || "-"}.`}))
    };
  }

  async function downloadTemplate(url, name, data, documentLabel) {
    try {
      const blob = await fillDocxTemplate(url, data);
      saveBlob(blob, name);
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (error) {
      throw new Error(`${documentLabel}: ${error.message}`);
    }
  }

  async function generatePackage() {
    if (!form.propertyName) {
      setMessage("Selecione ou informe o imóvel.");
      return;
    }
    setMessage("Gerando documentos pelos modelos reais...");
    try {
      let count = 0;
      const prefix = `Longitude_${safeFile(form.propertyName)}_`;
      if (form.documents.includes("memorial")) {
        await downloadTemplate(
          "/templates/MODELO_MEMORIAL_ORIGINAL.docx",
          `${prefix}01_Memorial_Descritivo.docx`,
          values(),
          "Memorial Descritivo"
        );
        count += 1;
      }
      if (form.documents.includes("limites")) {
        const rows = form.neighbors.length ? form.neighbors : [{}];
        for (let i = 0; i < rows.length; i += 1) {
          await downloadTemplate(
            "/templates/MODELO_DECLARACAO_LIMITE.docx",
            `${prefix}02_Declaracao_Limite_${String(i+1).padStart(2,"0")}_${safeFile(rows[i].name || "MODELO")}.docx`,
            values(rows[i]),
            `Declaração do confrontante ${rows[i].name || i + 1}`
          );
          count += 1;
        }
      }
      if (form.documents.includes("requerimento")) {
        await downloadTemplate(
          "/templates/MODELO_REQUERIMENTO_ORIGINAL.docx",
          `${prefix}03_Requerimento_Retificacao.docx`,
          values(),
          "Requerimento de Retificação"
        );
        count += 1;
      }
      if (form.documents.includes("quadro")) {
        saveBlob(await docxBlob(neighborsTableDocument(form)), `${prefix}04_Quadro_de_Confrontantes.docx`);
        count += 1;
      }
      saveProcess();
      setMessage(`${count} documento(s) gerado(s) pelos modelos oficiais.`);
    } catch (error) {
      setMessage(`Falha ao gerar documentos: ${error.message}`);
    }
  }

  return (
    <section className="technical-module">
      <div className="technical-hero">
        <div>
          <span className="technical-version">V74.1.3 RC • Templates Corrigidos</span>
          <h2>Peças Técnicas Inteligentes</h2>
          <p>Cadastre o processo, confira os dados e gere documentos Word editáveis com poucos cliques.</p>
        </div>
        <div className="technical-actions">
          <button onClick={newProcess}>Novo processo</button>
          <button className="primary" onClick={saveProcess}>Salvar processo</button>
          <button className="primary" onClick={generatePackage}>Gerar documentos</button>
        </div>
      </div>

      <div className="technical-tabs">
        <button className={tab === "process" ? "active" : ""} onClick={() => setTab("process")}>Dados do processo</button>
        <button className={tab === "neighbors" ? "active" : ""} onClick={() => setTab("neighbors")}>Confrontantes ({form.neighbors.length})</button>
        <button className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>Documentos ({selectedDocs.length})</button>
        <button className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}>Processos salvos ({processes.length})</button>
        <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>Biblioteca de modelos</button>
      </div>

      {message && <div className="technical-message">{message}</div>}

      {tab === "process" && (
        <div className="technical-card">
          <h3>1. Localizar proprietário e imóvel</h3>

          <div className="technical-master-search">
            <div>
              <label>CPF/CNPJ do proprietário
                <div className="technical-search-line">
                  <input value={ownerSearch} onChange={(event) => setOwnerSearch(event.target.value)} placeholder="Digite o CPF ou CNPJ"/>
                  <button type="button" onClick={searchOwnerByDocument} disabled={masterLoading}>Pesquisar CPF/CNPJ</button>
                </div>
              </label>
              {ownerMatches.length > 0 && <div className="technical-match-list">
                {ownerMatches.map((item) => <button key={item.id} type="button" onClick={() => useOwner(item)}>
                  <strong>{item.name}</strong><span>{item.document || "-"} • {item.phone || "-"} • {item.email || "-"}</span>
                </button>)}
              </div>}
            </div>

            <div>
              <label>Pesquisar fazenda/imóvel
                <div className="technical-search-line">
                  <input value={propertySearch} onChange={(event) => setPropertySearch(event.target.value)} placeholder="Nome, matrícula, SIGEF, CAR ou SNCR"/>
                  <button type="button" onClick={searchProperties} disabled={masterLoading}>Pesquisar imóvel</button>
                </div>
              </label>
              {propertyMatches.length > 0 && <div className="technical-match-list">
                {propertyMatches.map((item) => <button key={item.id} type="button" onClick={() => useProperty(item)}>
                  <strong>{item.name}</strong><span>{item.municipality || "-"}/{item.state || "-"} • Matrícula {item.registration || "-"} • {item.area_ha || "-"} ha</span>
                </button>)}
              </div>}
            </div>
          </div>

          <h3>2. Dados do processo</h3>
          <div className="technical-grid">
            <label>Nome interno do processo<input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Ex.: Averbação Fazenda Nascimento"/></label>
            <label>Procedimento<select value={form.procedure} onChange={e => update("procedure", e.target.value)}>{PROCEDURES.map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Imóvel<input value={form.propertyName} onChange={e => update("propertyName", e.target.value)} /></label>
            <label>Proprietário<input value={form.ownerName} onChange={e => update("ownerName", e.target.value)} /></label>
            <label>CPF/CNPJ do proprietário<input value={form.ownerDocument} onChange={e => update("ownerDocument", e.target.value)} /></label>
            <label>Matrícula<input value={form.registration} onChange={e => update("registration", e.target.value)} /></label>
            <label>CNS<input value={form.cns} onChange={e => update("cns", e.target.value)} /></label>
            <label>SNCR<input value={form.sncr} onChange={e => update("sncr", e.target.value)} /></label>
            <label>Código SIGEF<input value={form.sigefCode} onChange={e => update("sigefCode", e.target.value)} /></label>
            <label>Município<input value={form.municipality} onChange={e => update("municipality", e.target.value)} /></label>
            <label>UF<input maxLength="2" value={form.state} onChange={e => update("state", e.target.value.toUpperCase())} /></label>
            <label>Área (ha)<input value={form.areaHa} onChange={e => update("areaHa", e.target.value)} /></label>
            <label>Perímetro (m)<input value={form.perimeterM} onChange={e => update("perimeterM", e.target.value)} /></label>
            <label>Datum<input value={form.datum} onChange={e => update("datum", e.target.value)} /></label>
            <label>Responsável técnico<input value={form.technicalResponsible} onChange={e => update("technicalResponsible", e.target.value)} /></label>
            <label>Registro profissional<input value={form.professionalRegistry} onChange={e => update("professionalRegistry", e.target.value)} /></label>
            <label>Credenciamento INCRA<input value={form.credentialCode} onChange={e => update("credentialCode", e.target.value)} /></label>
            <label>TRT<input value={form.trt} onChange={e => update("trt", e.target.value)} /></label>
          </div>
          <label className="wide">Observações e justificativa<textarea value={form.observations} onChange={e => update("observations", e.target.value)} rows="5"/></label>
        </div>
      )}

      {tab === "neighbors" && (
        <div className="technical-card">
          <h3>Cadastro de confrontantes e banco de dados</h3>
          <p className="technical-note">
            Pesquise antes de cadastrar. Registros encontrados podem ser reutilizados e os dados do trecho permanecem editáveis dentro do processo.
            Fontes pesquisadas: <strong>{masterDataMode()}</strong>.
          </p>

          <div className="technical-registry-search">
            <input
              value={registrySearch}
              onChange={(event) => setRegistrySearch(event.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, imóvel, matrícula, INCRA, SIGEF ou CAR"
            />
            <button type="button" onClick={searchNeighborRegistry} disabled={registryLoading}>
              {registryLoading ? "Buscando..." : "Buscar cadastro"}
            </button>
          </div>

          {registryRows.length > 0 && (
            <div className="technical-registry-results">
              {registryRows.map((item) => (
                <button type="button" key={item.id} onClick={() => useRegistryNeighbor(item)}>
                  <strong>{item.nome || item.imovel || "Cadastro"}</strong>
                  <span>{item.imovel || "-"} • Matrícula {item.matricula || "-"} • INCRA {item.codigo_incra || "-"}</span>
                </button>
              ))}
            </div>
          )}

          <h4>{editingNeighborId ? "Alterar confrontante cadastrado no processo" : "Adicionar confrontante ao processo"}</h4>
          <div className="technical-grid">
            <label>Nome / titular<input value={neighbor.name} onChange={e => setNeighbor({...neighbor, name:e.target.value})}/></label>
            <label>CPF/CNPJ<input value={neighbor.document} onChange={e => setNeighbor({...neighbor, document:e.target.value})}/></label>
            <label>Imóvel confrontante<input value={neighbor.propertyName} onChange={e => setNeighbor({...neighbor, propertyName:e.target.value})}/></label>
            <label>Matrícula<input value={neighbor.registration} onChange={e => setNeighbor({...neighbor, registration:e.target.value})}/></label>
            <label>CNS<input value={neighbor.cns} onChange={e => setNeighbor({...neighbor, cns:e.target.value})}/></label>
            <label>Código INCRA/SNCR<input value={neighbor.incraCode} onChange={e => setNeighbor({...neighbor, incraCode:e.target.value})}/></label>
            <label>Código da certificação SIGEF<input value={neighbor.sigefCode} onChange={e => setNeighbor({...neighbor, sigefCode:e.target.value})}/></label>
            <label>Código CAR<input value={neighbor.carCode} onChange={e => setNeighbor({...neighbor, carCode:e.target.value})}/></label>
            <label>Município<input value={neighbor.municipality} onChange={e => setNeighbor({...neighbor, municipality:e.target.value})}/></label>
            <label>UF<input maxLength="2" value={neighbor.state} onChange={e => setNeighbor({...neighbor, state:e.target.value.toUpperCase()})}/></label>
            <label>Vértice inicial<input value={neighbor.startVertex} onChange={e => setNeighbor({...neighbor, startVertex:e.target.value})}/></label>
            <label>Vértice final<input value={neighbor.endVertex} onChange={e => setNeighbor({...neighbor, endVertex:e.target.value})}/></label>
            <label>Extensão (m)<input value={neighbor.lengthM} onChange={e => setNeighbor({...neighbor, lengthM:e.target.value})}/></label>
            <label>Tipo de limite<input value={neighbor.boundaryType} onChange={e => setNeighbor({...neighbor, boundaryType:e.target.value})} placeholder="Cerca, estrada, rio..."/></label>
          </div>
          <label className="wide">Observações do confrontante/trecho<textarea rows="3" value={neighbor.notes} onChange={e => setNeighbor({...neighbor, notes:e.target.value})}/></label>

          <div className="technical-inline-actions">
            <button className="primary" type="button" onClick={addNeighbor}>
              {editingNeighborId ? "Salvar alteração" : "Adicionar confrontante"}
            </button>
            {editingNeighborId && (
              <button type="button" onClick={() => {
                setEditingNeighborId("");
                setNeighbor({ id: "", name: "", document: "", propertyName: "", registration: "", cns: "", incraCode: "", sigefCode: "", carCode: "", municipality: "", state: "MT", startVertex: "", endVertex: "", lengthM: "", boundaryType: "", notes: "" });
              }}>Cancelar edição</button>
            )}
          </div>

          <div className="technical-table-wrap">
            <table className="technical-data-table">
              <thead>
                <tr>
                  <th>#</th><th>Confrontante</th><th>CPF/CNPJ</th><th>Imóvel</th><th>Matrícula</th><th>CNS</th>
                  <th>INCRA</th><th>SIGEF</th><th>CAR</th><th>Município/UF</th><th>Trecho</th><th>Tipo</th><th>Extensão</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {form.neighbors.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td><td>{item.name || "-"}</td><td>{item.document || "-"}</td><td>{item.propertyName || "-"}</td>
                    <td>{item.registration || "-"}</td><td>{item.cns || "-"}</td><td>{item.incraCode || "-"}</td><td>{item.sigefCode || "-"}</td>
                    <td>{item.carCode || "-"}</td><td>{item.municipality || "-"} / {item.state || "-"}</td>
                    <td>{item.startVertex || "-"} → {item.endVertex || "-"}</td><td>{item.boundaryType || "-"}</td><td>{item.lengthM || "-"}</td>
                    <td><div className="technical-table-actions"><button type="button" onClick={() => editNeighbor(item)}>Alterar</button><button type="button" onClick={() => removeNeighbor(item.id)}>Excluir</button></div></td>
                  </tr>
                ))}
                {!form.neighbors.length && <tr><td colSpan="14">Nenhum confrontante cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="technical-card">
          <h3>Documentos do pacote</h3>
          <div className="technical-doc-grid">
            {DOCUMENTS.map(d => <label key={d.id} className={form.documents.includes(d.id) ? "selected" : ""}><input type="checkbox" checked={form.documents.includes(d.id)} onChange={() => toggleDocument(d.id)}/><strong>{d.label}</strong><span>Base: {d.source}</span></label>)}
          </div>
          <button className="primary large" onClick={generatePackage}>Gerar documentos Word</button>
        </div>
      )}

      {tab === "saved" && (
        <div className="technical-card">
          <h3>Processos salvos neste navegador</h3>
          <div className="technical-list">
            {processes.map(item => <div className="technical-row" key={item.id}><div><strong>{item.name || item.propertyName || "Processo sem nome"}</strong><span>{item.procedure} • {item.propertyName || "-"} • atualizado em {new Date(item.updatedAt).toLocaleString("pt-BR")}</span></div><div><button onClick={() => loadProcess(item)}>Abrir</button><button onClick={() => deleteProcess(item.id)}>Excluir</button></div></div>)}
            {!processes.length && <p>Nenhum processo salvo.</p>}
          </div>
        </div>
      )}

      {tab === "library" && (
        <div className="technical-card">
          <h3>Biblioteca inicial de modelos</h3>
          <div className="technical-library">
            <article><h4>Memorial descritivo</h4><p>Estrutura baseada no Memorial da Fazenda Nascimento, com identificação do imóvel, caminhamento, confrontações e encerramento técnico.</p></article>
            <article><h4>Declaração de limite</h4><p>Estrutura baseada na declaração da Fazenda Aguassu, gerando um documento individual para cada confrontante.</p></article>
            <article><h4>Requerimento</h4><p>Estrutura baseada no requerimento de retificação enviado, com fundamentação variável conforme o procedimento.</p></article>
            <article><h4>Folhas e padrões gráficos</h4><p>Reservado para os formatos A4, A3, A2 e A1 e para as paletas de cores enviadas. A geração CAD entra na V74.</p></article>
          </div>
        </div>
      )}
    </section>
  );
}
