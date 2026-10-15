import test from "node:test";
import assert from "node:assert/strict";
import { clientDisplayName, filterClients, mergeClients } from "../src/core/clients/clientMapper.mjs";
import { parseSigefMemorialText } from "../src/modules/geoRegistry/sigefMemorialParser.mjs";
import { enrichCalculatedSegments } from "../src/modules/geoRegistry/segmentCalculations.mjs";
import { findInLocalSigef } from "../src/modules/geoRegistry/localSigefSearch.mjs";
import { reconstructPdfLines } from "../src/modules/geoRegistry/sigefLayoutParser.mjs";
import { buildCartorialPieces } from "../src/modules/geoRegistry/cartorialPieces.mjs";
import { parseRegistryDocument } from "../src/modules/geoRegistry/registryDocumentParser.mjs";
import { assessNativeText, chooseRegistryText } from "../src/modules/geoRegistry/registryOcrPolicy.mjs";
import { canonicalSurveyGeometry, validateGeometry, verticesToFeature } from "../src/modules/geoRegistry/geometryValidationService.mjs";
import { createGeoRegistryProject } from "../src/modules/geoRegistry/geoRegistryModel.mjs";
import { buildCanonicalSegments, buildCanonicalSurveyData, groupCanonicalBoundaries, segmentSelectionId } from "../src/modules/geoRegistry/canonical/canonicalSurveyData.mjs";
import { applyMemorialData, applyRegistryData } from "../src/modules/geoRegistry/projectSourceState.mjs";
import { parseSigefSegmentRows } from "../src/modules/geoRegistry/sigefLayoutParser.mjs";
import { buildCartorialDocumentContext } from "../src/modules/geoRegistry/documents/builders/cartorialDocumentContext.mjs";
import { validateDocumentData } from "../src/modules/geoRegistry/documents/validators/documentValidators.mjs";
import { applyBoundarySupplement } from "../src/modules/geoRegistry/documents/builders/boundarySupplement.mjs";
import { updateChecklistItem } from "../src/modules/geoRegistry/documents/builders/checklistState.mjs";
import { buildPerimeterNarrative } from "../src/modules/geoRegistry/documents/builders/perimeterNarrativeBuilder.mjs";
import { buildBoundaryDocuments } from "../src/modules/geoRegistry/documents/builders/boundaryDocumentBuilder.mjs";

test("Novo Laudo reúne clientes oficiais e CadCliente preservando identidade",()=>{const rows=mergeClients([{id:"op-1",name:"Alexandre Fantini",document:"301.752.000-00",phone:"1"}],[{id:"master-1",legacy_id:"207",legacy_source:"METRICA_TOPO_MDB",type:"PJ",corporate_name:"Empresa Rural Ltda",cpf_cnpj:"12.345.678/0001-90",city:"Cuiabá",state:"MT"}]);assert.equal(rows.length,2);const legacy=rows.find(x=>x.legacyId==="207");assert.equal(legacy.origin,"CadCliente / Métrica TOPO");assert.equal(clientDisplayName(legacy),"Empresa Rural Ltda — 12.345.678/0001-90");assert.equal(filterClients(rows,"301.752")[0].id,"op-1");assert.equal(filterClients(rows,"empresa")[0].id,"master-1")});
import { confirmCartorialData } from "../src/modules/geoRegistry/documents/builders/cartorialDataPersistence.mjs";
import { listProjectsFromStorage, saveProjectToStorage } from "../src/modules/geoRegistry/geoRegistryStorageCore.mjs";
import { buildPlantLayout, generateLocationMap } from "../src/modules/geoRegistry/documents/plant/plantLayout.mjs";
import { buildPlantDxf, CAD_LAYERS, DXF_VERSION, safeCadBaseName, validatePlantDxf } from "../src/modules/geoRegistry/documents/plant/plantCadExport.mjs";
import { buildCanonicalGeometry, buildUniformPresentation, validateRigidTransform } from "../src/modules/geoRegistry/documents/plant/canonicalGeometry.mjs";
import { readFileSync } from "node:fs";
import { buildDossier, buildSpecialBoundaryReports, classifyBoundaryType, DOSSIER_DEFAULT_ORDER } from "../src/modules/geoRegistry/documents/builders/cartorialWorkflow.mjs";
import { applyChecklistOverride, buildPendingRequirementsReport, calculateProtocolReadiness, createRegistryOfficeProfile, dossierItemsFromChecklist, evaluateBoundaryRequirements, evaluateCartorialChecklist, MATO_GROSSO_GEO_BASE } from "../src/modules/geoRegistry/documents/builders/cartorialChecklistEngine.mjs";
import { priorityLabel, requirementLabel, sourceLabel, statusLabel } from "../src/modules/geoRegistry/i18n/ptBR.mjs";
import { documentTextIssues } from "../src/modules/geoRegistry/documents/validators/documentQuality.mjs";
import { buildNotificationBatch, eligibleBoundariesForNotification, notificationTemplate, validateBoundaryNotification } from "../src/modules/geoRegistry/documents/builders/boundaryNotification.mjs";
import { notificationStatusLabel } from "../src/modules/geoRegistry/i18n/ptBR.mjs";
import { buildImportSimulation } from "../src/legacy-import/simulation.mjs";
import { METRICA_TOPO_PRESET, unmappedFields } from "../src/legacy-import/presets/metricaTopo.mjs";
import { buildGeoProjectFromLegacyData, consolidateLegacyProjectFragments, hydrateGeoProject, joinLegacyGeoRows, legacyPropertyToGeoProject, mergeHydratedGeoProject, parseLegacyNumber } from "../src/modules/geoRegistry/legacyProjectAdapter.mjs";
import { getCanonicalProjectData } from "../src/modules/geoRegistry/canonicalProjectData.mjs";

const validText = `MEMORIAL DESCRITIVO
Denominação: FAZENDA TESTE ANÔNIMA
Município: Cuiabá
UF: MT
Área: 12,3456 ha
Perímetro: 1.234,50 m
Matrícula: 12345
CNS: 00.000-0
Certificação: 12345678-abcd-1234-abcd-123456789012
Datum: SIRGAS2000
G61-M-3064 15° 30' 00,00" S 56° 00' 00,00" W
G61-M-3065 15° 30' 10,00" S 56° 00' 00,00" W
G61-M-3066 15° 30' 10,00" S 56° 00' 10,00" W`;

const chacaraCanaaText = `MEMORIAL DESCRITIVO
Denominação do imóvel: CHACARA CANAA
Proprietário(a): MARCIA BERNARDES DA CUNHA
Matrícula do imóvel: 103328
CNS: 06.344-6
Município/UF: Nossa Senhora do Livramento-MT
Área: 11,1578 ha
Perímetro: 1.392,9 m
Certificação: 81bacc4a-9788b-441c-a810-8697046229d0
Responsável Técnico(a): ALEXANDRE MAGNO GOMES DE LIMA
Código de credenciamento: G61
Sistema Geodésico de referência: SIRGAS 2000
G61-M-3063 15°42'09,314" S 56°29'41,396" W
G61-M-3064 15°42'10,000" S 56°29'42,000" W
G61-M-3065 15°42'11,000" S 56°29'43,000" W
G61-M-3066 15°42'12,000" S 56°29'42,000" W
G61-M-3067 15°42'11,000" S 56°29'41,000" W`;

test("interpreta campos principais e números com vírgula decimal", () => {
  const result = parseSigefMemorialText(validText);
  assert.equal(result.data.property.name, "FAZENDA TESTE ANÔNIMA");
  assert.equal(result.data.property.area, 12.3456);
  assert.equal(result.data.property.perimeter, 1234.5);
  assert.equal(result.data.vertices.length, 3);
});
test("PDF sem texto retorna aviso e não inventa dados", () => {
  const result = parseSigefMemorialText("");
  assert.equal(result.confidence, 0); assert.equal(result.data.vertices.length, 0); assert.ok(result.warnings.length);
});
test("campos ausentes permanecem vazios", () => {
  const result = parseSigefMemorialText("Memorial inesperado sem campos estruturados");
  assert.equal(result.data.registry.owner, ""); assert.equal(result.data.property.area, null);
});
test("aceita diferentes quantidades de vértices", () => {
  assert.equal(parseSigefMemorialText(validText.replace(/G61-M-3066.*$/m, "")).data.vertices.length, 2);
});
test("agrupa confrontantes repetidos preservando segmentos", () => {
  const text = "G61-M-3064 a G61-M-3065 distância: 100,00 m confrontando com FAZENDA VIZINHA\nG61-M-3065 a G61-M-3066 distância: 80,00 m confrontando com FAZENDA VIZINHA";
  const boundaries = parseSigefMemorialText(text).data.boundaries;
  assert.equal(boundaries.length, 2); assert.equal(new Set(boundaries.map((b) => b.boundaryName)).size, 1);
});
test("coordenadas inválidas impedem reconstrução", () => {
  assert.equal(verticesToFeature([{ longitude: -56, latitude: -15 }, { longitude: null, latitude: -15 }, { longitude: -55, latitude: -16 }]), null);
});
test("polígono aberto é fechado de modo explícito para cálculo", () => {
  const vertices = [{ longitude: -56, latitude: -15 }, { longitude: -56.01, latitude: -15 }, { longitude: -56.01, latitude: -15.01 }];
  const feature = verticesToFeature(vertices); assert.equal(feature.geometry.coordinates[0].length, 4);
});
test("geometria canônica preserva quantidade, ordem e lon/lat documentais", () => {
  const vertices = [{ code: "V3", longitude: -56.3, latitude: -15.3 }, { code: "V1", longitude: -56.1, latitude: -15.1 }, { code: "V2", longitude: -56.2, latitude: -15.4 }];
  const feature = canonicalSurveyGeometry(vertices);
  assert.deepEqual(feature.geometry.coordinates[0], [[-56.3,-15.3],[-56.1,-15.1],[-56.2,-15.4],[-56.3,-15.3]]);
});
test("geometria canônica rejeita conjunto parcialmente válido", () => {
  assert.equal(canonicalSurveyGeometry([{longitude:-56,latitude:-15},{longitude:null,latitude:-16},{longitude:-57,latitude:-16}]), null);
});

