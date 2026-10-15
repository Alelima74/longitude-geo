import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { copyFileSync, createWriteStream, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

function legacyAccessAnalysis() {
  return { name:"longitude-legacy-access-analysis", configureServer(server) {
    server.middlewares.use("/api/legacy-access", (request,response,next) => {
      if(request.method!=="POST") return next();
      const tempDirectory=resolve(process.cwd(),"tmp","legacy-import"); mkdirSync(tempDirectory,{recursive:true});
      const tempFile=resolve(tempDirectory,`${randomUUID()}.mdb`);
      const analyze=()=>{const executable="C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe";const script=resolve(process.cwd(),"scripts","inspect-metrica-access.ps1");const args=["-NoProfile","-ExecutionPolicy","Bypass","-File",script,"-DatabasePath",tempFile];if(request.url.startsWith("/export"))args.push("-IncludeAllRows");const child=spawn(executable,args,{windowsHide:true});let stdout="",stderr="";child.stdout.on("data",chunk=>stdout+=chunk.toString("utf8"));child.stderr.on("data",chunk=>stderr+=chunk.toString("utf8"));child.on("close",code=>{try{unlinkSync(tempFile)}catch{}response.setHeader("content-type","application/json; charset=utf-8");if(code!==0){response.statusCode=422;response.end(JSON.stringify({error:stderr.trim()||"O arquivo não pôde ser interpretado como Microsoft Access."}));return;}try{const analysis=JSON.parse(stdout.trim());analysis.file=decodeURIComponent(request.headers["x-file-name"]||analysis.file);response.end(JSON.stringify(analysis));}catch(error){response.statusCode=500;response.end(JSON.stringify({error:`Resposta inválida do analisador: ${error.message}`}));}});};
      if(request.url.endsWith("/installed")) { try { const installed=process.env.LONGITUDE_LEGACY_MDB_PATH||"C:\\Program Files (x86)\\Métrica\\Métrica TOPO\\Cadastro.mdb"; copyFileSync(installed,tempFile); request.headers["x-file-name"]=encodeURIComponent("Cadastro.mdb"); analyze(); } catch(error) { response.statusCode=404; response.end(JSON.stringify({error:error.message})); } return; }
      if(request.url!=="/analyze"&&request.url!=="/export") return next();
      const output=createWriteStream(tempFile); let size=0; const limit=100*1024*1024;
      request.on("data",chunk=>{size+=chunk.length;if(size>limit)request.destroy(new Error("Arquivo excede 100 MB."));}); request.pipe(output);
      output.on("finish",analyze);
      output.on("error",error=>{response.statusCode=500;response.end(JSON.stringify({error:error.message}));});
    });
  }};
}

export default defineConfig({
  plugins: [react(), legacyAccessAnalysis()],
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
