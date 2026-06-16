export default async function handler(req, res) {
  try {
    const rawUrl = req.url || "";
    const pathAndQuery = rawUrl.replace(/^\/api\/sigef\/?/, "");
    const targetUrl = `https://pamgia.ibama.gov.br/server/rest/services/BasesSincronizadas/lim_sigef_publico_incra_p/FeatureServer/0/${pathAndQuery}`;
    const response = await fetch(targetUrl, { headers: { "User-Agent": "LongitudeGeo/1.0", "Accept": "application/json,*/*" } });
    const contentType = response.headers.get("content-type") || "application/json";
    const body = await response.arrayBuffer();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    res.status(response.status).send(Buffer.from(body));
  } catch (error) {
    res.status(500).json({ error: "Erro no proxy SIGEF", message: error.message });
  }
}