test("Mesa Técnica deriva tabela, segmentos e geometria da mesma ordem canônica", () => {
  const vertices=[
    {code:"G61-M-1",type:"M",documentOrder:0,longitude:-56,latitude:-15,status:"OK"},
    {code:"G61-V-2",type:"V",documentOrder:1,longitude:-56.01,latitude:-15,status:"OK"},
    {code:"G61-P-3",type:"P",documentOrder:2,longitude:-56.01,latitude:-15.01,status:"OK"},
  ];
  const project=createGeoRegistryProject({property:{name:"IMÓVEL",area:1},registry:{registrationNumber:"632"},vertices,boundaries:[{fromVertex:"G61-M-1",toVertex:"G61-V-2",boundaryName:"FAZENDA X"},{fromVertex:"G61-V-2",toVertex:"G61-P-3",boundaryName:"RIO Y"},{fromVertex:"G61-P-3",toVertex:"G61-M-1",boundaryName:"FAZENDA X"}]});
  const data=buildCanonicalSurveyData(project);
  assert.deepEqual(data.segments.map((item)=>[item.fromVertex,item.toVertex]),[["G61-M-1","G61-V-2"],["G61-V-2","G61-P-3"],["G61-P-3","G61-M-1"]]);
  assert.deepEqual(data.geometry.geometry.coordinates[0],vertices.map((item)=>[item.longitude,item.latitude]).concat([[-56,-15]]));
  assert.equal(data.integrity.closed,true); assert.equal(data.integrity.status,"Revisar");
});

test("agrupamento por confrontante preserva todos os trechos sem simplificar", () => {
  const vertices=[{code:"A",longitude:-56,latitude:-15},{code:"B",longitude:-56.01,latitude:-15},{code:"C",longitude:-56.02,latitude:-15.01},{code:"D",longitude:-56,latitude:-15.02}];
  const segments=buildCanonicalSegments(vertices,[{fromVertex:"A",toVertex:"B",boundaryName:"RIO SINUOSO",distanceDocument:10},{fromVertex:"B",toVertex:"C",boundaryName:"RIO SINUOSO",distanceDocument:20},{fromVertex:"C",toVertex:"D",boundaryName:"RIO SINUOSO",distanceDocument:30},{fromVertex:"D",toVertex:"A",boundaryName:"FAZENDA"}]);
  const river=groupCanonicalBoundaries(segments).find((item)=>item.name==="RIO SINUOSO");
  assert.equal(river.segmentCount,3); assert.equal(river.totalLength,60); assert.deepEqual(river.segments.map(segmentSelectionId),["A→B","B→C","C→D"]);
});

test("seleção sincronizada usa o mesmo identificador no caminhamento e no mapa", () => {
  const segment={fromVertex:"FIH-M-2025",toVertex:"CD5-M-4247"};
  assert.equal(segmentSelectionId(segment),"FIH-M-2025→CD5-M-4247");
});
test("validação detecta vértice duplicado e quantidade insuficiente", () => {
  const result = validateGeometry([{ longitude: -56, latitude: -15 }, { longitude: -56, latitude: -15 }], {});
  assert.equal(result.status, "INCONSISTENTE"); assert.ok(result.issues.length >= 2);
});
test("conteúdo inesperado não causa exceção", () => assert.doesNotThrow(() => parseSigefMemorialText("%PDF conteúdo fora do padrão @@@")));
test("normaliza ponto de milhar e vírgula decimal brasileira", () => {
  assert.equal(parseSigefMemorialText("Área: 1.891,7172 ha").data.property.area, 1891.7172);
});
test("adaptador hidrata projeto legado canônico com relações preservadas", async () => {
  const tables = {
    properties: [{ id:"kurizevu", legacy_source:"METRICA_TOPO_MDB", legacy_table:"CadImovel", legacy_id:"7", name:"FAZENDA KURIZEVU", municipality:"Paranatinga", state:"MT", sncr_incra:"901", area_original:"1.234,50", perimeter_original:"5.678,90", sigef_code:"CODIGO-LEGADO" }],
    registry_records: [{ id:"mat", property_id:"kurizevu", registration_number:"632", registration_type:"Matrícula", book:"2", page:"10", registry_district:"Paranatinga", state:"MT", registry_office_name:"CRI Paranatinga" }],
    property_owners: [{ property_id:"kurizevu", person_id:"owner", is_primary:true }],
    people: [{ id:"owner", name:"PROPRIETÁRIO TESTE", cpf:"123", nationality:"Brasileira", profession:"Produtor", spouse_name:"CÔNJUGE" }],
    companies: [], survey_projects: [], technical_responsibilities: [], technical_professionals: [],
  };
  const project = await hydrateGeoProject("kurizevu", async (name) => tables[name]);
  assert.equal(project.property.name, "FAZENDA KURIZEVU"); assert.equal(project.property.municipality, "Paranatinga"); assert.equal(project.property.area, 1234.5); assert.equal(project.property.perimeter, 5678.9);
  assert.equal(project.registry.registrationNumber, "632"); assert.equal(project.registry.book, "2"); assert.equal(project.registry.owner, "PROPRIETÁRIO TESTE"); assert.equal(project.owners[0].nationality, "Brasileira");
  assert.equal(project.sigef.certificationId, ""); assert.equal(project.sigef.legacySigefCode, "CODIGO-LEGADO"); assert.equal(project.geometry, null);
});
test("reabertura substitui cache legado parcial pelos dados hidratados", () => {
  const hydrated = legacyPropertyToGeoProject({ property_id:"kurizevu", name:"FAZENDA KURIZEVU", municipality:"Paranatinga", state:"MT", registration_number:"632", owner_name:"TITULAR MDB" });
  const stale = legacyPropertyToGeoProject({ property_id:"kurizevu", name:"FAZENDA KURIZEVU" }); stale.geometry={type:"Feature",geometry:{type:"Polygon",coordinates:[]}}; stale.dataOrigins["property.name"]="PREENCHIMENTO MANUAL";
  const merged = mergeHydratedGeoProject(hydrated, stale);
  assert.equal(merged.property.municipality,"Paranatinga"); assert.equal(merged.registry.registrationNumber,"632"); assert.equal(merged.registry.owner,"TITULAR MDB"); assert.equal(merged.geometry,stale.geometry);
});
test("adaptador recupera campos normalizados ausentes do JSON legado", () => {
  const project = buildGeoProjectFromLegacyData({ property:{id:"raw",legacy_source:"METRICA_TOPO_MDB",legacy_table:"CadImovel",legacy_raw_data:{NOMEIMOVEL:"FAZENDA RAW",CIDADE:"Paranatinga",ESTADO:"MT",AREA:"10,5",PERIMETRO:"900"}}, registries:[{property_id:"raw",legacy_raw_data:{NUMERO:"632",COMARCA:"Paranatinga"}}] });
  assert.equal(project.property.municipality,"Paranatinga"); assert.equal(project.property.area,10.5); assert.equal(project.registry.registrationNumber,"632");
});
test("falha em relação técnica opcional não descarta a hidratação cadastral", async () => {
  const tables={properties:[{id:"p",legacy_source:"METRICA_TOPO_MDB",legacy_table:"CadImovel",name:"IMÓVEL",municipality:"Cuiabá"}],registry_records:[],property_owners:[],people:[],companies:[],survey_projects:[],technical_professionals:[]};
  const project=await hydrateGeoProject("p",async(name)=>name==="technical_responsibilities"?Promise.reject(new Error("tabela indisponível")):tables[name]);
  assert.equal(project.property.municipality,"Cuiabá");
});
test("FAZENDA KURIZEVU 7498 + 7529: banco, adaptador e canônico preservam matrícula 632", () => {
  const first=legacyPropertyToGeoProject({property_id:"uuid-7498",legacy_id:"7498",registry_legacy_id:"7516",owner_legacy_id:"7521",name:"FAZENDA KURIZEVU",sncr_incra:"9061151046713",sigef_code:"a6031fda-eab4-4201-8578-080a31373360",registration_number:"632",cns:"06.327-1",registry_office_name:"1º Registro de Imóveis de Paranatinga",registry_district:"Paranatinga",owner_name:"ADEMIR DE CAMPOS MARTINS",owner_document:"277.599.698-13"});
  const second=legacyPropertyToGeoProject({property_id:"uuid-7529",legacy_id:"7529",registry_legacy_id:"7547",owner_legacy_id:"7552",name:"FAZENDA KURIZEVU",municipality:"Gaúcha do Norte",state:"MT",area_original:"7866,7957 ha",perimeter_original:"56.724,25 m",sncr_incra:"9061151046713",sigef_code:"a6031fda-eab4-4201-8578-080a31373360",registration_number:"632",cns:"06.327-1"});
  const project=consolidateLegacyProjectFragments([first,second]); const canonical=getCanonicalProjectData(project);
  assert.deepEqual(project.legacySource.propertyIds,["7498","7529"]); assert.deepEqual(project.legacySource.registryIds,["7516","7547"]); assert.deepEqual(project.legacySource.ownerIds,["7521","7552"]); assert.equal(project.registry.registrationNumber,"632"); assert.equal(canonical.registry.registrationNumber,"632"); assert.equal(canonical.property.municipality,"Gaúcha do Norte"); assert.equal(canonical.property.area,7866.7957); assert.equal(canonical.owner.name,"ADEMIR DE CAMPOS MARTINS");
});

test("documentOrder preserva a sequência quando o Memorial mistura DMS e coordenadas decimais", () => {
  const parsed=parseSigefMemorialText(`G61-M-1001 -15,500000 -56,100000\nG61-V-1002 15°30'01,000" S 56°06'01,000" W\nG61-P-1003 -15,510000 -56,110000`);
  assert.deepEqual(parsed.data.vertices.map((item)=>item.code),["G61-M-1001","G61-V-1002","G61-P-1003"]);
  assert.deepEqual(parsed.data.vertices.map((item)=>item.documentOrder),[0,1,2]);
  assert.deepEqual(parsed.vertexDiagnostic,{found:3,structured:3,rejected:0});
});

