function parseCoordinateNumber(value, fieldName) {
  const raw = String(value ?? "").trim().replace(/\s+/g, "");
  if (!raw) throw new Error(`Informe ${fieldName}.`);

  let normalized = raw;

  // Brazilian thousands separators: 8.365.000 or 599.000
  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName} inválido: “${value}”.`);
  }
  return number;
}

export function utmToLatLon(easting, northing, zone, hemisphere = "S") {
  const E = parseCoordinateNumber(easting, "a coordenada Este");
  const N = parseCoordinateNumber(northing, "a coordenada Norte");
  const Z = Number(String(zone).trim());
  const H = String(hemisphere || "S").trim().toUpperCase();

  if (!Number.isInteger(Z) || Z < 1 || Z > 60) {
    throw new Error("Informe um fuso UTM inteiro entre 1 e 60.");
  }
  if (!["S", "N"].includes(H)) {
    throw new Error("Informe o hemisfério Sul ou Norte.");
  }
  if (E < 100000 || E > 900000) {
    throw new Error("A coordenada Este normalmente deve estar entre 100.000 m e 900.000 m.");
  }
  if (N < 0 || N > 10000000) {
    throw new Error("A coordenada Norte deve estar entre 0 m e 10.000.000 m.");
  }

  const a = 6378137.0;
  const eccSquared = 0.00669438002290;
  const k0 = 0.9996;
  const x = E - 500000.0;
  let y = N;
  if (H === "S") y -= 10000000.0;

  const longOrigin = (Z - 1) * 6 - 180 + 3;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const M = y / k0;
  const mu = M / (a * (1 - eccSquared / 4 - 3 * eccSquared ** 2 / 64 - 5 * eccSquared ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));

  const fp =
    mu
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

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("A conversão UTM resultou em coordenada inválida. Confira fuso, hemisfério, Este e Norte.");
  }

  return { lat, lon };
}
