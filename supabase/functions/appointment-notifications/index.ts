import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APPOINTMENT_TYPE_MAP: Record<string, string> = {
  one_hour_fifteen_before: "1_hour_15_minutes_before",
  one_hour_before: "1_hour_before",
  fifteen_minutes_before: "15_minutes_before",
  now: "now",
};

const PWA_TYPE_MAP: Record<string, string> = {
  "1_hour_15_minutes_before": "appointment_1_hour_15_minutes_before",
  "1_hour_before": "appointment_1_hour_before",
  "15_minutes_before": "appointment_15_minutes_before",
  now: "appointment_now",
};

const TITLE_MAP: Record<string, string> = {
  "1_hour_15_minutes_before": "Lembrete em 1h15",
  "1_hour_before": "Lembrete em 1 hora",
  "15_minutes_before": "Lembrete em 15 minutos",
  now: "É agora!",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Running appointment notifications check...");

    const now = new Date();
    const brazilOffset = -3 * 60 * 60 * 1000;
    const brazilNow = new Date(now.getTime() + brazilOffset);

    console.log("Current Brazil time:", brazilNow.toISOString());

    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select(`
        id,
        title,
        description,
        date,
        time,
        user_id
      `)
      .eq("status", "pending");

    if (appointmentsError) {
      console.error("Error fetching appointments:", appointmentsError);
      throw appointmentsError;
    }

    console.log(`Found ${appointments?.length || 0} pending appointments`);

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending appointments found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let processedWindows = 0;

    for (const appointment of appointments) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("phone, full_name")
        .eq("user_id", appointment.user_id)
        .maybeSingle();

      if (profileError) {
        console.error(
          `Profile error for appointment ${appointment.id}:`,
          profileError,
        );
      }

      // Missing phone must NOT block PWA/in-app (WhatsApp still requires phone)
      const profileSafe = profile ?? { phone: null, full_name: null };

      const appointmentDate = new Date(
        `${appointment.date}T${appointment.time || "00:00:00"}`,
      );

      const oneHourFifteenBefore = new Date(
        appointmentDate.getTime() - 75 * 60 * 1000,
      );
      const oneHourBefore = new Date(
        appointmentDate.getTime() - 60 * 60 * 1000,
      );
      const fifteenMinsBefore = new Date(
        appointmentDate.getTime() - 15 * 60 * 1000,
      );
      const appointmentTime = appointmentDate;

      const fiveMinutes = 5 * 60 * 1000;
      const currentTime = brazilNow.getTime();

      if (
        Math.abs(currentTime - oneHourFifteenBefore.getTime()) <= fiveMinutes
      ) {
        await checkAndSendNotification(
          supabase,
          supabaseUrl,
          supabaseServiceKey,
          appointment,
          profileSafe,
          "one_hour_fifteen_before",
          appointmentDate,
        );
        processedWindows += 1;
      }

      if (Math.abs(currentTime - oneHourBefore.getTime()) <= fiveMinutes) {
        await checkAndSendNotification(
          supabase,
          supabaseUrl,
          supabaseServiceKey,
          appointment,
          profileSafe,
          "one_hour_before",
          appointmentDate,
        );
        processedWindows += 1;
      }

      if (Math.abs(currentTime - fifteenMinsBefore.getTime()) <= fiveMinutes) {
        await checkAndSendNotification(
          supabase,
          supabaseUrl,
          supabaseServiceKey,
          appointment,
          profileSafe,
          "fifteen_minutes_before",
          appointmentDate,
        );
        processedWindows += 1;
      }

      if (Math.abs(currentTime - appointmentTime.getTime()) <= fiveMinutes) {
        await checkAndSendNotification(
          supabase,
          supabaseUrl,
          supabaseServiceKey,
          appointment,
          profileSafe,
          "now",
          appointmentDate,
        );
        processedWindows += 1;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Appointment notifications processed successfully",
        processed_appointments: appointments.length,
        processed_windows: processedWindows,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in appointment notifications:", error);
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

async function checkAndSendNotification(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  // deno-lint-ignore no-explicit-any
  appointment: any,
  // deno-lint-ignore no-explicit-any
  profile: any,
  notificationType: string,
  appointmentDate: Date,
) {
  const dbNotificationType = APPOINTMENT_TYPE_MAP[notificationType] ?? "now";
  const pwaType = PWA_TYPE_MAP[dbNotificationType];
  const title = TITLE_MAP[dbNotificationType] ?? "Lembrete de agenda";

  const { data: existingNotification } = await supabase
    .from("appointment_notifications_sent")
    .select("id")
    .eq("appointment_id", appointment.id)
    .eq("notification_type", dbNotificationType)
    .maybeSingle();

  if (existingNotification) {
    console.log(
      `Notification ${dbNotificationType} already sent for appointment ${appointment.id}`,
    );
    return;
  }

  const timeLabel = appointment.time
    ? ` às ${String(appointment.time).slice(0, 5)}`
    : "";
  const body =
    `${appointment.title}${timeLabel} — ${
      profile.full_name ? profile.full_name.split(" ")[0] + ", " : ""
    }não esqueça!`;

  // 1) Always try PWA / in-app (does not require phone)
  let pwaResult = "skipped";
  try {
    const dispatchRes = await fetch(
      `${supabaseUrl}/functions/v1/dispatch-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          user_id: appointment.user_id,
          type: pwaType,
          title,
          body,
          data: {
            entity_id: `${appointment.id}:${dbNotificationType}`,
            appointment_id: appointment.id,
            deep_link: "/agenda",
            notification_type: dbNotificationType,
          },
          force: true,
        }),
      },
    );
    pwaResult = `${dispatchRes.status}:${await dispatchRes.text()}`;
    console.log("PWA dispatch result:", pwaResult);
  } catch (pwaError) {
    console.error("PWA dispatch error:", pwaError);
    pwaResult = `Error: ${
      pwaError instanceof Error ? pwaError.message : String(pwaError)
    }`;
  }

  // 2) WhatsApp / n8n only when phone exists (unchanged contract)
  let webhookResponseText = "skipped_no_phone";
  const phone = profile?.phone;

  if (phone) {
    const webhookPayload = {
      notification_type: dbNotificationType,
      appointment: {
        id: appointment.id,
        title: appointment.title,
        description: appointment.description,
        date: appointment.date,
        time: appointment.time,
        user_phone: phone,
        user_name: profile.full_name,
      },
      scheduled_datetime: appointmentDate.toISOString(),
      notification_time: new Date().toISOString(),
    };

    console.log(
      `Sending ${dbNotificationType} WhatsApp for appointment ${appointment.id}`,
    );

    const webhookBaseUrl = Deno.env.get("WEBHOOK_BASE_URL") || "";
    const webhookUrl = webhookBaseUrl
      ? `${webhookBaseUrl}/webhook/registra_ai_lembrete`
      : null;

    if (!webhookUrl) {
      console.warn("WEBHOOK_BASE_URL not configured, skipping webhook call");
      webhookResponseText = "skipped_no_webhook_url";
    } else {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });
        webhookResponseText = await webhookResponse.text();
        console.log(
          "Webhook response:",
          webhookResponse.status,
          webhookResponseText,
        );
      } catch (webhookError) {
        console.error("Error sending webhook:", webhookError);
        webhookResponseText = `Error: ${
          webhookError instanceof Error
            ? webhookError.message
            : String(webhookError)
        }`;
      }
    }
  } else {
    console.log(
      `No phone for appointment ${appointment.id}; WhatsApp skipped, PWA attempted`,
    );
  }

  // Record once so we do not re-fire this window (even if only PWA ran)
  const { error: insertError } = await supabase
    .from("appointment_notifications_sent")
    .insert({
      appointment_id: appointment.id,
      notification_type: dbNotificationType,
      webhook_response: JSON.stringify({
        whatsapp: webhookResponseText,
        pwa: pwaResult,
      }),
    });

  if (insertError) {
    console.error("Error recording notification:", insertError);
  } else {
    console.log(
      `Notification ${dbNotificationType} recorded for appointment ${appointment.id}`,
    );
  }
}
