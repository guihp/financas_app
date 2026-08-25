import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (req.method === "POST") {
      const body = await req.json();
      const endpoint = body?.endpoint as string | undefined;
      const p256dh = (body?.keys?.p256dh ?? body?.p256dh) as string | undefined;
      const auth = (body?.keys?.auth ?? body?.auth) as string | undefined;
      const userAgent =
        (body?.user_agent as string | undefined) ??
        req.headers.get("user-agent") ??
        null;

      if (!endpoint || !p256dh || !auth) {
        return new Response(
          JSON.stringify({
            error: "endpoint, keys.p256dh and keys.auth are required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data, error } = await admin
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            user_agent: userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" },
        )
        .select("id, endpoint, created_at")
        .single();

      if (error) {
        console.error("subscribe error", error);
        throw error;
      }

      // Ensure prefs exist
      await admin.from("notification_preferences").upsert(
        { user_id: user.id },
        { onConflict: "user_id", ignoreDuplicates: true },
      );

      return new Response(JSON.stringify({ ok: true, subscription: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      let endpoint: string | undefined;
      try {
        const body = await req.json();
        endpoint = body?.endpoint as string | undefined;
      } catch {
        // empty body
      }

      let query = admin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);

      if (endpoint) {
        query = query.eq("endpoint", endpoint);
      }

      const { error } = await query;
      if (error) {
        console.error("unsubscribe error", error);
        throw error;
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("manage-push-subscription error", error);
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
