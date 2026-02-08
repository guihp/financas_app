import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Received Asaas webhook:', JSON.stringify(body, null, 2));
    
    // Asaas webhook format
    const { event, payment } = body;

    // Also support direct format from n8n
    const paymentId = payment?.id || body.paymentId;
    const customerId = payment?.customer || body.customerId;
    const eventType = event || body.event;
    const paymentStatus = payment?.status || body.status;
    const externalReference = payment?.externalReference || body.externalReference;

    if (!paymentId && !externalReference) {
      console.log('No paymentId or externalReference in webhook');
      return new Response(
        JSON.stringify({ error: 'paymentId ou externalReference é obrigatório' }),
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
    let query = supabaseAdmin.from('pending_registrations').select('*');
    
    if (externalReference) {
      query = query.eq('id', externalReference);
    } else if (paymentId) {
      query = query.eq('asaas_payment_id', paymentId);
    }

    const { data: registration, error: regError } = await query.single();

    if (regError || !registration) {
      console.log('Registration not found:', { paymentId, externalReference, error: regError });
      
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
