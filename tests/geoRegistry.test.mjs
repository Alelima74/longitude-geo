import test from "node:test";
import assert from "node:assert/strict";
import { parseSigefMemorialText } from "../src/modules/geoRegistry/sigefMemorialParser.mjs";
import { enrichCalculatedSegments } from "../src/modules/geoRegistry/segmentCalculations.mjs";
import { findInLocalSigef } from "../src/modules/geoRegistry/localSigefSearch.mjs";
import { reconstructPdfLines } from "../src/modules/geoRegistry/sigefLayoutParser.mjs";
import { buildCartorialPieces } from "../src/modules/geoRegistry/cartorialPieces.mjs";
import { parseRegistryDocument } from "../src/modules/geoRegistry/registryDocumentParser.mjs";
import { assessNativeText, chooseRegistryText } from "../src/modules/geoRegistry/registryOcrPolicy.mjs";
import { validateGeometry, verticesToFeature } from "../src/modules/geoRegistry/geometryValidationService.mjs";

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
test("validação detecta vértice duplicado e quantidade insuficiente", () => {
  const result = validateGeometry([{ longitude: -56, latitude: -15 }, { longitude: -56, latitude: -15 }], {});
  assert.equal(result.status, "INCONSISTENTE"); assert.ok(result.issues.length >= 2);
});
test("conteúdo inesperado não causa exceção", () => assert.doesNotThrow(() => parseSigefMemorialText("%PDF conteúdo fora do padrão @@@")));
test("normaliza ponto de milhar e vírgula decimal brasileira", () => {
  assert.equal(parseSigefMemorialText("Área: 1.891,7172 ha").data.property.area, 1891.7172);
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
