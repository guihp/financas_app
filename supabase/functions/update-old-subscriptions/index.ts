// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? '';
let ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';

// Force v3 if user forgot it in production URL
if (ASAAS_BASE_URL && !ASAAS_BASE_URL.endsWith('/v3') && !ASAAS_BASE_URL.endsWith('/v3/')) {
  // Remove trailing slash if exists before appending /v3
  ASAAS_BASE_URL = ASAAS_BASE_URL.replace(/\/$/, '') + '/v3';
}

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: subscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('asaas_subscription_id')
      .not('asaas_subscription_id', 'is', null)
      .eq('status', 'active');

    let updatedCount = 0;
    const results = [];

    // Base price we want all recurring subs to be
    const TARGET_VALUE = 29.90;

    for (const sub of subscriptions || []) {
      const subId = sub.asaas_subscription_id;
      if (!subId) continue;

      try {
        // Fetch from Asaas
        const getRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
          headers: { 'access_token': ASAAS_API_KEY, 'accept': 'application/json' }
        });
        const textGet = await getRes.text();
        let asaasSub;
        try {
          asaasSub = JSON.parse(textGet);
        } catch (e) {
          console.warn('Failed to parse GET response for', subId, ':', textGet);
          results.push({ subId, action: 'error_get_parse', body: textGet });
          continue;
        }

        if (asaasSub && asaasSub.status === 'ACTIVE' && asaasSub.value !== TARGET_VALUE) {
          console.log(`Updating sub ${subId} from ${asaasSub.value} to ${TARGET_VALUE}`);
          const putRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              'accept': 'application/json',
              'access_token': ASAAS_API_KEY
            },
            // updatePendingPayments = false ensures we only affect future non-issued invoices
            body: JSON.stringify({ value: TARGET_VALUE, updatePendingPayments: false })
          });

          const textPut = await putRes.text();
          let updateData;
          try {
            updateData = JSON.parse(textPut);
          } catch (e) {
            console.warn('Failed to parse PUT response for', subId, ':', textPut);
          }

          results.push({
            subId,
            old_value: asaasSub.value,
            new_value: TARGET_VALUE,
            success: putRes.ok,
            errors: updateData?.errors,
            rawPut: textPut
          });

          if (putRes.ok) {
            updatedCount++;
          }
        } else {
          results.push({
            subId,
            status: asaasSub?.status,
            current_value: asaasSub?.value,
            action: 'skipped'
          });
        }
      } catch (errLoop: any) {
        console.warn('Exception processing', subId, errLoop.message);
        results.push({ subId, action: 'exception', error: errLoop.message });
      }
    }

    return new Response(JSON.stringify({ updatedCount, results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/update-old-subscriptions' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
