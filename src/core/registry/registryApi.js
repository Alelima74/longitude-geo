import { getSession } from "../../cloud/cloudApi";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

function localKey(table) {
  return `longitude_registry_${table}_v73_1`;
}

function localRead(table) {
  try {
    return JSON.parse(localStorage.getItem(localKey(table)) || "[]");
  } catch {
    return [];
  }
}

function localWrite(table, rows) {
  localStorage.setItem(localKey(table), JSON.stringify(rows));
}

function availableOnline() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && getSession()?.access_token);
}

function headers(extra = {}) {
  const session = getSession();
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`,
    ...extra,
  };
}

async function parse(response) {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    throw new Error(body?.message || body?.error || body?.details || text || `Erro HTTP ${response.status}`);
  }
  return body;
}

export async function registryList(table, search = "") {
  if (!availableOnline()) {
    const term = search.trim().toLowerCase();
    return localRead(table)
      .filter((row) => !term || JSON.stringify(row).toLowerCase().includes(term))
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }

  const query = search.trim()
    ? `&or=(nome.ilike.*${encodeURIComponent(search)}*,documento.ilike.*${encodeURIComponent(search)}*,codigo.ilike.*${encodeURIComponent(search)}*)`
    : "";
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&order=updated_at.desc${query}`,
    { headers: headers() },
  );
  return (await parse(response)) || [];
}

export async function registryUpsert(table, payload) {
  const row = {
    ...payload,
    id: payload.id || crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  };

  if (!availableOnline()) {
    const rows = localRead(table);
    const next = [row, ...rows.filter((item) => item.id !== row.id)];
    localWrite(table, next);
    return row;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: headers({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(row),
  });
  return (await parse(response))?.[0] || row;
}

export async function registryDelete(table, id) {
  if (!availableOnline()) {
    localWrite(table, localRead(table).filter((row) => row.id !== id));
    return;
  }
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) },
  );
  await parse(response);
}

export function registryMode() {
  return availableOnline() ? "Supabase" : "armazenamento local";
}
