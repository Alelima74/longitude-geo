import React from "react";
import { CoordinateTable } from "./CoordinateTable.jsx";
import { LocationSatelliteMap } from "./LocationSatelliteMap.jsx";
import { MainParcelMap } from "./MainParcelMap.jsx";
import { buildPlantLayout, formatScale, scaleBarFor } from "./plantLayout.mjs";

const value = (item) => item?.value ?? item ?? "";
const number = (item, digits = 2) => Number.isFinite(Number(value(item))) ? Number(value(item)).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "-";

export const LONGITUDE_PLANT_TEMPLATE = Object.freeze({
  sheet: { width: 594, height: 420, orientation: "landscape", format: "A2" },
  border: { x: 25, y: 0, width: 569, height: 420, innerX: 35, innerY: 10, innerWidth: 549, innerHeight: 400 },
  mainViewport: { x: 35, y: 10, width: 374, height: 261.5 },
  lowerViewport: { x: 35, y: 271.5, width: 374, height: 138.5 },
  titleBlock: { x: 419, y: 123, width: 165, height: 277 },
  legendFrame: { x: 409, y: 49.77, width: 69.95, height: 73.23 },
  cartographicFrame: { x: 478.95, y: 49.77, width: 105.05, height: 73.23 },
  scaleBar: { x: 445.08, y: 34.81, width: 100, height: 12 },
});

export function PlantTemplate({ context }) {
  const layout = buildPlantLayout(context), scaleBar = scaleBarFor(layout.scale);
  return <article className="plant-master">
    <div className="plant-binding-margin"/><div className="plant-inner-border"/>
    <section className="plant-main-viewport"><MainParcelMap context={context}/></section>
    <section className="plant-lower-viewport"><div className="plant-situation"><b>Situação:</b><LocationSatelliteMap context={context}/></div><Legend context={context}/></section>
    <section className="plant-master-legend"><Legend context={context}/></section>
    <section className="plant-cartographic"><b>Informações de Coordenadas</b><span>PROJEÇÃO UNIVERSAL TRANSVERSA DE MERCATOR - UTM</span><span>SGR - SIRGAS 2000</span><span>MC: {value(context.centralMeridian) || "-"}</span></section>
    <ScaleBar descriptor={scaleBar}/>
    <aside className="plant-original-seal"><SealHeader/><TitleBlock context={context} scale={layout.scale}/><SignaturePanel context={context}/><CoordinateTable context={context}/></aside>
    <small className="plant-paper">A2 = ( 594 × 420 )</small>
    {import.meta.env.DEV && <GeometryAudit canonical={layout.canonicalGeometry} layout={layout}/>}
  </article>;
}

function GeometryAudit({ canonical, layout }) { return <section className={`plant-geometry-audit ${canonical.valid ? "valid" : "invalid"}`} data-html2canvas-ignore="true"><h3>AUDITORIA GEOMÉTRICA</h3><strong>{canonical.status}</strong><p>Fingerprint: {canonical.fingerprint} · Projeção: {canonical.projection || "NÃO DEFINIDA"} · Escala X/Y: {layout.scaleX ?? "-"} / {layout.scaleY ?? "-"}</p>{canonical.issues.length > 0 && <p>{canonical.issues.join(" ")}</p>}<table><thead><tr><th>Trecho</th><th>Azimute SIGEF</th><th>Azimute calculado</th><th>Distância SIGEF</th><th>Distância calculada</th></tr></thead><tbody>{canonical.surveyTraverse.map((segment) => <tr key={`${segment.from}-${segment.to}`}><td>{segment.from} → {segment.to}</td><td>{segment.documentAzimuth || "-"}</td><td>{segment.calculatedAzimuth == null ? "-" : segment.calculatedAzimuth.toFixed(6)}</td><td>{segment.documentDistance ?? "-"}</td><td>{segment.calculatedDistance == null ? "-" : segment.calculatedDistance.toFixed(4)}</td></tr>)}</tbody></table></section>; }

function Legend({ context }) { const types = [...new Set((context.vertices || []).map((vertex) => String(vertex.code || "").split("-")[1]).filter(Boolean))]; return <div className="plant-conventions"><strong>LEGENDA</strong>{types.map((type) => <span key={type}>⊙ Vértices Tipo {type}</span>)}<span>━ Área de Preservação</span><span>╬ Vias de Acesso</span><span>≈ Córrego ou Nascente</span></div>; }
function ScaleBar({ descriptor }) { return <div className="plant-scale-bar"><b>ESCALA:</b><div className="scale-labels">{Array.from({ length: descriptor.divisions + 1 }, (_, index) => <span key={index}>{Number(descriptor.total / descriptor.divisions * index).toLocaleString("pt-BR")}</span>)}</div><div className="scale-blocks">{Array.from({ length: descriptor.divisions }, (_, index) => <i className={index % 2 ? "light" : "dark"} key={index}/>)}</div></div>; }
function SealHeader() { return <header><small>Título:</small><strong>PLANIMÉTRICO GEORREFERENCIADO</strong><b>Folha:<em>01</em></b></header>; }
function TitleBlock({ context, scale }) { return <section className="plant-title-block"><p><span>PROPRIEDADE:</span><b>{value(context.property.name)}</b></p><p><span>PROPRIETÁRIO:</span><b>{value(context.property.owner)}</b></p><p><span>MUNICÍPIO(S):</span><b>{value(context.property.municipality)}-{value(context.property.state)}</b></p><p><span>COMARCA(S):</span><b>{value(context.registry.district)}-{value(context.registry.state)}</b></p><p><span>CÓDIGO INCRA:</span><b>{value(context.property.incraCode)}</b></p><p><span>MAT./TRANSC.:</span><b>{value(context.registry.registrationNumber)}</b><span>CNS: <b>{value(context.registry.cns)}</b></span></p><p><span>CERTIF. SIGEF:</span><b>{value(context.certification)}</b></p><p><span>ÁREA TOTAL (ha): <b>{number(context.area, 4)}</b></span><span>PERÍMETRO (m): <b>{number(context.perimeter, 2)}</b></span></p><p><span>DATA: <b>{value(context.procedure.requestDate) || new Date().toLocaleDateString("pt-BR")}</b></span><span>ESCALA: <b>{formatScale(scale)}</b></span></p></section>; }
function SignaturePanel({ context }) { return <div className="plant-signatures"><small>Quadro de Assinaturas:</small><div><i/>Prop.: <b>{value(context.property.owner)}</b></div><div><i/>Resp. Téc.: <b>{value(context.technical.name)}</b><span>{value(context.technical.profession)} · {value(context.technical.council)} {value(context.technical.registrationNumber)}</span><span>INCRA: {value(context.technical.accreditation)}</span></div><footer>{value(context.technical.responsibilityTerm)}</footer></div>; }
