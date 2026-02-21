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
    console.log('Creating Asaas customer with data:', { ...body, password: '[HIDDEN]' });

    const { email, full_name, phone, cpfCnpj, password, terms_accepted, registrationId } = body;

    // Validate password early
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Senha é obrigatória para criar o cadastro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client early (needed for registrationId flow)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let emailToUse = email;
    let fullNameToUse = full_name;
    let phoneToUse = phone;
    let termsAcceptedToUse = terms_accepted;

    // Se registrationId informado, buscar dados do registro existente (para corrigir registros sem asaas_customer_id)
    if (registrationId) {
      const { data: existingReg, error: regErr } = await supabaseAdmin
        .from('pending_registrations')
        .select('email, full_name, phone, asaas_customer_id, status')
        .eq('id', registrationId)
        .single();

      if (regErr || !existingReg) {
        return new Response(
          JSON.stringify({ error: 'Registro não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (existingReg.asaas_customer_id) {
        return new Response(
          JSON.stringify({
            success: true,
            customerId: existingReg.asaas_customer_id,
            registrationId,
            message: 'Cliente já vinculado.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      emailToUse = existingReg.email;
      fullNameToUse = existingReg.full_name;
      phoneToUse = existingReg.phone;
    }

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
    if (!emailToUse || !fullNameToUse || !phoneToUse) {
      return new Response(
        JSON.stringify({ error: 'Email, nome completo e telefone são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Clean phone number
    const cleanPhone = phoneToUse.replace(/\D/g, '');

    console.log('Searching for existing Asaas customer with email:', emailToUse);
    console.log('Using API URL:', ASAAS_BASE_URL);

    // Check if customer already exists in Asaas by email
    const searchResponse = await fetch(`${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(emailToUse)}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'access_token': ASAAS_API_KEY
      }
    });

    const searchData = await searchResponse.json();
    console.log('Asaas customer search response status:', searchResponse.status);
    console.log('Asaas customer search result:', searchData);

    // Check for API key error
    if (searchData.errors && searchData.errors.some((e: any) => e.code === 'invalid_access_token')) {
      console.error('Invalid Asaas API key');
      return new Response(
        JSON.stringify({ error: 'Erro de configuração do gateway de pagamento. Entre em contato com o suporte.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let customerId: string;

    if (searchData.data && searchData.data.length > 0) {
      // Customer already exists, use existing ID
      customerId = searchData.data[0].id;
      console.log('Using existing Asaas customer:', customerId);
    } else {
      // Create new customer in Asaas
      const customerPayload = {
        name: fullNameToUse,
        email: emailToUse,
        phone: cleanPhone,
        mobilePhone: cleanPhone,
        cpfCnpj: cpfCnpj || null, // Optional
        notificationDisabled: false
      };

      console.log('Creating new Asaas customer:', customerPayload);

      const createResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'access_token': ASAAS_API_KEY
        },
        body: JSON.stringify(customerPayload)
      });

      const createData = await createResponse.json();
      console.log('Asaas customer creation response status:', createResponse.status);
      console.log('Asaas customer creation response:', createData);

      if (createData.errors || !createData.id) {
        console.error('Failed to create Asaas customer:', createData);

        let errorMessage = 'Erro ao criar cliente no sistema de pagamento';
        if (createData.errors && createData.errors.length > 0) {
          const errorDescriptions = createData.errors.map((e: any) => e.description || e.code).join(', ');
          errorMessage = `Erro: ${errorDescriptions}`;
        }

        return new Response(
          JSON.stringify({
            error: errorMessage,
            details: createData.errors || createData
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      customerId = createData.id;
      console.log('Created new Asaas customer:', customerId);
    }

    // Get default plan
    const { data: planData, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('active', true)
      .single();

    if (planError || !planData) {
      console.error('Failed to get plan:', planError);
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Simple hash for temporary password storage (will be replaced on actual registration)
    // Note: In production, use a proper encryption method
    // Simple hash for temporary password storage (will be replaced on actual registration)
    // Note: In production, use a proper encryption method
    const passwordHash = btoa(password);
    const termsAcceptedAt = termsAcceptedToUse === true ? new Date().toISOString() : null;

    // Se registrationId foi passado, atualizar apenas esse registro. Senão, buscar por email.
    let existingReg: any = null;
    if (registrationId) {
      const { data: reg } = await supabaseAdmin
        .from('pending_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();
      existingReg = reg;
    } else {
      const { data: reg } = await supabaseAdmin
        .from('pending_registrations')
        .select('*')
        .eq('email', emailToUse.toLowerCase().trim())
        .in('status', ['pending_payment', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      existingReg = reg;
    }

    let finalRegistrationId: string;

    if (existingReg) {
      // Update existing registration
      const { data: updatedReg, error: updateError } = await supabaseAdmin
        .from('pending_registrations')
        .update({
          phone: cleanPhone,
          full_name: fullNameToUse,
          password_hash: passwordHash,
          asaas_customer_id: customerId,
          plan_id: planData.id,
          status: 'pending_payment',
          asaas_payment_id: null,
          payment_method: null,
          pix_code: null,
          pix_qr_code_url: null,
          boleto_url: null,
          invoice_url: null,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
          ...(termsAcceptedAt && { terms_accepted_at: termsAcceptedAt })
        })
        .eq('id', existingReg.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update pending registration:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar registro pendente' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      finalRegistrationId = updatedReg.id;
      console.log('Updated existing pending registration:', finalRegistrationId);
    } else {
      // Create pending registration
      const { data: regData, error: regError } = await supabaseAdmin
        .from('pending_registrations')
        .insert({
          email: emailToUse.toLowerCase().trim(),
          phone: cleanPhone,
          full_name: fullNameToUse,
          password_hash: passwordHash,
          asaas_customer_id: customerId,
          plan_id: planData.id,
          status: 'pending_payment',
          expires_at: expiresAt.toISOString(),
          ...(termsAcceptedAt && { terms_accepted_at: termsAcceptedAt })
        })
        .select()
        .single();

      if (regError) {
        console.error('Failed to create pending registration:', regError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar registro pendente' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      finalRegistrationId = regData.id;
      console.log('Created new pending registration:', finalRegistrationId);
    }

    console.log('Asaas customer created/found successfully:', {
      customerId,
      registrationId: finalRegistrationId,
      planId: planData.id,
      planPrice: planData.price
    });

    return new Response(
      JSON.stringify({
        success: true,
        customerId: customerId,
        registrationId: finalRegistrationId,
        plan: {
          id: planData.id,
          name: planData.name,
          price: planData.price,
          interval: planData.interval
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in create-asaas-customer function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
