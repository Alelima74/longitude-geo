// Adapters are explicit. A failed remote request must never write to local storage.
export function createRecordRepository({ mode, local, remote }) {
  if (!["LOCAL", "SUPABASE"].includes(mode)) throw new Error("Modo de persistência inválido.");
  const adapter = mode === "SUPABASE" ? remote : local;
  if (!adapter) throw new Error(`Repository ${mode} indisponível.`);
  return Object.freeze({
    mode,
    list: (...args) => adapter.list(...args),
    getById: (...args) => adapter.getById(...args),
    search: (...args) => adapter.search(...args),
    create: (...args) => adapter.create(...args),
    update: (...args) => adapter.update(...args),
  });
}

export function assertRealRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Registro inválido.");
  if (record.isDemo || record.status === "DEMO") throw new Error("Demonstrações não podem ser migradas como dados reais.");
  // Large binaries must use Storage. Do not silently drop any field.
  const serialized = JSON.stringify(record);
  if (/data:[^"\s]*;base64,/i.test(serialized)) throw new Error("Arquivo base64 encontrado. Envie o arquivo ao Storage antes de salvar.");
  return record;
}

export function createLocalRecordAdapter({ storage, key, uuid = () => crypto.randomUUID() }) {
  const list = async () => {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) throw new Error("Base local inválida. Preserve o backup antes de continuar.");
    return rows;
  };
  const write = rows => storage.setItem(key, JSON.stringify(rows));
  return {
    list,
    getById: async id => (await list()).find(row => row.id === id) || null,
    search: async query => (await list()).filter(row => JSON.stringify(row).toLocaleLowerCase("pt-BR").includes(String(query).toLocaleLowerCase("pt-BR"))),
    async create(record) {
      const rows = await list();
      const next = { ...record, id: record.id || uuid(), updatedAt: new Date().toISOString() };
      if (rows.some(row => row.id === next.id)) throw new Error("ID já cadastrado.");
      write([next, ...rows]);
      return next;
    },
    async update(id, patch) {
      const rows = await list(), index = rows.findIndex(row => row.id === id);
      if (index < 0) throw new Error("Registro não encontrado.");
      rows[index] = { ...rows[index], ...patch, id, updatedAt: new Date().toISOString() };
      write(rows);
      return rows[index];
    },
  };
}

// Snapshot adapters preserve the entire project. No technical calculations occur here.
export function createSupabaseProjectAdapter({ client, table, organizationId }) {
  if (!["geo_projects", "evaluation_projects"].includes(table)) throw new Error("Tabela de projetos inválida.");
  const context = async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("Sem conexão com o servidor.");
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) throw new Error("Faça login para acessar a nuvem.");
    const org = await organizationId();
    if (!org) throw new Error("Usuário sem organização autorizada.");
    return org;
  };
  const unwrap = row => row ? { ...row.payload, id: row.id, onlineRevision: row.revision, localProjectId: row.local_project_id, updatedAt: row.updated_at } : null;
  const result = ({ data, error }) => { if (error) throw new Error(error.message || "Erro ao acessar o servidor."); return data; };
  const list = async () => {
    const org = await context(), rows = [];
    // Use a deterministic keyset so the API's row cap cannot truncate migration silently.
    let cursor = null;
    for (;;) {
      let query = client.from(table).select("*").eq("organization_id", org).order("id").limit(200);
      if (cursor) query = query.gt("id", cursor);
      const page = result(await query);
      rows.push(...page.map(unwrap));
      if (page.length < 200) return rows;
      cursor = page.at(-1).id;
    }
  };
  return {
    list,
    async getById(id) {
      const org = await context();
      return unwrap(result(await client.from(table).select("*").eq("organization_id", org).eq("id", id).maybeSingle()));
    },
    search: async query => (await list()).filter(row => JSON.stringify(row).toLocaleLowerCase("pt-BR").includes(String(query).toLocaleLowerCase("pt-BR"))),
    async create(record) {
      assertRealRecord(record);
      const org = await context();
      return unwrap(result(await client.from(table).insert({ organization_id: org, local_project_id: record.localProjectId || record.id || crypto.randomUUID(), payload: record }).select().single()));
    },
    async update(id, record) {
      assertRealRecord(record);
      if (!Number.isInteger(record.onlineRevision)) throw new Error("Reabra o projeto antes de salvar: versão online ausente.");
      const org = await context();
      const row = result(await client.from(table).update({ payload: record }).eq("organization_id", org).eq("id", id).eq("revision", record.onlineRevision).select().maybeSingle());
      if (!row) throw new Error("Projeto alterado em outro dispositivo. Reabra antes de salvar; suas edições não foram enviadas.");
      return unwrap(row);
    },
  };
}
