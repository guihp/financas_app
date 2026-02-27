import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate random 6-digit OTP code
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, email, full_name, pais } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
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

    // Generate OTP code
    const code = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiration

    // Clean phone number (remove formatting)
    const cleanPhone = phone.replace(/\D/g, '');

    // Delete any existing unverified OTP codes for this phone
    await supabaseAdmin
      .from('otp_codes')
      .delete()
      .eq('phone', cleanPhone)
      .eq('verified', false);

    // Insert new OTP code
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .insert({
        phone: cleanPhone,
        code: code,
        email: email || null,
        expires_at: expiresAt.toISOString(),
        verified: false
      })
      .select()
      .single();

    if (otpError) {
      console.error('Error creating OTP:', otpError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP code' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Send OTP via webhook to WhatsApp
    // Get webhook base URL from environment variable, default to empty if not set
    const webhookBaseUrl = Deno.env.get('WEBHOOK_BASE_URL') || '';
    const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/webhook/CODIGO-OTP` : null;
    
    if (!webhookUrl) {
      console.warn('WEBHOOK_BASE_URL not configured, skipping webhook call');
    } else {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            codigo_usuario: cleanPhone,
            email: email || null,
            nome: full_name || null,
            codigo_verificacao: code,
            pais: pais || null // Brasil, EUA, Portugal, Irlanda, Espanha
          })
        });

        if (!webhookResponse.ok) {
          console.error('Webhook error:', await webhookResponse.text());
        }
      } catch (webhookError) {
        console.error('Error calling webhook:', webhookError);
        // Don't fail the request if webhook fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTP code sent to WhatsApp',
        expires_at: expiresAt.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in generate-otp function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
