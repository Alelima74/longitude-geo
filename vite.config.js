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
