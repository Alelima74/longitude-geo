import { buildPlantLayout } from "./plantLayout.mjs";
import { buildCanonicalGeometry, distance } from "./canonicalGeometry.mjs";

export const DXF_VERSION = "AC1009";
export const CAD_LAYERS = ["LAYOUT", "FOLHA_MOLDURA", "FOLHA_SELO_GRANDE", "IMAGEMPLANTA", "LEGENDA", "ESCALA_GRAFICA", "INFORMACOES_CARTOGRAFICAS", "ROTEIRO_PERIMETRICO", "PLANTA_VIEWPORT", "VERTICES", "###_TEXTOS_DOS_PONTOS", "CONFRONTANTE", "TABELA"];

export function safeCadBaseName(name) { return String(value(name) || "PROJETO_GEO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "PROJETO_GEO"; }

export function buildPlantDxf(context, imageFileName) {
  const canonical = buildCanonicalGeometry(context);
  if (!canonical.valid) throw new Error(`${canonical.status}: ${canonical.issues.join(" ")}`);
  const writer = new DxfWriter();
  writer.section("HEADER", () => { writer.variable("$ACADVER", [[1, DXF_VERSION]]); writer.variable("$INSUNITS", [[70, 6]]); writer.variable("$LIMMIN", [[10, 0], [20, 0]]); writer.variable("$LIMMAX", [[10, 594], [20, 420]]); });
  writer.section("TABLES", () => writeTables(writer));
  writer.section("BLOCKS", () => {});
  writer.section("ENTITIES", () => { writeModelSpace(writer, context); writeCompleteSheet(writer, context, imageFileName); });
  writer.pair(0, "EOF");
  const dxf = writer.toString();
  validatePlantDxf(dxf);
  validatePlantDxfRoundTrip(dxf, canonical);
  return dxf;
}

export function validatePlantDxfRoundTrip(dxf, canonical) {
  const pairs = pairsOf(dxf); let active = false, layer = "", vertices = [], current = null;
  for (const [code, value] of pairs) {
    if (code === 0 && value === "POLYLINE") { active = true; layer = ""; vertices = []; current = null; continue; }
    if (!active) continue;
    if (code === 8 && !layer) layer = value;
    if (code === 0 && value === "VERTEX") { current = [null, null]; vertices.push(current); continue; }
    if (current && code === 10) current[0] = Number(value); if (current && code === 20) current[1] = Number(value);
    if (code === 0 && value === "SEQEND") { if (layer === "ROTEIRO_PERIMETRICO") break; active = false; current = null; }
  }
  if (vertices.length !== canonical.projected.length) throw new Error("DXF round-trip inválido: quantidade de vértices divergente.");
  const maximumCoordinateDifference = Math.max(0, ...vertices.map((point, index) => distance(point, canonical.projected[index])));
  if (maximumCoordinateDifference > 1e-6) throw new Error(`DXF round-trip inválido: diferença máxima ${maximumCoordinateDifference} m.`);
  const closed = vertices.length > 2; if (!closed) throw new Error("DXF round-trip inválido: perímetro não fechado.");
  return { valid: true, vertexCount: vertices.length, maximumCoordinateDifference, fingerprint: canonical.fingerprint };
}

export function validatePlantDxf(dxf) {
  const lines = String(dxf).replace(/\r\n/g, "\n").split("\n"); if (lines.at(-1) === "") lines.pop();
  if (lines.length % 2) throw new Error(`DXF inválido: group code sem valor na linha ${lines.length}.`);
  const pairs = [];
  for (let index = 0; index < lines.length; index += 2) { if (!/^-?\d+$/.test(lines[index].trim())) throw new Error(`DXF inválido: group code na linha ${index + 1}.`); pairs.push([Number(lines[index]), lines[index + 1]]); }
  if (pairs.at(-1)?.[0] !== 0 || pairs.at(-1)?.[1] !== "EOF") throw new Error("DXF inválido: EOF ausente.");
  let openSection = null; const sections = [];
  for (let index = 0; index < pairs.length; index++) { const [code, val] = pairs[index]; if (code === 0 && val === "SECTION") { if (openSection) throw new Error("DXF inválido: SECTION aninhada."); const next = pairs[++index]; if (next?.[0] !== 2) throw new Error("DXF inválido: SECTION sem nome."); openSection = next[1]; sections.push(openSection); } else if (code === 0 && val === "ENDSEC") { if (!openSection) throw new Error("DXF inválido: ENDSEC sem SECTION."); openSection = null; } }
  if (openSection) throw new Error(`DXF inválido: SECTION ${openSection} não fechada.`);
  for (const required of ["HEADER", "TABLES", "BLOCKS", "ENTITIES"]) if (!sections.includes(required)) throw new Error(`DXF inválido: SECTION ${required} ausente.`);
  if (sections.includes("OBJECTS")) throw new Error("DXF R12 não deve conter OBJECTS.");
  return { version: DXF_VERSION, pairCount: pairs.length, sections };
}

function writeTables(writer) {
  writer.pair(0, "TABLE"); writer.pair(2, "LTYPE"); writer.pair(70, 1); writer.pair(0, "LTYPE"); writer.pair(2, "CONTINUOUS"); writer.pair(70, 0); writer.pair(3, "Solid line"); writer.pair(72, 65); writer.pair(73, 0); writer.pair(40, 0); writer.pair(0, "ENDTAB");
  writer.pair(0, "TABLE"); writer.pair(2, "LAYER"); writer.pair(70, CAD_LAYERS.length); for (const layer of CAD_LAYERS) { writer.pair(0, "LAYER"); writer.pair(2, layer); writer.pair(70, 0); writer.pair(62, layer === "01_PERIMETRO" ? 3 : 7); writer.pair(6, "CONTINUOUS"); } writer.pair(0, "ENDTAB");
  writer.pair(0, "TABLE"); writer.pair(2, "STYLE"); writer.pair(70, 1); writer.pair(0, "STYLE"); writer.pair(2, "STANDARD"); writer.pair(70, 0); writer.pair(40, 0); writer.pair(41, 1); writer.pair(50, 0); writer.pair(71, 0); writer.pair(42, 2.5); writer.pair(3, "txt"); writer.pair(4, ""); writer.pair(0, "ENDTAB");
}

function writeModelSpace(writer, context) {
  const canonical = buildCanonicalGeometry(context), model = realCoordinates(canonical); if (model.points.length < 3) return;
  writer.polyline(model.points, "ROTEIRO_PERIMETRICO", true);
  model.points.forEach(([x, y], index) => { writer.point(x, y, "VERTICES"); writer.text(x + model.offset, y + model.offset, context.vertices[index]?.code || `V${index + 1}`, "###_TEXTOS_DOS_PONTOS", model.textHeight); });
  (context.boundaries || []).slice(0, model.points.length).forEach((boundary, index) => { const a = model.points[index], b = model.points[(index + 1) % model.points.length]; writer.text((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, boundary.boundaryName || "CONFRONTANTE", "CONFRONTANTE", model.textHeight); });
}

function writeCompleteSheet(writer, context, imageFileName) {
  const sheet = buildPlantLayout(context, { width: 374, height: 261.5, widthMm: 374, heightMm: 261.5 });
  writer.polyline([[25,0],[594,0],[594,420],[25,420]], "FOLHA_MOLDURA", true); writer.polyline([[35,10],[584,10],[584,410],[35,410]], "FOLHA_MOLDURA", true);
  writer.line(409,10,409,410,"LAYOUT"); writer.line(35,148.5,409,148.5,"LAYOUT"); writer.line(419,10,419,287,"FOLHA_SELO_GRANDE"); writer.line(584,10,584,410,"LAYOUT");
  writer.polyline([[35,10],[409,10],[409,148.5],[35,148.5]], "IMAGEMPLANTA", true); writer.text(38,144,"SITUACAO:","IMAGEMPLANTA",2.5); writer.text(38,13,`IMAGEM EXTERNA: ${imageFileName}`,"IMAGEMPLANTA",1.8);
  writer.polyline([[409,297],[478.95,297],[478.95,370.23],[409,370.23]],"LEGENDA",true); writer.polyline([[478.95,297],[584,297],[584,370.23],[478.95,370.23]],"INFORMACOES_CARTOGRAFICAS",true);
  writer.text(445.08,389,"ESCALA:","ESCALA_GRAFICA",2.9); for(let index=0;index<5;index++){writer.line(445.08+index*20,382.69,465.08+index*20,382.69,"ESCALA_GRAFICA");writer.line(445.08+index*20,382.69,445.08+index*20,385.19,"ESCALA_GRAFICA");}
  writer.text(423,281,"PLANIMETRICO GEORREFERENCIADO","FOLHA_SELO_GRANDE",4.5); writer.text(562,281,"FOLHA 01","FOLHA_SELO_GRANDE",2.9);
  const seal = [["PROPRIEDADE",value(context.property?.name)],["PROPRIETARIO",value(context.property?.owner)],["MUNICIPIO",`${value(context.property?.municipality)}-${value(context.property?.state)}`],["COMARCA",`${value(context.registry?.district)}-${value(context.registry?.state)}`],["CODIGO INCRA",value(context.property?.incraCode)],["MATRICULA",value(context.registry?.registrationNumber)],["CNS",value(context.registry?.cns)],["CERTIF. SIGEF",value(context.certification)],["AREA",`${value(context.area)} ha`],["PERIMETRO",`${value(context.perimeter)} m`],["DATA",value(context.procedure?.requestDate)],["RESP. TECNICO",value(context.technical?.name)]];
  writer.polyline([[419,10],[584,10],[584,287],[419,287]],"FOLHA_SELO_GRANDE",true); seal.forEach(([label,val],index)=>writer.text(423,250-index*6,`${label}: ${val}`,"FOLHA_SELO_GRANDE",2.3));
  writer.text(412,365,"LEGENDA","LEGENDA",2.5); writer.text(412,358,"O VERTICE TIPO M","LEGENDA",2); writer.text(482,365,"INFORMACOES DE COORDENADAS","INFORMACOES_CARTOGRAFICAS",2.5); writer.text(482,355,"SIRGAS 2000 / UTM","INFORMACOES_CARTOGRAFICAS",2);
  writer.polyline([[423,14],[580,14],[580,96],[423,96]],"TABELA",true); writer.text(426,91,"VERTICE | LATITUDE | LONGITUDE | ALTITUDE","TABELA",1.8); (context.vertices||[]).slice(0,14).forEach((vertex,index)=>writer.text(426,86-index*4.7,`${vertex.code} | ${vertex.latitudeDocument||""} | ${vertex.longitudeDocument||""} | ${vertex.altitude??""}`,"TABELA",1.5));
  if (sheet.points.length) { const scaled = sheet.points.slice(0,-1).map(([x,y])=>[35+x,148.5+y]); writer.polyline(scaled,"PLANTA_VIEWPORT",true); }
  writer.text(55,385,"N","LAYOUT",4); writer.line(55,380,55,367,"LAYOUT"); writer.line(55,380,52,374,"LAYOUT"); writer.line(55,380,58,374,"LAYOUT");
}

function realCoordinates(canonical) { const points=canonical.projected; if(!points.length)return{points:[],offset:1,textHeight:1}; const span=Math.max(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])),1);return{points,offset:span*.012,textHeight:span*.018}; }
function pairsOf(dxf) { const lines=String(dxf).replace(/\r\n/g,"\n").split("\n"); const pairs=[]; for(let index=0;index+1<lines.length;index+=2)pairs.push([Number(lines[index].trim()),lines[index+1]]); return pairs; }
class DxfWriter { constructor(){this.pairs=[];} pair(code,val){if(!Number.isInteger(Number(code))||val==null)throw new Error("Par DXF inválido.");this.pairs.push([Number(code),cad(val)]);} variable(name,pairs){this.pair(9,name);pairs.forEach(pair=>this.pair(...pair));} section(name,callback){this.pair(0,"SECTION");this.pair(2,name);callback();this.pair(0,"ENDSEC");} line(x1,y1,x2,y2,layer){this.entity("LINE",layer,[[10,x1],[20,y1],[30,0],[11,x2],[21,y2],[31,0]]);} point(x,y,layer){this.entity("POINT",layer,[[10,x],[20,y],[30,0]]);} text(x,y,content,layer,height){this.entity("TEXT",layer,[[10,x],[20,y],[30,0],[40,height],[1,content],[7,"STANDARD"]]);} polyline(points,layer,closed){this.pair(0,"POLYLINE");this.pair(8,layer);this.pair(66,1);this.pair(10,0);this.pair(20,0);this.pair(30,0);this.pair(70,closed?1:0);for(const[x,y]of points){this.pair(0,"VERTEX");this.pair(8,layer);this.pair(10,x);this.pair(20,y);this.pair(30,0);this.pair(70,0);}this.pair(0,"SEQEND");this.pair(8,layer);} entity(type,layer,pairs){this.pair(0,type);this.pair(8,layer);pairs.forEach(pair=>this.pair(...pair));} toString(){return this.pairs.map(([code,val])=>`${code}\r\n${val}\r\n`).join("");} }
function cad(input){return String(value(input)).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g,"?").replace(/[\r\n]/g," ");} function value(item){return item?.value??item??"";}
