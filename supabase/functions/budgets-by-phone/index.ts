import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { normalizeCategorySlug } from "../_shared/categories.ts";
import { isUserSubscriptionInactive, SUBSCRIPTION_BLOCK_MESSAGE, SUBSCRIPTION_INACTIVE_CODE } from "../_shared/subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function apiError(
  code: string,
  message: string,
  status: number,
  opts?: { hint?: string; details?: string; field?: string },
) {
  return json({ success: false, error: { code, message, ...opts } }, status);
}

function apiSuccess(data: Record<string, unknown>) {
  return json({ success: true, ...data }, 200);
}

async function getUserIdByPhone(
  supabase: ReturnType<typeof createClient>,
  phone: string,
): Promise<string | null> {
  const normalizedPhone = phone.replace(/\D/g, "");

  const variations = [
    normalizedPhone,
    `+${normalizedPhone}`,
    normalizedPhone.length > 10 ? normalizedPhone.substring(2) : normalizedPhone,
    normalizedPhone.length === 12 && normalizedPhone.startsWith("55")
      ? `55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}`
      : null,
    normalizedPhone.length === 12 && normalizedPhone.startsWith("55")
      ? `+55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}`
      : null,
    normalizedPhone.length === 12 && normalizedPhone.startsWith("55")
      ? `${normalizedPhone.substring(4)}`
      : null,
    normalizedPhone.length === 13 && normalizedPhone.startsWith("55")
      ? normalizedPhone.substring(2)
      : null,
    normalizedPhone.length === 13 && normalizedPhone.startsWith("55")
      ? `+${normalizedPhone}`
      : null,
  ].filter(Boolean) as string[];

  for (const phoneVariation of variations) {
    const { data, error } = await supabase.rpc("get_user_id_by_phone", {
      phone_number: phoneVariation,
    });
    if (!error && data) return data as string;
  }
  return null;
}

function currentMonthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function budgetsParamsFromUrl(url: URL): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "amount") {
      const n = Number(v);
      body[k] = Number.isFinite(n) ? n : v;
    } else {
      body[k] = v;
    }
  }
  return body;
}

async function readJsonObject(req: Request): Promise<
  { ok: true; body: Record<string, unknown> } | { ok: false }
