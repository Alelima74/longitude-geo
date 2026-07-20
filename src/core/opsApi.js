const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function getStoredSession() {
  try { return JSON.parse(localStorage.getItem("longitude_cloud_session_v2") || "null"); }
  catch { return null; }
}

async function refreshStoredSession() {
  const current = getStoredSession();
  if (!current?.refresh_token) return current;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  if (!response.ok) return current;
  const next = await response.json();
  localStorage.setItem("longitude_cloud_session_v2", JSON.stringify(next));
  return next;
}

async function request(path, options = {}, retry = true) {
  let session = getStoredSession();
  if (!session?.access_token) throw new Error("Entre primeiro no módulo Cloud / Consulta Territorial.");
  const execute = (token) => fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  let response = await execute(session.access_token);
  if (response.status === 401 && retry) {
    session = await refreshStoredSession();
    if (session?.access_token) response = await execute(session.access_token);
  }
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(body?.message || body?.error || body?.hint || text || `Erro HTTP ${response.status}`);
  return body;
}

export function onlineConfigured() { return Boolean(SUPABASE_URL && SUPABASE_KEY); }
export function onlineSession() { return getStoredSession(); }

export async function listRows(table, order = "created_at.desc") {
  return (await request(`/rest/v1/${table}?select=*&order=${encodeURIComponent(order)}`)) || [];
}
export async function insertRow(table, payload) {
  const rows = await request(`/rest/v1/${table}`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) });
  return rows?.[0];
}
export async function updateRow(table, id, payload) {
  const rows = await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(payload) });
  return rows?.[0];
}
export async function deleteRow(table, id) {
  return request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}
export async function getSettings() {
  const rows = await request('/rest/v1/lg_settings?select=*&limit=1');
  return rows?.[0] || null;
}
export async function saveSettings(payload) {
  const session = getStoredSession();
  const owner = session?.user?.id;
  if (!owner) throw new Error('Sessão sem usuário.');
  const response = await request('/rest/v1/lg_settings?on_conflict=owner_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ owner_id: owner, ...payload, updated_at: new Date().toISOString() }),
  });
  return response?.[0];
}
