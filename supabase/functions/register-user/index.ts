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

    const { email: bodyEmail, password, full_name: bodyFullName, phone: bodyPhone, otp_code, registrationId, planId, terms_accepted } = body;

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let email = bodyEmail;
    let full_name = bodyFullName;
    let cleanPhone = bodyPhone ? String(bodyPhone).replace(/\D/g, '') : '';
    let userPassword = password;
    let asaasCustomerId = null;
    let selectedPlanId = planId;
    let isTrialRegistration = true;
    let registration: any = null;
    let termsAcceptedAt: string | null = null;

    // ============================================
    // PATH: registrationId only (payment confirmed - create user from pending_registrations)
    // ============================================
    if (registrationId) {
      console.log('Creating user from paid registration:', registrationId);

      const { data: reg, error: regError } = await supabaseAdmin
        .from('pending_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();

      if (regError || !reg) {
        console.error('register-user 404: Registration not found', { registrationId, error: regError?.message });
        return new Response(
          JSON.stringify({ error: 'Registro de pagamento não encontrado. Por favor, reinicie o processo de cadastro.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (reg.status !== 'paid' && reg.status !== 'card_registered') {
        console.error('register-user 402: Payment/card not confirmed', { registrationId, status: reg.status });
        return new Response(
          JSON.stringify({ error: 'Pagamento ou cartão ainda não confirmado.', status: reg.status }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (reg.status === 'registered') {
        console.error('register-user 400: Registration already used', { registrationId });
        return new Response(
          JSON.stringify({ error: 'Este registro já foi utilizado. Por favor, faça login.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      registration = reg;
      email = reg.email;
      full_name = reg.full_name;
      cleanPhone = String(reg.phone || '').replace(/\D/g, '');
      selectedPlanId = reg.plan_id;
      asaasCustomerId = reg.asaas_customer_id;
      // card_registered = trial with card saved; paid = immediate payment
      isTrialRegistration = reg.status === 'card_registered';
      if (reg.terms_accepted_at) termsAcceptedAt = reg.terms_accepted_at;

      try {
        if (!reg.password_hash) throw new Error('Password hash missing');
        userPassword = atob(reg.password_hash);
      } catch (e) {
        console.error('register-user 400: Failed to decode password_hash', { registrationId, error: e.message });
        return new Response(
          JSON.stringify({ error: 'Erro de segurança: Senha inválida no cadastro. Entre em contato com o suporte.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Payment verified for registration:', registrationId);
    } else {
      // ============================================
      // PATH: Trial/OTP (legacy - require body fields)
      // ============================================
      if (!bodyEmail || !bodyFullName || !bodyPhone) {
        return new Response(
          JSON.stringify({ error: 'Email, nome completo e telefone são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      email = bodyEmail;
      full_name = bodyFullName;
      cleanPhone = String(bodyPhone).replace(/\D/g, '');
      userPassword = password;
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
      console.error('register-user 400: Password empty', { registrationId: registrationId ?? null, hasPasswordFromReg: !!registration?.password_hash });
      return new Response(
        JSON.stringify({ error: 'Senha é obrigatória' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if email already exists in auth.users
    const sanitizedEmail = email.toLowerCase().trim();
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (!listError && existingUsers) {
      const emailExists = existingUsers.users.some(u => u.email?.toLowerCase().trim() === sanitizedEmail);
      if (emailExists) {
        console.error('register-user 400: Email already exists in auth.users', { email: sanitizedEmail, registrationId: registrationId ?? null });
        return new Response(
          JSON.stringify({ error: 'Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Also check in profiles table (in case email exists there but not in auth yet)
    const { data: existingProfileByEmail, error: emailCheckError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', sanitizedEmail)
      .limit(1)
      .maybeSingle();

    if (!emailCheckError && existingProfileByEmail) {
      console.error('register-user 400: Email already exists in profiles', { email: sanitizedEmail, registrationId: registrationId ?? null });
      return new Response(
        JSON.stringify({ error: 'Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if phone already exists
    const { data: existingProfileByPhone, error: phoneCheckError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('phone', cleanPhone)
      .limit(1)
      .single();

    if (!phoneCheckError && existingProfileByPhone) {
      console.error('register-user 400: Phone already exists', { phone: cleanPhone, registrationId: registrationId ?? null });
      return new Response(
        JSON.stringify({ error: 'Este número de telefone já está cadastrado. Por favor, faça login ou use outro número.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get plan info if not provided
    if (!selectedPlanId) {
      const { data: defaultPlan } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('interval', 'monthly')
        .eq('active', true)
        .single();

      selectedPlanId = defaultPlan?.id;
    }

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) {
      console.error('register-user 400: Auth createUser failed', { email: sanitizedEmail, message: authError.message, registrationId: registrationId ?? null });

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

    // Update the profile with phone number and terms acceptance
    const profileUpdate: any = { phone: cleanPhone };
    if (termsAcceptedAt) {
      profileUpdate.terms_accepted_at = termsAcceptedAt;
    } else if (terms_accepted === true) {
      profileUpdate.terms_accepted_at = new Date().toISOString();
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
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
      // TRIAL: 7 days free (from OTP registration or card_registered)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

      subscriptionData.is_trial = true;
      subscriptionData.trial_ends_at = trialEndsAt.toISOString();
      subscriptionData.current_period_start = now.toISOString().split('T')[0];
      subscriptionData.current_period_end = trialEndsAt.toISOString().split('T')[0];
      // Save Asaas subscription ID if card was registered
      if (registration?.asaas_subscription_id) {
        subscriptionData.asaas_subscription_id = registration.asaas_subscription_id;
      }
      if (asaasCustomerId) {
        subscriptionData.asaas_customer_id = asaasCustomerId;
      }

      console.log('Creating trial subscription:', {
        userId: authData.user.id,
        trialDays: TRIAL_DAYS,
        trialEndsAt: trialEndsAt.toISOString(),
        hasAsaasSubscription: !!registration?.asaas_subscription_id
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

        const emailPromise = fetch(`${supabaseUrl}/functions/v1/send-payment-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emailType: 'welcome_trial',
            to: sanitizedEmail,
            userName: full_name,
            planName: planName,
            trialDays: TRIAL_DAYS,
            trialEndsAt: trialEndsAt.toISOString()
          })
        }).then(res => res.json())
          .then(res => console.log('Welcome email result:', res))
          .catch(err => console.error('Failed to send welcome email:', err));

        // Use waitUntil if available (Edge Runtime) to not block response
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined') {
          // @ts-ignore
          EdgeRuntime.waitUntil(emailPromise);
        } else {
          // Wait if not in Edge Runtime (e.g. local dev)
          await emailPromise;
        }
      } catch (error) {
        console.error('Error sending welcome email:', error);
      }
    }

    console.log('User created successfully:', {
      user_id: authData.user.id,
      email: sanitizedEmail,
      phone: cleanPhone,
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
    const errMsg = error instanceof Error ? error.message : String(error ?? 'Erro interno');
    console.error('register-user 500: Unexpected error', { error: errMsg });
    return new Response(
      JSON.stringify({ error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
