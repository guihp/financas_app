import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? '';
const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    // n8n pode enviar o payload em body.body ou no root
    const body = rawBody?.body && typeof rawBody.body === 'object' ? rawBody.body : rawBody;
    console.log('Received Asaas webhook (keys):', Object.keys(body || {}));

    // Asaas webhook format: { event, payment: { id, externalReference, ... } }
    // n8n pode repassar com estrutura diferente
    const payment = body?.payment || body?.Payment || rawBody?.payment;
    const event = body?.event || body?.Event || rawBody?.event;

    // paymentId: Asaas usa "pay_xxx"; body.id pode ser o payment quando n8n repassa
    const paymentId = payment?.id || payment?.ID || body?.paymentId || body?.payment_id || rawBody?.paymentId || (typeof body?.id === 'string' && body.id.startsWith('pay_') ? body.id : null);
    const customerId = payment?.customer || payment?.Customer || body?.customerId || body?.customer_id;
    const eventType = event || body?.event || rawBody?.event;
    const paymentStatus = payment?.status || payment?.Status || body?.status || rawBody?.status;
    const externalReference = payment?.externalReference ?? payment?.external_reference ?? body?.externalReference ?? body?.external_reference ?? rawBody?.externalReference;

    if (!paymentId && !externalReference && !customerId) {
      console.error('Webhook sem paymentId, externalReference nem customerId. Body recebido:', JSON.stringify({ ...body, payment: body?.payment ? '[presente]' : 'ausente' }).slice(0, 500));
      return new Response(
        JSON.stringify({
          error: 'paymentId, externalReference ou customerId é obrigatório',
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

    if (regError || !registration) {
      console.log('Registration not found:', { paymentId, externalReference, customerId, error: regError });

      // Don't fail - webhook might be for a different payment type
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook recebido, mas registro não encontrado',
          paymentId,
          externalReference
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Found registration:', registration.id, 'current status:', registration.status);

    // Check if payment is confirmed
    const paidEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'];
    const isPaidEvent = paidEvents.includes(eventType);

    const paidStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    const isPaidStatus = paidStatuses.includes(paymentStatus);

    if (isPaidEvent || isPaidStatus) {
      // Update registration to paid
      const { error: updateError } = await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', registration.id)
        .in('status', ['pending_payment']); // Only update if still pending

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
          asaas_payment_id: paymentId,
          asaas_customer_id: customerId || registration.asaas_customer_id,
          amount: payment?.value || 0,
          status: paymentStatus || 'CONFIRMED',
          payment_method: payment?.billingType || registration.payment_method,
          paid_at: new Date().toISOString(),
          due_date: payment?.dueDate,
          invoice_url: payment?.invoiceUrl || registration.invoice_url
        });

      if (historyError) {
        console.error('Failed to record payment history:', historyError);
        // Don't fail the webhook
      }

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
        } else {
          console.log('User created from paid registration:', registration.id);
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

    // Handle other events (overdue, cancelled, etc)
    if (eventType === 'PAYMENT_OVERDUE') {
      await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', registration.id);

      console.log('Registration marked as expired due to overdue payment:', registration.id);
    }

    if (eventType === 'PAYMENT_DELETED' || eventType === 'PAYMENT_REFUNDED') {
      await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', registration.id);

      console.log('Registration cancelled:', registration.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processado',
        event: eventType,
        registrationId: registration.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in process-asaas-webhook function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
