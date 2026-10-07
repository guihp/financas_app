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
    const { phone, code } = await req.json();

    if (!phone || !code) {
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

    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanCode = String(code).trim();

    // Verificacao atomica no banco (lock por telefone + limite de tentativas)
    const { data: result, error: verifyError } = await supabaseAdmin.rpc('verify_otp_code', {
      p_phone: cleanPhone,
      p_code: cleanCode,
    });

    if (verifyError) {
      console.error('Error verifying OTP:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar código.' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (result !== 'ok') {
      const errors: Record<string, { status: number; message: string }> = {
        locked: { status: 429, message: 'Muitas tentativas incorretas. Aguarde e solicite um novo código.' },
        expired: { status: 400, message: 'Código inválido ou expirado. Por favor, solicite um novo código.' },
        invalid: { status: 400, message: 'Código inválido. Verifique o código recebido no WhatsApp.' },
      };
      const { status, message } = errors[result] ?? errors.invalid;
      console.warn('OTP verification failed:', result);
      return new Response(
        JSON.stringify({ error: message }),
        { 
          status, 
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