test("diagnóstico lista vértice rejeitado sem descarte silencioso", () => {
  const parsed=parseSigefMemorialText("G61-P-9001 Este: ??? Norte: 8.200.000,00");
  assert.equal(parsed.vertexDiagnostic.rejected,1); assert.equal(parsed.rejectedVertices[0].code,"G61-P-9001"); assert.match(parsed.rejectedVertices[0].originalText,/Este/);
});
test("Visão Geral não substitui mais registry pelo bloco vazio do Memorial", () => {
  const source=readFileSync(new URL("../src/modules/geoRegistry/GeoRegistryModule.jsx",import.meta.url),"utf8");
  assert.doesNotMatch(source,/registry:\s*project\.memorial\?\.registry/); assert.match(source,/Overview project=\{canonicalProject\}/);
});
test("reconhece campo separado do valor por quebra de linha", () => {
  const result = parseSigefMemorialText("Município:\nCuiabá\nUF:\nMT");
  assert.equal(result.data.property.municipality, "Cuiabá"); assert.equal(result.data.property.state, "MT");
});
test("preserva vértice não interpretado como registro incompleto", () => {
  const result = parseSigefMemorialText("G61-M-3099 Este: ??? Norte: 8.200.000,00");
  assert.equal(result.data.vertices.length, 1); assert.equal(result.data.vertices[0].status, "incompleto");
});
test("sinaliza mais de um possível valor em campo crítico", () => {
  const result = parseSigefMemorialText("Matrícula: 9824\nMatrícula: 9911");
  assert.equal(result.data.registry.registrationNumber, ""); assert.equal(result.ambiguousFields[0].field, "registry.registrationNumber");
});
test("identifica coordenadas UTM e converte com parâmetros suficientes", () => {
  const result = parseSigefMemorialText("Datum: SIRGAS2000\nFuso: 21\nHemisfério: Sul\nG61-M-3064 E: 600000,00 N: 8300000,00\nG61-M-3065 E: 601000,00 N: 8300000,00\nG61-M-3066 E: 601000,00 N: 8299000,00");
  assert.match(result.coordinateType, /UTM/); assert.equal(result.data.vertices[0].status, "OK"); assert.ok(Number.isFinite(result.data.vertices[0].longitude));
});
test("UTM sem parâmetros permanece incompleto com mensagem explícita", () => {
  const result = parseSigefMemorialText("G61-M-3064 E: 600000,00 N: 8300000,00");
  assert.equal(result.data.vertices[0].status, "incompleto"); assert.ok(result.warnings.some((item) => item.includes("parâmetros suficientes")));
});
test("identifica latitude e longitude decimais", () => {
  const result = parseSigefMemorialText("G61-M-3064 -15,500000 -56,100000\nG61-M-3065 -15,510000 -56,100000\nG61-M-3066 -15,510000 -56,110000");
  assert.match(result.coordinateType, /latitude\/longitude/); assert.equal(result.data.vertices.length, 3);
});
test("DMS respeita hemisférios N, S, E e W", () => {
  const southWest = parseSigefMemorialText(`G61-M-1001 15°42'09,314" S 56°29'41,396" W\nG61-M-1002 15°42'10,000" S 56°29'42,000" W\nG61-M-1003 15°42'11,000" S 56°29'41,000" W`).data.vertices[0];
  const northEast = parseSigefMemorialText(`G61-M-2001 15°42'09,314" N 56°29'41,396" E\nG61-M-2002 15°42'10,000" N 56°29'42,000" E\nG61-M-2003 15°42'11,000" N 56°29'41,000" E`).data.vertices[0];
  assert.ok(southWest.latitude < 0 && southWest.longitude < 0); assert.ok(northEast.latitude > 0 && northEast.longitude > 0);
});
test("área divergente sem tolerância exige conferência", () => {
  const vertices = [{ longitude: -56, latitude: -15 }, { longitude: -56.01, latitude: -15 }, { longitude: -56.01, latitude: -15.01 }];
  const result = validateGeometry(vertices, { area: 1 }); assert.equal(result.status, "DIFERENÇA A CONFERIR"); assert.ok(result.areaDifferencePercent > 5); assert.ok(Number.isFinite(result.areaDifferenceM2));
});
test("interpreta estrutura realista do Memorial SIGEF sem absorver blocos", () => {
  const text = `DENOMINAÇÃO DO IMÓVEL: CHÁCARA CANAÃ
PROPRIETÁRIO: PESSOA DE TESTE
MATRÍCULA: 9.824
CNS: 12.345-6
MUNICÍPIO: Cuiabá
UF: MT
RESPONSÁVEL TÉCNICO: PROFISSIONAL DE TESTE
CREDENCIAMENTO: G61
SISTEMA GEODÉSICO: SIRGAS2000
CERTIFICAÇÃO: 12345678-abcd-1234-abcd-123456789012
ÁREA (SISTEMA GEODÉSICO LOCAL): 11,1578 ha
PERÍMETRO (m): 1.392,90 m
Longitude Latitude Altitude
G61-M-3064
-56°29'41,396"
-15°42'09,314"
251,86
G61-M-3065
-56°29'40,100"
-15°42'10,100"
252,10
G61-M-3066
-56°29'42,000"
-15°42'11,000"
250,50
G61-M-3064 a G61-M-3065 azimute: 10° distância: 100,00 m confrontando com FAZENDA PARAÍSO INCRA 123
G61-M-3065 a G61-M-3066 azimute: 20° distância: 120,00 m confrontando com FAZENDA PARAÍSO INCRA 123`;
  const result = parseSigefMemorialText(text);
  assert.equal(result.data.property.name, "CHÁCARA CANAÃ");
  assert.equal(result.data.registry.registrationNumber, "9.824");
  assert.equal(result.data.registry.cns, "12.345-6");
  assert.equal(result.data.property.area, 11.1578);
  assert.equal(result.data.property.perimeter, 1392.9);
  assert.equal(result.data.sigef.accreditationCode, "G61");
  assert.equal(result.data.vertices.length, 3);
  assert.equal(result.data.vertices[0].type, "M");
  assert.ok(result.data.vertices[0].longitude < -56);
  assert.ok(result.data.vertices[0].latitude < -15);
  assert.equal(result.data.vertices[0].altitude, 251.86);
  assert.equal(result.data.boundaries.length, 3);
  assert.match(result.data.boundaries[0].boundaryName, /FAZENDA PARAÍSO/);
});
test("palavras comuns nunca viram segmentos", () => {
  const result = parseSigefMemorialText("gerado automaticamente CHACARA a CANAA Latitude Longitude");
  assert.equal(result.data.boundaries.length, 0); assert.equal(result.data.vertices.length, 0);
});
test("reconstrói segmentos fechados pela ordem dos vértices sem inventar atributos", () => {
  const text = `G61-M-3063\n-56°29'41,000"\n-15°42'09,000"\nG61-M-3064\n-56°29'42,000"\n-15°42'09,000"\nG61-M-3065\n-56°29'42,000"\n-15°42'10,000"\nG61-M-3066\n-56°29'41,500"\n-15°42'11,000"\nG61-M-3067\n-56°29'41,000"\n-15°42'10,000"`;
  const result = parseSigefMemorialText(text);
  assert.equal(result.data.boundaries.length, 5);
  assert.equal(result.data.boundaries[4].fromVertex, "G61-M-3067"); assert.equal(result.data.boundaries[4].toVertex, "G61-M-3063");
  assert.equal(result.data.boundaries[0].azimuth, null); assert.equal(result.data.boundaries[0].distance, null);
  assert.ok(result.data.boundaries.every((item) => item.origin === "RECONSTRUÍDO"));
  assert.equal(result.extractedSegments.length, 0); assert.equal(result.reconstructedSegments.length, 5);
});
test("preserva separação entre segmento documental e fechamento reconstruído", () => {
  const text = `G61-M-3063\n-56°29'41,000"\n-15°42'09,000"\nG61-M-3064\n-56°29'42,000"\n-15°42'09,000"\nG61-M-3065\n-56°29'42,000"\n-15°42'10,000"\nG61-M-3063 a G61-M-3064 azimute: 90° distância: 29,80 m confrontando com FAZENDA PARAISO`;
  const result = parseSigefMemorialText(text);
  assert.equal(result.extractedSegments.length, 1); assert.equal(result.data.boundaries[0].origin, "MEMORIAL");
  assert.equal(result.data.boundaries[0].distanceDocument, 29.8); assert.match(result.data.boundaries[0].boundaryName, /FAZENDA PARAISO/);
  assert.equal(result.reconstructedSegments.length, 2);
  assert.ok(result.rawSegmentStructure.length > 0);
});
test("extrai variantes cadastrais Município/UF e responsável técnico", () => {
  const result = parseSigefMemorialText("Proprietário(a): NOME TESTE\nMunicípio/UF: Cuiabá / MT\nResponsável Técnico(a): PROFISSIONAL TESTE\nCódigo de credenciamento: G61\nSistema Geodésico de referência: SIRGAS2000\nMatrícula nº: 9.824");
  assert.equal(result.data.registry.owner, "NOME TESTE"); assert.equal(result.data.property.municipality, "Cuiabá"); assert.equal(result.data.property.state, "MT"); assert.equal(result.data.sigef.surveyor, "PROFISSIONAL TESTE"); assert.equal(result.data.geodesy.datum, "SIRGAS2000"); assert.equal(result.data.registry.registrationNumber, "9.824");
});

test("executa o enriquecimento chamado pela interface após importar o Memorial", () => {
  const parsed = parseSigefMemorialText(validText);
  const enriched = enrichCalculatedSegments(parsed.data.boundaries, parsed.data.vertices);
  assert.equal(enriched.length, parsed.data.boundaries.length);
  assert.ok(enriched.every((segment) => Number.isFinite(segment.azimuthCalculated)));
  assert.ok(enriched.every((segment) => Number.isFinite(segment.distanceCalculated)));
  assert.ok(enriched.every((segment) => segment.azimuthDocument == null));
});

test("prioriza UUID existente na base SIGEF local", () => {
  const uuid = "81bacc4a-978b-441c-a810-8697046229d0";
  const feature = { type: "Feature", properties: { parcela_co: uuid }, geometry: { type: "Polygon", coordinates: [] } };
  assert.equal(findInLocalSigef(uuid, { type: "FeatureCollection", features: [feature] }), feature);
});

