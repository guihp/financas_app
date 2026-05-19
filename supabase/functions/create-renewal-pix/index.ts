// create-renewal-pix
// Generates a one-off PIX charge for an already-registered user whose subscription
// has expired/cancelled. The webhook PAYMENT_RECEIVED handler picks up the
// renewal externalReference and extends current_period_end by 30 days.

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const cpfCnpj = (body?.cpfCnpj || '').toString().replace(/\D/g, '');
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return new Response(JSON.stringify({ error: 'Informe um CPF ou CNPJ válido.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, asaas_customer_id, asaas_subscription_id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (subError || !sub || !sub.asaas_customer_id) {
      return new Response(JSON.stringify({ error: 'Assinatura não encontrada. Reinicie o cadastro.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Configuração de pagamento ausente.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: appSettings } = await supabaseAdmin
      .from('app_settings')
      .select('product_full_price')
      .limit(1)
      .single();
    const value = Number(appSettings?.product_full_price || 0);
    if (!value || value <= 0) {
      return new Response(JSON.stringify({ error: 'Preço não configurado.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Ensure customer has CPF on Asaas (PIX requires it)
    try {
      await fetch(`${ASAAS_BASE_URL}/customers/${sub.asaas_customer_id}`, {
        method: 'PUT',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({ cpfCnpj })
      });
    } catch (e) {
      console.warn('Failed to PUT customer CPF (non-fatal):', e);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const paymentPayload = {
      customer: sub.asaas_customer_id,
      billingType: 'PIX',
      value,
      dueDate: dueDateStr,
      description: 'Renovação mensal - IAFÉ Finanças',
      externalReference: `renewal:${user.id}`
    };

    const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(paymentPayload)
    });
    const paymentData = await paymentRes.json();
    if (!paymentRes.ok || paymentData.errors || !paymentData.id) {
      console.error('Asaas PIX renewal failed:', paymentData);
      const errMsg = Array.isArray(paymentData.errors)
        ? paymentData.errors.map((e: any) => e.description || e.code).filter(Boolean).join('. ')
        : 'Erro ao gerar PIX.';
      return new Response(JSON.stringify({ error: errMsg, details: paymentData.errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch PIX QR
    let pixCode: string | undefined;
    let pixQrCodeBase64: string | undefined;
    let pixExpirationDate: string | undefined;
    try {
      const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
      });
      const qrJson = await qrRes.json().catch(() => ({}));
      if (qrRes.ok && !qrJson.errors) {
        pixCode = qrJson.payload;
        pixQrCodeBase64 = qrJson.encodedImage;
        pixExpirationDate = qrJson.expirationDate;
      }
    } catch (e) {
      console.warn('pixQrCode fetch failed:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      paymentId: paymentData.id,
      status: paymentData.status,
      value: paymentData.value,
      invoiceUrl: paymentData.invoiceUrl,
      pixCode,
      pixQrCodeBase64,
      pixExpirationDate
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('create-renewal-pix error:', errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
