import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { generateLocationMap } from "./plantLayout.mjs";

export const SATELLITE_SOURCE = "Esri World Imagery";
export function LocationSatelliteMap({ context }) {
  const element = useRef(null), descriptor = useMemo(() => generateLocationMap(context), [context]);
  useEffect(() => {
    if (!element.current || !descriptor.bounds) return undefined;
    const map = L.map(element.current, { attributionControl: false, zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false, preferCanvas: true });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, crossOrigin: true }).addTo(map);
    L.polygon(descriptor.ring.map(([longitude, latitude]) => [latitude, longitude]), { color: "#ff1e00", weight: 4, opacity: 1, fillColor: "#fff200", fillOpacity: .22 }).addTo(map);
    map.fitBounds(descriptor.bounds, { animate: false });
    const refresh = window.setTimeout(() => map.invalidateSize(false), 80);
    return () => { window.clearTimeout(refresh); map.remove(); };
  }, [descriptor]);
  return <div className="plant-location-map"><div ref={element}/><span>Imagem: {SATELLITE_SOURCE}</span></div>;
}
