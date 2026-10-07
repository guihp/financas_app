import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceRequest } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function dispatch(
  supabaseUrl: string,
  serviceKey: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch(`${supabaseUrl}/functions/v1/dispatch-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("dispatch failed", res.status, text);
  }
  return { ok: res.ok, status: res.status, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await isServiceRequest(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
      .toISOString();

    // Active subscribers inactive for 2+ days
    const { data: inactiveProfiles, error: inactiveError } = await supabase
      .from("profiles")
      .select("user_id, full_name, last_seen_at")
      .or(`last_seen_at.is.null,last_seen_at.lt.${twoDaysAgo}`);

    if (inactiveError) throw inactiveError;

    const userIds = (inactiveProfiles || []).map((p) => p.user_id);
    let engagementSent = 0;

    if (userIds.length > 0) {
      const { data: activeSubs } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("status", "active")
        .in("user_id", userIds);

      const activeSet = new Set((activeSubs || []).map((s) => s.user_id));

      for (const profile of inactiveProfiles || []) {
        if (!activeSet.has(profile.user_id)) continue;

        const { data: recent } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("type", "engagement_inactive_2d")
          .gte("created_at", fortyEightHoursAgo)
          .limit(1);

        if (recent && recent.length > 0) continue;

        const name = profile.full_name?.split(" ")[0] || "olá";
        await dispatch(supabaseUrl, serviceKey, {
          user_id: profile.user_id,
          type: "engagement_inactive_2d",
          title: "Sentimos sua falta!",
          body:
            `${name}, faz uns dias que você não abre o IAFÉ FINANCE. Que tal registrar suas finanças?`,
          data: {
            entity_id: `engagement-${profile.user_id}`,
            deep_link: "/dash",
          },
        });
        engagementSent += 1;
      }
    }

    // Invoice due within next 3 calendar days (America/Sao_Paulo)
    const brazilFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = brazilFormatter.format(new Date()); // YYYY-MM-DD
    const [y, m, d] = todayStr.split("-").map(Number);
    const dueDays: number[] = [];
    for (let offset = 0; offset <= 3; offset++) {
      const dt = new Date(Date.UTC(y, m - 1, d + offset));
      dueDays.push(dt.getUTCDate());
    }

    const { data: cards } = await supabase
      .from("credit_cards")
      .select("id, user_id, name, due_day");

    let invoiceSent = 0;
    const cardUsers = [...new Set((cards || []).map((c) => c.user_id))];
    let activeCardUsers = new Set<string>();
    if (cardUsers.length > 0) {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("status", "active")
        .in("user_id", cardUsers);
      activeCardUsers = new Set((subs || []).map((s) => s.user_id));
    }

    for (const card of cards || []) {
      if (!activeCardUsers.has(card.user_id)) continue;
      if (!dueDays.includes(card.due_day)) continue;

      const entityId = `invoice-${card.id}-${y}-${m}-${card.due_day}`;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", card.user_id)
        .eq("type", "invoice_due")
        .gte("created_at", since)
        .filter("data->>entity_id", "eq", entityId)
        .limit(1);

      if (recent && recent.length > 0) continue;

      await dispatch(supabaseUrl, serviceKey, {
        user_id: card.user_id,
        type: "invoice_due",
        title: "Fatura próxima do vencimento",
        body: `A fatura do cartão ${card.name} vence no dia ${card.due_day}.`,
        data: {
          entity_id: entityId,
          credit_card_id: card.id,
          deep_link: "/dash",
        },
      });
      invoiceSent += 1;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        engagement_sent: engagementSent,
        invoice_sent: invoiceSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("engagement-notifications error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
