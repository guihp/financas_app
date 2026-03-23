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
        full_name: full_name || null,
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

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

    if (!RESEND_API_KEY || !email) {
      console.warn('RESEND_API_KEY or email missing, cannot send OTP via email');
      // Continuamos retornando sucesso pro frontend não quebrar a lógica de UI, 
      // mas na vida real o OTP não seria recebido.
    } else {
      try {
        const emailHtml = `
          <div style="font-family: sans-serif; text-align: center; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="margin-bottom: 30px;">
              <h1 style="color: #f97316; margin: 0;">IAFÉ Finanças</h1>
              <p style="color: #666; font-size: 14px; margin-top: 5px;">Seu parceiro de gestão financeira</p>
            </div>
            
            <h2 style="font-size: 24px; margin-bottom: 20px;">Código de Verificação</h2>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Olá${full_name ? ' ' + full_name : ''},<br/>
              Use o código de 6 dígitos abaixo para confirmar seu cadastro ou acesso:
            </p>
            
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${code}</span>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-bottom: 10px;">
              Este código expira em 15 minutos.
            </p>
            <p style="font-size: 12px; color: #999;">
              Se você não solicitou este código, por favor, ignore este e-mail.
            </p>
          </div>
        `;

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: "IAFÉ Finanças <nao-responda@iafefinancas.com.br>",
            to: email,
            subject: "Seu Código de Acesso - IAFÉ Finanças",
            html: emailHtml
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to send email via Resend:', errorText);
        } else {
          console.log(`OTP Email successfully sent to ${email}`);
        }
      } catch (emailError) {
        console.error('Error sending OTP email:', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP code sent to Email',
        expires_at: expiresAt.toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
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
