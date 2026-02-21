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
      creditCardHolderInfo,
      // CPF/CNPJ for PIX (required - Asaas exige no cliente)
      cpfCnpj,
      // Address (optional; saved to DB for both PIX and Cartão)
      address
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

    // Address is required for both PIX and Cartão (save to DB)
    const addrFields = address && typeof address === 'object' ? {
      postalCode: address.postalCode != null && String(address.postalCode).trim() !== '',
      street: address.street != null && String(address.street).trim() !== '',
      number: address.number != null && String(address.number).trim() !== '',
      neighborhood: address.neighborhood != null && String(address.neighborhood).trim() !== '',
      city: address.city != null && String(address.city).trim() !== '',
      state: address.state != null && String(address.state).trim() !== ''
    } : null;
    const hasAddress = addrFields && Object.values(addrFields).every(Boolean);
    if (!hasAddress) {
      const missing = addrFields ? Object.entries(addrFields).filter(([, v]) => !v).map(([k]) => k).join(', ') : 'endereço';
      return new Response(
        JSON.stringify({ error: `Endereço incompleto. Verifique: ${missing || 'CEP, logradouro, número, bairro, cidade e UF'}.` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // CPF/CNPJ for PIX: required by Asaas. Will validate after optional fetch from Asaas customer.

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

    const plan = (registration.plans ?? registration.plan) as { id: string; name: string; price: number } | null;
    if (!plan || !plan.price) {
      console.error('Plan not found for registration:', registrationId);
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado. Tente novamente.' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // PIX: resolve CPF/CNPJ - from body or fallback to Asaas customer
    let cpfCnpjForPix = cpfCnpj ? String(cpfCnpj).replace(/\D/g, '') : '';
    if (billingType === 'PIX' && (!cpfCnpjForPix || (cpfCnpjForPix.length !== 11 && cpfCnpjForPix.length !== 14))) {
      try {
        const custRes = await fetch(`${ASAAS_BASE_URL}/customers/${customerId}`, {
          headers: { 'accept': 'application/json', 'access_token': ASAAS_API_KEY }
        });
        const custData = await custRes.json();
        const custCpf = custData?.cpfCnpj ? String(custData.cpfCnpj).replace(/\D/g, '') : '';
        if (custCpf && (custCpf.length === 11 || custCpf.length === 14)) {
          cpfCnpjForPix = custCpf;
          console.log('Using CPF/CNPJ from Asaas customer:', custCpf.slice(0, 3) + '***');
        }
      } catch (e) {
        console.warn('Failed to fetch customer for CPF fallback:', e);
      }
      if (!cpfCnpjForPix || (cpfCnpjForPix.length !== 11 && cpfCnpjForPix.length !== 14)) {
        return new Response(
          JSON.stringify({ error: 'Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (billingType === 'PIX' && cpfCnpjForPix) {
      cpfCnpjForPix = String(cpfCnpjForPix).replace(/\D/g, '');
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

    // PIX: apenas customer, billingType, value, dueDate são obrigatórios (doc Asaas)
    // Não enviar pixExpirationSeconds - não está no schema e pode causar 400

    // Add Credit Card specific data (doc Asaas: creditCard + creditCardHolderInfo + remoteIp)
    if (billingType === 'CREDIT_CARD') {
      const cleanPhone = (creditCardHolderInfo.phone || '').replace(/\D/g, '');
      const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';
      paymentPayload.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\s/g, ''),
        expiryMonth: String(creditCard.expiryMonth || '').padStart(2, '0'),
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      };
      paymentPayload.creditCardHolderInfo = {
        name: creditCardHolderInfo.name,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
        postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
        phone: cleanPhone,
        mobilePhone: cleanPhone,
        email: registration.email,
        addressNumber: creditCardHolderInfo.addressNumber || '0',
        ...(address?.complement != null && address.complement !== '' && { addressComplement: address.complement }),
        remoteIp
      };
    }

    // PIX: update customer with CPF/CNPJ before creating payment (Asaas requires it on the customer)
    if (billingType === 'PIX' && cpfCnpjForPix) {
      const cleanCpf = cpfCnpjForPix;
      const updateRes = await fetch(`${ASAAS_BASE_URL}/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({ cpfCnpj: cleanCpf })
      });
      const updateData = await updateRes.json();
      if (updateData.errors && !updateRes.ok) {
        console.error('Failed to update customer with CPF:', updateData);
        const errDesc = Array.isArray(updateData.errors) ? updateData.errors[0]?.description : updateData.errors?.description;
        return new Response(
          JSON.stringify({ error: errDesc || 'Erro ao atualizar CPF/CNPJ do cliente. Verifique os dados informados.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Customer updated with CPF/CNPJ for PIX');
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
      console.error('Failed to create Asaas payment:', JSON.stringify(paymentData));
      
      // Parse Asaas error messages (array or single object)
      let errorMessage = 'Erro ao criar cobrança';
      const errs = Array.isArray(paymentData.errors) ? paymentData.errors : (paymentData.errors ? [paymentData.errors] : []);
      if (errs.length > 0) {
        const msgs = errs.map((e: any) => e.description || e.message || e.code || String(e)).filter(Boolean);
        errorMessage = msgs.length ? msgs.join('. ') : errorMessage;
      }

      // Cliente removido no Asaas? Limpar e criar novo para permitir novo cadastro
      const isCustomerRemoved = /removido|removed|cliente.*inválido/i.test(errorMessage);
      if (isCustomerRemoved) {
        console.log('Cliente removido no Asaas, recriando...');
        await supabaseAdmin.from('pending_registrations').update({ asaas_customer_id: null, updated_at: new Date().toISOString() }).eq('id', registrationId);
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const custRes = await fetch(`${supabaseUrl}/functions/v1/create-asaas-customer`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId })
        });
        const custData = await custRes.json().catch(() => ({}));
        const newCustomerId = custData?.customerId;
        if (newCustomerId) {
          console.log('Novo cliente criado:', newCustomerId, '- retentando pagamento');
          // Rebuild payload com novo customerId e retentar
          const retryPayload = { ...paymentPayload, customer: newCustomerId };
          const retryRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
            method: 'POST',
            headers: { 'accept': 'application/json', 'content-type': 'application/json', 'access_token': ASAAS_API_KEY },
            body: JSON.stringify(retryPayload)
          });
          const retryData = await retryRes.json();
          if (!retryData.errors && retryData.id) {
            // Sucesso no retry - continuar fluxo normal (pixData, update DB, etc.)
            Object.assign(paymentData, retryData);
          } else {
            const retryErr = Array.isArray(retryData.errors) ? retryData.errors : (retryData.errors ? [retryData.errors] : []);
            const retryMsgs = retryErr.map((e: any) => e.description || e.message || e.code).filter(Boolean);
            return new Response(JSON.stringify({ error: retryMsgs.length ? retryMsgs.join('. ') : errorMessage, details: retryData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else {
          return new Response(JSON.stringify({ error: 'Não foi possível vincular um novo cliente. Tente iniciar um novo cadastro.', details: custData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            details: paymentData.errors ?? paymentData
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let pixData: { payload?: string; encodedImage?: string; expirationDate?: string } | null = null;
    let boletoData = null;

    // If PIX, get código copia e cola + QR Code (pixQrCode ou fallback billingInfo como no n8n)
    if (billingType === 'PIX') {
      const asaasHeaders = { 'accept': 'application/json', 'access_token': ASAAS_API_KEY };

      // 1) Tentar GET /payments/{id}/pixQrCode (retorna encodedImage, payload, expirationDate)
      try {
        const pixResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
          method: 'GET',
          headers: asaasHeaders
        });
        const pixJson = await pixResponse.json();
        console.log('Pix pixQrCode response status:', pixResponse.status, pixJson?.errors ? 'errors' : 'ok');
        if (pixResponse.ok && !pixJson.errors && (pixJson.payload || pixJson.encodedImage)) {
          pixData = {
            payload: pixJson.payload,
            encodedImage: pixJson.encodedImage,
            expirationDate: pixJson.expirationDate
          };
        }
      } catch (e) {
        console.warn('pixQrCode request failed:', e);
      }

      // 2) Fallback: GET /payments/{id}/billingInfo (como no n8n: response.pix.payload / .encodedImage)
      if (!pixData || (!pixData.payload && !pixData.encodedImage)) {
        try {
          const billingRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/billingInfo`, {
            method: 'GET',
            headers: asaasHeaders
          });
          const billingJson = await billingRes.json();
          console.log('Pix billingInfo response status:', billingRes.status);
          if (billingRes.ok && billingJson?.pix) {
            const pix = billingJson.pix;
            pixData = {
              payload: pix.payload ?? pixData?.payload,
              encodedImage: pix.encodedImage ?? pixData?.encodedImage,
              expirationDate: pix.expirationDate ?? pixData?.expirationDate
            };
          }
        } catch (e) {
          console.warn('billingInfo request failed:', e);
        }
      }
    }

    // If BOLETO, the invoice URL is already in paymentData
    if (billingType === 'BOLETO') {
      boletoData = {
        bankSlipUrl: paymentData.bankSlipUrl,
        invoiceUrl: paymentData.invoiceUrl
      };
    }

    // Update pending registration with payment info and address
    const updateData: any = {
      asaas_payment_id: paymentData.id,
      payment_method: billingType,
      invoice_url: paymentData.invoiceUrl,
      updated_at: new Date().toISOString()
    };
    if (address && typeof address === 'object') {
      if (address.postalCode != null) updateData.address_postal_code = String(address.postalCode).replace(/\D/g, '');
      if (address.street != null) updateData.address_street = address.street;
      if (address.number != null) updateData.address_number = address.number;
      if (address.complement != null) updateData.address_complement = address.complement;
      if (address.neighborhood != null) updateData.address_neighborhood = address.neighborhood;
      if (address.city != null) updateData.address_city = address.city;
      if (address.state != null) updateData.address_state = address.state;
    }

    // If credit card payment was approved immediately, mark as paid
    if (billingType === 'CREDIT_CARD' && ['CONFIRMED', 'RECEIVED'].includes(paymentData.status)) {
      updateData.status = 'paid';
      updateData.paid_at = new Date().toISOString();
    }

    if (pixData && pixData.payload) {
      updateData.pix_code = pixData.payload;
      if (pixData.encodedImage) {
        updateData.pix_qr_code_url = `data:image/png;base64,${pixData.encodedImage}`;
      }
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

    // If credit card was approved immediately, create user account
    let registerUserError: string | null = null;
    if (billingType === 'CREDIT_CARD' && ['CONFIRMED', 'RECEIVED'].includes(paymentData.status)) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      try {
        const regRes = await fetch(`${supabaseUrl}/functions/v1/register-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ registrationId })
        });
        const regResult = await regRes.json().catch(() => ({}));
        if (!regRes.ok) {
          registerUserError = regResult?.error || regResult?.message || `Erro ao criar conta (${regRes.status})`;
          console.error('register-user failed after card payment:', regRes.status, regResult);
        } else {
          console.log('User created from card payment:', registrationId);
        }
      } catch (invokeError) {
        registerUserError = 'Erro ao criar conta. Tente fazer login ou entre em contato com o suporte.';
        console.error('Failed to invoke register-user:', invokeError);
      }
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
            pixCode: pixData?.payload ?? null,
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
        // PIX: código copia e cola + QR (sempre retornar quando houver)
        ...(pixData && pixData.payload && {
          pixCode: pixData.payload,
          ...(pixData.encodedImage && { pixQrCodeBase64: pixData.encodedImage }),
          ...(pixData.expirationDate && { pixExpirationDate: pixData.expirationDate })
        }),
        // Boleto specific
        ...(boletoData && {
          boletoUrl: boletoData.bankSlipUrl
        }),
        // Credit card - check if already paid
        ...(billingType === 'CREDIT_CARD' && {
          isPaid: ['CONFIRMED', 'RECEIVED'].includes(paymentData.status),
          ...(registerUserError ? { registerUserError } : {})
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
