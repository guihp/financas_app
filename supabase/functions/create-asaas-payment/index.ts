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
    console.log('Creating Asaas payment with data:', { ...body, creditCard: body.creditCard ? '[HIDDEN]' : undefined });
    
    const { 
      customerId, 
      registrationId, 
      billingType = 'PIX',
      // Credit card data (optional)
      creditCard,
      creditCardHolderInfo
    } = body;

    // Check if API key is configured
    if (!ASAAS_API_KEY) {
      console.error('ASAAS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento não encontrada. Entre em contato com o suporte.' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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

    // Validate credit card data if billing type is CREDIT_CARD
    if (billingType === 'CREDIT_CARD') {
      if (!creditCard || !creditCard.number || !creditCard.holderName || !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.ccv) {
        return new Response(
          JSON.stringify({ error: 'Dados do cartão de crédito são obrigatórios' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      if (!creditCardHolderInfo || !creditCardHolderInfo.name || !creditCardHolderInfo.cpfCnpj || !creditCardHolderInfo.postalCode || !creditCardHolderInfo.phone) {
        return new Response(
          JSON.stringify({ error: 'Dados do titular do cartão são obrigatórios' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
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
        JSON.stringify({ error: 'Registro não encontrado. Tente novamente.' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const plan = registration.plans;
    if (!plan) {
      console.error('Plan not found for registration:', registrationId);
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado. Tente novamente.' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate due date (tomorrow for PIX/BOLETO, today for credit card)
    const dueDate = new Date();
    if (billingType !== 'CREDIT_CARD') {
      dueDate.setDate(dueDate.getDate() + 1);
    }
    const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Build payment payload
    const paymentPayload: any = {
      customer: customerId,
      billingType: billingType,
      value: parseFloat(plan.price),
      dueDate: dueDateStr,
      description: `${plan.name} - IAFÉ Finanças`,
      externalReference: registrationId
    };

    // Add PIX specific settings
    if (billingType === 'PIX') {
      paymentPayload.pixExpirationSeconds = 86400; // 24 hours
    }

    // Add Credit Card specific data
    if (billingType === 'CREDIT_CARD') {
      paymentPayload.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\s/g, ''),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      };
      paymentPayload.creditCardHolderInfo = {
        name: creditCardHolderInfo.name,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
        postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
        phone: creditCardHolderInfo.phone.replace(/\D/g, ''),
        email: registration.email,
        addressNumber: creditCardHolderInfo.addressNumber || '0'
      };
    }

    console.log('Creating Asaas payment with payload:', { 
      ...paymentPayload, 
      creditCard: paymentPayload.creditCard ? '[HIDDEN]' : undefined 
    });
    console.log('Using API URL:', ASAAS_BASE_URL);

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
    console.log('Asaas payment response status:', paymentResponse.status);
    console.log('Asaas payment response:', paymentData);

    if (paymentData.errors || !paymentData.id) {
      console.error('Failed to create Asaas payment:', paymentData);
      
      // Parse Asaas error messages
      let errorMessage = 'Erro ao criar cobrança';
      if (paymentData.errors && paymentData.errors.length > 0) {
        const errorDescriptions = paymentData.errors.map((e: any) => e.description || e.code).join(', ');
        errorMessage = `Erro: ${errorDescriptions}`;
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
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
      try {
        const pixResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'access_token': ASAAS_API_KEY
          }
        });

        pixData = await pixResponse.json();
        console.log('Pix QR Code response status:', pixResponse.status);
      } catch (pixError) {
        console.error('Failed to get PIX QR code:', pixError);
      }
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

    // If credit card payment was approved immediately, mark as paid
    if (billingType === 'CREDIT_CARD' && ['CONFIRMED', 'RECEIVED'].includes(paymentData.status)) {
      updateData.status = 'paid';
      updateData.paid_at = new Date().toISOString();
    }

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
    }

    // Send payment email (for PIX and BOLETO only)
    if (billingType !== 'CREDIT_CARD') {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-payment-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: registration.email,
            userName: registration.full_name,
            planName: plan.name,
            planPrice: plan.price,
            paymentMethod: billingType,
            pixCode: pixData?.payload,
            pixQrCodeUrl: pixData?.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null,
            boletoUrl: boletoData?.bankSlipUrl,
            invoiceUrl: paymentData.invoiceUrl,
            expiresAt: registration.expires_at
          })
        });
        
        const emailResult = await emailResponse.json();
        console.log('Payment email result:', emailResult);
      } catch (emailError) {
        console.error('Failed to send payment email:', emailError);
        // Don't fail the whole operation if email fails
      }
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
        ...(pixData && pixData.encodedImage && {
          pixCode: pixData.payload,
          pixQrCodeBase64: pixData.encodedImage,
          pixExpirationDate: pixData.expirationDate
        }),
        // Boleto specific
        ...(boletoData && {
          boletoUrl: boletoData.bankSlipUrl
        }),
        // Credit card - check if already paid
        ...(billingType === 'CREDIT_CARD' && {
          isPaid: ['CONFIRMED', 'RECEIVED'].includes(paymentData.status)
        })
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in create-asaas-payment function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
