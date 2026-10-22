import test from "node:test";
import assert from "node:assert/strict";
import { createRecordRepository, createLocalRecordAdapter, createSupabaseProjectAdapter, assertRealRecord } from "../src/data/online/recordRepository.mjs";
import { createLocalBackup, inspectLocalBackup, backupFilename } from "../src/data/online/localBackup.mjs";
import { createFileRepository } from "../src/data/online/fileRepository.mjs";

function memory(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value) };
}
test("repository SUPABASE nunca cai no local após erro remoto", async () => {
  let writes = 0;
  const repository = createRecordRepository({ mode: "SUPABASE", local: { create: () => writes++ }, remote: { create: async () => { throw new Error("rede"); } } });
  await assert.rejects(repository.create({ id: "a" }), /rede/);
  assert.equal(writes, 0);
  assert.throws(() => createRecordRepository({ mode: "AUTO" }), /inválido/);
});
test("adapter LOCAL preserva campos e identidade, sem criar duplicata", async () => {
  const adapter = createLocalRecordAdapter({ storage: memory(), key: "projects", uuid: () => "id-1" });
  await adapter.create({ technical: { unknown: 42 }, name: "Chácara" });
  await adapter.update("id-1", { id: "wrong", name: "Chácara alterada" });
  const row = await adapter.getById("id-1");
  assert.equal(row.technical.unknown, 42); assert.equal(row.id, "id-1");
  assert.equal((await adapter.search("CHÁCARA")).length, 1);
  await assert.rejects(adapter.create({ id: "id-1" }), /já cadastrado/);
});
test("base local corrompida bloqueia escrita em vez de sobrescrever", async () => {
  const storage = memory({ projects: "{" });
  const adapter = createLocalRecordAdapter({ storage, key: "projects" });
  await assert.rejects(adapter.create({ id: "new" }));
  assert.equal(storage.getItem("projects"), "{");
});
test("backup preserva bytes locais inválidos e exclui sessões/credenciais", () => {
  const storage = memory({ longitude_geo_mvp_v8_corrigido: '{"clientes":[{"id":"1"}],"imoveis":[]}', longitude_geo_registry_projects_v1: "broken",
    longitude_cloud_session_v2: "SECRET", longitude_online_auth_v1: "SECRET", unrelated: "other" });
  const before = storage.getItem("longitude_geo_registry_projects_v1");
  const backup = createLocalBackup(storage);
  assert.equal(backup.records.longitude_geo_registry_projects_v1, before);
  assert.equal(JSON.stringify(backup).includes("SECRET"), false);
  assert.equal(backup.records.unrelated, undefined);
  assert.equal(inspectLocalBackup(backup).clients, 1);
  assert.equal(inspectLocalBackup(backup).problems.length, 1);
  assert.equal(storage.getItem("longitude_cloud_session_v2"), "SECRET");
  assert.equal(backupFilename(new Date(2026,8,4,10,30)), "longitude_backup_pre_cloud_20260904_1030.json");
});
test("projetos demo e arquivos base64 não entram no snapshot online", () => {
  assert.throws(() => assertRealRecord({ isDemo: true }), /Demonstrações/);
  assert.throws(() => assertRealRecord({ nested: { file: "data:application/pdf;base64,AAAA" } }), /Storage/);
  assertRealRecord({ title: "Real", chapters: [{ text: "Edição manual" }] });
});
test("update concorrente informa conflito e aplica filtro de organização/revisão", async () => {
  const filters = [];
  const query = { update: () => query, eq: (...args) => { filters.push(args); return query; }, select: () => query, maybeSingle: async () => ({ data: null, error: null }) };
  const adapter = createSupabaseProjectAdapter({ table: "geo_projects", organizationId: async () => "org-a", client: {
    auth: { getUser: async () => ({ data: { user: { id: "user" } } }) }, from: () => query } });
  await assert.rejects(adapter.update("uuid-a", { onlineRevision: 2 }), /outro dispositivo/);
  assert.deepEqual(filters, [["organization_id", "org-a"], ["id", "uuid-a"], ["revision", 2]]);
});
test("repository remoto rejeita usuário sem login antes de consultar projetos", async () => {
  const adapter = createSupabaseProjectAdapter({ table: "evaluation_projects", organizationId: async () => "org", client: {
    auth: { getUser: async () => ({ data: { user: null } }) }, from: () => assert.fail("Consulta indevida") } });
  await assert.rejects(adapter.list(), /login/);
});
test("arquivo parcialmente enviado não é apagado e não é declarado salvo", async () => {
  let uploadedPath;
  const client = { storage: { from: () => ({ upload: async path => { uploadedPath = path; return {}; } }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ error: { message: "failed" } }) }) }) }) };
  const files = createFileRepository({ client, organizationId: async () => "org-a", uuid: () => "file-a" });
  await assert.rejects(files.upload({ size: 10, type: "application/pdf", name: "laudo.pdf" }, { projectId: "proj-a", projectType: "geo", documentType: "memorial" }), /metadados não foram salvos/);
  assert.equal(uploadedPath, "org-a/geo/proj-a/file-a/laudo.pdf");
});
