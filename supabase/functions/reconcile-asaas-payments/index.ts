import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { requireRole } from "../_shared/admin-auth.ts";

// Reconciliacao Asaas x banco (somente super_admin).
//
// POST { since?: "YYYY-MM-DD", dry_run?: boolean }
//  - Lista os pagamentos confirmados na Asaas desde `since` para cada cliente
//    com assinatura local ou cadastro pendente.
//  - Aponta divergencias: pagou mas esta sem acesso, tem acesso sem pagamento
//    recente, pagou mas nunca virou conta.
//  - Com dry_run=false, grava no payment_history os pagamentos que faltam.
//    Nao altera periodo nem status de nenhuma assinatura.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
let ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";
if (ASAAS_BASE_URL && !ASAAS_BASE_URL.endsWith("/v3") && !ASAAS_BASE_URL.endsWith("/v3/")) {
  ASAAS_BASE_URL = ASAAS_BASE_URL.replace(/\/$/, "") + "/v3";
}

const PAID_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
const RECENT_DAYS = 35;

type AsaasPayment = {
  id: string;
  status: string;
  value?: number;
  billingType?: string;
  confirmedDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  dueDate?: string;
  invoiceUrl?: string;
  subscription?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const paidDateOf = (p: AsaasPayment) =>
  (p.confirmedDate || p.paymentDate || p.clientPaymentDate || "").split("T")[0] || null;

async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    headers: { accept: "application/json", access_token: ASAAS_API_KEY },
  });
  if (!res.ok) throw new Error(`Asaas ${path} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const OPEN_STATUSES = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"];

// Pagamentos confirmados desde `since` e cobrancas ainda em aberto (qualquer data).
async function paymentsOf(customerId: string, since: string): Promise<{ paid: AsaasPayment[]; open: AsaasPayment[] }> {
  const paid: AsaasPayment[] = [];
  const open: AsaasPayment[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const body = await asaasGet(`/payments?customer=${encodeURIComponent(customerId)}&limit=100&offset=${offset}`);
    const page = (body?.data ?? []) as AsaasPayment[];
    paid.push(...page.filter((p) => PAID_STATUSES.includes(p.status) && (paidDateOf(p) ?? "") >= since));
    open.push(...page.filter((p) => OPEN_STATUSES.includes(p.status)));
    if (!body?.hasMore) break;
  }
  return { paid, open };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const auth = await requireRole(req, supabase, ["super_admin"]);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  if (!ASAAS_API_KEY) return json({ error: "ASAAS_API_KEY not configured" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const since: string = /^\d{4}-\d{2}-\d{2}$/.test(body?.since ?? "") ? body.since : "2026-06-22";
    const dryRun = body?.dry_run !== false;
    const today = new Date().toISOString().split("T")[0];
    const recentCutoff = new Date(Date.now() - RECENT_DAYS * 864e5).toISOString().split("T")[0];

    const [{ data: subs }, { data: regs }, { data: history }, { data: adminRoles }] = await Promise.all([
      supabase.from("subscriptions")
        .select("id, user_id, status, is_trial, current_period_end, asaas_customer_id, asaas_subscription_id"),
      supabase.from("pending_registrations")
        .select("id, email, status, asaas_customer_id, created_at")
        .not("asaas_customer_id", "is", null)
        .neq("status", "registered")
        .gte("created_at", since),
      supabase.from("payment_history").select("asaas_payment_id, status"),
      supabase.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
    ]);

    const known = new Set((history ?? []).map((h) => `${h.asaas_payment_id}|${h.status}`));
    const admins = new Set((adminRoles ?? []).map((r) => r.user_id));
    const userIds = (subs ?? []).map((s) => s.user_id);
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map((users?.users ?? []).filter((u) => userIds.includes(u.id)).map((u) => [u.id, u.email]));

    const report: Record<string, unknown>[] = [];
    const missingRows: Record<string, unknown>[] = [];
    const errors: string[] = [];

    for (const sub of subs ?? []) {
      if (!sub.asaas_customer_id) continue;
      let paid: AsaasPayment[] = [];
      let open: AsaasPayment[] = [];
      try {
        ({ paid, open } = await paymentsOf(sub.asaas_customer_id, since));
      } catch (e) {
        errors.push(`${sub.asaas_customer_id}: ${(e as Error).message}`);
        continue;
      }

      let asaasSubStatus: string | null = null;
      if (sub.asaas_subscription_id) {
        try {
          asaasSubStatus = (await asaasGet(`/subscriptions/${sub.asaas_subscription_id}`))?.status ?? null;
        } catch (e) {
          asaasSubStatus = `erro: ${(e as Error).message.slice(0, 60)}`;
        }
      }

      const missing = paid.filter((p) => !known.has(`${p.id}|${p.status}`));
      for (const p of missing) {
        missingRows.push({
          user_id: sub.user_id,
          subscription_id: sub.id,
          asaas_payment_id: p.id,
          asaas_customer_id: sub.asaas_customer_id,
          amount: p.value ?? 0,
          status: p.status,
          payment_method: p.billingType ?? null,
          paid_at: paidDateOf(p),
          due_date: p.dueDate ?? null,
          invoice_url: p.invoiceUrl ?? null,
        });
      }

      const lastPaid = paid.map(paidDateOf).filter(Boolean).sort().pop() ?? null;
      // Mesma regra do is_subscription_inactive: cancelada mantem acesso ate o fim do periodo pago.
      const hasAccess = (sub.status === "active" || (sub.status === "cancelled" && !sub.is_trial)) &&
        !!sub.current_period_end && sub.current_period_end >= today;
      const isAdmin = admins.has(sub.user_id);
      const flags: string[] = [];
      if (lastPaid && lastPaid >= recentCutoff && !hasAccess) flags.push("pagou_recente_sem_acesso");
      if (sub.status === "active" && !isAdmin && !sub.is_trial && (!lastPaid || lastPaid < recentCutoff)) {
        flags.push("ativo_sem_pagamento_recente");
      }
      if (sub.status === "active" && sub.current_period_end && sub.current_period_end < today) {
        flags.push("ativo_com_periodo_vencido");
      }
      if (asaasSubStatus === "ACTIVE" && !hasAccess && !isAdmin) flags.push("asaas_cobrando_mas_sem_acesso");
      if (asaasSubStatus === "ACTIVE" && sub.status === "cancelled") flags.push("cancelou_mas_asaas_ativo");
      if (open.length && !hasAccess && !isAdmin) flags.push("cobranca_em_aberto_sem_acesso");

      if (paid.length || open.length || flags.length) {
        report.push({
          email: emailById.get(sub.user_id) ?? sub.user_id,
          admin: isAdmin,
          local_status: sub.status,
          current_period_end: sub.current_period_end,
          asaas_subscription_status: asaasSubStatus,
          pagamentos_desde: paid.map((p) => ({ id: p.id, status: p.status, valor: p.value, data: paidDateOf(p) })),
          cobrancas_em_aberto: open.map((p) => ({ id: p.id, status: p.status, valor: p.value, vencimento: p.dueDate })),
          faltando_no_historico: missing.length,
          flags,
        });
      }
    }

    // Pagou mas o cadastro nunca virou conta
    const paidWithoutAccount: Record<string, unknown>[] = [];
    for (const reg of regs ?? []) {
      if ((subs ?? []).some((s) => s.asaas_customer_id === reg.asaas_customer_id)) continue;
      try {
        const { paid } = await paymentsOf(reg.asaas_customer_id!, since);
        if (paid.length) {
          paidWithoutAccount.push({
            registration_id: reg.id,
            email: reg.email,
            status: reg.status,
            pagamentos: paid.map((p) => ({ id: p.id, status: p.status, valor: p.value, data: paidDateOf(p) })),
          });
        }
      } catch (e) {
        errors.push(`${reg.asaas_customer_id}: ${(e as Error).message}`);
      }
    }

    let inserted = 0;
    if (!dryRun && missingRows.length) {
      const { error, count } = await supabase
        .from("payment_history")
        .upsert(missingRows, { onConflict: "asaas_payment_id,status", ignoreDuplicates: true, count: "exact" });
      if (error) errors.push(`insert payment_history: ${error.message}`);
      else inserted = count ?? missingRows.length;
    }

    return json({
      since,
      dry_run: dryRun,
      pagamentos_faltando_no_historico: missingRows.length,
      inseridos: inserted,
      assinaturas: report,
      pagou_sem_conta: paidWithoutAccount,
      erros: errors,
    });
  } catch (error) {
    console.error("reconcile-asaas-payments error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
