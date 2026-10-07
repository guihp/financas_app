import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.53.0";

export type AppRole = "user" | "admin" | "super_admin";

export type AdminAuthResult =
  | { ok: true; user: User; roles: AppRole[] }
  | { ok: false; status: number; error: string };

/**
 * Valida o JWT do usuario (assinatura checada pelo Auth server via getUser)
 * e exige que ele tenha pelo menos um dos papeis informados em user_roles.
 * `supabase` deve ser um client com a service role key.
 */
export async function requireRole(
  req: Request,
  supabase: SupabaseClient,
  allowed: AppRole[],
): Promise<AdminAuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, status: 401, error: "Missing authorization header" };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { ok: false, status: 401, error: "Invalid authorization token" };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    console.error("requireRole: error checking roles", roleError);
    return { ok: false, status: 500, error: "Error checking permissions" };
  }

  const roles = (roleRows ?? []).map((r: { role: AppRole }) => r.role);
  if (!roles.some((r) => allowed.includes(r))) {
    return { ok: false, status: 403, error: "Access denied" };
  }

  return { ok: true, user, roles };
}

/** Busca um usuario do Auth pelo e-mail percorrendo todas as paginas. */
export async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ user: User | null; error: Error | null }> {
  const target = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return { user: found, error: null };
    if (data.users.length < perPage) return { user: null, error: null };
  }
}
