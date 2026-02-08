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
    console.log('Received request body:', { ...body, password: '[HIDDEN]' });
    
    const { email, password, full_name, phone, otp_code, registrationId } = body;

    // Validate required fields
    if (!email || !full_name || !phone) {
      console.error('Missing required fields:', { 
        email: !!email, 
        full_name: !!full_name, 
        phone: !!phone
      });
      return new Response(
        JSON.stringify({ error: 'Email, nome completo e telefone são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cleanPhone = phone.replace(/\D/g, '');
    let userPassword = password;
    let asaasCustomerId = null;

    // ============================================
    // PAYMENT VERIFICATION (if registrationId provided)
    // ============================================
    if (registrationId) {
      console.log('Checking payment status for registration:', registrationId);
      
      const { data: registration, error: regError } = await supabaseAdmin
        .from('pending_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();

      if (regError || !registration) {
        console.error('Registration not found:', regError);
        return new Response(
          JSON.stringify({ error: 'Registro de pagamento não encontrado. Por favor, reinicie o processo de cadastro.' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Verify payment status
      if (registration.status !== 'paid') {
        console.error('Payment not confirmed:', registration.status);
        return new Response(
          JSON.stringify({ 
            error: 'Pagamento ainda não confirmado. Por favor, aguarde a confirmação do pagamento.',
            status: registration.status
          }),
          { 
            status: 402, // Payment Required
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if registration already used
      if (registration.status === 'registered') {
        console.error('Registration already used:', registrationId);
        return new Response(
          JSON.stringify({ error: 'Este registro já foi utilizado. Por favor, faça login.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Use password from registration if not provided
      if (!userPassword && registration.password_hash) {
        try {
          userPassword = atob(registration.password_hash);
        } catch (e) {
          console.error('Failed to decode password:', e);
        }
      }

      asaasCustomerId = registration.asaas_customer_id;
      console.log('Payment verified for registration:', registrationId);
    } else {
      // ============================================
      // LEGACY OTP VERIFICATION (for backwards compatibility)
      // ============================================
      if (!otp_code) {
        return new Response(
          JSON.stringify({ error: 'Código OTP ou registrationId é obrigatório' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const cleanOtpCode = String(otp_code).trim();
      console.log('Looking for OTP:', { phone: cleanPhone, code: cleanOtpCode });
      
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const { data: otpData, error: otpError } = await supabaseAdmin
        .from('otp_codes')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('verified', true)
        .gt('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      const matchingOtp = otpData?.find(otp => String(otp.code).trim() === cleanOtpCode);

      if (otpError || !matchingOtp) {
        console.error('OTP verification failed:', { 
          error: otpError?.message, 
          foundCodes: otpData?.length || 0,
          searchedCode: cleanOtpCode 
        });
        return new Response(
          JSON.stringify({ error: 'Código OTP inválido ou não verificado. Por favor, verifique o código recebido no WhatsApp e tente novamente.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      console.log('Found matching OTP:', matchingOtp.id);
    }

    // Validate password
    if (!userPassword) {
      return new Response(
        JSON.stringify({ error: 'Senha é obrigatória' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if email already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!listError && existingUsers) {
      const emailExists = existingUsers.users.some(u => u.email?.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        console.error('Email already exists:', email);
        return new Response(
          JSON.stringify({ error: 'Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: { full_name }
    });

    if (authError) {
      console.error('Auth error:', authError);
      
      // Tratar erros específicos
      let errorMessage = authError.message;
      if (authError.message.includes('already been registered') || 
          authError.message.includes('User already registered') ||
          authError.message.includes('duplicate key')) {
        errorMessage = 'Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.';
      } else if (authError.message.includes('Password')) {
        errorMessage = 'A senha não atende aos requisitos de segurança. Use pelo menos 8 caracteres com letras e números.';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update the profile with phone number (use clean phone)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ phone: cleanPhone })
      .eq('user_id', authData.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Don't fail the whole operation if profile update fails
    }

    // ============================================
    // CREATE SUBSCRIPTION (if payment was verified)
    // ============================================
    if (registrationId && asaasCustomerId) {
      // Get plan info from registration
      const { data: registration } = await supabaseAdmin
        .from('pending_registrations')
        .select('plan_id')
        .eq('id', registrationId)
        .single();

      // Calculate subscription period (1 month)
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      // Create subscription record
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: authData.user.id,
          asaas_customer_id: asaasCustomerId,
          plan_id: registration?.plan_id,
          status: 'active',
          current_period_start: periodStart.toISOString().split('T')[0],
          current_period_end: periodEnd.toISOString().split('T')[0]
        });

      if (subError) {
        console.error('Failed to create subscription:', subError);
        // Don't fail registration if subscription creation fails
      } else {
        console.log('Subscription created for user:', authData.user.id);
      }

      // Update pending registration status
      await supabaseAdmin
        .from('pending_registrations')
        .update({ 
          status: 'registered',
          updated_at: new Date().toISOString()
        })
        .eq('id', registrationId);
    }

    console.log('User created successfully:', { 
      user_id: authData.user.id, 
      email, 
      phone, 
      full_name,
      hasSubscription: !!registrationId
    });

    return new Response(
      JSON.stringify({ 
        message: 'User created successfully',
        user_id: authData.user.id,
        email: authData.user.email
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in register-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});