// create-renewal-subscription
// Creates a NEW recurring credit-card subscription on Asaas for an already-registered
// user whose subscription expired/was cancelled. There is no trial: the first charge
// happens today. The webhook picks up the `renewal:<userId>` externalReference and
// extends current_period_end by 30 days on every confirmed payment.
//
// Before this function existed the only "reactivate with card" path was
// /pagamento-pendente, which requires a pending_registrations row in status
// pending_payment. An expired customer has no such row, so the card option was a
// dead end and only PIX renewal worked.

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

const asaasHeaders = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'access_token': ASAAS_API_KEY
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const asaasErrorMessage = (data: any, fallback: string): string => {
  const errs = Array.isArray(data?.errors) ? data.errors : (data?.errors ? [data.errors] : []);
  const msgs = errs.map((e: any) => e?.description || e?.message || e?.code).filter(Boolean);
  return msgs.length ? msgs.join('. ') : fallback;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Não autenticado' }, 401);

    if (!ASAAS_API_KEY) return json({ error: 'Configuração de pagamento ausente.' }, 500);

    const body = await req.json().catch(() => ({}));
    const creditCard = body?.creditCard;
    const holderInfo = body?.creditCardHolderInfo;
    const address = body?.address;
    // `quote: true` resolves the price this customer would pay and returns it
    // WITHOUT touching Asaas, so the UI can show the real amount (which may be a
    // permanently discounted one) before the customer types a card.
    const quoteOnly = body?.quote === true;

    const { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, asaas_customer_id, asaas_subscription_id, status, is_trial, current_period_end')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !sub || !sub.asaas_customer_id) {
      return json({ error: 'Assinatura não encontrada. Reinicie o cadastro.' }, 404);
    }

    // Do not let an already-active customer create a second recurring subscription.
    if (sub.status === 'active' && sub.current_period_end) {
      const today = new Date(new Date().toISOString().split('T')[0]);
      if (new Date(sub.current_period_end) >= today) {
        return json({ error: 'Sua assinatura já está ativa. Não é necessário renovar agora.' }, 409);
      }
    }

    const { data: appSettings } = await supabaseAdmin
      .from('app_settings')
      .select('product_full_price')
      .limit(1)
      .single();
    const fullPrice = Number(appSettings?.product_full_price || 0);

    // A coupon discount is PERMANENT: the customer keeps the discounted price on
    // every renewal, forever. `pending_registrations.promotional_code_id` is not
    // reliably filled (legacy rows have it null even when a coupon was applied),
    // so the last amount the customer actually paid is the source of truth.
    // Falls back to the configured full price when there is no payment history.
    let value = fullPrice;
    const { data: lastPaid } = await supabaseAdmin
      .from('payment_history')
      .select('amount, paid_at')
      .eq('asaas_customer_id', sub.asaas_customer_id)
      .in('status', ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
      .gt('amount', 0)
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastAmount = Number(lastPaid?.amount || 0);
    // Only ever honour a price BELOW the full price. A stale higher amount (an
    // old plan, a one-off charge) must not make the customer pay more than today's
    // list price.
    if (lastAmount > 0 && lastAmount < fullPrice) {
      value = lastAmount;
      console.log(`Honouring permanent discount for customer ${sub.asaas_customer_id}: ${value} (full ${fullPrice})`);
    }

    if (!value || value <= 0) return json({ error: 'Preço não configurado.' }, 500);

    if (quoteOnly) {
      return json({ value, fullPrice, discounted: value < fullPrice });
    }

    if (!creditCard?.number || !creditCard?.holderName || !creditCard?.expiryMonth || !creditCard?.expiryYear || !creditCard?.ccv) {
      return json({ error: 'Dados do cartão incompletos.' }, 400);
    }
    const holderCpf = String(holderInfo?.cpfCnpj || '').replace(/\D/g, '');
    if (holderCpf.length !== 11 && holderCpf.length !== 14) {
      return json({ error: 'Informe um CPF ou CNPJ válido do titular do cartão.' }, 400);
    }
    const holderPostalCode = String(holderInfo?.postalCode || '').replace(/\D/g, '');
    if (holderPostalCode.length !== 8) {
      return json({ error: 'Informe um CEP válido do titular do cartão.' }, 400);
    }

    // Kill the old Asaas subscription only once we are actually going to create a
    // new one. Doing it earlier would leave a customer who typed a bad card with no
    // subscription at all. If the old one is still ACTIVE there, creating a second
    // one would double-charge the customer every month.
    if (sub.asaas_subscription_id) {
      try {
        const oldRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${sub.asaas_subscription_id}`, {
          headers: asaasHeaders
        });
        if (oldRes.ok) {
          const oldData = await oldRes.json().catch(() => ({}));
          if (oldData?.id && oldData?.status !== 'INACTIVE' && oldData?.deleted !== true) {
            const delRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${sub.asaas_subscription_id}`, {
              method: 'DELETE', headers: asaasHeaders
            });
            console.log('Old Asaas subscription delete status:', delRes.status, sub.asaas_subscription_id);
          }
        }
      } catch (e) {
        console.warn('Could not inspect/delete old Asaas subscription:', e);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const cleanPhone = String(holderInfo?.phone || '').replace(/\D/g, '');
    const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '127.0.0.1';

    const subscriptionPayload: Record<string, unknown> = {
      customer: sub.asaas_customer_id,
      billingType: 'CREDIT_CARD',
      value,
      // No trial on reactivation: charge today.
      nextDueDate: today,
      cycle: 'MONTHLY',
      description: 'Assinatura mensal - IAFÉ Finanças',
      externalReference: `renewal:${user.id}`,
      creditCard: {
        holderName: creditCard.holderName,
        number: String(creditCard.number).replace(/\s/g, ''),
        expiryMonth: String(creditCard.expiryMonth).padStart(2, '0'),
        expiryYear: String(creditCard.expiryYear),
        ccv: String(creditCard.ccv)
      },
      creditCardHolderInfo: {
        name: holderInfo?.name || creditCard.holderName,
        cpfCnpj: holderCpf,
        postalCode: holderPostalCode,
        phone: cleanPhone,
        mobilePhone: cleanPhone,
        email: user.email,
        addressNumber: holderInfo?.addressNumber || address?.number || '0',
        ...(address?.complement ? { addressComplement: address.complement } : {}),
        remoteIp
      }
    };

    const subRes = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(subscriptionPayload)
    });
    const subData = await subRes.json().catch(() => ({}));

    if (!subRes.ok || subData?.errors || !subData?.id) {
      console.error('Asaas renewal subscription failed:', JSON.stringify(subData));
      return json({
        error: asaasErrorMessage(subData, 'Não foi possível reativar com cartão agora.'),
        details: subData?.errors
      }, 400);
    }

    // Store the new subscription id immediately. Status stays untouched: only the
    // webhook (PAYMENT_RECEIVED/CONFIRMED with renewal: reference) may flip it to active.
    const { error: persistError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        asaas_subscription_id: subData.id,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', sub.id);
    if (persistError) {
      console.error('CRITICAL: renewal subscription created on Asaas but not persisted', {
        userId: user.id, subscriptionId: subData.id, error: persistError.message
      });
    }

    // Surface an immediate card refusal instead of leaving the user staring at
    // "aguardando confirmação" forever.
    let firstPaymentStatus: string | null = null;
    let firstPaymentId: string | null = null;
    try {
      const payRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subData.id}/payments`, {
        headers: asaasHeaders
      });
      const payData = await payRes.json().catch(() => ({}));
      const first = Array.isArray(payData?.data) ? payData.data[0] : null;
      if (first) {
        firstPaymentStatus = first.status ?? null;
        firstPaymentId = first.id ?? null;
      }
    } catch (e) {
      console.warn('Could not read first payment of renewal subscription:', e);
    }

    const refused = firstPaymentStatus === 'REFUNDED'
      || firstPaymentStatus === 'REFUND_REQUESTED'
      || firstPaymentStatus === 'CHARGEBACK_REQUESTED'
      || firstPaymentStatus === 'AWAITING_CHARGEBACK_REVERSAL';

    if (refused) {
      return json({
        error: 'O cartão não foi aprovado. Tente outro cartão ou use PIX.',
        subscriptionId: subData.id,
        paymentStatus: firstPaymentStatus
      }, 400);
    }

    return json({
      success: true,
      subscriptionId: subData.id,
      paymentId: firstPaymentId,
      paymentStatus: firstPaymentStatus,
      value
    });
  } catch (error) {
    console.error('create-renewal-subscription error:', error);
    return json({ error: 'Erro inesperado ao reativar a assinatura.' }, 500);
  }
});
