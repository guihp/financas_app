import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Asaas API configuration
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? '';
const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Checking payment status:', body);
    
    const { paymentId, registrationId } = body;

    // Validate - need at least one identifier
    if (!paymentId && !registrationId) {
      return new Response(
        JSON.stringify({ error: 'paymentId ou registrationId é obrigatório' }),
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

    let asaasPaymentId = paymentId;

    // If only registrationId provided, get paymentId from database
    let registration: { asaas_payment_id?: string; asaas_customer_id?: string; status: string } | null = null;
    if (!asaasPaymentId && registrationId) {
      const { data: regData, error: regError } = await supabaseAdmin
        .from('pending_registrations')
        .select('asaas_payment_id, asaas_customer_id, status')
        .eq('id', registrationId)
        .single();
      registration = regData;

      if (regError || !registration) {
        return new Response(
          JSON.stringify({ error: 'Registro não encontrado' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // If already paid in our DB, ensure user exists (webhook may not have run) then return
      if (registration.status === 'paid' || registration.status === 'registered') {
        let registerUserError: string | null = null;
        if (registration.status === 'paid') {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            const regRes = await fetch(`${supabaseUrl}/functions/v1/register-user`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ registrationId })
            });
            const regResult = await regRes.json().catch(() => ({}));
            if (regRes.ok) {
              console.log('User created from check-payment-status (was already paid):', registrationId);
            } else {
              registerUserError = regResult?.error || regResult?.message || `Erro ao criar conta (${regRes.status})`;
              console.warn('register-user on already-paid registration:', regRes.status, regResult);
            }
          } catch (e) {
            registerUserError = 'Erro ao criar conta. Tente fazer login ou entre em contato com o suporte.';
            console.error('Failed to invoke register-user:', e);
          }
        }
        return new Response(
          JSON.stringify({ 
            success: true,
            status: 'CONFIRMED',
            isPaid: true,
            registrationStatus: registration.status,
            ...(registerUserError ? { registerUserError } : {})
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      asaasPaymentId = registration.asaas_payment_id;

      // Fallback: quando asaas_payment_id for null mas temos asaas_customer_id, buscar pagamentos do cliente no Asaas
      if (!asaasPaymentId && registration.asaas_customer_id) {
        const customerId = body.customerId ?? registration.asaas_customer_id;
        const listRes = await fetch(
          `${ASAAS_BASE_URL}/payments?customer=${customerId}&limit=20`,
          {
            headers: {
              'accept': 'application/json',
              'access_token': ASAAS_API_KEY
            }
          }
        );
        const listData = await listRes.json();
        const paidStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
        const paidPayment = (listData?.data ?? []).find((p: { status: string }) => paidStatuses.includes(p.status));
        if (paidPayment) {
          asaasPaymentId = paidPayment.id;
          console.log('Found paid payment by customer fallback:', paidPayment.id);
          // Atualizar registro com asaas_payment_id e status paid se ainda pendente
          await supabaseAdmin
            .from('pending_registrations')
            .update({
              asaas_payment_id: paidPayment.id,
              status: 'paid',
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', registrationId)
            .eq('status', 'pending_payment');
        }
      }
    }

    // Sem cobrança Asaas ainda (PIX/cartão ainda não gerado) → retornar 200 pendente em vez de 404
    if (!asaasPaymentId) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'PENDING',
          isPaid: false,
          message: 'Aguardando geração do pagamento.'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check payment status in Asaas
    const paymentResponse = await fetch(`${ASAAS_BASE_URL}/payments/${asaasPaymentId}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'access_token': ASAAS_API_KEY
      }
    });

    const paymentData = await paymentResponse.json();
    console.log('Asaas payment status:', paymentData);

    if (paymentData.errors) {
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao verificar pagamento',
          details: paymentData.errors
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if payment is confirmed/received
    const paidStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    const isPaid = paidStatuses.includes(paymentData.status);

    // If paid, update pending registration and create user account
    let registerUserError: string | null = null;
    if (isPaid && registrationId) {
      const { error: updateError } = await supabaseAdmin
        .from('pending_registrations')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', registrationId)
        .eq('status', 'pending_payment'); // Only update if still pending

      if (updateError) {
        console.error('Failed to update registration status:', updateError);
      } else {
        console.log('Registration marked as paid:', registrationId);
        // Create user account (PIX/Boleto - webhook may not have run)
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const regRes = await fetch(`${supabaseUrl}/functions/v1/register-user`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId })
          });
          const regResult = await regRes.json().catch(() => ({}));
          if (regRes.ok) {
            console.log('User created from check-payment-status:', registrationId);
          } else {
            registerUserError = regResult?.error || regResult?.message || `Erro ao criar conta (${regRes.status})`;
            console.error('register-user failed:', regRes.status, regResult);
          }
        } catch (e) {
          registerUserError = 'Erro ao criar conta. Tente fazer login ou entre em contato com o suporte.';
          console.error('Failed to invoke register-user:', e);
        }
      }
    }

    // Get registration status from DB
    let registrationStatus = null;
    if (registrationId) {
      const { data: regData } = await supabaseAdmin
        .from('pending_registrations')
        .select('status')
        .eq('id', registrationId)
        .single();
      
      registrationStatus = regData?.status;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        paymentId: paymentData.id,
        status: paymentData.status,
        isPaid: isPaid,
        value: paymentData.value,
        netValue: paymentData.netValue,
        paymentDate: paymentData.paymentDate,
        confirmedDate: paymentData.confirmedDate,
        billingType: paymentData.billingType,
        registrationStatus: registrationStatus,
        ...(registerUserError ? { registerUserError } : {})
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in check-payment-status function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
