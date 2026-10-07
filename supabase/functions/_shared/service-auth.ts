import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

// Tokens service_role ja validados nesta instancia (evita 1 chamada ao Auth por request).
const verifiedServiceTokens = new Set<string>();

function bearerToken(req: Request): string {
  const auth = req.headers.get("Authorization") ?? "";
  return auth.replace(/^Bearer\s+/i, "").trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * True se a requisicao traz uma chave service_role valida deste projeto.
 * Aceita a SUPABASE_SERVICE_ROLE_KEY do ambiente (comparacao exata) ou um JWT
 * legado com role=service_role (usado pelo n8n e pelo pg_cron/vault). O JWT so
 * e aceito depois que o Auth server confirma a assinatura, entao um token
 * forjado com role=service_role no payload e rejeitado.
 */
export async function isServiceRequest(req: Request): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) return false;

  const envKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (envKey && token === envKey) return true;

  if (verifiedServiceTokens.has(token)) return true;

  const payload = decodeJwtPayload(token);
  if (!payload || payload.role !== "service_role") return false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  try {
    // Endpoint admin do Auth so responde 200 para uma service_role com assinatura valida.
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    });
    await res.body?.cancel();
    if (res.ok) {
      verifiedServiceTokens.add(token);
      return true;
    }
  } catch (err) {
    console.error("isServiceRequest: auth verification failed", err);
  }
  return false;
}

/**
 * True se a requisicao vem de uma chave service_role valida OU de um usuario
 * logado com papel super_admin (usado pela tela de teste de API do app).
 */
export async function isServiceOrSuperAdmin(req: Request): Promise<boolean> {
  if (await isServiceRequest(req)) return true;

  const token = bearerToken(req);
  if (!token) return false;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();
  return !!roleRow;
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
