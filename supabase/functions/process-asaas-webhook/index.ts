import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyWelcomeMessageN8n } from './n8n-welcome-webhook.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function insertPaymentHistoryIdempotent(supabaseAdmin: any, row: Record<string, unknown>) {
  // unique index payment_history_payment_status_uniq on (asaas_payment_id, status)
  // prevents duplicates from webhook redelivery. Use upsert with ignoreDuplicates
  // so the second delivery is a no-op instead of raising 23505.
  if (!row.asaas_payment_id) {
    return supabaseAdmin.from('payment_history').insert(row);
  }
  return supabaseAdmin
    .from('payment_history')
    .upsert(row, { onConflict: 'asaas_payment_id,status', ignoreDuplicates: true });
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
    // Validate Asaas signature (token configurado no painel Asaas).
    // Suporta 2 tokens simultaneos (ASAAS_WEBHOOK_TOKEN + ASAAS_WEBHOOK_TOKEN_PREV)
    // para evitar fila penalizada durante a rotacao do segredo. Quando trocar o
    // token no painel Asaas, mantenha o antigo em ASAAS_WEBHOOK_TOKEN_PREV por
    // 24h e o novo em ASAAS_WEBHOOK_TOKEN.
    const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN') ?? '';
    const expectedTokenPrev = Deno.env.get('ASAAS_WEBHOOK_TOKEN_PREV') ?? '';
    // Falha fechada: sem token configurado, nenhum webhook e aceito.
    if (!expectedToken && !expectedTokenPrev) {
      console.error('ASAAS_WEBHOOK_TOKEN nao configurado. Rejeitando webhook.');
      return new Response(JSON.stringify({ error: 'webhook token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const receivedToken = req.headers.get('asaas-access-token') ?? req.headers.get('Asaas-Access-Token') ?? '';
    const accepted = [expectedToken, expectedTokenPrev].filter(Boolean);
    if (!accepted.includes(receivedToken)) {
      console.warn('Invalid asaas-access-token header. Rejecting.');
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    const isRenewalRef = typeof externalReference === 'string' && externalReference.startsWith('renewal:');

    if (isUuid(externalReference)) {
      const res = await supabaseAdmin.from('pending_registrations').select('*').eq('id', externalReference).single();
      registration = res.data;
      regError = res.error;
    } else if (paymentId && !isRenewalRef) {
      const res = await supabaseAdmin.from('pending_registrations').select('*').eq('asaas_payment_id', paymentId).single();
      registration = res.data;
      regError = res.error;
    }

    // Fallback: externalReference ausente - buscar no Asaas ou por customerId
    if ((regError || !registration) && paymentId && ASAAS_API_KEY && !isRenewalRef) {
      // 1. Buscar pagamento no Asaas para obter externalReference
      try {
        const payRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
          headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
        });
        const payData = await payRes.json();
        const extRef = payData?.externalReference ?? payData?.external_reference;
        if (isUuid(extRef)) {
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

    // allowCustomerFallback=false: so casa pelo id da assinatura Asaas. Eventos
    // de uma assinatura antiga (apagada na renovacao por cartao) ou de cobrancas
    // avulsas vencidas nao podem cancelar/marcar como vencida a assinatura atual
    // do mesmo cliente.
    const updateSubscriptionByAsaasReference = async (
      updates: Record<string, unknown>,
      allowCustomerFallback = true
    ) => {
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
      if (allowCustomerFallback && fallbackCustomerId) {
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

    // Registra o pagamento e estende a assinatura uma unica vez por cobranca
    // (idempotente: PAYMENT_CONFIRMED + PAYMENT_RECEIVED da mesma cobranca
    // e reentregas nao somam dias extras). Ver record_subscription_payment.
    const applyPaymentToSubscription = async (subscriptionId: string) => {
      const paidDate = String(
        payment?.confirmedDate || payment?.paymentDate || payment?.clientPaymentDate || new Date().toISOString()
      ).split('T')[0];
      const { data: newEnd, error } = await supabaseAdmin.rpc('record_subscription_payment', {
        p_subscription_id: subscriptionId,
        p_asaas_payment_id: paymentId,
        p_status: paymentStatus || 'CONFIRMED',
        p_amount: payment?.value || 0,
        p_payment_method: payment?.billingType || registration?.payment_method || null,
        p_asaas_customer_id: customerId || registration?.asaas_customer_id || null,
        p_paid_date: paidDate,
        p_due_date: payment?.dueDate || null,
        p_invoice_url: payment?.invoiceUrl || null,
      });
      if (error) throw new Error(`record_subscription_payment failed: ${error.message}`);
      console.log(newEnd
        ? `Payment ${paymentId} applied to sub ${subscriptionId}, new period_end ${newEnd}`
        : `Payment ${paymentId} already applied to sub ${subscriptionId}, period unchanged`);
      return newEnd as string | null;
    };

    const findSubscriptionId = async (): Promise<string | null> => {
      if (asaasSubscriptionId) {
        const { data } = await supabaseAdmin
          .from('subscriptions').select('id').eq('asaas_subscription_id', asaasSubscriptionId).maybeSingle();
        if (data?.id) return data.id;
      }
      const cust = customerId || registration?.asaas_customer_id;
      if (cust) {
        const { data } = await supabaseAdmin
          .from('subscriptions').select('id').eq('asaas_customer_id', cust).maybeSingle();
        if (data?.id) return data.id;
      }
      return null;
    };

    if (regError || !registration) {
      console.log('Registration not found:', { paymentId, externalReference, customerId, error: regError });
      console.log('Proceeding anyway to update existing subscription if applicable.');
    } else {
      console.log('Found registration:', registration.id, 'current status:', registration.status);
    }

    // ============================================
    // RENEWAL (PIX one-off or CREDIT_CARD recurring): externalReference="renewal:USER_ID"
    // Extends subscription period by 1 month (once per payment), no register-user.
    // ============================================
    const renewalUserId = typeof externalReference === 'string' && externalReference.startsWith('renewal:')
      ? externalReference.slice('renewal:'.length)
      : null;
    if (renewalUserId && (isPaidEvent || isPaidStatus)) {
      const { data: targetSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('user_id', renewalUserId)
        .maybeSingle();

      if (targetSub?.id && paymentId) {
        await applyPaymentToSubscription(targetSub.id);
      } else {
        console.warn('Renewal payment received but subscription not found for user:', renewalUserId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Renewal processed', user_id: renewalUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (registration && (isPaidEvent || isPaidStatus)) {
      const isFirstTimeActivation = registration.status !== 'registered';

      // Cadastro ja convertido (registered) ou cancelado: e uma cobranca
      // recorrente (mensalidade do cartao) ou um pagamento atrasado. Nao recria
      // o usuario; registra o pagamento e estende a assinatura local uma vez por
      // cobranca, esteja ela ativa (renovacao em dia) ou nao (reativacao).
      if (registration.status === 'cancelled' || registration.status === 'registered') {
        const subId = await findSubscriptionId();
        let newEnd: string | null = null;
        if (subId && paymentId) {
          newEnd = await applyPaymentToSubscription(subId);
        } else {
          const { error: histErr } = await insertPaymentHistoryIdempotent(supabaseAdmin, {
            asaas_payment_id: paymentId,
            asaas_customer_id: customerId || registration?.asaas_customer_id,
            amount: payment?.value || 0,
            status: paymentStatus || 'CONFIRMED',
            payment_method: payment?.billingType || registration?.payment_method,
            paid_at: new Date().toISOString(),
            due_date: payment?.dueDate,
            invoice_url: payment?.invoiceUrl || registration?.invoice_url
          });
          if (histErr) console.error('Failed to insert payment_history:', histErr);
          console.warn(`Paid ${registration.status} registration ${registration.id} has no local subscription`);
        }
        return new Response(
          JSON.stringify({
            success: true,
            message: newEnd ? `Payment applied, period_end ${newEnd}` : 'Payment recorded',
            registrationId: registration.id,
            current_period_end: newEnd
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
      const { error: historyError } =  await insertPaymentHistoryIdempotent(supabaseAdmin, {
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

      let isUserRegistered = registration?.status === 'registered';

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

            // Distinguish "email duplicate" (the same user already has an
            // account — safe to skip) from "phone duplicate" (DIFFERENT user
            // tried to use a phone already taken; account was NEVER created).
            // Treating phone-dup as user-exists creates ghost accounts that
            // never let the client log in even after they pay.
            const errStr = JSON.stringify(outcome.result || {}).toLowerCase();
            const errCode = (outcome.result as { error_code?: string } | undefined)?.error_code;
            const isPhoneDup = errCode === 'phone_already_registered' || errStr.includes('telefone já está cadastrado');
            const isEmailDup = !isPhoneDup && (
              errStr.includes('e-mail já está cadastrado') ||
              errStr.includes('email já está cadastrado') ||
              errStr.includes('already registered') ||
              errStr.includes('user already exists')
            );

            if (isEmailDup) {
              console.log('User already registered (email dup). Proceeding to update subscription without failing webhook.');
              isUserRegistered = true;
            } else if (isPhoneDup) {
              // Account NOT created. Do not mark webhook as success — escalate
              // for manual review. Returning 200 here prevents Asaas from
              // retrying forever, but we keep registration in 'paid' so the
              // admin can pick up and fix manually.
              console.error('Phone duplicate: account NOT created for registration', registration.id, '. Manual review required.');
              return new Response(
                JSON.stringify({
                  success: true,
                  message: 'Pagamento registrado mas a conta nao pode ser criada (telefone duplicado). Suporte ira contatar o cliente.',
                  registrationId: registration.id,
                  needs_manual_review: true
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
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

      // Fallback: garante mensagem de boas-vindas no n8n se register-user não disparou
      if (isUserRegistered && isFirstTimeActivation && registration.email) {
        try {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id, full_name, phone')
            .eq('email', String(registration.email).toLowerCase().trim())
            .maybeSingle();

          if (profile?.user_id) {
            const welcomeResult = await notifyWelcomeMessageN8n(
              supabaseAdmin,
              {
                nome: profile.full_name || String(registration.full_name || ''),
                email: String(registration.email).toLowerCase().trim(),
                telefone: String(profile.phone || registration.phone || '').replace(/\D/g, '')
              },
              profile.user_id
            );
            console.log('process-asaas-webhook welcome n8n fallback:', welcomeResult);
          } else {
            console.warn('process-asaas-webhook: profile not found for welcome webhook', registration.email);
          }
        } catch (welcomeErr) {
          console.error('process-asaas-webhook welcome n8n fallback failed:', welcomeErr);
        }
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

    // Pagamento confirmado sem cadastro pendente correspondente (ex.: cobranca
    // recorrente de assinatura antiga): aplica na assinatura local, se houver.
    if (!registration && !renewalUserId && (isPaidEvent || isPaidStatus) && paymentId) {
      const subId = await findSubscriptionId();
      if (subId) {
        const newEnd = await applyPaymentToSubscription(subId);
        return new Response(
          JSON.stringify({ success: true, message: 'Payment applied to existing subscription', current_period_end: newEnd }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.warn('Paid webhook without registration or local subscription:', { paymentId, customerId, asaasSubscriptionId });
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
      }, false);
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

    // PAYMENT_DELETED / PAYMENT_REFUNDED: apagar uma cobrança individual ou
    // estornar um pagamento NAO significa cancelar a assinatura inteira. O
    // admin pode estar so removendo um boleto duplicado, ou estornando uma
    // taxa avulsa. O cancelamento de plano so vem via SUBSCRIPTION_DELETED.
    // Por isso aqui apenas registramos no payment_history; nao mexemos no
    // status local.
    if ((eventType === 'PAYMENT_DELETED' || eventType === 'PAYMENT_REFUNDED') && paymentId) {
      await insertPaymentHistoryIdempotent(supabaseAdmin, {
        asaas_payment_id: paymentId,
        asaas_customer_id: customerId || registration?.asaas_customer_id,
        amount: payment?.value || 0,
        status: eventType === 'PAYMENT_REFUNDED' ? 'REFUNDED' : 'DELETED',
        payment_method: payment?.billingType || registration?.payment_method,
        paid_at: new Date().toISOString(),
        due_date: payment?.dueDate,
        invoice_url: payment?.invoiceUrl || registration?.invoice_url
      });
      console.log(`Payment ${eventType.toLowerCase()} logged: ${paymentId} (sub local nao alterada)`);
    }

    // Assinatura encerrada na Asaas (cancelamento pelo usuario, pelo cron ou
    // pelo painel): o cliente mantem acesso ate o fim do periodo ja pago, como
    // o cancel-subscription promete. Nao mexe em current_period_end.
    if (eventType === 'SUBSCRIPTION_DELETED' || eventType === 'SUBSCRIPTION_CANCELLED' || eventType === 'SUBSCRIPTION_INACTIVATED') {
      await updateSubscriptionByAsaasReference({
        status: 'cancelled',
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString()
      }, false);
    }

    // Chargeback: cliente solicitou estorno via cartao/banco. O Asaas vai
    // forçar o estorno do valor. Cancelamos o acesso imediatamente para
    // evitar fraude (cliente usar a plataforma sem pagar) e registramos
    // o evento no historico para suporte revisar.
    const chargebackEvents = [
      'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CHARGEBACK_DISPUTE',
      'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
    ];
    if (chargebackEvents.includes(eventType || '')) {
      const nowIso = new Date().toISOString();
      // Ontem: corta o acesso imediatamente (periodo vigente vai ate o fim do dia).
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      console.warn(`Chargeback recebido para payment=${paymentId} customer=${customerId} sub=${asaasSubscriptionId} event=${eventType}`);
      // Log no payment_history como CHARGEBACK
      if (paymentId) {
        await insertPaymentHistoryIdempotent(supabaseAdmin, {
          asaas_payment_id: paymentId,
          asaas_customer_id: customerId,
          amount: payment?.value || 0,
          status: 'CHARGEBACK',
          payment_method: payment?.billingType,
          paid_at: nowIso,
          due_date: payment?.dueDate,
          invoice_url: payment?.invoiceUrl
        });
      }
      // Bloquear acesso da sub correspondente
      await updateSubscriptionByAsaasReference({
        status: 'cancelled',
        cancel_at_period_end: true,
        cancelled_at: nowIso,
        current_period_end: yesterday
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
