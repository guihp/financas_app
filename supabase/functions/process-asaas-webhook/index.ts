import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? '';
let ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';

if (ASAAS_BASE_URL && !ASAAS_BASE_URL.endsWith('/v3') && !ASAAS_BASE_URL.endsWith('/v3/')) {
  ASAAS_BASE_URL = ASAAS_BASE_URL.replace(/\/$/, '') + '/v3';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Asaas signature (token configured no painel Asaas)
    const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? '';
    if (expectedToken) {
      const receivedToken = req.headers.get('asaas-access-token') ?? req.headers.get('Asaas-Access-Token') ?? '';
      if (receivedToken !== expectedToken) {
        console.warn('Invalid asaas-access-token header. Rejecting.');
        return new Response(JSON.stringify({ error: 'invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const rawBody = await req.json();
    // n8n pode enviar o payload em body.body ou no root
    const body = rawBody?.body && typeof rawBody.body === 'object' ? rawBody.body : rawBody;
    console.log('Received Asaas webhook (keys):', Object.keys(body || {}));

    // Asaas webhook format varies by event family:
    // - PAYMENT_*       => { event, payment: { id, customer, subscription, externalReference, ... } }
    // - SUBSCRIPTION_*  => { event, subscription: { id, customer, ... } }
    const payment = body?.payment || body?.Payment || rawBody?.payment;
    const subscription = body?.subscription || body?.Subscription || rawBody?.subscription;
    const event = body?.event || body?.Event || rawBody?.event;

    // paymentId: Asaas usa "pay_xxx"; body.id pode ser o payment quando n8n repassa
    const paymentId = payment?.id || payment?.ID || body?.paymentId || body?.payment_id || rawBody?.paymentId || (typeof body?.id === 'string' && body.id.startsWith('pay_') ? body.id : null);
    // customerId pode vir em payment.customer OR subscription.customer
    const customerId = payment?.customer || payment?.Customer || subscription?.customer || subscription?.Customer || body?.customerId || body?.customer_id;
    const eventType = event || body?.event || rawBody?.event;
    const paymentStatus = payment?.status || payment?.Status || body?.status || rawBody?.status;
    const externalReference = payment?.externalReference ?? payment?.external_reference ?? subscription?.externalReference ?? subscription?.external_reference ?? body?.externalReference ?? body?.external_reference ?? rawBody?.externalReference;
    // subscriptionId pode vir em payment.subscription (events PAYMENT_*) OR no proprio subscription.id (events SUBSCRIPTION_*)
    const asaasSubscriptionId = payment?.subscription || subscription?.id || subscription?.ID || body?.subscription?.id || body?.subscriptionId || body?.subscription_id || rawBody?.subscription;

    if (!paymentId && !externalReference && !customerId && !asaasSubscriptionId) {
      console.error('Webhook sem paymentId, subscriptionId, externalReference nem customerId. Body recebido:', JSON.stringify({ ...body, payment: body?.payment ? '[presente]' : 'ausente', subscription: body?.subscription ? '[presente]' : 'ausente' }).slice(0, 500));
      return new Response(
        JSON.stringify({
          error: 'paymentId, subscriptionId, externalReference ou customerId é obrigatório',
          receivedKeys: Object.keys(body || {})
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find pending registration by payment ID or external reference (which is registration ID)
    let registration: Record<string, unknown> | null = null;
    let regError: { message: string } | null = null;

    if (externalReference) {
      const res = await supabaseAdmin.from('pending_registrations').select('*').eq('id', externalReference).single();
      registration = res.data;
      regError = res.error;
    } else if (paymentId) {
      const res = await supabaseAdmin.from('pending_registrations').select('*').eq('asaas_payment_id', paymentId).single();
      registration = res.data;
      regError = res.error;
    }

    // Fallback: externalReference ausente - buscar no Asaas ou por customerId
    if ((regError || !registration) && paymentId && ASAAS_API_KEY) {
      // 1. Buscar pagamento no Asaas para obter externalReference
      try {
        const payRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
          headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
        });
        const payData = await payRes.json();
        const extRef = payData?.externalReference ?? payData?.external_reference;
        if (extRef) {
          const res = await supabaseAdmin.from('pending_registrations').select('*').eq('id', extRef).single();
          if (res.data) {
            registration = res.data;
            regError = null;
            console.log('Found registration by externalReference from Asaas API:', extRef);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch payment from Asaas:', e);
      }

      // 2. Se ainda não encontrou e temos customerId, buscar por asaas_customer_id
      if ((regError || !registration) && customerId) {
        const res = await supabaseAdmin
          .from('pending_registrations')
          .select('*')
          .eq('asaas_customer_id', customerId)
          .in('status', ['pending_payment', 'paid'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (res.data) {
          registration = res.data;
          regError = null;
          console.log('Found registration by asaas_customer_id fallback:', customerId);
          // Atualizar asaas_payment_id para manter consistência
          await supabaseAdmin
            .from('pending_registrations')
            .update({ asaas_payment_id: paymentId, updated_at: new Date().toISOString() })
            .eq('id', registration.id);
        }
      }
    }

    const paidEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'];
    const isPaidEvent = paidEvents.includes(eventType);

    const paidStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    const isPaidStatus = paidStatuses.includes(paymentStatus);

    const updateSubscriptionByAsaasReference = async (updates: Record<string, unknown>) => {
      const nowIso = new Date().toISOString();
      const payload = { ...updates, updated_at: nowIso };

      if (asaasSubscriptionId) {
        const { data: subById } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('asaas_subscription_id', asaasSubscriptionId)
          .maybeSingle();

        if (subById?.id) {
          await supabaseAdmin.from('subscriptions').update(payload).eq('id', subById.id);
          return true;
        }
      }

      const fallbackCustomerId = customerId || registration?.asaas_customer_id;
      if (fallbackCustomerId) {
        const { data: subByCustomer } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('asaas_customer_id', fallbackCustomerId)
          .maybeSingle();
        if (subByCustomer?.id) {
          await supabaseAdmin.from('subscriptions').update(payload).eq('id', subByCustomer.id);
          return true;
        }
      }

      return false;
    };

    if (regError || !registration) {
      console.log('Registration not found:', { paymentId, externalReference, customerId, error: regError });
      console.log('Proceeding anyway to update existing subscription if applicable.');
    } else {
      console.log('Found registration:', registration.id, 'current status:', registration.status);
    }

    // ============================================
    // RENEWAL PIX: externalReference="renewal:USER_ID"
    // Extends subscription period by 30 days, no register-user.
    // ============================================
    const renewalUserId = typeof externalReference === 'string' && externalReference.startsWith('renewal:')
      ? externalReference.slice('renewal:'.length)
      : null;
    if (renewalUserId && (isPaidEvent || isPaidStatus)) {
      const nowIso = new Date().toISOString();
      const today = new Date();
      const periodEnd = new Date(today);
      periodEnd.setDate(periodEnd.getDate() + 30);

      const { data: targetSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, current_period_end, status')
        .eq('user_id', renewalUserId)
        .maybeSingle();

      if (targetSub?.id) {
        // If subscription still has remaining days, stack the new 30d on top.
        let baseDate = today;
        if (targetSub.current_period_end) {
          const existing = new Date(targetSub.current_period_end);
          if (existing > today) baseDate = existing;
        }
        const newEnd = new Date(baseDate);
        newEnd.setDate(newEnd.getDate() + 30);

        await supabaseAdmin.from('subscriptions').update({
          status: 'active',
          is_trial: false,
          cancel_at_period_end: false,
          cancelled_at: null,
          current_period_start: today.toISOString().split('T')[0],
          current_period_end: newEnd.toISOString().split('T')[0],
          updated_at: nowIso
        }).eq('id', targetSub.id);

        await supabaseAdmin.from('payment_history').insert({
          user_id: renewalUserId,
          subscription_id: targetSub.id,
          asaas_payment_id: paymentId,
          asaas_customer_id: customerId,
          amount: payment?.value || 0,
          status: paymentStatus || 'CONFIRMED',
          payment_method: 'PIX',
          paid_at: nowIso,
          due_date: payment?.dueDate,
          invoice_url: payment?.invoiceUrl
        });

        console.log('Renewal applied for user', renewalUserId, 'new period_end:', newEnd.toISOString().split('T')[0]);
      } else {
        console.warn('Renewal PIX received but subscription not found for user:', renewalUserId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Renewal processed', user_id: renewalUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (registration && (isPaidEvent || isPaidStatus)) {
      // Resolve user_id and subscription_id by registration email so we can:
      // (a) link payment_history rows instead of leaving them orphan, and
      // (b) tell a paying renewal apart from a registration that was never
      //     promoted to an account (the latter is the only true short-circuit).
      let linkedUserId: string | null = null;
      let linkedSubscriptionId: string | null = null;
      if (registration?.email) {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('email', registration.email)
          .maybeSingle();
        if (prof?.user_id) {
          linkedUserId = prof.user_id;
          const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('id')
            .eq('user_id', linkedUserId)
            .maybeSingle();
          linkedSubscriptionId = sub?.id ?? null;
        }
      }

      // Only short-circuit when the registration is cancelled AND there is no
      // profile behind it (refund or never-activated). If a profile exists, this
      // is a recurring payment for an existing customer — proceed to the
      // subscription update block so they get IA + app released immediately.
      if (registration.status === 'cancelled' && !linkedUserId) {
        const { error: histErr } = await supabaseAdmin
          .from('payment_history')
          .insert({
            asaas_payment_id: paymentId,
            asaas_customer_id: customerId || registration?.asaas_customer_id,
            amount: payment?.value || 0,
            status: paymentStatus || 'CONFIRMED',
            payment_method: payment?.billingType || registration?.payment_method,
            paid_at: new Date().toISOString(),
            due_date: payment?.dueDate,
            invoice_url: payment?.invoiceUrl || registration?.invoice_url
          });
        if (histErr) console.warn('Failed to insert payment_history for cancelled-registration payment:', histErr);
        console.log(`Payment for cancelled registration ${registration.id} with no profile — short-circuit (no reactivation)`);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Payment recorded for cancelled registration (no reactivation)',
            registrationId: registration.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update registration to paid
      const { error: updateError } = await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', registration.id)
        .in('status', ['pending_payment', 'expired']); // Only update if still pending or expired

      if (updateError) {
        console.error('Failed to update registration:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar registro' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Registration marked as paid:', registration.id);

      // Record payment in history
      const { error: historyError } = await supabaseAdmin
        .from('payment_history')
        .insert({
          user_id: linkedUserId,
          subscription_id: linkedSubscriptionId,
          asaas_payment_id: paymentId,
          asaas_customer_id: customerId || registration?.asaas_customer_id,
          amount: payment?.value || 0,
          status: paymentStatus || 'CONFIRMED',
          payment_method: payment?.billingType || registration?.payment_method,
          paid_at: new Date().toISOString(),
          due_date: payment?.dueDate,
          invoice_url: payment?.invoiceUrl || registration?.invoice_url
        });

      if (historyError) {
        console.error('Failed to record payment history:', historyError);
        // Don't fail the webhook
      }

      // Skip register-user when there is already a profile linked to the email —
      // either the registration row is flagged 'registered' or the lookup above
      // resolved an existing user (handles 'cancelled' renewals too).
      let isUserRegistered = registration?.status === 'registered' || !!linkedUserId;

      if (registration && !isUserRegistered) {
        // Create user account (register-user with registrationId only), with 1 retry on failure
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const invokeRegisterUser = async () => {
          const regRes = await fetch(`${supabaseUrl}/functions/v1/register-user`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ registrationId: registration.id })
          });
          const regResult = await regRes.json().catch(() => ({}));
          return { ok: regRes.ok, status: regRes.status, result: regResult };
        };
        try {
          let outcome = await invokeRegisterUser();
          if (!outcome.ok && (outcome.status >= 500 || outcome.status === 408)) {
            console.warn('register-user failed, retrying in 2s:', outcome.status, outcome.result);
            await new Promise(r => setTimeout(r, 2000));
            outcome = await invokeRegisterUser();
          }
          if (!outcome.ok) {
            console.error('register-user failed after payment:', outcome.status, outcome.result);
            
            // Check if it's a known non-retryable error like user already exists
            const errorStr = JSON.stringify(outcome.result || {}).toLowerCase();
            const isUserExists = errorStr.includes('já está cadastrado') || 
                                 errorStr.includes('already registered') || 
                                 errorStr.includes('user already exists');

            if (isUserExists) {
              console.log('User already registered. Proceeding to update subscription without failing webhook.');
              isUserRegistered = true;
            } else {
              // Return 500 to trigger Asaas retry
              return new Response(
                JSON.stringify({
                  error: 'Erro ao criar conta de usuário. O webhook será retentado.',
                  details: outcome.result
                }),
                {
                  status: 500,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
          } else {
            console.log('User created from paid registration:', registration.id);
            isUserRegistered = true;
          }
        } catch (invokeError) {
          console.error('Failed to invoke register-user:', invokeError);
          // Return 500 to trigger Asaas retry
          return new Response(
            JSON.stringify({ error: 'Erro de comunicação interna ao criar usuário' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      } else if (registration) {
        console.log('User is already registered, skipping user creation step for recurring payment:', registration.id);
      }

      // ============================================
      // UPDATE SUBSCRIPTION (for recurring subscription payments)
      // ============================================
      // Check if this payment belongs to an Asaas subscription
      let subscriptionUpdated = false;

      if (asaasSubscriptionId) {
        console.log('Payment from subscription:', asaasSubscriptionId);
        // Find subscription by asaas_subscription_id
        const { data: existingSub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('asaas_subscription_id', asaasSubscriptionId)
          .maybeSingle();

        if (existingSub) {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          await supabaseAdmin
            .from('subscriptions')
            .update({
              is_trial: false,
              status: 'active',
              cancel_at_period_end: false,
              cancelled_at: null,
              current_period_start: new Date().toISOString().split('T')[0],
              current_period_end: periodEnd.toISOString().split('T')[0],
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSub.id);

          console.log('Subscription renewed:', existingSub.id, 'new period_end:', periodEnd.toISOString());
          subscriptionUpdated = true;
        } else {
          // Fallback: find by asaas_customer_id
          if (customerId || registration.asaas_customer_id) {
            const custId = customerId || registration.asaas_customer_id;
            const { data: subByCust } = await supabaseAdmin
              .from('subscriptions')
              .select('*')
              .eq('asaas_customer_id', custId)
              .maybeSingle();

            if (subByCust) {
              const periodEnd = new Date();
              periodEnd.setMonth(periodEnd.getMonth() + 1);

              await supabaseAdmin
                .from('subscriptions')
                .update({
                  is_trial: false,
                  status: 'active',
                  cancel_at_period_end: false,
                  cancelled_at: null,
                  asaas_subscription_id: asaasSubscriptionId,
                  current_period_start: new Date().toISOString().split('T')[0],
                  current_period_end: periodEnd.toISOString().split('T')[0],
                  updated_at: new Date().toISOString()
                })
                .eq('id', subByCust.id);

              subscriptionUpdated = true;
            }
          }
        }
      }

      // FALLBACK: If subscription was NOT updated and we have customerId,
      // try to update by customerId directly (handles cases where Asaas 
      // doesn't include subscription ID in the webhook payload)
      if (!subscriptionUpdated && (customerId || registration.asaas_customer_id)) {
        const custId = customerId || registration.asaas_customer_id;
        const { data: subByCust } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('asaas_customer_id', custId)
          .maybeSingle();

        if (subByCust) {
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          await supabaseAdmin
            .from('subscriptions')
            .update({
              is_trial: false,
              status: 'active',
              cancel_at_period_end: false,
              cancelled_at: null,
              current_period_start: new Date().toISOString().split('T')[0],
              current_period_end: periodEnd.toISOString().split('T')[0],
              updated_at: new Date().toISOString()
            })
            .eq('id', subByCust.id);

          console.log('Subscription updated via customerId fallback:', subByCust.id);
          subscriptionUpdated = true;
        }
      }

      // ============================================
      // INJECT PLATFORM FEE EXPENSE
      // ============================================
      try {
        if (registration?.email) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id, phone')
            .eq('email', registration.email)
            .maybeSingle();

          if (profile && profile.user_id) {
            // Formatar o phone no padrão WhatsApp se ele existir
            let formattedPhone = profile.phone;
            if (formattedPhone && !formattedPhone.includes('@s.whatsapp.net')) {
              const cleanPhone = formattedPhone.replace(/\D/g, '');
              const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
              formattedPhone = `${phoneWithCountry}@s.whatsapp.net`;
            }

            await supabaseAdmin.from('transactions').insert({
              user_id: profile.user_id,
              type: 'expense',
              amount: payment?.value || 0,
              description: 'Assinatura Sistema',
              category: 'assinatura',
              date: new Date().toISOString().split('T')[0],
              transaction_date: new Date().toISOString().split('T')[0],
              payment_method: payment?.billingType || registration.payment_method || 'other',
              phone: formattedPhone
            });
            console.log('Automated expense (Platform fee) inserted for user:', profile.user_id);
          }
        }
      } catch (e) {
        console.error('Failed to inject platform fee transaction:', e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pagamento confirmado e registro atualizado',
          registrationId: registration.id,
          email: registration.email
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // PAYMENT_CREATED: no price mutation here.
    // - For new subscribers, create-asaas-payment already PUTs the subscription
    //   to baseSubscriptionPrice with updatePendingPayments:false right after
    //   creation, so the first invoice keeps the promo/coupon price and recurring
    //   invoices use the configured full price.
    // - The previous attempt to mutate payment.value here used POST /payments/{id},
    //   which Asaas silently ignores for credit-card subscription invoices, so it
    //   never worked. Re-pricing legacy subscriptions must be done explicitly via
    //   the admin-only update-subscriptions-price function to avoid surprise
    //   charges on grandfathered customers.

    if (registration && eventType === 'PAYMENT_OVERDUE') {
      await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', registration.id);

      console.log('Registration marked as expired due to overdue payment:', registration.id);
    }

    if (eventType === 'PAYMENT_OVERDUE') {
      await updateSubscriptionByAsaasReference({
        status: 'overdue'
      });
    }

    if (registration && (eventType === 'PAYMENT_DELETED' || eventType === 'PAYMENT_REFUNDED')) {
      await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', registration.id);

      console.log('Registration cancelled:', registration.id);
    }

    if (eventType === 'PAYMENT_DELETED' || eventType === 'PAYMENT_REFUNDED') {
      const nowIso = new Date().toISOString();
      const today = nowIso.split('T')[0];
      await updateSubscriptionByAsaasReference({
        status: 'cancelled',
        cancel_at_period_end: true,
        cancelled_at: nowIso,
        current_period_end: today
      });
    }

    if (eventType === 'SUBSCRIPTION_DELETED' || eventType === 'SUBSCRIPTION_CANCELLED' || eventType === 'SUBSCRIPTION_INACTIVATED') {
      const nowIso = new Date().toISOString();
      const today = nowIso.split('T')[0];
      await updateSubscriptionByAsaasReference({
        status: 'cancelled',
        cancel_at_period_end: true,
        cancelled_at: nowIso,
        current_period_end: today
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        payment_id: paymentId,
        registration_id: registration?.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in process-asaas-webhook function:', error);
    return new Response(
      JSON.stringify({ error: (error as any).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
