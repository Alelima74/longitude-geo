const digits = value => String(value || "").replace(/\D/g, "");
export const normalizeClientSearch = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export function mapOperationalClient(row = {}) {
  return { id: row.id, legacyId: null, type: digits(row.document).length === 14 ? "PJ" : digits(row.document).length === 11 ? "PF" : "UNDETERMINED", name: row.name || "", corporateName: row.name || "", tradeName: "", cpfCnpj: row.document || "", address: row.address || "", city: row.city || "", state: row.state || "", phone: row.phone || "", email: row.email || "", origin: "Cadastro oficial", sourceTable: "lg_clients" };
}
export function mapMasterClient(row = {}) {
  const name = row.type === "PJ" ? row.corporate_name || row.name || row.trade_name : row.name || row.corporate_name || row.trade_name;
  return { id: row.id, legacyId: row.legacy_id || null, type: row.type || "UNDETERMINED", name: name || "", corporateName: row.corporate_name || "", tradeName: row.trade_name || "", cpfCnpj: row.cpf_cnpj || "", address: row.address || "", city: row.city || "", state: row.state || "", phone: row.phone || "", email: row.email || "", origin: row.legacy_source === "METRICA_TOPO_MDB" ? "CadCliente / Métrica TOPO" : "Banco mestre", sourceTable: "clients" };
}
export function clientDisplayName(client) { const name = client.type === "PJ" ? client.corporateName || client.name : client.name; return client.cpfCnpj ? `${name} — ${client.cpfCnpj}` : name; }
export function filterClients(clients, query) { const term = normalizeClientSearch(query), document = digits(query); if (!term && !document) return clients; return clients.filter(client => [client.name, client.corporateName, client.tradeName].some(value => normalizeClientSearch(value).includes(term)) || Boolean(document && digits(client.cpfCnpj).includes(document))); }
export function mergeClients(operational = [], master = []) {
  const result = [], seen = new Set();
  for (const client of [...operational.map(mapOperationalClient), ...master.map(mapMasterClient)]) { const key = digits(client.cpfCnpj) || `${normalizeClientSearch(client.name)}|${client.id}`; if (!seen.has(key)) { seen.add(key); result.push(client); } }
  return result.sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b), "pt-BR"));
}
