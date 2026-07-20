export function utmToLatLon(easting, northing, zone, hemisphere = "S") {
  const E = Number(String(easting).replace(",", "."));
  const N = Number(String(northing).replace(",", "."));
  const Z = Number(zone);
  if (!Number.isFinite(E) || !Number.isFinite(N) || !Number.isFinite(Z) || Z < 1 || Z > 60) {
    throw new Error("Informe coordenadas UTM e fuso válidos.");
  }

  const a = 6378137.0;
  const eccSquared = 0.00669438002290;
  const k0 = 0.9996;
  let x = E - 500000.0;
  let y = N;
  if (String(hemisphere).toUpperCase() === "S") y -= 10000000.0;

  const longOrigin = (Z - 1) * 6 - 180 + 3;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const M = y / k0;
  const mu = M / (a * (1 - eccSquared / 4 - 3 * eccSquared ** 2 / 64 - 5 * eccSquared ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
  const fp = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);

  const sinfp = Math.sin(fp);
  const cosfp = Math.cos(fp);
  const tanfp = Math.tan(fp);
  const C1 = eccPrimeSquared * cosfp ** 2;
  const T1 = tanfp ** 2;
  const R1 = a * (1 - eccSquared) / Math.pow(1 - eccSquared * sinfp ** 2, 1.5);
  const N1 = a / Math.sqrt(1 - eccSquared * sinfp ** 2);
  const D = x / (N1 * k0);

  let lat = fp - (N1 * tanfp / R1) * (
    D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * eccPrimeSquared) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * eccPrimeSquared - 3 * C1 ** 2) * D ** 6 / 720
  );
  lat = lat * 180 / Math.PI;

  let lon = (
    D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * eccPrimeSquared + 24 * T1 ** 2) * D ** 5 / 120
  ) / cosfp;
  lon = longOrigin + lon * 180 / Math.PI;

  return { lat, lon };
}
