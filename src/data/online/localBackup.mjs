const SESSION_KEYS = /session|token|auth|password|secret/i;
export function createLocalBackup(storage, now = new Date()) {
  const records = {}, excludedKeys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith("longitude_")) continue;
    if (SESSION_KEYS.test(key)) { excludedKeys.push(key); continue; }
    // Preserve raw strings, including malformed JSON. Never erase or repair the source.
    records[key] = storage.getItem(key);
  }
  return { format: "longitude-pre-cloud", version: 1, createdAt: now.toISOString(), records, excludedKeys,
    scope: "Dados Longitude do localStorage desta origem. Não inclui credenciais, MDB externo, outras origens/perfis ou IndexedDB." };
}
export function backupFilename(now = new Date()) {
  const part = n => String(n).padStart(2, "0");
  return `longitude_backup_pre_cloud_${now.getFullYear()}${part(now.getMonth()+1)}${part(now.getDate())}_${part(now.getHours())}${part(now.getMinutes())}.json`;
}
export function inspectLocalBackup(backup) {
  if (backup?.format !== "longitude-pre-cloud" || backup.version !== 1) throw new Error("Backup incompatível.");
  const problems = [];
  const read = (key, fallback) => {
    if (!(key in backup.records)) return fallback;
    try { return JSON.parse(backup.records[key]); } catch { problems.push(`JSON inválido: ${key}`); return fallback; }
  };
  const root = read("longitude_geo_mvp_v8_corrigido", {});
  const count = (value, name) => {
    if (!Array.isArray(value)) { problems.push(`Coleção inválida: ${name}`); return 0; }
    return value.length;
  };
  return { clients: count(root?.clientes || [], "clientes"), properties: count(root?.imoveis || [], "imóveis"),
    geoProjects: count(read("longitude_geo_registry_projects_v1", []), "projetos GEO"),
    evaluations: count(read("longitude_geo_evaluation_projects_v1", []), "laudos"), problems };
}