test("extrai metadados reais sem confundir matrícula, parcela e CNS", () => {
  const result = parseSigefMemorialText(`Denominação do imóvel: CHACARA CANAA
Proprietário(a): MARCIA BERNARDES DA CUNHA
Município/UF: Nossa Senhora do Livramento-MT
Matrícula do imóvel: 103328
CNS: 06.344-6
Responsável Técnico(a): ALEXANDRE MAGNO GOMES DE LIMA
Código de credenciamento: G61
Sistema Geodésico de referência: SIRGAS 2000`);
  assert.equal(result.data.property.municipality, "Nossa Senhora do Livramento");
  assert.equal(result.data.property.state, "MT");
  assert.equal(result.data.registry.registrationNumber, "103328");
  assert.equal(result.data.registry.owner, "MARCIA BERNARDES DA CUNHA");
  assert.equal(result.data.sigef.surveyor, "ALEXANDRE MAGNO GOMES DE LIMA");
  assert.equal(result.data.sigef.parcelId, "Não informado no Memorial");
  assert.equal(result.data.sigef.status, "Não informado no Memorial");
});

test("reconstrói tabela espacial e mantém cinco segmentos documentais associados", () => {
  const row = (text, x, y) => ({ page: 2, text, x, y, width: 80, height: 10 });
  const items = [row("Vértice", 10, 700), row("Azimute", 200, 700), row("Distância", 300, 700), row("Confrontante", 400, 700)];
  const codes = ["G61-M-3063", "G61-M-3064", "G61-M-3065", "G61-M-3066", "G61-M-3067"];
  codes.forEach((code, index) => { const y = 680 - index * 20; items.push(row(code, 10, y), row(`${index + 10}°00'00\"`, 200, y), row(`${100 + index},50 m`, 300, y), row(`FAZENDA ${index < 2 ? "PARAISO" : "CANAA"}`, 400, y)); });
  const lines = reconstructPdfLines(items);
  const vertexText = codes.map((code, index) => `${code} -15,${5000 + index} -56,${1000 + index}`).join("\n");
  const result = parseSigefMemorialText(vertexText, { items, lines });
  assert.equal(result.extractedSegments.length, 5);
  assert.equal(result.data.boundaries.filter((item) => item.origin === "MEMORIAL").length, 5);
  assert.equal(result.data.boundaries[0].boundaryName, "FAZENDA PARAISO");
  assert.equal(result.data.boundaries[2].boundaryName, "FAZENDA CANAA");
  assert.equal(result.data.boundaries[0].distanceDocument, 100.5);
  assert.equal(result.data.boundaries[0].azimuthDocument, "10°00'00\"");
  assert.equal(result.data.boundaries[0].azimuthCalculated, undefined);
});

test("preserva coordenada documental e mantém decimal para geometria", () => {
  const result = parseSigefMemorialText(`Datum: SIRGAS 2000
G61-M-3063 15°42'09,314\" S 56°29'41,396\" W
G61-M-3064 15°42'10,000\" S 56°29'42,000\" W
G61-M-3065 15°42'11,000\" S 56°29'41,000\" W`);
  const vertex = result.data.vertices[0];
  assert.equal(vertex.latitudeDocument, `15°42'09,314\" S`);
  assert.equal(vertex.longitudeDocument, `56°29'41,396\" W`);
  assert.equal(vertex.latitudeDecimal, vertex.latitude);
  assert.equal(vertex.longitudeDecimal, vertex.longitude);
  assert.ok(vertex.latitudeDecimal < 0 && vertex.longitudeDecimal < 0);
});

test("quadro usa DMS original e requerimento sem matrícula fica bloqueado", () => {
  const project = { property: { name: "CHACARA CANAA", municipality: "Nossa Senhora do Livramento", state: "MT", area: 11.1578 }, registry: { owner: "MARCIA", registrationNumber: "", cns: "06.344-6", registryOffice: "", previousArea: null }, sigef: { certificationId: "uuid", surveyor: "ALEXANDRE" }, geodesy: { datum: "SIRGAS 2000" }, vertices: [{ code: "G61-M-3063", latitudeDocument: `15°42'09,314\" S`, longitudeDocument: `56°29'41,396\" W`, latitudeDecimal: -15.7, longitudeDecimal: -56.4, altitude: 251.86 }], boundaries: [], checklist: [] };
  const pieces = buildCartorialPieces(project);
  assert.equal(pieces.coordinates.rows[0].latitude, `15°42'09,314\" S`);
  assert.notEqual(pieces.coordinates.rows[0].latitude, String(project.vertices[0].latitudeDecimal));
  assert.equal(pieces.request.canGenerate, false);
  assert.ok(pieces.request.missing.includes("Matrícula"));
});

test("quadro de confrontantes rejeita segmentos reconstruídos", () => {
  const project = { property: {}, registry: {}, sigef: {}, geodesy: {}, vertices: [], checklist: [], boundaries: [{ origin: "RECONSTRUÍDO", fromVertex: "A", toVertex: "B", azimuthCalculated: 90, distanceCalculated: 100, boundaryName: "VIZINHO" }, { origin: "MEMORIAL", fromVertex: "B", toVertex: "C", azimuthDocument: "45°", distanceDocument: 80, boundaryName: "FAZENDA REAL" }] };
  const pieces = buildCartorialPieces(project);
  assert.equal(pieces.boundaries.rows.length, 1);
  assert.equal(pieces.boundaries.rows[0].boundaryName, "FAZENDA REAL");
});

test("parser registral extrai campos sem usar o parser SIGEF", () => {
  const parsed = parseRegistryDocument(`Matrícula nº: 103328
CNS: 06.344-6
Cartório: 1º Ofício de Registro de Imóveis
Comarca: Nossa Senhora do Livramento
Município/UF: Nossa Senhora do Livramento-MT
Denominação do imóvel: CHACARA CANAA
Proprietário atual: MARCIA BERNARDES DA CUNHA
CPF: 000.000.000-00
Área registral: 11,1500 ha
SNCR: 123.456.789
CCIR: 98765
CIB: 1234
CAR: MT-123
R.1 - Aquisição
AV.2 - Retificação`);
  assert.equal(parsed.fields.registrationNumber, "103328"); assert.equal(parsed.fields.owner, "MARCIA BERNARDES DA CUNHA"); assert.equal(parsed.fields.previousArea, 11.15); assert.equal(parsed.fields.state, "MT"); assert.equal(parsed.acts.length, 2);
});

test("confrontante espacial preserva matrícula e CNS do mesmo segmento", () => {
  const row = (text, x, y) => ({ page: 1, text, x, y, width: 50, height: 10 });
  const items = [row("Vértice", 10, 700), row("Azimute", 200, 700), row("Distância", 300, 700), row("Confrontante", 400, 700), row("G61-M-3063", 10, 680), row("90°", 200, 680), row("100,00 m", 300, 680), row("FAZENDA PARAISO Matrícula: 7788 CNS: 01.222-3", 400, 680), row("G61-M-3064", 10, 660), row("180°", 200, 660), row("80,00 m", 300, 660), row("FAZENDA CANAA", 400, 660)];
  const parsed = parseSigefMemorialText(`G61-M-3063 -15,5000 -56,1000\nG61-M-3064 -15,6000 -56,2000`, { items, lines: reconstructPdfLines(items) });
  assert.equal(parsed.extractedSegments[0].boundaryRegistration, "7788"); assert.equal(parsed.extractedSegments[0].boundaryCns, "01.222-3"); assert.equal(parsed.extractedSegments[0].boundaryName, "FAZENDA PARAISO");
});

test("PDF registral com texto suficiente não executa OCR", async () => {
  const native = "Matrícula 103328 CNS 06.344-6 Proprietário MARCIA BERNARDES DA CUNHA Cartório de Registro de Imóveis Município Nossa Senhora do Livramento área registral onze hectares documento pesquisável com informações suficientes para interpretação segura";
  let called = false; const selected = await chooseRegistryText(native, async () => { called = true; return { text: "OCR" }; });
  assert.equal(assessNativeText(native).sufficient, true); assert.equal(selected.method, "Texto nativo"); assert.equal(called, false);
});

test("PDF registral sem texto aciona fallback OCR e preserva confiança", async () => {
  const selected = await chooseRegistryText("", async () => ({ text: "Matrícula: 103328\nCNS: 06.344-6\nProprietário atual: MARCIA", confidence: 64 }));
  const parsed = parseRegistryDocument(selected.text);
  assert.equal(selected.method, "OCR"); assert.equal(selected.documentType, "Documento digitalizado"); assert.equal(selected.confidence, 64); assert.equal(parsed.fields.registrationNumber, "103328"); assert.equal(parsed.fields.cns, "06.344-6"); assert.equal(parsed.fields.owner, "MARCIA"); assert.ok(selected.confidence < 80);
});

test("azimute calculado é normalizado para intervalo de zero a 360", () => {
  const enriched = enrichCalculatedSegments([{ fromVertex: "A", toVertex: "B" }], [{ code: "A", latitude: 0, longitude: 0 }, { code: "B", latitude: -1, longitude: -1 }]);
  assert.ok(enriched[0].azimuthCalculated >= 0 && enriched[0].azimuthCalculated < 360);
});

test("confrontante manual permanece separado do documental e pode alimentar quadro sem inferência", () => {
  const manual = { origin: "RECONSTRUÍDO", boundarySource: "MANUAL", fromVertex: "A", toVertex: "B", azimuthDocument: "90°", distanceDocument: 100, boundaryName: "FAZENDA MANUAL" };
  const project = { property: {}, registry: {}, sigef: {}, geodesy: {}, vertices: [], checklist: [], boundaries: [manual] };
  const pieces = buildCartorialPieces(project); assert.equal(pieces.boundaries.rows.length, 1); assert.equal(pieces.boundaries.rows[0].boundarySource, "MANUAL");
});

