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

function lastDayOfMonthDateStr(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${yyyyMm}-${String(last).padStart(2, "0")}`;
}

/**
 * Converte para YYYY-MM-DD. Aceita ISO e DD/MM/YYYY ou DD-MM-YYYY (Brasil).
 * Evita que "08/04/2026" (8 de abril) vire agosto ao usar new Date() (parse MM/DD).
 */
function normalizeDateInputToYyyyMmDd(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (br) {
    const day = parseInt(br[1], 10);
    const month = parseInt(br[2], 10);
    const year = parseInt(br[3], 10);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const dt = new Date(year, month - 1, day);
    if (
      dt.getFullYear() === year &&
      dt.getMonth() === month - 1 &&
      dt.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

async function getUserIdByPhone(supabase: any, phone: string): Promise<string | null> {
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
  ].filter(Boolean);

  for (const phoneVariation of variations) {
    const { data, error } = await supabase
      .rpc("get_user_id_by_phone", { phone_number: phoneVariation });

    if (!error && data) {
      return data as string;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return apiError(
      "METHOD_NOT_ALLOWED",
      "Use POST com JSON no corpo.",
      405,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError(
      "INVALID_JSON",
      "Corpo da requisição não é JSON válido.",
      400,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const phone = body.phone as string | undefined;
    const type = body.type as string | undefined;
    const amount = body.amount;
    const description = body.description as string | undefined;
    const rawCategory = body.category as string | undefined;
    const category = rawCategory ? normalizeCategorySlug(rawCategory) : rawCategory;
    const date = body.date as string | undefined;
    const payment_method = body.payment_method as string | undefined;
    const bank_account_id = body.bank_account_id as string | undefined;
    const credit_card_id = body.credit_card_id as string | undefined;
    const total_installments = body.total_installments as number | string | undefined;
    const is_fixed = body.is_fixed as boolean | undefined;
    const fixed_months = body.fixed_months as number | string | undefined;

    if (!phone || !type || amount === undefined || amount === null || !category) {
      return apiError(
        "MISSING_FIELDS",
        "Campos obrigatórios: phone, type, amount, category.",
        400,
        {
          hint:
            "phone (string), type (income|expense), amount (number), category (string). Opcionais: date, payment_method, bank_account_id, credit_card_id, total_installments, is_fixed, fixed_months.",
        },
      );
    }

    if (type !== "income" && type !== "expense") {
      return apiError(
        "INVALID_TYPE",
        'type deve ser "income" ou "expense".',
        400,
        { field: "type" },
      );
    }

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return apiError(
        "INVALID_AMOUNT",
        "amount deve ser um número positivo.",
        400,
        { field: "amount" },
      );
    }

    const validPaymentMethods = ["debit", "pix", "credit", "boleto"];
    if (
      type === "expense" && payment_method &&
      !validPaymentMethods.includes(payment_method)
    ) {
      return apiError(
        "INVALID_PAYMENT_METHOD",
        `Método de pagamento inválido: "${payment_method}".`,
        400,
        {
          field: "payment_method",
          hint: `Valores aceitos: ${validPaymentMethods.join(", ")}`,
        },
      );
    }

    const userId = await getUserIdByPhone(supabase, phone);

    if (!userId) {
      return apiError(
        "USER_NOT_FOUND",
        "Nenhum usuário encontrado para este telefone.",
        404,
        { hint: "Confirme o número (ex.: 5511999999999)." },
      );
    }

    let resolvedBankAccountId = bank_account_id || null;
    let resolvedCreditCardId = credit_card_id || null;

    if (
      type === "expense" && payment_method &&
      ["debit", "pix", "boleto"].includes(payment_method)
    ) {
      if (!bank_account_id) {
        const { data: banks } = await supabase
          .from("bank_accounts")
          .select("id, name")
          .eq("user_id", userId)
          .order("name")
          .limit(1);

        if (!banks || banks.length === 0) {
          return apiError(
            "NO_BANK_ACCOUNT",
            `Para ${payment_method.toUpperCase()} é necessário cadastrar uma conta bancária.`,
            400,
            {
              hint:
                "Cadastre um banco no app (Bancos e Cartões) ou envie bank_account_id.",
            },
          );
        }
        resolvedBankAccountId = banks[0].id;
      } else {
        const { data: bank } = await supabase
          .from("bank_accounts")
          .select("id, name")
          .eq("id", bank_account_id)
          .eq("user_id", userId)
          .single();

        if (!bank) {
          return apiError(
            "INVALID_BANK_ACCOUNT",
            "Conta bancária não encontrada ou não pertence ao usuário.",
            400,
          );
        }
      }
    }

    if (type === "income") {
      if (bank_account_id) {
        const { data: bank } = await supabase
          .from("bank_accounts")
          .select("id, name")
          .eq("id", bank_account_id)
          .eq("user_id", userId)
          .single();

        if (!bank) {
          return apiError(
            "INVALID_BANK_ACCOUNT",
            "Conta de destino não encontrada ou não pertence ao usuário.",
            400,
          );
        }
        resolvedBankAccountId = bank.id;
      } else {
        const { data: banks } = await supabase
          .from("bank_accounts")
          .select("id, name")
          .eq("user_id", userId)
          .order("name")
          .limit(1);

        if (banks && banks.length > 0) {
          resolvedBankAccountId = banks[0].id;
        }
      }
    }

    if (type === "expense" && payment_method === "credit") {
      if (!credit_card_id) {
        const { data: cards } = await supabase
          .from("credit_cards")
          .select("id, name")
          .eq("user_id", userId)
          .order("name")
          .limit(1);

        if (!cards || cards.length === 0) {
          return apiError(
            "NO_CREDIT_CARD",
            "Para crédito é necessário cadastrar um cartão.",
            400,
          );
        }
        resolvedCreditCardId = cards[0].id;
      } else {
        const { data: card } = await supabase
          .from("credit_cards")
          .select("id, name")
          .eq("id", credit_card_id)
          .eq("user_id", userId)
          .single();

        if (!card) {
          return apiError(
            "INVALID_CREDIT_CARD",
            "Cartão não encontrado ou não pertence ao usuário.",
            400,
          );
        }
      }
    }

    let transactionsToInsert: any[] = [];
    const normalizedFromClient = normalizeDateInputToYyyyMmDd(date);
    const baseDate =
      normalizedFromClient ?? new Date().toISOString().split("T")[0];
    const groupId = crypto.randomUUID();

    if (is_fixed && fixed_months && parseInt(String(fixed_months), 10) > 1) {
      const totalMonths = Math.min(parseInt(String(fixed_months), 10), 60);

      for (let i = 0; i < totalMonths; i++) {
        const fixedDateObj = new Date(baseDate + "T12:00:00");
        fixedDateObj.setMonth(fixedDateObj.getMonth() + i);
        const dateStr =
          `${fixedDateObj.getFullYear()}-${
            String(fixedDateObj.getMonth() + 1).padStart(2, "0")
          }-${
            String(fixedDateObj.getDate()).padStart(2, "0")
          }`;

        const suffix = i > 0 ? ` (Fixa ${i + 1}/${totalMonths})` : "";
        let desc = description ? `${description}${suffix}` : suffix.trim();

        const insertRow: any = {
          type,
          amount: parsedAmount,
          description: desc || null,
          category,
          date: dateStr,
          transaction_date: dateStr,
          user_id: userId,
          installment_group_id: groupId,
          total_installments: 1,
          installment_number: 1,
        };

        if (payment_method) insertRow.payment_method = payment_method;
        if (resolvedBankAccountId) insertRow.bank_account_id = resolvedBankAccountId;
        if (resolvedCreditCardId) insertRow.credit_card_id = resolvedCreditCardId;

        transactionsToInsert.push(insertRow);
      }
    } else if (
      total_installments && payment_method === "credit" &&
      parseInt(String(total_installments), 10) > 1
    ) {
      const numInstallments = parseInt(String(total_installments), 10);
      const installmentAmount =
        Math.round((parsedAmount / numInstallments) * 100) / 100;

      for (let i = 0; i < numInstallments; i++) {
        const installmentDate = new Date(baseDate + "T12:00:00");
        installmentDate.setMonth(installmentDate.getMonth() + i);
        const dateStr =
          `${installmentDate.getFullYear()}-${
            String(installmentDate.getMonth() + 1).padStart(2, "0")
          }-${
            String(installmentDate.getDate()).padStart(2, "0")
          }`;

        let currentAmount = installmentAmount;
        if (i === numInstallments - 1) {
          currentAmount =
            Math.round((parsedAmount - (installmentAmount * (numInstallments - 1))) * 100) /
            100;
        }

        const insertRow: any = {
          type,
          amount: currentAmount,
          description: description || null,
          category,
          date: dateStr,
          transaction_date: dateStr,
          user_id: userId,
          payment_method: "credit",
          credit_card_id: resolvedCreditCardId,
          total_installments: numInstallments,
          installment_number: i + 1,
          installment_group_id: groupId,
        };

        transactionsToInsert.push(insertRow);
      }
    } else {
      const insertRow: any = {
        type,
        amount: parsedAmount,
        description: description || null,
        category,
        date: baseDate,
        transaction_date: baseDate,
        user_id: userId,
      };

      if (payment_method) insertRow.payment_method = payment_method;
      if (resolvedBankAccountId) insertRow.bank_account_id = resolvedBankAccountId;
      if (resolvedCreditCardId) insertRow.credit_card_id = resolvedCreditCardId;
      if (total_installments && payment_method === "credit") {
        insertRow.total_installments = 1;
        insertRow.installment_number = 1;
      }

      transactionsToInsert.push(insertRow);
    }

    const { data: transactionData, error: transactionError } = await supabase
      .from("transactions")
      .insert(transactionsToInsert)
      .select();

    if (transactionError) {
      console.error("Erro ao inserir transação:", transactionError);
      return apiError(
        "TRANSACTION_INSERT_FAILED",
        "Não foi possível registrar a transação.",
        500,
        { details: transactionError.message },
      );
    }

    const createdIds = transactionData?.map((t: { id: string }) => t.id) || [];
    const returnData = transactionsToInsert.length === 1
      ? transactionData![0]
      : transactionData;

    let budgetAlert = undefined;

    if (type === "expense") {
      const d = baseDate ? new Date(baseDate) : new Date();
      const currentMonthYear = baseDate
        ? baseDate.substring(0, 7)
        : `${d.getFullYear()}-${
          String(d.getMonth() + 1).padStart(2, "0")
        }`;

      const { data: budgetData } = await supabase
        .from("budgets")
        .select("amount")
        .eq("user_id", userId)
        .eq("category", category)
        .eq("month_year", currentMonthYear)
        .maybeSingle();

      if (budgetData) {
        const monthEnd = lastDayOfMonthDateStr(currentMonthYear);
        const { data: expenses } = await supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", userId)
          .eq("type", "expense")
          .eq("category", category)
          .gte("date", `${currentMonthYear}-01`)
          .lte("date", monthEnd);

        const totalSpent = (expenses || []).reduce(
          (acc: number, curr: any) => acc + Number(curr.amount),
          0,
        );
        const limit = Number(budgetData.amount);
        const perc = limit > 0 ? (totalSpent / limit) * 100 : 100;

        let status = "ok";
        let msg =
          `Tudo sob controle, utilizou ${perc.toFixed(0)}% do orçamento de ${category}.`;
        if (perc >= 100) {
          status = "danger";
          msg =
            `🚨 ESTOUROU! ${perc.toFixed(0)}% utilizado em ${category} (R$ ${totalSpent.toFixed(2)} de R$ ${limit.toFixed(2)}).`;
        } else if (perc >= 85) {
          status = "warning";
          msg =
            `⚠️ Atenção! Você gastou ${perc.toFixed(0)}% do seu teto de ${category}.`;
        }

        budgetAlert = {
          status,
          percentage: parseFloat(perc.toFixed(1)),
          message: msg,
          limit,
          total_spent: totalSpent,
        };
      }
    }

    return apiSuccess({
      message: transactionsToInsert.length > 1
        ? `Criadas ${transactionsToInsert.length} transações fixas com sucesso!`
        : "Transação criada com sucesso!",
      transaction_id: createdIds.length === 1 ? createdIds[0] : undefined,
      transaction_ids: createdIds.length > 1 ? createdIds : undefined,
      budget_alert: budgetAlert,
      transaction_url:
        `https://dlbiwguzbiosaoyrcvay.supabase.co/rest/v1/transactions?id=in.(${createdIds.join(",")})`,
      data: returnData,
    });
  } catch (error: any) {
    console.error("Erro geral:", error);
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno do servidor.",
      500,
      { details: error?.message },
    );
  }
});
