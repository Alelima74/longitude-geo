
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import shapefile from "shapefile";
import shp from "shpjs";

const app = express();
app.use(cors());

const PORT = 8787;

const PATHS = {
  sigef: "D:\\COMPARTILHAMENTO\\INCRA-SISTEMA\\Sigef Privado_MT",
  car: "D:\\COMPARTILHAMENTO\\INCRA-SISTEMA\\CAR",
  intermat: "D:\\COMPARTILHAMENTO\\INCRA-SISTEMA\\INTERMAT",
};

function listarArquivosRecursivo(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...listarArquivosRecursivo(full));
    else out.push(full);
  }

  return out;
}

function juntarFeatureCollections(collections) {
  return {
    type: "FeatureCollection",
    features: collections.flatMap((fc) => Array.isArray(fc?.features) ? fc.features : []),
  };
}

function normalizarResultadoShpjs(resultado) {
  if (!resultado) return { type: "FeatureCollection", features: [] };
  if (resultado.type === "FeatureCollection") return resultado;
  if (Array.isArray(resultado)) return juntarFeatureCollections(resultado.map((r) => r?.geojson || r));
  if (resultado.geojson?.type === "FeatureCollection") return resultado.geojson;
  return { type: "FeatureCollection", features: [] };
}

async function lerGeojson(file) {
  const txt = await fs.promises.readFile(file, "utf8");
  const json = JSON.parse(txt);
  if (json.type === "FeatureCollection") return json;
  if (json.type === "Feature") return { type: "FeatureCollection", features: [json] };
  return { type: "FeatureCollection", features: [] };
}

async function lerZip(file) {
  const buffer = await fs.promises.readFile(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const resultado = await shp(arrayBuffer);
  return normalizarResultadoShpjs(resultado);
}

async function lerShp(file) {
  const dbf = file.replace(/\.shp$/i, ".dbf");
  const features = [];
  const source = await shapefile.open(file, fs.existsSync(dbf) ? dbf : undefined);

  while (true) {
    const result = await source.read();
    if (result.done) break;
    features.push(result.value);
  }

  return { type: "FeatureCollection", features };
}

async function carregarPasta(tipo) {
  const dir = PATHS[tipo];
  const arquivos = listarArquivosRecursivo(dir);

  const preferidos = [
    ...arquivos.filter((f) => /\.(geojson|json)$/i.test(f)),
    ...arquivos.filter((f) => /\.zip$/i.test(f)),
    ...arquivos.filter((f) => /\.shp$/i.test(f)),
  ];

  const collections = [];
  const lidos = [];
  const erros = [];

  for (const file of preferidos) {
    try {
      let fc = null;
      if (/\.(geojson|json)$/i.test(file)) fc = await lerGeojson(file);
      else if (/\.zip$/i.test(file)) fc = await lerZip(file);
      else if (/\.shp$/i.test(file)) fc = await lerShp(file);

      if (fc?.features?.length) {
        collections.push(fc);
        lidos.push({ file, features: fc.features.length });
      }
    } catch (error) {
      erros.push({ file, error: error.message });
    }
  }

  return {
    nome: `${tipo.toUpperCase()} automático`,
    pasta: dir,
    arquivosLidos: lidos,
    erros,
    geojson: juntarFeatureCollections(collections),
  };
}

app.get("/api/base/:tipo", async (req, res) => {
  const tipo = String(req.params.tipo || "").toLowerCase();

  if (!PATHS[tipo]) return res.status(404).json({ error: "Tipo de base inválido" });

  try {
    const resultado = await carregarPasta(tipo);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/status", (req, res) => res.json({ ok: true, paths: PATHS }));

app.listen(PORT, () => {
  console.log(`Servidor local de bases rodando em http://localhost:${PORT}`);
  console.log(PATHS);
});