test("regressão permanente CHACARA CANAA preserva todos os campos e cinco vértices", () => {
  const result = parseSigefMemorialText(chacaraCanaaText);
  assert.equal(result.data.property.name, "CHACARA CANAA"); assert.equal(result.data.registry.owner, "MARCIA BERNARDES DA CUNHA"); assert.equal(result.data.registry.registrationNumber, "103328"); assert.equal(result.data.registry.cns, "06.344-6"); assert.equal(result.data.property.municipality, "Nossa Senhora do Livramento"); assert.equal(result.data.property.state, "MT"); assert.equal(result.data.property.area, 11.1578); assert.equal(result.data.property.perimeter, 1392.9); assert.equal(result.data.sigef.certificationId, "81bacc4a-9788b-441c-a810-8697046229d0"); assert.equal(result.data.sigef.surveyor, "ALEXANDRE MAGNO GOMES DE LIMA"); assert.equal(result.data.sigef.accreditationCode, "G61"); assert.equal(result.data.geodesy.datum, "SIRGAS 2000"); assert.deepEqual(result.data.vertices.map((item) => item.code), ["G61-M-3063", "G61-M-3064", "G61-M-3065", "G61-M-3066", "G61-M-3067"]); assert.ok(result.data.vertices.every((item) => item.latitudeDocument && item.longitudeDocument && Number.isFinite(item.latitudeDecimal) && Number.isFinite(item.longitudeDecimal))); assert.ok(verticesToFeature(result.data.vertices));
});

test("dados registrais não sobrescrevem Memorial, SIGEF, geometria ou vértices", () => {
  const parsed = parseSigefMemorialText(chacaraCanaaText).data; const geometry = verticesToFeature(parsed.vertices); const initial = { property: {}, registry: {}, sigef: {}, geodesy: {}, vertices: [], boundaries: [], geometry, calculated: { area: 11.1578 } }; const withMemorial = applyMemorialData(initial, parsed); const withRegistry = applyRegistryData(withMemorial, { registrationNumber: "REG-999", owner: "OUTRO TITULAR", confirmed: true }); assert.equal(withRegistry.memorial.registry.registrationNumber, "103328"); assert.equal(withRegistry.memorial.registry.owner, "MARCIA BERNARDES DA CUNHA"); assert.equal(withRegistry.sigef.certificationId, "81bacc4a-9788b-441c-a810-8697046229d0"); assert.equal(withRegistry.vertices.length, 5); assert.equal(withRegistry.geometry, geometry); assert.deepEqual(withRegistry.calculated, { area: 11.1578 });
});

test("interpreta literalmente os cinco segmentos reais da CHACARA CANAA por linha", () => {
  const lines = [
    "G61-M-3063 ... G61-M-3064 153°58' 248,72 CNS: 06.344-6 | Mat. 3959 | FAZENDA PARAISO INCRA ...",
    "G61-M-3064 ... G61-M-3065 239°03' 165,58 CNS: 06.344-6 | Mat. 3959 | SITIO CANINANA e propriedade de ESPOLIO DE ANA EV...",
    "G61-M-3065 ... G61-M-3066 242°23' 283,92 CNS: 06.344-6 | Mat. 3959 | SITIO CANINANA e propriedade de ESPOLIO DE ANA EV...",
    "G61-M-3066 ... G61-M-3067 332°36' 239,09 Estrada de Servidão",
    "G61-M-3067 ... G61-M-3063 59°58' 455,59 CNS: 06.344-6 | Mat. POSS; | CHACARA 2 IRMAOS e propriedade de MAURO ANTONIO ...",
  ];
  const segments = parseSigefSegmentRows(lines);
  assert.equal(segments.length, 5);
  assert.deepEqual(segments.map((item) => [item.fromVertex, item.toVertex]), [["G61-M-3063", "G61-M-3064"], ["G61-M-3064", "G61-M-3065"], ["G61-M-3065", "G61-M-3066"], ["G61-M-3066", "G61-M-3067"], ["G61-M-3067", "G61-M-3063"]]);
  assert.deepEqual(segments.map((item) => item.azimuthDocumentRaw), ["153°58'", "239°03'", "242°23'", "332°36'", "59°58'"]);
  assert.deepEqual(segments.map((item) => item.distanceDocumentRaw), ["248,72", "165,58", "283,92", "239,09", "455,59"]);
  assert.deepEqual(segments.map((item) => item.distanceDocumentMeters), [248.72, 165.58, 283.92, 239.09, 455.59]);
  assert.equal(segments[0].boundaryCns, "06.344-6"); assert.equal(segments[0].boundaryRegistration, "3959"); assert.match(segments[0].boundaryName, /FAZENDA PARAISO/);
  assert.equal(segments[3].boundaryCns, null); assert.equal(segments[3].boundaryRegistration, null); assert.equal(segments[3].boundaryName, "Estrada de Servidão");
  assert.equal(segments[4].boundaryRegistration, "POSS;"); assert.match(segments[4].boundaryName, /CHACARA 2 IRMAOS/);
});

test("rejeita matrícula OCR sem contexto semântico suficiente", () => {
  const parsed = parseRegistryDocument("MATRÍCULA 1\nOCR ilegível");
  assert.equal(parsed.fields.registrationNumber, "");
  assert.equal(parsed.fieldValidation.registrationNumber.status, "REJEITADO");
});

test("integra os cinco segmentos documentais ao Memorial sem alterar os vértices", () => {
  const segmentText = [
    "G61-M-3063 ... G61-M-3064 153°58' 248,72 CNS: 06.344-6 | Mat. 3959 | FAZENDA PARAISO INCRA ...",
    "G61-M-3064 ... G61-M-3065 239°03' 165,58 CNS: 06.344-6 | Mat. 3959 | SITIO CANINANA e propriedade de ESPOLIO DE ANA EV...",
    "G61-M-3065 ... G61-M-3066 242°23' 283,92 CNS: 06.344-6 | Mat. 3959 | SITIO CANINANA e propriedade de ESPOLIO DE ANA EV...",
    "G61-M-3066 ... G61-M-3067 332°36' 239,09 Estrada de Servidão",
    "G61-M-3067 ... G61-M-3063 59°58' 455,59 CNS: 06.344-6 | Mat. POSS; | CHACARA 2 IRMAOS e propriedade de MAURO ANTONIO ...",
  ].join("\n");
  const result = parseSigefMemorialText(`${chacaraCanaaText}\n${segmentText}`);
  assert.equal(result.data.vertices.length, 5); assert.equal(result.data.boundaries.length, 5); assert.ok(result.data.boundaries.every((item) => item.origin === "MEMORIAL")); assert.ok(result.data.boundaries.every((item) => item.azimuthDocumentRaw && item.distanceDocumentRaw && item.boundaryName));
});

test("propõe campos registrais por contexto e mantém validação separada", () => {
  const parsed = parseRegistryDocument("MATRÍCULA Nº 103.328\nCNS: 06.344-6\nSERVENTIA: 1º REGISTRO DE IMÓVEIS\nCOMARCA: Várzea Grande\nMUNICÍPIO: Nossa Senhora do Livramento / MT\nPROPRIETÁRIA: MARCIA BERNARDES DA CUNHA\nÁREA: 11,1578 ha");
  assert.equal(parsed.fields.registrationNumber, "103.328"); assert.equal(parsed.fields.cns, "06.344-6"); assert.equal(parsed.fields.district, "Várzea Grande"); assert.equal(parsed.fields.municipality, "Nossa Senhora do Livramento"); assert.equal(parsed.fields.state, "MT"); assert.equal(parsed.fields.owner, "MARCIA BERNARDES DA CUNHA"); assert.equal(parsed.fieldValidation.registrationNumber.status, "CONFERIR");
});

function cartorialProject() {
  return {
    property: { name: "CHACARA CANAA", municipality: "Nossa Senhora do Livramento", state: "MT", area: 11.1578, perimeter: 1392.9 },
    memorial: { registry: { owner: "MARCIA BERNARDES DA CUNHA", registrationNumber: "103328", cns: "06.344-6" } }, memorialRegistry: { owner: "MARCIA BERNARDES DA CUNHA", registrationNumber: "103328", cns: "06.344-6" },
    registry: { confirmed: true, registrationNumber: "103.328", cns: "06.344-6", registryOffice: "1º Registro de Imóveis", district: "Nossa Senhora do Livramento", municipality: "Nossa Senhora do Livramento", state: "MT", owner: "MARCIA BERNARDES DA CUNHA", ownerDocument: "000.000.000-00", previousArea: 11.15 },
    registryState: "CONFIRMED", sigef: { certificationId: "UUID-CANAA", certificationDate: "01/08/2026", surveyor: "ALEXANDRE MAGNO GOMES DE LIMA", accreditationCode: "G61" }, geodesy: { datum: "SIRGAS 2000" },
    vertices: [
      { code: "G61-M-3063", longitudeDocument: `56°29'41,396" W`, latitudeDocument: `15°42'09,314" S`, longitudeDecimal: -56.49, latitudeDecimal: -15.7, altitude: 251.8 },
      { code: "G61-M-3064", longitudeDocument: `56°29'42,000" W`, latitudeDocument: `15°42'10,000" S`, longitudeDecimal: -56.5, latitudeDecimal: -15.71, altitude: 252.1 },
    ],
    boundaries: Array.from({ length: 5 }, (_, index) => ({ origin: "MEMORIAL", fromVertex: `G61-M-${3063 + index}`, toVertex: `G61-M-${index === 4 ? 3063 : 3064 + index}`, azimuthDocumentRaw: `${index + 10}°00'`, azimuthCalculated: 999, distanceDocumentRaw: `${100 + index},50`, distanceDocumentMeters: 100 + index + .5, distanceCalculated: 999, boundaryName: `CONFRONTANTE ${index + 1}`, boundaryRegistration: index === 3 ? null : "3959", boundaryCns: index === 3 ? null : "06.344-6" })),
    checklist: [{ id: "registro-matricula", category: "REGISTRO", label: "Matrícula atualizada", status: "pending", observation: "" }], cartorialData: { "owner.civilStatus": { value: "casada", confirmed: true }, "owner.nationality": { value: "brasileira", confirmed: true }, "owner.profession": { value: "produtora rural", confirmed: true }, "owner.address": { value: "Nossa Senhora do Livramento/MT", confirmed: true } }, dataOrigins: {}, sourceDocuments: [{ category: "SIGEF", type: "Memorial", name: "memorial.pdf" }], geometry: { type: "Feature" }, manualOverrides: {},
  };
}

