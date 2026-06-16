export default async function handler(req, res) {
  try {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const targetUrl = `https://geoserver.car.gov.br/geoserver/sicar/ows${query}`;
    const response = await fetch(targetUrl, { headers: { "User-Agent": "LongitudeGeo/1.0", "Accept": "application/json,text/xml,*/*" } });
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const body = await response.arrayBuffer();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    res.status(response.status).send(Buffer.from(body));
  } catch (error) {
    res.status(500).json({ error: "Erro no proxy CAR/SICAR", message: error.message });
  }
}