> {
  const t = await req.text();
  if (!t.trim()) return { ok: true, body: {} };
  try {
    const body = JSON.parse(t) as Record<string, unknown>;
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false };
    }
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const httpMethod = req.method;
  let body: Record<string, unknown>;

  if (httpMethod === "GET") {
    body = budgetsParamsFromUrl(new URL(req.url));
    if (!body.action) body.action = "list";
    const act = String(body.action);
    if (act !== "list") {
      return apiError(
        "GET_ONLY_LIST",
        "GET só lista tetos (action=list ou omita o parâmetro action).",
        405,
        { hint: "upsert: PUT ou POST. delete: POST." },
      );
    }
  } else if (httpMethod === "PUT") {
    const parsed = await readJsonObject(req);
    if (!parsed.ok) {
      return apiError(
        "INVALID_JSON",
        "Corpo da requisição não é JSON válido.",
        400,
      );
    }
    body = parsed.body;
    if (!body.action) body.action = "upsert";
    const act = String(body.action);
    if (act !== "upsert") {
      return apiError(
        "PUT_ONLY_UPSERT",
        "PUT só cria/atualiza teto (action=upsert ou omita).",
        405,
        { hint: "list e delete continuam em GET e POST." },
      );
    }
  } else if (httpMethod === "POST") {
    const parsed = await readJsonObject(req);
    if (!parsed.ok) {
      return apiError(
        "INVALID_JSON",
        "Corpo da requisição não é JSON válido.",
        400,
      );
    }
    body = parsed.body;
  } else {
    return apiError(
      "METHOD_NOT_ALLOWED",
      "Use GET (list), PUT (upsert) ou POST (list | upsert | delete).",
      405,
      { hint: "OPTIONS é suportado para CORS." },
    );
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!phone) {
    return apiError(
      "MISSING_PHONE",
      "Campo obrigatório: phone.",
      400,
      { field: "phone" },
    );
  }
  if (!action) {
    return apiError(
      "MISSING_ACTION",
      "Campo obrigatório: action.",
      400,
      {
        field: "action",
        hint: "Ações: list | upsert | delete",
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userId = await getUserIdByPhone(supabase, phone);
    if (!userId) {
      return apiError(
        "USER_NOT_FOUND",
        "Nenhum usuário encontrado para este telefone.",
        404,
        { hint: "Confirme o número (ex.: 5511999999999)." },
      );
    }

    if (await isUserSubscriptionInactive(supabase, userId)) {
      return apiError(SUBSCRIPTION_INACTIVE_CODE, SUBSCRIPTION_BLOCK_MESSAGE, 402);
    }

    // ── list ───────────────────────────────────
    if (action === "list") {
      const filterMonth =
        typeof body.month_year === "string" && /^\d{4}-\d{2}$/.test(body.month_year)
          ? body.month_year
          : currentMonthYear();

      const { data, error } = await supabase
        .from("budgets")
        .select("id, category, amount, month_year, user_id")
        .eq("user_id", userId)
        .eq("month_year", filterMonth)
        .order("category");

      if (error) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível listar os orçamentos.",
          500,
          { details: error.message },
        );
      }
      return apiSuccess({
        month_year: filterMonth,
        budgets: data ?? [],
      });
    }

    // ── upsert ─────────────────────────────────
    if (action === "upsert") {
      const categoryRaw =
        typeof body.category === "string" ? body.category.trim() : "";
      const category = normalizeCategorySlug(categoryRaw);
      if (!category) {
        return apiError(
          "MISSING_CATEGORY",
          "category é obrigatório.",
          400,
          { field: "category" },
        );
      }
      const amount = body.amount != null ? Number(body.amount) : NaN;
      if (Number.isNaN(amount) || amount < 0) {
        return apiError(
          "INVALID_AMOUNT",
          "amount deve ser um número ≥ 0.",
          400,
          { field: "amount" },
        );
      }

      const targetMonth =
        typeof body.month_year === "string" && /^\d{4}-\d{2}$/.test(body.month_year)
          ? body.month_year
          : currentMonthYear();

      const { data: existing, error: findErr } = await supabase
        .from("budgets")
        .select("id")
        .eq("user_id", userId)
        .eq("category", category)
        .eq("month_year", targetMonth)
        .maybeSingle();

      if (findErr) {
        return apiError(
          "DATABASE_ERROR",
          "Erro ao consultar orçamento existente.",
          500,
          { details: findErr.message },
        );
      }

      if (existing?.id) {
        const { data: updated, error: upErr } = await supabase
          .from("budgets")
          .update({ amount })
          .eq("id", existing.id)
          .eq("user_id", userId)
          .select()
          .single();
        if (upErr) {
          return apiError(
            "DATABASE_ERROR",
            "Não foi possível atualizar o orçamento.",
            500,
            { details: upErr.message },
          );
        }
        return apiSuccess({
          message: "Orçamento atualizado.",
          budget: updated,
          created: false,
        });
      }

      const { data: inserted, error: insErr } = await supabase
        .from("budgets")
        .insert({
          user_id: userId,
          category,
          amount,
          month_year: targetMonth,
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === "23505") {
          return apiError(
            "DUPLICATE_BUDGET",
            "Já existe teto para esta categoria neste mês.",
            409,
            { hint: "Use upsert novamente ou delete antes de recriar." },
          );
        }
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível criar o orçamento.",
          500,
          { details: insErr.message },
        );
      }
      return apiSuccess({
        message: "Orçamento criado.",
        budget: inserted,
        created: true,
      });
    }

    // ── delete ─────────────────────────────────
    if (action === "delete") {
      const budgetId =
        typeof body.budget_id === "string" ? body.budget_id : "";
      const delCategory = normalizeCategorySlug(
        typeof body.category === "string" ? body.category.trim() : "",
      );
      const delMonth =
        typeof body.month_year === "string" && /^\d{4}-\d{2}$/.test(body.month_year)
          ? body.month_year
          : currentMonthYear();

      if (budgetId) {
        const { data: row, error: gErr } = await supabase
          .from("budgets")
          .select("id")
          .eq("id", budgetId)
          .eq("user_id", userId)
          .maybeSingle();
        if (gErr || !row) {
          return apiError(
            "BUDGET_NOT_FOUND",
            "Orçamento não encontrado.",
            404,
          );
        }
        const { error: dErr } = await supabase
          .from("budgets")
          .delete()
          .eq("id", budgetId)
          .eq("user_id", userId);
        if (dErr) {
          return apiError(
            "DATABASE_ERROR",
            "Não foi possível excluir o orçamento.",
            500,
            { details: dErr.message },
          );
        }
        return apiSuccess({ message: "Orçamento excluído." });
      }

      if (!delCategory) {
        return apiError(
          "VALIDATION_ERROR",
          "Informe budget_id ou category (+ month_year opcional).",
          400,
        );
      }

      const { error: dErr } = await supabase
        .from("budgets")
        .delete()
        .eq("user_id", userId)
        .eq("category", delCategory)
        .eq("month_year", delMonth);

      if (dErr) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível excluir o orçamento.",
          500,
          { details: dErr.message },
        );
      }
      return apiSuccess({
        message: "Orçamento excluído (se existia para o mês indicado).",
        category: delCategory,
        month_year: delMonth,
      });
    }

    return apiError(
      "UNKNOWN_ACTION",
      `Ação desconhecida: "${action}".`,
      400,
      { hint: "list | upsert | delete" },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("budgets-by-phone:", e);
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno do servidor.",
      500,
      { details: msg },
    );
  }
});