test("requerimento completo fica pronto para revisão", () => { const pieces = buildCartorialPieces(cartorialProject()); assert.equal(pieces.request.state, "PRONTO PARA REVISÃO"); assert.equal(pieces.request.validation.ready, true); assert.match(pieces.request.templateOriginal, /AO ILUSTRÍSSIMO SENHOR OFICIAL/); });
test("requerimento informa exatamente os campos críticos sem imprimir placeholder", () => { const project = cartorialProject(); project.registry.registryOffice = ""; const pieces = buildCartorialPieces(project); assert.equal(pieces.request.state, "DADOS PENDENTES"); assert.ok(pieces.request.validation.criticalMissing.includes("registryOffice")); assert.doesNotMatch(pieces.request.templateOriginal, /DADO PENDENTE|PREENCHER|undefined|null/); });
test("quadro de coordenadas preserva DMS e ordem original", () => { const pieces = buildCartorialPieces(cartorialProject()); assert.deepEqual(pieces.coordinates.rows.map((item) => item.code), ["G61-M-3063", "G61-M-3064"]); assert.equal(pieces.coordinates.rows[0].longitude, `56°29'41,396" W`); assert.equal(pieces.coordinates.rows[0].latitude, `15°42'09,314" S`); });
test("quadro de confrontantes usa cinco valores documentais antes dos calculados", () => { const pieces = buildCartorialPieces(cartorialProject()); assert.equal(pieces.boundaries.rows.length, 5); assert.equal(pieces.boundaries.rows[0].azimuth, "10°00'"); assert.equal(pieces.boundaries.rows[0].distance, "100,50"); assert.notEqual(pieces.boundaries.rows[0].azimuth, "999"); });
test("edição manual de confrontante não destrói valor original", () => { const original = cartorialProject().boundaries[0]; const edited = applyBoundarySupplement(original, { boundaryName: "EDITADO", owner: "VIZINHO" }); assert.equal(edited.originalData.boundaryName, "CONFRONTANTE 1"); assert.equal(edited.boundaryName, "CONFRONTANTE 1"); assert.equal(edited.additionalData.boundaryName, "EDITADO"); const context = buildCartorialDocumentContext({ ...cartorialProject(), boundaries: [edited] }); assert.equal(context.boundaries[0].originalData.boundaryName, "CONFRONTANTE 1"); });
test("documento SIGEF independente não é bloqueado por matrícula", () => { const project = cartorialProject(); project.registry = { confirmed: false }; project.registryState = "NOT_IMPORTED"; const context = buildCartorialDocumentContext(project); assert.equal(validateDocumentData("coordinates", context).ready, true); assert.equal(validateDocumentData("boundaries", context).ready, true); });
test("checklist legado permanece editável sem substituir o motor inteligente", () => { const project = cartorialProject(); project.checklist = updateChecklistItem(project.checklist, "registro-matricula", { status: "received", observation: "Certidão de 30 dias" }); const pieces = buildCartorialPieces(project); assert.equal(project.checklist[0].status, "received"); assert.equal(project.checklist[0].observation, "Certidão de 30 dias"); assert.ok(["NOT_READY","REVIEW_REQUIRED","READY"].includes(pieces.checklist.state)); assert.ok(pieces.checklist.rows.every((item)=>item.requiredLevel&&item.reason)); });

test("requerimento baseado no modelo real reutiliza qualificação e procedimento", () => { const project = cartorialProject(); project.cartorialData = { ...project.cartorialData, "owner.rg": { value: "123456", confirmed: true }, "property.incraCode": { value: "901.234.567", confirmed: true }, "procedure.returnNote": { value: "ND-77", confirmed: true }, "procedure.serviceOrder": { value: "OS-88", confirmed: true }, "technical.registrationNumber": { value: "49539140153", confirmed: true } }; const request = buildCartorialPieces(project).request.templateOriginal; assert.match(request, /MARCIA BERNARDES/); assert.match(request, /103\.328/); assert.match(request, /901\.234\.567/); assert.match(request, /ND-77/); assert.match(request, /OS-88/); assert.match(request, /ALEXANDRE MAGNO/); assert.match(request, /49539140153/); });
test("memorial cria narrativa fechada com azimutes e distâncias documentais", () => { const context = buildCartorialDocumentContext(cartorialProject()); const narrative = buildPerimeterNarrative(context); assert.match(narrative, /Inicia-se a descrição/); assert.match(narrative, /10°00'/); assert.match(narrative, /100,50 m/); assert.match(narrative, /ponto inicial da descrição deste perímetro/); });
test("anuência gera um documento por confrontante e somente seus trechos", () => { const project = cartorialProject(); project.boundaries[1].boundaryName = project.boundaries[0].boundaryName; const documents = buildBoundaryDocuments(buildCartorialDocumentContext(project)); assert.equal(documents.length, 4); assert.equal(documents[0].rows.length, 2); assert.ok(documents[0].rows.every((row) => row.azimuth && row.distance)); });
test("autopreenchimento cartorial prioriza confirmação manual sem apagar Memorial", () => { const project = cartorialProject(); project.cartorialData["owner.name"] = { value: "NOME CONFIRMADO", confirmed: true, updatedAt: "2026-08-12" }; const context = buildCartorialDocumentContext(project); assert.equal(context.owner.name.value, "NOME CONFIRMADO"); assert.equal(context.owner.name.origin, "MANUAL_CONFIRMED"); assert.equal(project.memorial.registry.owner, "MARCIA BERNARDES DA CUNHA"); });

test("persistência cartorial sobrevive a serialização e reabertura completa", () => {
  const memory = new Map(); globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: (key) => memory.delete(key) };
  const values = { "owner.document": "481.645.859-04", "owner.rg": "33595093", "owner.profession": "Professora do Ensino Fundamental", "registry.office": "1º Ofício de Registro de Imóveis", "registry.district": "Várzea Grande", "property.incraCode": "9040901048414" };
  const project = { ...cartorialProject(), id: "persistencia-cartorial" }; saveProjectToStorage(globalThis.localStorage, confirmCartorialData(project, values, "2026-08-12T12:00:00.000Z"));
  const reopened = JSON.parse(JSON.stringify(listProjectsFromStorage(globalThis.localStorage)))[0];
  for (const [key, expected] of Object.entries(values)) { assert.equal(reopened.cartorialData[key].value, expected); assert.equal(reopened.cartorialData[key].source, "MANUAL_CONFIRMED"); assert.equal(reopened.cartorialData[key].confirmed, true); }
  assert.equal(buildCartorialDocumentContext(reopened).owner.document.value, "481.645.859-04"); assert.equal(buildCartorialDocumentContext(reopened).registry.office.value, "1º Ofício de Registro de Imóveis");
  delete globalThis.localStorage;
});

test("planta CHACARA CANAA preserva códigos e escolhe escala cartográfica convencional", () => {
  const project = cartorialProject();
  project.geodesy.utmZone = "21";
  project.vertices.push({ code: "G61-M-3065", longitudeDecimal: -56.495, latitudeDecimal: -15.695 });
  project.geometry = { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-56.49, -15.7], [-56.5, -15.71], [-56.495, -15.695], [-56.49, -15.7]]] } };
  const context = { geometry: project.geometry, vertices: project.vertices, boundaries: project.boundaries, datum: "SIRGAS 2000", utmZone: "21", area: project.property.area, perimeter: project.property.perimeter };
  const layout = buildPlantLayout(context);
  assert.deepEqual(layout.vertexPoints.map((item) => item.vertex.code), ["G61-M-3063", "G61-M-3064", "G61-M-3065"]);
  assert.ok([500, 1000, 2000, 5000, 10000, 20000, 25000, 50000].includes(layout.scale));
  assert.equal(layout.boundaryLabels[0].title, "CONFRONTANTE 1");
  assert.equal(layout.scaleX, layout.scaleY);
  assert.ok(generateLocationMap(context).bounds);
});

test("segunda geometria altera enquadramento e escala sem alterar o template", () => {
  const small = { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-56.49, -15.7], [-56.489, -15.7], [-56.489, -15.699], [-56.49, -15.7]]] } };
  const large = { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-56.49, -15.7], [-56.39, -15.7], [-56.39, -15.6], [-56.49, -15.7]]] } };
  const context = (geometry) => ({ geometry, vertices: geometry.geometry.coordinates[0].slice(0,-1).map(([longitudeDecimal,latitudeDecimal],index)=>({code:`P${index+1}`,longitudeDecimal,latitudeDecimal})), boundaries: [], datum:"SIRGAS 2000", utmZone:"21" });
  const smallContext=context(small),largeContext=context(large),smallLayout = buildPlantLayout(smallContext),largeLayout = buildPlantLayout(largeContext);
  assert.ok(largeLayout.scale > smallLayout.scale);
  assert.notDeepEqual(generateLocationMap(smallContext).bounds, generateLocationMap(largeContext).bounds);
  assert.deepEqual(smallLayout.viewport, largeLayout.viewport);
});

test("planta bloqueia latitude/longitude quando o fuso UTM documental está ausente", () => { const project=cartorialProject(); project.geometry={type:"Feature",geometry:{type:"Polygon",coordinates:[[[-56.49,-15.7],[-56.5,-15.71],[-56.49,-15.71],[-56.49,-15.7]]]}}; project.vertices=[{code:"A",longitudeDecimal:-56.49,latitudeDecimal:-15.7},{code:"B",longitudeDecimal:-56.5,latitudeDecimal:-15.71},{code:"C",longitudeDecimal:-56.49,latitudeDecimal:-15.71}]; const canonical=buildCanonicalGeometry({geometry:project.geometry,vertices:project.vertices,datum:"SIRGAS 2000",utmZone:""}); assert.equal(canonical.valid,false); assert.match(canonical.status,/BLOQUEADA/); assert.match(canonical.issues.join(" "),/Fuso UTM/); });

