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
    console.log('Creating Asaas payment with data:', body);
    
    const { customerId, registrationId, billingType = 'PIX' } = body;

    // Validate required fields
    if (!customerId || !registrationId) {
      return new Response(
        JSON.stringify({ error: 'customerId e registrationId são obrigatórios' }),
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

    // Get pending registration to get plan info
    const { data: registration, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*, plans(*)')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      console.error('Registration not found:', regError);
      return new Response(
        JSON.stringify({ error: 'Registro não encontrado' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const plan = registration.plans;
    if (!plan) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate due date (tomorrow)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Create payment in Asaas
    const paymentPayload = {
      customer: customerId,
      billingType: billingType, // PIX, BOLETO, CREDIT_CARD
      value: plan.price,
      dueDate: dueDateStr,
      description: `${plan.name} - IAFÉ Finanças`,
      externalReference: registrationId,
      // Pix specific settings
      ...(billingType === 'PIX' && {
        pixExpirationSeconds: 86400 // 24 hours
      })
    };

    console.log('Creating Asaas payment:', paymentPayload);

    const paymentResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'access_token': ASAAS_API_KEY
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentResponse.json();
    console.log('Asaas payment response:', paymentData);

    if (paymentData.errors || !paymentData.id) {
      console.error('Failed to create Asaas payment:', paymentData);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar cobrança',
          details: paymentData.errors || paymentData
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let pixData = null;
    let boletoData = null;

    // If PIX, get the PIX QR Code
    if (billingType === 'PIX') {
      const pixResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'access_token': ASAAS_API_KEY
        }
      });

      pixData = await pixResponse.json();
      console.log('Pix QR Code data:', pixData);
    }

    // If BOLETO, the invoice URL is already in paymentData
    if (billingType === 'BOLETO') {
      boletoData = {
        bankSlipUrl: paymentData.bankSlipUrl,
        invoiceUrl: paymentData.invoiceUrl
      };
    }

    // Update pending registration with payment info
    const updateData: any = {
      asaas_payment_id: paymentData.id,
      payment_method: billingType,
      invoice_url: paymentData.invoiceUrl,
      updated_at: new Date().toISOString()
    };

    if (pixData && pixData.encodedImage) {
      updateData.pix_code = pixData.payload;
      updateData.pix_qr_code_url = `data:image/png;base64,${pixData.encodedImage}`;
    }

    if (boletoData) {
      updateData.boleto_url = boletoData.bankSlipUrl;
    }

    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update(updateData)
      .eq('id', registrationId);

    if (updateError) {
      console.error('Failed to update pending registration:', updateError);
      // Don't fail the whole operation
    }

    console.log('Payment created successfully:', {
      paymentId: paymentData.id,
      status: paymentData.status,
      billingType
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        paymentId: paymentData.id,
        status: paymentData.status,
        value: paymentData.value,
        dueDate: paymentData.dueDate,
        invoiceUrl: paymentData.invoiceUrl,
        billingType: billingType,
        // PIX specific
        ...(pixData && {
          pixCode: pixData.payload,
          pixQrCodeBase64: pixData.encodedImage,
          pixExpirationDate: pixData.expirationDate
        }),
        // Boleto specific
        ...(boletoData && {
          boletoUrl: boletoData.bankSlipUrl
        })
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in create-asaas-payment function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
