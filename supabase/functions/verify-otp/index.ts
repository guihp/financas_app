import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Received request body:', body);
    
    const { phone, code } = body;

    if (!phone || !code) {
      console.error('Missing required fields:', { phone: !!phone, code: !!code });
      return new Response(
        JSON.stringify({ error: 'Phone and code are required' }),
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

    // Clean phone number - remove all non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    // Convert code to string for consistent comparison
    const cleanCode = String(code).trim();

    console.log('Cleaned phone:', cleanPhone, 'Cleaned code:', cleanCode);

    // First, check if there are any OTP codes for this phone
    const { data: allOtpCodes, error: checkError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('phone', cleanPhone)
      .order('created_at', { ascending: false });

    console.log('All OTP codes for phone:', allOtpCodes?.length || 0, checkError ? checkError.message : 'OK');

    // Find valid OTP code - try with string comparison first
    let { data: otpData, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10); // Get multiple to check manually

    if (otpError) {
      console.error('Error querying OTP codes:', otpError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar código OTP: ' + otpError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!otpData || otpData.length === 0) {
      console.error('No valid OTP codes found for phone:', cleanPhone);
      return new Response(
        JSON.stringify({ error: 'Código inválido ou expirado. Por favor, solicite um novo código.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Find matching code (handle both string and number comparison)
    const matchingOtp = otpData.find(otp => {
      const otpCodeStr = String(otp.code).trim();
      const otpCodeNum = Number(otp.code);
      const inputCodeStr = cleanCode;
      const inputCodeNum = Number(cleanCode);
      
      return otpCodeStr === inputCodeStr || 
             otpCodeNum === inputCodeNum ||
             otpCodeStr === inputCodeNum.toString() ||
             otpCodeNum.toString() === inputCodeStr;
    });

    if (!matchingOtp) {
      console.error('Code mismatch. Received:', cleanCode, 'Available codes:', otpData.map(o => o.code));
      return new Response(
        JSON.stringify({ error: 'Código inválido. Verifique o código recebido no WhatsApp.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found matching OTP:', matchingOtp.id);

    // Mark OTP as verified
    const { error: updateError } = await supabaseAdmin
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', matchingOtp.id);

    if (updateError) {
      console.error('Error updating OTP:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar código: ' + updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('OTP verified successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTP verified successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in verify-otp function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
