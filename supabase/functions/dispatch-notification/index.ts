import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceRequest } from "../_shared/service-auth.ts";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DispatchBody = {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Skip short-window dedupe when true */
  force?: boolean;
};

const TYPE_PREF_COLUMN: Record<string, string> = {
  appointment_1_hour_15_minutes_before: "appointment_enabled",
  appointment_1_hour_before: "appointment_enabled",
  appointment_15_minutes_before: "appointment_enabled",
  appointment_now: "appointment_enabled",
  transaction_expense: "transaction_expense_enabled",
  transaction_income: "transaction_income_enabled",
  shopping_list_created: "shopping_list_created_enabled",
  shopping_item_added: "shopping_item_added_enabled",
  shopping_list_finished: "shopping_list_finished_enabled",
  engagement_inactive_2d: "engagement_inactive_2d_enabled",
  budget_threshold: "budget_threshold_enabled",
  invoice_due: "invoice_due_enabled",
};

function prefColumnForType(type: string): string | null {
  if (TYPE_PREF_COLUMN[type]) return TYPE_PREF_COLUMN[type];
  if (type.startsWith("appointment_")) return "appointment_enabled";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!(await isServiceRequest(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as DispatchBody;
    const { user_id, type, title, body, data = {}, force = false } = payload;

    if (!user_id || !type || !title || !body) {
      return new Response(
        JSON.stringify({
          error: "user_id, type, title and body are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ensure prefs row exists
    await supabase.from("notification_preferences").upsert(
      { user_id },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefsError) {
      console.error("prefs error", prefsError);
      throw prefsError;
    }

    const prefCol = prefColumnForType(type);
    const typeEnabled = prefCol
      ? (prefs as Record<string, unknown> | null)?.[prefCol] !== false
      : true;
    const inAppEnabled = prefs?.in_app_enabled !== false;
    const pushEnabled = prefs?.push_enabled !== false;

    if (!typeEnabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "type_disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!inAppEnabled && !pushEnabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "all_channels_disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const entityId = typeof data.entity_id === "string" ? data.entity_id : null;

    // Short-window dedupe (type + entity_id)
    if (!force && entityId) {
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user_id)
        .eq("type", type)
        .gte("created_at", since)
        .filter("data->>entity_id", "eq", entityId)
        .limit(1);

      if (recent && recent.length > 0) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "deduped" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    let notificationId: string | null = null;

    if (inAppEnabled) {
      const { data: inserted, error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_id,
          type,
          title,
          body,
          data,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("insert notification error", insertError);
        throw insertError;
      }
      notificationId = inserted.id;
    }

    let pushSent = 0;
    let pushPruned = 0;
    let pushFailed = 0;

    let pushSkipReason: string | null = null;

    if (pushEnabled) {
      const vapidPublic = (Deno.env.get("VAPID_PUBLIC_KEY") || "").trim();
      const vapidPrivate = (Deno.env.get("VAPID_PRIVATE_KEY") || "").trim();
      const vapidSubject = (Deno.env.get("VAPID_SUBJECT") ||
        "mailto:noreply@iafe.finance").trim();

      if (!vapidPublic || !vapidPrivate) {
        console.warn("VAPID keys not configured; skipping web push");
        pushSkipReason = "vapid_missing";
      } else {
        try {
          webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
        } catch (vapidErr) {
          console.error("VAPID setup error", vapidErr);
          pushSkipReason = vapidErr instanceof Error
            ? vapidErr.message
            : "vapid_invalid";
        }

        if (!pushSkipReason) {
          const { data: subs, error: subsError } = await supabase
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", user_id);

          if (subsError) {
            console.error("subs error", subsError);
            pushSkipReason = subsError.message;
          } else {
            const pushPayload = JSON.stringify({
              title,
              body,
              data: {
                ...data,
                type,
                notification_id: notificationId,
              },
            });

            for (const sub of subs || []) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  pushPayload,
                  { TTL: 60 * 60 },
                );
                pushSent += 1;
              } catch (err: unknown) {
                const statusCode =
                  (err as { statusCode?: number })?.statusCode ??
                  (err as { status?: number })?.status;
                console.error("web-push error", statusCode, err);
                if (statusCode === 404 || statusCode === 410) {
                  await supabase
                    .from("push_subscriptions")
                    .delete()
                    .eq("id", sub.id);
                  pushPruned += 1;
                } else {
                  pushFailed += 1;
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        notification_id: notificationId,
        push_sent: pushSent,
        push_pruned: pushPruned,
        push_failed: pushFailed,
        push_skip_reason: pushSkipReason,
        in_app: inAppEnabled,
        push: pushEnabled,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("dispatch-notification error", error);
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
