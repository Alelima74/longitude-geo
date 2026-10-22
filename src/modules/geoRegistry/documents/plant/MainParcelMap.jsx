import React from "react";
import { buildPlantLayout } from "./plantLayout.mjs";
import { PlantExportActions } from "./PlantExportActions.jsx";

export function MainParcelMap({ context }) {
  const layout = buildPlantLayout(context);
  if (layout.blocked || !layout.points.length) return <div className="plant-map-empty"><PlantExportActions context={context}/><strong>{layout.status || "GEOMETRIA NÃO DISPONÍVEL"}</strong><span>{layout.issues?.join(" ")}</span></div>;
  const polygon = layout.points.map((point) => point.join(",")).join(" ");
  return <div className="plant-main-map"><PlantExportActions context={context}/><svg viewBox={`0 0 ${layout.viewport.width} ${layout.viewport.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Planta técnica da parcela">
    <polygon className="plant-parcel" points={polygon}/>
    {layout.boundaryLabels.map((label, index) => <g className="plant-boundary-label" key={`${label.fromVertex || index}-${label.toVertex || index}`} transform={`translate(${label.x} ${label.y}) rotate(${label.angle})`}><text textAnchor="middle">{label.title}</text>{label.details && <text className="details" textAnchor="middle" y="15">{label.details}</text>}</g>)}
    {layout.vertexPoints.map(({ point: [x, y], vertex, index }) => <g className="plant-vertex" key={vertex.code || index}><circle cx={x} cy={y} r="5"/><text x={x + 9} y={y - 9}>{vertex.code || `V${index + 1}`}</text></g>)}
    <g className="plant-north" transform="translate(58 70)"><text x="0" y="-34" textAnchor="middle">N</text><path d="M0,-28 L-10,8 L0,2 L10,8 Z"/><line x1="0" y1="2" x2="0" y2="28"/></g>
  </svg></div>;
}
