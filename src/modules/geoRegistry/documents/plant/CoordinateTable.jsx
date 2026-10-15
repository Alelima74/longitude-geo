import React from "react";

export function CoordinateTable({ context }) {
  const rows = context.vertices || [], groups = rows.length > 12 ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))] : [rows];
  return <section className={`plant-coordinate-panel ${groups.length > 1 ? "two-columns" : ""}`}><h3>{value(context.property.name) || "QUADRO DE COORDENADAS"}</h3><div>{groups.map((group, groupIndex) => <table key={groupIndex}><thead><tr><th>Vértice</th><th>Latitude</th><th>Longitude</th><th>Altitude</th></tr></thead><tbody>{group.map((vertex, index) => <tr key={`${vertex.code}-${index}`}><td>{vertex.code}</td><td>{vertex.latitudeDocument || formatDecimal(vertex.latitudeDecimal, "S", "N")}</td><td>{vertex.longitudeDocument || formatDecimal(vertex.longitudeDecimal, "W", "E")}</td><td>{vertex.altitude == null ? "-" : `${Number(vertex.altitude).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m`}</td></tr>)}</tbody></table>)}</div><footer>Área (SGL): {format(value(context.area), 4)} ha &nbsp; | &nbsp; Perímetro (Cart.): {format(value(context.perimeter), 2)} m</footer></section>;
}
const value = (item) => item?.value ?? item ?? "";
const format = (item, digits) => Number.isFinite(Number(item)) ? Number(item).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "-";
const formatDecimal = (item, negative, positive) => Number.isFinite(Number(item)) ? `${Math.abs(Number(item)).toFixed(7).replace(".", ",")}° ${Number(item) < 0 ? negative : positive}` : "-";
