import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/proxy/sigef": {
        target: "https://pamgia.ibama.gov.br/server/rest/services/BasesSincronizadas/lim_sigef_publico_incra_p/FeatureServer/0",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/sigef/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            proxyReq.setHeader("accept-encoding", "identity");
            console.info("[SIGEF DEBUG]", "request recebido:", req.url);
            console.info("[SIGEF DEBUG]", "endpoint externo utilizado:", `${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
          });
          proxy.on("proxyRes", (proxyRes) => {
            console.info("[SIGEF DEBUG]", "status externo:", proxyRes.statusCode);
            console.info("[SIGEF DEBUG]", "content-type:", proxyRes.headers["content-type"] || "não informado");
            let preview = "";
            proxyRes.on("data", (chunk) => { if (preview.length < 500) preview += chunk.toString("utf8"); });
            proxyRes.on("end", () => console.info("[SIGEF DEBUG]", "primeiros dados da resposta:", preview.slice(0, 500)));
          });
          proxy.on("error", (error, req) => console.error("[SIGEF DEBUG]", "erro:", error.message || error.code || String(error), "causas:", error.errors?.map((item) => `${item.code}: ${item.message}`) || [], "request:", req.url));
        },
      },
      "/proxy/car": {
        target: "https://geoserver.car.gov.br/geoserver/sicar/ows",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/car/, ""),
      },
      "/proxy/intermat": {
        target: "https://intergeo.intermat.mt.gov.br/server/rest/services/INTERGEO/Base_Cartrografica/FeatureServer",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/intermat/, ""),
      },
    },
  },
});
