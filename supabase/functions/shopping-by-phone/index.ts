import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { normalizeCategorySlug } from "../_shared/categories.ts";

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

function finalizeListName(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `Compras ${dd}/${mm}/${yyyy}`;
}

function computeCheckedTotal(
  items: Array<{
    checked: boolean;
    unit_type: string;
    quantity: number;
    weight_per_unit: number;
    price: number;
  }>,
): number {
  return items.filter((i) => i.checked).reduce((sum, item) => {
    const q = Number(item.quantity);
    const p = Number(item.price);
    if (item.unit_type === "kg") {
      return sum + q * Number(item.weight_per_unit) * p;
    }
    return sum + q * p;
  }, 0);
}

const SHOPPING_GET_ACTIONS = new Set(["list_lists", "get_list"]);

function shoppingParamsFromUrl(url: URL): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const boolKeys = new Set(["active_only"]);
  const numKeys = new Set([
    "budget",
    "amount",
    "quantity",
    "price",
    "weight_per_unit",
  ]);
  for (const [k, v] of url.searchParams.entries()) {
    if (boolKeys.has(k)) {
      body[k] = v === "true" || v === "1";
    } else if (numKeys.has(k)) {
      const n = Number(v);
      body[k] = Number.isFinite(n) ? n : v;
    } else if (k === "require_price") {
      body[k] = !(v === "false" || v === "0");
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
    body = shoppingParamsFromUrl(new URL(req.url));
  } else if (httpMethod === "POST" || httpMethod === "PUT") {
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
      "Use GET (list_lists, get_list), POST ou PUT (demais ações).",
      405,
      { hint: "OPTIONS é suportado para CORS." },
    );
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (httpMethod === "GET" && action && !SHOPPING_GET_ACTIONS.has(action)) {
    return apiError(
      "GET_ACTION_NOT_ALLOWED",
      "Com GET use apenas action=list_lists ou action=get_list.",
      405,
      { hint: "Criar, alterar ou finalizar: POST ou PUT com JSON." },
    );
  }

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
        hint:
          "Ações: list_lists | create_list | get_list | add_item | update_item | delete_item | delete_list | finalize_list",
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

    // ── list_lists ─────────────────────────────
    if (action === "list_lists") {
      const activeOnly = body.active_only === true;
      let q = supabase
        .from("shopping_lists")
        .select(
          "id, name, budget, is_active, finished_at, final_value, payment_method, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível listar as listas.",
          500,
          { details: error.message },
        );
      }
      return apiSuccess({ lists: data ?? [] });
    }

    // ── create_list ─────────────────────────────
    if (action === "create_list") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return apiError("INVALID_NAME", "name é obrigatório.", 400, {
          field: "name",
        });
      }
      const budget = body.budget != null ? Number(body.budget) : 0;
      if (Number.isNaN(budget) || budget < 0) {
        return apiError("INVALID_BUDGET", "budget deve ser um número ≥ 0.", 400, {
          field: "budget",
        });
      }
      const { data, error } = await supabase
        .from("shopping_lists")
        .insert({
          user_id: userId,
          name,
          budget,
          is_active: true,
        })
        .select()
        .single();
      if (error) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível criar a lista.",
          500,
          { details: error.message },
        );
      }
      return apiSuccess({ list: data, message: "Lista criada." });
    }

    // helper: garantir lista do usuário
    const requireList = async (listId: string) => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("id", listId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        return { err: error.message as string, list: null as null };
      }
      if (!data) {
        return { err: "NOT_FOUND" as const, list: null as null };
      }
      return { err: null as null, list: data };
    };

    // ── get_list ───────────────────────────────
    if (action === "get_list") {
      const listId = typeof body.list_id === "string" ? body.list_id : "";
      if (!listId) {
        return apiError("MISSING_LIST_ID", "list_id é obrigatório.", 400, {
          field: "list_id",
        });
      }
      const { err, list } = await requireList(listId);
      if (err === "NOT_FOUND") {
        return apiError("LIST_NOT_FOUND", "Lista não encontrada.", 404);
      }
      if (err) {
        return apiError("DATABASE_ERROR", "Erro ao buscar lista.", 500, {
          details: err,
        });
      }
      const { data: items, error: itemsErr } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true });
      if (itemsErr) {
        return apiError(
          "DATABASE_ERROR",
          "Erro ao buscar itens.",
          500,
          { details: itemsErr.message },
        );
      }
      return apiSuccess({ list, items: items ?? [] });
    }

    // ── add_item ───────────────────────────────
    if (action === "add_item") {
      const listId = typeof body.list_id === "string" ? body.list_id : "";
      const itemName = typeof body.name === "string" ? body.name.trim() : "";
      const category = normalizeCategorySlug(
        typeof body.category === "string" ? body.category.trim() : "",
      );
      if (!listId || !itemName || !category) {
        return apiError(
          "VALIDATION_ERROR",
          "list_id, name e category são obrigatórios.",
          400,
        );
      }
      const { err, list } = await requireList(listId);
      if (err === "NOT_FOUND") {
        return apiError("LIST_NOT_FOUND", "Lista não encontrada.", 404);
      }
      if (err) {
        return apiError("DATABASE_ERROR", "Erro ao validar lista.", 500, {
          details: err,
        });
      }
      if (!list.is_active) {
        return apiError(
          "LIST_FINISHED",
          "Não é possível adicionar itens a uma lista já finalizada.",
          400,
        );
      }

      const quantity = body.quantity != null ? Number(body.quantity) : 1;
      const unitType =
        body.unit_type === "kg" ? "kg" : "un";
      const weightPerUnit =
        body.weight_per_unit != null ? Number(body.weight_per_unit) : 0;
      const price = body.price != null ? Number(body.price) : 0;
      const requirePrice = body.require_price !== false;

      if (Number.isNaN(quantity) || quantity <= 0) {
        return apiError("INVALID_QUANTITY", "quantity deve ser > 0.", 400, {
          field: "quantity",
        });
      }

      const { data, error } = await supabase
        .from("shopping_items")
        .insert({
          list_id: listId,
          user_id: userId,
          name: itemName,
          category,
          quantity,
          unit_type: unitType,
          weight_per_unit: weightPerUnit,
          price,
          checked: false,
          require_price: requirePrice,
        })
        .select()
        .single();

      if (error) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível adicionar o item.",
          500,
          { details: error.message },
        );
      }
      return apiSuccess({ item: data, message: "Item adicionado." });
    }

    // ── update_item ────────────────────────────
    if (action === "update_item") {
      const itemId = typeof body.item_id === "string" ? body.item_id : "";
      if (!itemId) {
        return apiError("MISSING_ITEM_ID", "item_id é obrigatório.", 400, {
          field: "item_id",
        });
      }
      const { data: existing, error: exErr } = await supabase
        .from("shopping_items")
        .select("id, list_id, user_id")
        .eq("id", itemId)
        .eq("user_id", userId)
        .maybeSingle();
      if (exErr || !existing) {
        return apiError("ITEM_NOT_FOUND", "Item não encontrado.", 404);
      }
      const { err: listErr, list } = await requireList(existing.list_id);
      if (listErr === "NOT_FOUND" || !list) {
        return apiError("LIST_NOT_FOUND", "Lista não encontrada.", 404);
      }
      if (!list.is_active) {
        return apiError(
          "LIST_FINISHED",
          "Lista finalizada; itens não podem ser alterados.",
          400,
        );
      }

      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string") patch.name = body.name.trim();
      if (typeof body.category === "string") {
        patch.category = normalizeCategorySlug(body.category.trim());
      }
      if (body.quantity != null) patch.quantity = Number(body.quantity);
      if (body.unit_type === "kg" || body.unit_type === "un") {
        patch.unit_type = body.unit_type;
      }
      if (body.weight_per_unit != null) {
        patch.weight_per_unit = Number(body.weight_per_unit);
      }
      if (body.price != null) patch.price = Number(body.price);
      if (typeof body.checked === "boolean") patch.checked = body.checked;
      if (typeof body.require_price === "boolean") {
        patch.require_price = body.require_price;
      }

      if (Object.keys(patch).length === 0) {
        return apiError(
          "VALIDATION_ERROR",
          "Nenhum campo para atualizar. Envie name, category, quantity, unit_type, weight_per_unit, price, checked ou require_price.",
          400,
        );
      }

      const { data, error } = await supabase
        .from("shopping_items")
        .update(patch)
        .eq("id", itemId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível atualizar o item.",
          500,
          { details: error.message },
        );
      }
      return apiSuccess({ item: data, message: "Item atualizado." });
    }

    // ── delete_item ────────────────────────────
    if (action === "delete_item") {
      const itemId = typeof body.item_id === "string" ? body.item_id : "";
      if (!itemId) {
        return apiError("MISSING_ITEM_ID", "item_id é obrigatório.", 400, {
          field: "item_id",
        });
      }
      const { data: existing } = await supabase
        .from("shopping_items")
        .select("list_id")
        .eq("id", itemId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        return apiError("ITEM_NOT_FOUND", "Item não encontrado.", 404);
      }
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("id", itemId)
        .eq("user_id", userId);
      if (error) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível excluir o item.",
          500,
          { details: error.message },
        );
      }
      return apiSuccess({ message: "Item excluído." });
    }

    // ── delete_list ────────────────────────────
    if (action === "delete_list") {
      const listId = typeof body.list_id === "string" ? body.list_id : "";
      if (!listId) {
        return apiError("MISSING_LIST_ID", "list_id é obrigatório.", 400, {
          field: "list_id",
        });
      }
      const { err } = await requireList(listId);
      if (err === "NOT_FOUND") {
        return apiError("LIST_NOT_FOUND", "Lista não encontrada.", 404);
      }
      if (err) {
        return apiError("DATABASE_ERROR", "Erro ao validar lista.", 500, {
          details: err,
        });
      }
      await supabase.from("shopping_items").delete().eq("list_id", listId);
      const { error } = await supabase
        .from("shopping_lists")
        .delete()
        .eq("id", listId)
        .eq("user_id", userId);
      if (error) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível excluir a lista.",
          500,
          { details: error.message },
        );
      }
      return apiSuccess({ message: "Lista excluída." });
    }

    // ── finalize_list ──────────────────────────
    if (action === "finalize_list") {
      const listId = typeof body.list_id === "string" ? body.list_id : "";
      const paymentMethod =
        typeof body.payment_method === "string"
          ? body.payment_method.trim().toLowerCase()
          : "";
      if (!listId) {
        return apiError("MISSING_LIST_ID", "list_id é obrigatório.", 400, {
          field: "list_id",
        });
      }
      const allowedPm = ["debit", "pix", "credit", "boleto", "cash"];
      if (!allowedPm.includes(paymentMethod)) {
        return apiError(
          "INVALID_PAYMENT_METHOD",
          `payment_method inválido. Use: ${allowedPm.join(", ")}.`,
          400,
          { field: "payment_method" },
        );
      }

      const { err, list } = await requireList(listId);
      if (err === "NOT_FOUND") {
        return apiError("LIST_NOT_FOUND", "Lista não encontrada.", 404);
      }
      if (err) {
        return apiError("DATABASE_ERROR", "Erro ao buscar lista.", 500, {
          details: err,
        });
      }
      if (!list.is_active) {
        return apiError(
          "LIST_ALREADY_FINISHED",
          "Esta lista já foi finalizada.",
          400,
        );
      }

      const { data: items, error: itemsErr } = await supabase
        .from("shopping_items")
        .select(
          "checked, unit_type, quantity, weight_per_unit, price",
        )
        .eq("list_id", listId);
      if (itemsErr) {
        return apiError(
          "DATABASE_ERROR",
          "Erro ao ler itens da lista.",
          500,
          { details: itemsErr.message },
        );
      }

      let amount: number;
      if (body.amount != null && body.amount !== "") {
        amount = Number(body.amount);
        if (Number.isNaN(amount) || amount <= 0) {
          return apiError("INVALID_AMOUNT", "amount deve ser um número > 0.", 400, {
            field: "amount",
          });
        }
      } else {
        amount = computeCheckedTotal(items ?? []);
        if (amount <= 0) {
          return apiError(
            "EMPTY_TOTAL",
            "Informe amount ou marque itens com preço para totalizar a compra.",
            400,
            {
              hint:
                "O total padrão soma apenas itens com checked=true (igual ao app).",
            },
          );
        }
      }

      let resolvedBank: string | null =
        typeof body.bank_account_id === "string" ? body.bank_account_id : null;
      let resolvedCard: string | null =
        typeof body.credit_card_id === "string"
          ? body.credit_card_id
          : null;

      if (paymentMethod === "credit") {
        if (!resolvedCard) {
          const { data: cards } = await supabase
            .from("credit_cards")
            .select("id")
            .eq("user_id", userId)
            .order("name")
            .limit(1);
          if (!cards?.length) {
            return apiError(
              "NO_CREDIT_CARD",
              "Nenhum cartão cadastrado para crédito.",
              400,
            );
          }
          resolvedCard = cards[0].id;
        } else {
          const { data: card } = await supabase
            .from("credit_cards")
            .select("id")
            .eq("id", resolvedCard)
            .eq("user_id", userId)
            .maybeSingle();
          if (!card) {
            return apiError(
              "INVALID_CREDIT_CARD",
              "Cartão não encontrado ou não pertence ao usuário.",
              400,
            );
          }
        }
        resolvedBank = null;
      } else if (paymentMethod === "cash") {
        resolvedBank = null;
        resolvedCard = null;
      } else {
        if (!resolvedBank) {
          const { data: banks } = await supabase
            .from("bank_accounts")
            .select("id")
            .eq("user_id", userId)
            .order("name")
            .limit(1);
          if (!banks?.length) {
            return apiError(
              "NO_BANK_ACCOUNT",
              "Nenhuma conta bancária cadastrada para este método.",
              400,
            );
          }
          resolvedBank = banks[0].id;
        } else {
          const { data: bank } = await supabase
            .from("bank_accounts")
            .select("id")
            .eq("id", resolvedBank)
            .eq("user_id", userId)
            .maybeSingle();
          if (!bank) {
            return apiError(
              "INVALID_BANK_ACCOUNT",
              "Conta não encontrada ou não pertence ao usuário.",
              400,
            );
          }
        }
        resolvedCard = null;
      }

      const now = new Date();
      const todayIso = now.toISOString().split("T")[0];
      const newName = finalizeListName();

      const updateData: Record<string, unknown> = {
        is_active: false,
        finished_at: now.toISOString(),
        final_value: amount,
        payment_method: paymentMethod,
        name: newName,
        bank_id: resolvedBank,
        credit_card_id: resolvedCard,
      };

      const { error: upErr } = await supabase
        .from("shopping_lists")
        .update(updateData)
        .eq("id", listId)
        .eq("user_id", userId);
      if (upErr) {
        return apiError(
          "DATABASE_ERROR",
          "Não foi possível finalizar a lista.",
          500,
          { details: upErr.message },
        );
      }

      const txData: Record<string, unknown> = {
        user_id: userId,
        type: "expense",
        amount,
        description: newName,
        category: "supermercado",
        payment_method: paymentMethod,
        date: todayIso,
        transaction_date: todayIso,
        total_installments: 1,
        installment_number: 1,
        credit_card_id: null,
        bank_account_id: null,
      };
      if (paymentMethod === "credit" && resolvedCard) {
        txData.credit_card_id = resolvedCard;
      } else if (resolvedBank) {
        txData.bank_account_id = resolvedBank;
      }

      const { data: txRow, error: txErr } = await supabase
        .from("transactions")
        .insert(txData)
        .select("id")
        .single();
      if (txErr) {
        return apiError(
          "TRANSACTION_INSERT_FAILED",
          "Lista finalizada, mas o lançamento financeiro falhou.",
          500,
          { details: txErr.message },
        );
      }

      return apiSuccess({
        message: "Lista finalizada e transação criada.",
        list_id: listId,
        transaction_id: txRow?.id,
        final_value: amount,
        payment_method: paymentMethod,
      });
    }

    return apiError(
      "UNKNOWN_ACTION",
      `Ação desconhecida: "${action}".`,
      400,
      {
        hint:
          "list_lists | create_list | get_list | add_item | update_item | delete_item | delete_list | finalize_list",
      },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("shopping-by-phone:", e);
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno do servidor.",
      500,
      { details: msg },
    );
  }
});
