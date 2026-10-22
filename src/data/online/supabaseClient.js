import { createClient } from "@supabase/supabase-js";

let client;
// Lazy construction: local mode never starts an extra token-refresh loop.
export function getSupabaseClient() {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure URL e chave publicável do Supabase para o ambiente de teste.");
  if (key.startsWith("sb_secret_")) throw new Error("Chave secreta não permitida no frontend.");
  // Legacy JWT anon keys are accepted only if explicitly public.
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "anon") throw new Error();
    } catch { throw new Error("Utilize somente chave publicável ou anon, nunca service_role."); }
  }
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: false, storageKey: "longitude_online_auth_v1" } });
  return client;
}

export const onlineAuth = {
  async signIn(email, password) {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw new Error("Não foi possível entrar. Confira as credenciais e a conexão.");
    return data;
  },
  async signOut() {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw new Error("Não foi possível encerrar a sessão no servidor.");
  },
  async organizationId() {
    const sdk = getSupabaseClient();
    const { data: auth, error: authError } = await sdk.auth.getUser();
    if (authError || !auth?.user) throw new Error("Faça login para acessar a nuvem.");
    const { data, error } = await sdk.from("users").select("organization_id").eq("id", auth.user.id).single();
    if (error || !data?.organization_id) throw new Error("Usuário sem organização autorizada. Solicite o vínculo ao administrador.");
    return data.organization_id;
  },
};
