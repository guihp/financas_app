import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? '';
let ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';
if (ASAAS_BASE_URL && !ASAAS_BASE_URL.endsWith('/v3') && !ASAAS_BASE_URL.endsWith('/v3/')) {
  ASAAS_BASE_URL = ASAAS_BASE_URL.replace(/\/$/, '') + '/v3';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const todayIso = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const grace = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data: staleTrials } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, asaas_subscription_id, asaas_customer_id, current_period_end, is_trial, trial_ends_at')
      .eq('status', 'active')
      .eq('is_trial', true)
      .lt('trial_ends_at', grace);

    const { data: stalePaid } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, asaas_subscription_id, asaas_customer_id, current_period_end, is_trial, trial_ends_at')
      .eq('status', 'active')
      .or('is_trial.eq.false,is_trial.is.null')
      .lt('current_period_end', todayIso);

    const candidates = [...(staleTrials || []), ...(stalePaid || [])];
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: 'no stale subscriptions' }),
        { headers: { 'content-type': 'application/json' } }
      );
    }

    const userIds = Array.from(new Set(candidates.map((c: any) => c.user_id)));
    const { data: adminRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds)
      .in('role', ['admin', 'super_admin']);
    const adminSet = new Set((adminRoles || []).map((r: any) => r.user_id));

    const targets = candidates.filter((c: any) => !adminSet.has(c.user_id));
    const results: any[] = [];

    for (const sub of targets) {
      const entry: any = {
        id: sub.id,
        user_id: sub.user_id,
        asaas_subscription_id: sub.asaas_subscription_id
      };

      // Guard against race condition: if Asaas already received payment for
      // this billing cycle but the webhook hasn't synced yet (e.g. it was
      // interrupted), skip cancellation. The webhook will eventually renew
      // the local sub when it processes the queued PAYMENT_RECEIVED event.
      if (sub.asaas_subscription_id && ASAAS_API_KEY) {
        try {
          const checkRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${sub.asaas_subscription_id}`, {
            headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            // Look at the most recent payment for this sub
            const payRes = await fetch(`${ASAAS_BASE_URL}/payments?subscription=${sub.asaas_subscription_id}&limit=5`, {
              headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
            });
            if (payRes.ok) {
              const payJson = await payRes.json();
              const recent = (payJson.data || []) as any[];
              const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              const recentPaid = recent.find((p: any) => {
                if (!['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(p.status)) return false;
                const when = p.confirmedDate || p.paymentDate || p.dateCreated;
                if (!when) return false;
                return new Date(when) >= cutoff;
              });
              if (recentPaid && checkData.status === 'ACTIVE') {
                entry.skipped_reason = `recent paid payment ${recentPaid.id} status=${recentPaid.status}`;
                console.log(`Skipping cancel for ${sub.id}: ${entry.skipped_reason}`);
                results.push(entry);
                continue;
              }
            }
          }
        } catch (e) {
          console.warn('payment-guard check failed (proceeding):', e);
        }

        try {
          const resp = await fetch(`${ASAAS_BASE_URL}/subscriptions/${sub.asaas_subscription_id}`, {
            method: 'DELETE',
            headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
          });
          entry.asaas_status = resp.status;
          if (!resp.ok && resp.status !== 404) {
            const text = await resp.text();
            entry.asaas_error = text.slice(0, 200);
            console.error(`Asaas DELETE failed for ${sub.asaas_subscription_id}: ${resp.status}`);
            results.push(entry);
            continue;
          }
        } catch (e) {
          entry.asaas_error = String(e);
          console.error('Asaas DELETE exception:', e);
          results.push(entry);
          continue;
        }
      } else {
        entry.asaas_status = sub.asaas_subscription_id ? 'no_api_key' : 'no_subscription_id';
      }

      const { error: updErr } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancel_at_period_end: true,
          cancelled_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', sub.id);
      if (updErr) {
        entry.db_error = updErr.message;
      } else {
        entry.local_status = 'cancelled';
      }
      results.push(entry);
    }

    const okCount = results.filter((r: any) => r.local_status === 'cancelled').length;
    return new Response(
      JSON.stringify({ ok: true, processed: targets.length, cancelled: okCount, results }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    console.error('cancel-stale-subscriptions error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
