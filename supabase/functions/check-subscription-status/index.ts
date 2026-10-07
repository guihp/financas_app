import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
let ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";
if (ASAAS_BASE_URL && !ASAAS_BASE_URL.endsWith("/v3") && !ASAAS_BASE_URL.endsWith("/v3/")) {
  ASAAS_BASE_URL = ASAAS_BASE_URL.replace(/\/$/, "") + "/v3";
}

// So pagamentos recentes contam. Antes qualquer pagamento antigo (ex.: de
// meses atras) renovava o acesso por +1 mes toda vez que o app chamava aqui.
const RECENT_PAYMENT_DAYS = 35;
const PAID_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];

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
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function paidDateOf(p: AsaasPayment): string | null {
  return p.confirmedDate || p.paymentDate || p.clientPaymentDate || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "No authorization header" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status, current_period_end, asaas_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.asaas_customer_id) {
      return json({ paid: false, message: "No subscription found" });
    }

    if (!ASAAS_API_KEY) {
      return json({ paid: false, message: "Asaas API key not configured" });
    }

    // Pagamentos do cliente (cobre assinatura recorrente e renovacoes PIX)
    const payments: AsaasPayment[] = [];
    for (const status of PAID_STATUSES) {
      const res = await fetch(
        `${ASAAS_BASE_URL}/payments?customer=${encodeURIComponent(sub.asaas_customer_id)}&status=${status}&limit=20`,
        { headers: { accept: "application/json", access_token: ASAAS_API_KEY } },
      );
      if (!res.ok) {
        console.error("Asaas payments lookup failed:", res.status, await res.text());
        continue;
      }
      const body = await res.json();
      payments.push(...((body?.data ?? []) as AsaasPayment[]));
    }

    const cutoff = new Date(Date.now() - RECENT_PAYMENT_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const recent = payments
      .filter((p) => {
        const d = paidDateOf(p);
        return d !== null && d.split("T")[0] >= cutoff;
      })
      .sort((a, b) => (paidDateOf(a)! < paidDateOf(b)! ? -1 : 1));

    // Aplica cada pagamento recente uma unica vez (idempotente por payment id).
    let periodEnd: string | null = sub.current_period_end;
    for (const p of recent) {
      const { data: newEnd, error } = await supabaseAdmin.rpc("record_subscription_payment", {
        p_subscription_id: sub.id,
        p_asaas_payment_id: p.id,
        p_status: p.status,
        p_amount: p.value ?? 0,
        p_payment_method: p.billingType ?? null,
        p_asaas_customer_id: sub.asaas_customer_id,
        p_paid_date: paidDateOf(p)!.split("T")[0],
        p_due_date: p.dueDate ?? null,
        p_invoice_url: p.invoiceUrl ?? null,
      });
      if (error) {
        console.error("record_subscription_payment failed:", error);
        continue;
      }
      if (newEnd) {
        periodEnd = newEnd as string;
        console.log(`User ${user.id}: applied payment ${p.id}, period_end ${periodEnd}`);
      }
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: fresh } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("id", sub.id)
      .single();

    const paid = fresh?.status === "active" && !!fresh.current_period_end && fresh.current_period_end >= today;

    return json({
      paid,
      message: paid ? "Active paid period confirmed" : "No recent confirmed payment found in Asaas",
      current_period_end: fresh?.current_period_end ?? periodEnd,
    });
  } catch (error) {
    console.error("check-subscription-status error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
