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
    
    const { email, password, full_name, phone, otp_code } = body;

    // Validate required fields
    if (!email || !password || !full_name || !phone || !otp_code) {
      console.error('Missing required fields:', { 
        email: !!email, 
        password: !!password, 
        full_name: !!full_name, 
        phone: !!phone, 
        otp_code: !!otp_code 
      });
      return new Response(
        JSON.stringify({ error: 'Email, password, full_name, phone and otp_code are required' }),
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

    // Verify OTP code - check if it was verified (we don't re-check expiration since verify-otp already did that)
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanOtpCode = String(otp_code).trim();
    
    console.log('Looking for OTP:', { phone: cleanPhone, code: cleanOtpCode });
    
    // First, find any verified OTP for this phone (within the last hour for safety)
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

    console.log('OTP query result:', { 
      found: otpData?.length || 0, 
      error: otpError?.message || null,
      codes: otpData?.map(o => ({ id: o.id, code: o.code, verified: o.verified })) || []
    });

    // Find matching code
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

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
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

    console.log('User created successfully:', { 
      user_id: authData.user.id, 
      email, 
      phone, 
      full_name 
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