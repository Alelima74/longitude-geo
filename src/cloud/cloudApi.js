const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";
const TOKEN_KEY = "longitude_cloud_session_v2";
const REFRESH_MARGIN_SECONDS = 90;

export function cloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    if (!session?.access_token) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}

function saveSession(session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  return session;
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(decodeURIComponent(
      atob(padded)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    ));
  } catch {
    return null;
  }
}

function tokenExpiresSoon(accessToken, marginSeconds = REFRESH_MARGIN_SECONDS) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + marginSeconds;
}

function authHeaders(token, extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    ...extra,
  };
}

async function parseResponse(response) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      body?.message ||
      body?.error_description ||
      body?.error ||
      text ||
      `Erro HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function isExpiredJwtError(error) {
  const text = String(error?.message || "").toLowerCase();
  return error?.status === 401 ||
    text.includes("jwt expired") ||
    text.includes("invalid jwt") ||
    text.includes("token is expired");
}

export async function signIn(email, password) {
  if (!cloudConfigured()) throw new Error("Supabase ainda não configurado.");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });
  return saveSession(await parseResponse(response));
}

export async function refreshSession(force = false) {
  const session = getSession();
  if (!session?.refresh_token) return session;

  if (!force && session.access_token && !tokenExpiresSoon(session.access_token)) {
    return session;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(null, { "Content-Type": "application/json" }),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  try {
    return saveSession(await parseResponse(response));
  } catch (error) {
    if (error?.status === 400 || error?.status === 401) {
      clearSession();
      throw new Error("Sua sessão expirou por completo. Entre novamente.");
    }
    throw error;
  }
}

async function validSession() {
  const session = getSession();
  if (!session) return null;
  if (tokenExpiresSoon(session.access_token)) {
    return refreshSession(true);
  }
  return session;
}

async function apiFetch(path, options = {}, requireLogin = false) {
  let session = await validSession();

  if (requireLogin && !session?.access_token) {
    throw new Error("Entre como administrador.");
  }

  const execute = (currentSession) => fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: authHeaders(currentSession?.access_token, options.headers || {}),
  });

  let response = await execute(session);

  if (response.status === 401 && session?.refresh_token) {
    session = await refreshSession(true);
    response = await execute(session);
  }

  try {
    return await parseResponse(response);
  } catch (error) {
    if (isExpiredJwtError(error) && session?.refresh_token) {
      session = await refreshSession(true);
      return parseResponse(await execute(session));
    }
    throw error;
  }
}

export async function queryPoint(lon, lat) {
  return (await apiFetch("/rest/v1/rpc/consultar_camadas_por_ponto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_longitude: lon, p_latitude: lat }),
  })) || [];
}

export async function queryGeometry(geometry) {
  try {
    return (await apiFetch("/rest/v1/rpc/consultar_camadas_por_geometria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_geometria_geojson: geometry }) })) || [];
  } catch (error) {
    if (!/timeout|canceling statement/i.test(String(error?.message || ""))) throw error;
    return (await apiFetch("/rest/v1/rpc/consultar_camadas_por_geometria_rapida", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_geometria_geojson: geometry }) })) || [];
  }
}

export async function queryNeighbors(geometry, distanceMeters = 20) {
  return (await apiFetch("/rest/v1/rpc/consultar_vizinhos_por_geometria", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_geometria_geojson: geometry,
      p_distancia_m: Number(distanceMeters) || 0,
    }),
  })) || [];
}

export async function createVersion(payload) {
  const rows = await apiFetch("/rest/v1/base_versions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  }, true);
  return rows?.[0];
}

export async function updateVersion(versionId, payload) {
  return apiFetch(`/rest/v1/base_versions?id=eq.${encodeURIComponent(versionId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  }, true);
}

export async function createImportLog(payload) {
  const rows = await apiFetch("/rest/v1/importacoes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  }, true);
  return rows?.[0];
}

export async function updateImportLog(importId, payload) {
  return apiFetch(`/rest/v1/importacoes?id=eq.${encodeURIComponent(importId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  }, true);
}

export async function importFeatureBatch(versionId, origem, uf, features) {
  return apiFetch("/rest/v1/rpc/importar_lote_geojson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_version_id: versionId,
      p_origem: origem,
      p_uf: uf || null,
      p_features: features,
    }),
  }, true);
}

export async function activateVersion(versionId) {
  return apiFetch("/rest/v1/rpc/ativar_versao_base", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_version_id: versionId }),
  }, true);
}

export async function uploadOriginalZip(file, origem, uf, onProgress) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${origem.toLowerCase()}/${uf || "BR"}/${Date.now()}-${safeName}`;
  onProgress?.(8);

  await apiFetch(`/storage/v1/object/bases-originais/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/zip",
      "x-upsert": "false",
    },
    body: file,
  }, true);

  onProgress?.(15);
  return path;
}

export async function listVersions() {
  return (await apiFetch(
    "/rest/v1/base_versions?select=*&order=criado_em.desc&limit=100",
    { method: "GET" }
  )) || [];
}

export async function listImports() {
  if (!getSession()?.access_token) return [];
  return (await apiFetch(
    "/rest/v1/importacoes?select=*&order=iniciado_em.desc&limit=50",
    { method: "GET" },
    true
  )) || [];
}
