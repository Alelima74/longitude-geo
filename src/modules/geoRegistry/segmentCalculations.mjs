import * as turf from "@turf/turf";

export function enrichCalculatedSegments(segments = [], vertices = []) {
  const byCode = new Map(vertices.map((item) => [item.code, item]));
  return segments.map((segment) => {
    const from = byCode.get(segment.fromVertex);
    const to = byCode.get(segment.toVertex);
    if (![from?.longitude, from?.latitude, to?.longitude, to?.latitude].every(Number.isFinite)) return segment;
    const start = turf.point([from.longitude, from.latitude]);
    const end = turf.point([to.longitude, to.latitude]);
    return {
      ...segment,
      azimuthCalculated: ((turf.bearing(start, end) % 360) + 360) % 360,
      distanceCalculated: turf.distance(start, end, { units: "kilometers" }) * 1000,
    };
  });
}