test("coordenadas métricas nulas nunca são convertidas silenciosamente para zero", () => { const geometry={type:"Feature",geometry:{type:"Polygon",coordinates:[[[-56.49,-15.7],[-56.5,-15.71],[-56.49,-15.71],[-56.49,-15.7]]]}}; const vertices=geometry.geometry.coordinates[0].slice(0,-1).map(([longitudeDecimal,latitudeDecimal],index)=>({code:`N${index}`,longitudeDecimal,latitudeDecimal,east:null,north:""})); const canonical=buildCanonicalGeometry({geometry,vertices,datum:"SIRGAS 2000",utmZone:""}); assert.equal(canonical.valid,false); assert.equal(canonical.projection,null); assert.match(canonical.issues.join(" "),/Fuso UTM/); });

test("transformação da planta usa escala uniforme e preserva distâncias e ângulos", () => { const context={geometry:{type:"Feature",geometry:{type:"Polygon",coordinates:[[[-56.49,-15.7],[-56.5,-15.71],[-56.495,-15.695],[-56.49,-15.7]]]}},vertices:[{code:"A",longitudeDecimal:-56.49,latitudeDecimal:-15.7},{code:"B",longitudeDecimal:-56.5,latitudeDecimal:-15.71},{code:"C",longitudeDecimal:-56.495,latitudeDecimal:-15.695}],boundaries:[],datum:"SIRGAS 2000",utmZone:"21"}; const canonical=buildCanonicalGeometry(context),presentation=buildUniformPresentation(canonical,{width:1122,height:785},.37); assert.equal(presentation.scaleX,presentation.scaleY); assert.equal(presentation.audit.valid,true); assert.ok(presentation.audit.distanceError<1e-8); assert.ok(presentation.audit.angleError<1e-8); assert.equal(validateRigidTransform(canonical.projected,presentation.points.slice(0,-1),presentation.scale).valid,true); });

test("DXF CAD mantém perímetro fechado, layers e referência raster relativa", () => {
  const project = cartorialProject();
  project.geodesy.utmZone = "21";
  project.vertices.push({ code: "G61-M-3065", longitudeDecimal: -56.495, latitudeDecimal: -15.695 });
  project.geometry = { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-56.49, -15.7], [-56.5, -15.71], [-56.495, -15.695], [-56.49, -15.7]]] } };
  const dxf = buildPlantDxf({ ...buildCartorialPieces(project).plant.context, boundaries: project.boundaries }, "CHACARA_CANAA_LOCALIZACAO.png");
  for (const layer of CAD_LAYERS) assert.match(dxf, new RegExp(layer));
  assert.match(dxf, /POLYLINE[\s\S]*ROTEIRO_PERIMETRICO[\s\S]*66\r\n1/);
  assert.match(dxf, /\$LIMMAX[\s\S]*10\r\n594[\s\S]*20\r\n420/);
  assert.match(dxf, /IMAGEM EXTERNA: CHACARA_CANAA_LOCALIZACAO\.png/);
  assert.doesNotMatch(dxf, /[A-Z]:\\/);
  assert.equal(validatePlantDxf(dxf).version, DXF_VERSION);
  assert.doesNotMatch(dxf, /\r\nOBJECTS\r\n|\r\nIMAGE\r\n|\r\nIMAGEDEF\r\n/);
  assert.equal(safeCadBaseName("Chácara Canaã / 01"), "CHACARA_CANAA_01");
});

test("classifica estrada e rio como confrontação especial", () => {
  assert.equal(classifyBoundaryType("Estrada de Servidão"), "ESTRADA_SERVIDAO");
  assert.equal(classifyBoundaryType("Rodovia MT-251"), "RODOVIA_ESTADUAL");
  assert.equal(classifyBoundaryType("BR-364"), "RODOVIA_FEDERAL");
  assert.equal(classifyBoundaryType("Rio Cuiabá"), "RIO");
  assert.equal(classifyBoundaryType("Córrego do Meio"), "CORREGO");
});

test("imóvel privado não gera laudo especial e rio ou estrada não geram anuência", () => {
  const project = cartorialProject();
  project.boundaries = [
    { ...project.boundaries[0], boundaryName: "FAZENDA VIZINHA" },
    { ...project.boundaries[1], boundaryName: "Estrada Municipal" },
    { ...project.boundaries[2], boundaryName: "Rio Cuiabá" },
  ];
  const context = buildCartorialDocumentContext(project);
  const special = buildSpecialBoundaryReports(context);
  assert.deepEqual(special.map((item) => item.type), ["ESTRADA_MUNICIPAL", "RIO"]);
  const consents = buildBoundaryDocuments(context);
  assert.equal(consents.length, 1);
  assert.equal(consents[0].boundary.name, "FAZENDA VIZINHA");
});

test("dossiê inclui somente peças selecionadas e preserva a ordem do índice", () => {
  const context = buildCartorialDocumentContext(cartorialProject());
  const selected = ["cover", "index", "request", "technicalReport", "comparison"];
  const dossier = buildDossier(context, {}, selected);
  assert.deepEqual(dossier.selected, selected);
  assert.deepEqual(dossier.index.map((item) => item.id), ["request", "technicalReport", "comparison"]);
  assert.ok(DOSSIER_DEFAULT_ORDER.indexOf("request") < DOSSIER_DEFAULT_ORDER.indexOf("comparison"));
});

