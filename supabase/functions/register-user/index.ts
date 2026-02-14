import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Trial period configuration
const TRIAL_DAYS = 7;
const DEFAULT_PLAN_NAME = 'Plano Mensal';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Received request body:', { ...body, password: '[HIDDEN]' });
    
    const { email, password, full_name, phone, otp_code, registrationId, planId } = body;

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
    let selectedPlanId = planId;
    let isTrialRegistration = true; // Default to trial

    // ============================================
    // PAYMENT VERIFICATION (if registrationId provided - legacy flow)
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
      selectedPlanId = registration.plan_id;
      isTrialRegistration = false; // Paid registration
      console.log('Payment verified for registration:', registrationId);
    } else {
      // ============================================
      // TRIAL REGISTRATION (7 days free)
      // ============================================
      if (!otp_code) {
        return new Response(
          JSON.stringify({ error: 'Código OTP é obrigatório' }),
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

    // Get plan info if not provided
    if (!selectedPlanId) {
      const { data: defaultPlan } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('interval', 'monthly')
        .eq('is_active', true)
        .single();
      
      selectedPlanId = defaultPlan?.id;
    }

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) {
      console.error('Auth error:', authError);
      
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

    // Update the profile with phone number
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ phone: cleanPhone })
      .eq('user_id', authData.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    // ============================================
    // CREATE SUBSCRIPTION
    // ============================================
    const now = new Date();
    let subscriptionData: any = {
      user_id: authData.user.id,
      plan_id: selectedPlanId,
      status: 'active'
    };

    if (isTrialRegistration) {
      // TRIAL: 7 days free
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
      
      subscriptionData.is_trial = true;
      subscriptionData.trial_ends_at = trialEndsAt.toISOString();
      subscriptionData.current_period_start = now.toISOString().split('T')[0];
      subscriptionData.current_period_end = trialEndsAt.toISOString().split('T')[0];
      
      console.log('Creating trial subscription:', { 
        userId: authData.user.id,
        trialDays: TRIAL_DAYS,
        trialEndsAt: trialEndsAt.toISOString()
      });
    } else {
      // PAID: 1 month subscription
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      
      subscriptionData.is_trial = false;
      subscriptionData.asaas_customer_id = asaasCustomerId;
      subscriptionData.current_period_start = now.toISOString().split('T')[0];
      subscriptionData.current_period_end = periodEnd.toISOString().split('T')[0];
    }

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert(subscriptionData);

    if (subError) {
      console.error('Failed to create subscription:', subError);
    } else {
      console.log('Subscription created for user:', authData.user.id);
    }

    // ============================================
    // UPDATE PENDING REGISTRATION (if applicable)
    // ============================================
    if (registrationId) {
      await supabaseAdmin
        .from('pending_registrations')
        .update({ 
          status: 'registered',
          updated_at: new Date().toISOString()
        })
        .eq('id', registrationId);
    }

    // ============================================
    // SEND WELCOME EMAIL (for trial registrations)
    // ============================================
    if (isTrialRegistration) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        
        // Get plan name
        let planName = DEFAULT_PLAN_NAME;
        if (selectedPlanId) {
          const { data: plan } = await supabaseAdmin
            .from('plans')
            .select('name')
            .eq('id', selectedPlanId)
            .single();
          if (plan) planName = plan.name;
        }
        
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
        
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-payment-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emailType: 'welcome_trial',
            to: email,
            userName: full_name,
            planName: planName,
            trialDays: TRIAL_DAYS,
            trialEndsAt: trialEndsAt.toISOString()
          })
        });
        
        const emailResult = await emailResponse.json();
        console.log('Welcome email result:', emailResult);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail registration if email fails
      }
    }

    console.log('User created successfully:', { 
      user_id: authData.user.id, 
      email, 
      phone, 
      full_name,
      isTrial: isTrialRegistration,
      trialDays: isTrialRegistration ? TRIAL_DAYS : 0
    });

    return new Response(
      JSON.stringify({ 
        message: 'User created successfully',
        user_id: authData.user.id,
        email: authData.user.email,
        isTrial: isTrialRegistration,
        trialDays: isTrialRegistration ? TRIAL_DAYS : 0
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