test("impressão isola documento em fundo branco e não força quebra após a última página", () => {
  const css = readFileSync(new URL("../src/modules/geoRegistry/geo-registry.css", import.meta.url), "utf8");
  assert.match(css, /#print-root,.print-document\{background:#fff!important;color:#000!important\}/);
  assert.match(css, /\.gr-a4:last-child\{break-after:auto!important;page-break-after:auto!important\}/);
  assert.match(css, /\.print-document\{position:absolute!important;left:0!important;top:0!important/);
});

test("cenário A cria anuências para confrontantes particulares", () => {
  const project=cartorialProject(); const result=evaluateCartorialChecklist(project);
  assert.equal(result.items.filter((item)=>item.id.startsWith("boundary-consent-")).length,5);
});

test("cenários B e C sugerem SINFRA e DNIT com laudo de via", () => {
  const state=evaluateBoundaryRequirements({fromVertex:"A",toVertex:"B",boundaryName:"MT-251",boundaryType:"STATE_HIGHWAY"},MATO_GROSSO_GEO_BASE);
  const federal=evaluateBoundaryRequirements({fromVertex:"B",toVertex:"C",boundaryName:"BR-364",boundaryType:"FEDERAL_HIGHWAY"},MATO_GROSSO_GEO_BASE);
  assert.match(state.map((item)=>item.reason).join(" "),/SINFRA\/MT/); assert.ok(state.some((item)=>item.id.startsWith("road-report")));
  assert.match(federal.map((item)=>item.reason).join(" "),/DNIT/); assert.ok(federal.some((item)=>item.id.startsWith("road-report")));
});

test("cenários D e E sugerem INTERMAT e FUNAI com alerta crítico", () => {
  const project=cartorialProject(); project.boundaries=[{origin:"MEMORIAL",fromVertex:"A",toVertex:"B",boundaryName:"Terra pública",boundaryType:"PUBLIC_STATE"},{origin:"MEMORIAL",fromVertex:"B",toVertex:"C",boundaryName:"Terra Indígena",boundaryType:"INDIGENOUS_LAND"}];
  const result=evaluateCartorialChecklist(project);
  assert.match(result.items.map((item)=>item.reason).join(" "),/INTERMAT/); assert.match(result.items.map((item)=>item.reason).join(" "),/FUNAI/);
  assert.ok(result.alerts.some((alert)=>alert.priority==="CRITICAL"&&alert.title.includes("FUNAI")));
});

test("cenário F cria laudo de curso d'água sem presumir dominialidade", () => {
  const rules=evaluateBoundaryRequirements({fromVertex:"A",toVertex:"B",boundaryName:"Rio Cuiabá",boundaryType:"RIVER"});
  assert.ok(rules.some((item)=>item.id.startsWith("water-report"))); assert.ok(rules.some((item)=>item.id.startsWith("water-domain")&&item.status==="REVIEW_REQUIRED"));
});

test("cenários G e H condicionam documentos societários e procuração", () => {
  const project={...cartorialProject(),ownerType:"LEGAL_ENTITY",representation:{exists:true}}; const result=evaluateCartorialChecklist(project);
  assert.equal(result.items.find((item)=>item.id==="corporate-documents").status,"PENDING"); assert.equal(result.items.find((item)=>item.id==="power-of-attorney").status,"PENDING");
});

test("cenário I aplica perfil editável que exige CAR e Laudo", () => {
  const profile=createRegistryOfficeProfile({id:"nova-mutum",name:"1º Ofício — Nova Mutum",state:"MT",defaultRequirements:[{id:"car",title:"CAR",required:true},{id:"technical-report",title:"Laudo",required:true}]});
  const result=evaluateCartorialChecklist(cartorialProject(),profile);
  assert.equal(result.items.find((item)=>item.id==="car").required,true); assert.equal(result.items.find((item)=>item.id==="technical-report").required,true);
});

test("CHACARA CANAA separa imóveis particulares de Estrada de Servidão", () => {
  const project=cartorialProject(); project.boundaries[4]={...project.boundaries[4],boundaryName:"Estrada de Servidão",boundaryType:"EASEMENT_ROAD"}; const result=evaluateCartorialChecklist(project);
  assert.equal(result.items.filter((item)=>item.id.startsWith("boundary-consent-")).length,4); assert.ok(result.items.some((item)=>item.id.startsWith("easement-review-"))); assert.ok(result.items.some((item)=>item.id.startsWith("easement-report-")));
});

test("READY exige que todos os itens obrigatórios estejam disponíveis ou confirmados", () => {
  assert.equal(calculateProtocolReadiness([{required:true,status:"PENDING"}]).state,"NOT_READY"); assert.equal(calculateProtocolReadiness([{required:true,status:"REVIEW_REQUIRED"}]).state,"REVIEW_REQUIRED"); assert.equal(calculateProtocolReadiness([{required:true,status:"AVAILABLE"},{required:true,status:"CONFIRMED"},{required:true,status:"NOT_APPLICABLE"}]).state,"READY");
});

test("override preserva auditoria, relatório lista pendências e dossiê usa documentos vinculados", () => {
  const project=cartorialProject(); const changed=applyChecklistOverride(project,"ccir",{status:"AVAILABLE",documentIds:["doc-ccir"]},"TESTE","2026-08-17T12:00:00.000Z"); const evaluation=evaluateCartorialChecklist(changed); const ccir=evaluation.items.find((item)=>item.id==="ccir");
  assert.equal(ccir.audit[0].actor,"TESTE"); assert.ok(buildPendingRequirementsReport(changed,evaluation).items.length>0); assert.deepEqual(dossierItemsFromChecklist(evaluation),[{requirementId:"ccir",documentId:"doc-ccir"}]);
});

test("camada pt-BR traduz status, níveis, fontes e prioridades sem expor enums", () => {
  assert.equal(statusLabel("PENDING"),"Pendente"); assert.equal(statusLabel("AVAILABLE"),"Disponível"); assert.equal(statusLabel("CONFIRMED"),"Confirmado"); assert.equal(statusLabel("NOT_APPLICABLE"),"Não aplicável"); assert.equal(statusLabel("REVIEW_REQUIRED"),"Revisão necessária"); assert.equal(requirementLabel("STATE_CORE"),"Exigência estadual"); assert.equal(requirementLabel("REGISTRY_PROFILE"),"Exigência do cartório"); assert.equal(sourceLabel("BOUNDARY_RULE"),"Regra de confrontação"); assert.equal(priorityLabel("CRITICAL"),"Crítica");
});

test("validador documental separa críticos, recomendados e opcionais",()=>{const context=buildCartorialDocumentContext(cartorialProject());const result=validateDocumentData("request",context);assert.equal(result.ready,true);assert.ok(result.recommendedMissing.includes("owner.phone"));assert.ok(result.optionalMissing.includes("procedure.protocol"));});
test("campo crítico bloqueia documento e campo opcional não bloqueia",()=>{const project=cartorialProject();delete project.cartorialData["procedure.notes"];let result=buildCartorialPieces(project).request.validation;assert.equal(result.ready,true);project.registry.registryOffice="";result=buildCartorialPieces(project).request.validation;assert.equal(result.ready,false);assert.ok(result.criticalMissing.includes("registryOffice"));});
test("requerimento e declaração não geram tokens proibidos ou data quebrada",()=>{const project=cartorialProject();const pieces=buildCartorialPieces(project);assert.deepEqual(documentTextIssues(pieces.request.text),[]);assert.deepEqual(documentTextIssues(pieces.ownerDeclaration.text),[]);assert.doesNotMatch(pieces.request.text,/Livramento,\s*\./);});
test("pessoa jurídica não recebe exigência de estado civil ou contrato social no requerimento-base",()=>{const project=cartorialProject();project.ownerType="LEGAL_ENTITY";project.cartorialData={...project.cartorialData,"owner.type":{value:"LEGAL_ENTITY",confirmed:true},"legalEntity.corporateName":{value:"EMPRESA RURAL LTDA",confirmed:true},"legalEntity.document":{value:"00.000.000/0001-00",confirmed:true}};const text=buildCartorialPieces(project).request.text;assert.match(text,/EMPRESA RURAL LTDA/);assert.doesNotMatch(text,/estado civil|DADO PENDENTE|contrato social/i);});
test("anuência sem proprietário confrontante fica bloqueada sem perder trechos documentais",()=>{const documents=buildBoundaryDocuments(buildCartorialDocumentContext(cartorialProject()));assert.equal(documents[0].validation.ready,false);assert.equal(documents[0].warning,"Proprietário do confrontante não informado.");assert.ok(documents[0].rows.every((row)=>row.azimuth&&row.distance));});
test("memorial mantém fuso e meridiano opcionais sem texto vazio proibido",()=>{const pieces=buildCartorialPieces(cartorialProject());assert.equal(pieces.memorial.document.geodesy.zone.value,"");assert.equal(pieces.memorial.validation.ready,true);});
test("notificação lista particulares e exclui estrada de servidão",()=>{const project=cartorialProject();project.boundaries.push({...project.boundaries[0],boundaryName:"Estrada de Servidão"});const eligible=eligibleBoundariesForNotification(project.boundaries);assert.equal(eligible.length,5);assert.ok(eligible.every((item)=>!item.name.includes("Estrada")));});
test("notificação sem endereço e CPF informa pendências específicas",()=>{const context=buildCartorialDocumentContext(cartorialProject());const boundary=eligibleBoundariesForNotification(cartorialProject().boundaries)[0];const result=validateBoundaryNotification(context,boundary);assert.ok(result.criticalMissing.some((item)=>item.message.includes("endereço")));assert.ok(result.recommendedMissing.some((item)=>item.label.includes("CPF")));});
test("notificação PF com endereço completo fica pronta",()=>{const context=buildCartorialDocumentContext({...cartorialProject(),cartorialData:{...cartorialProject().cartorialData,"procedure.requestDate":{value:"17/08/2026",confirmed:true}}});const boundary=eligibleBoundariesForNotification(cartorialProject().boundaries)[0];boundary.complement={owner:"JOÃO DA SILVA",boundaryPossessionType:"PROPRIETÁRIO",address:"Rua Um",addressNumber:"10",municipality:"Cuiabá",state:"MT",postalCode:"78000-000"};assert.equal(validateBoundaryNotification(context,boundary).ready,true);});
test("notificação PJ exige CNPJ e usa prazo centralizado",()=>{const context=buildCartorialDocumentContext({...cartorialProject(),cartorialData:{...cartorialProject().cartorialData,"procedure.requestDate":{value:"17/08/2026",confirmed:true}}});const boundary=eligibleBoundariesForNotification(cartorialProject().boundaries)[0];boundary.complement={partyType:"LEGAL_ENTITY",corporateName:"FAZENDA EMPRESA LTDA",boundaryPossessionType:"PROPRIETÁRIO",notificationAddressFree:"Avenida Central, 100, Cuiabá/MT"};const result=validateBoundaryNotification(context,boundary);assert.ok(result.criticalMissing.some((item)=>item.message.includes("CNPJ")));assert.equal(notificationTemplate.legalDeadline,15);});
test("lote de notificações separa prontas e rascunhos com status em português",()=>{const project={...cartorialProject(),cartorialData:{...cartorialProject().cartorialData,"procedure.requestDate":{value:"17/08/2026",confirmed:true}}};const context=buildCartorialDocumentContext(project);const eligible=eligibleBoundariesForNotification(project.boundaries);eligible[0].complement={owner:"JOÃO",boundaryPossessionType:"PROPRIETÁRIO",notificationAddressFree:"Rua Um, 10, Cuiabá/MT"};const batch=buildNotificationBatch(context,eligible.slice(0,2));assert.equal(batch[0].status,"READY");assert.equal(batch[1].status,"DRAFT");assert.equal(notificationStatusLabel("READY"),"Pronta para assinatura");assert.equal(notificationStatusLabel("DRAFT"),"Rascunho");});
test("preset Métrica TOPO mapeia chaves reais sem descartar campos desconhecidos",()=>{assert.equal(METRICA_TOPO_PRESET.tables.CadImovel.fields.CodigoImovel,"legacy_id");assert.equal(METRICA_TOPO_PRESET.tables.CadMatricula.fields.CodigoImovel,"property.legacy_id");assert.deepEqual(unmappedFields({name:"CadCliente",columns:[{name:"Codigo_Cliente"},{name:"IE"}]}),["IE"]);});
test("simulação do MDB não realiza escritas e classifica registros para revisão",()=>{const analysis={tables:[{name:"CadCliente",count:207,columns:[]},{name:"CadEmpresa",count:3,columns:[]},{name:"CadImovel",count:7524,columns:[]},{name:"CadMatricula",count:7536,columns:[]},{name:"CadProprietario",count:7529,columns:[]},{name:"CadServico",count:209,columns:[]}],issues:[{table:"CadImovel",kind:"EMPTY",count:3},{table:"CadProprietario",kind:"EMPTY",count:50}],totals:{incomplete:53,orphanedRelationships:5,duplicateGroups:1597}};const result=buildImportSimulation(analysis);assert.equal(result.totals.found,23008);assert.equal(result.totals.writes,0);assert.equal(result.mode,"SIMULATE");assert.equal(result.entities.find((item)=>item.table==="CadImovel").ready,7521);});
test("imóvel Métrica é adaptado para Projeto GEO sem validar dados automaticamente",()=>{const project=legacyPropertyToGeoProject({property_id:"abc",legacy_id:"42",name:"FAZENDA TESTE",municipality:"Cuiabá",state:"MT",area_original:"1.234,5678 ha",perimeter_original:"4.321,09 m",sigef_code:"SIGEF-1",registration_number:"123",cns:"456",registry_office_name:"CRI",registry_district:"Cuiabá",owner_name:"Maria",owner_document:"000.000.000-00",created_at:"2026-08-18T00:00:00Z"});assert.equal(project.id,"metrica-abc");assert.equal(project.property.name,"FAZENDA TESTE");assert.equal(project.property.area,1234.5678);assert.equal(project.property.perimeter,4321.09);assert.equal(project.registry.owner,"Maria");assert.equal(project.registryState,"REVIEW_REQUIRED");assert.equal(project.registry.confirmed,false);assert.equal(project.dataOrigins["property.name"],"IMPORTAÇÃO MÉTRICA TOPO");});
test("número legado inválido permanece vazio",()=>{assert.equal(parseLegacyNumber(""),null);assert.equal(parseLegacyNumber("não informado"),null);});
test("tabelas importadas são relacionadas para a lista da Averbação GEO",()=>{const rows=joinLegacyGeoRows([{id:"p1",legacy_source:"METRICA_TOPO_MDB",legacy_table:"CadImovel",legacy_id:"7",name:"SÍTIO"}],[{id:"r1",property_id:"p1",registration_number:"10",cns:"20"}],[{id:"o1",property_id:"p1",person_id:"person1",is_primary:true}],[{id:"person1",name:"José",cpf:"123"}],[]);assert.equal(rows.length,1);assert.equal(rows[0].registration_number,"10");assert.equal(rows[0].owner_name,"José");});
