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
    console.log('Getting pending payment for:', body.email);
    
    const { email } = body;

    // Validate required fields
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email é obrigatório' }),
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

    // Get pending registration for this email
    const { data: registration, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*, plans(*)')
      .eq('email', email.toLowerCase().trim())
      .in('status', ['pending_payment', 'paid', 'registered'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (regError || !registration) {
      console.log('No pending registration found for:', email);
      return new Response(
        JSON.stringify({ 
          found: false,
          message: 'Nenhum pagamento pendente encontrado para este email.'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if expired
    const expiresAt = new Date(registration.expires_at);
    const now = new Date();
    const isExpired = expiresAt < now && registration.status === 'pending_payment';

    if (isExpired) {
      // Update status to expired
      await supabaseAdmin
        .from('pending_registrations')
        .update({ status: 'expired' })
        .eq('id', registration.id);

      return new Response(
        JSON.stringify({ 
          found: true,
          expired: true,
          message: 'Este pagamento expirou. Por favor, inicie um novo cadastro.'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If already paid, inform the user (include registrationId so frontend can call check-payment-status to ensure user account exists)
    if (registration.status === 'paid' || registration.status === 'registered') {
      return new Response(
        JSON.stringify({ 
          found: true,
          paid: true,
          registration: { id: registration.id },
          message: 'Seu pagamento já foi confirmado! Você pode fazer login na sua conta.'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return pending payment info
    const plan = registration.plans;
    
    console.log('Found pending payment:', {
      registrationId: registration.id,
      status: registration.status,
      paymentMethod: registration.payment_method
    });

    return new Response(
      JSON.stringify({ 
        found: true,
        expired: false,
        paid: false,
        registration: {
          id: registration.id,
          customerId: registration.asaas_customer_id,
          email: registration.email,
          fullName: registration.full_name,
          phone: registration.phone,
          status: registration.status,
          paymentMethod: registration.payment_method,
          pixCode: registration.pix_code,
          pixQrCodeUrl: registration.pix_qr_code_url,
          boletoUrl: registration.boleto_url,
          invoiceUrl: registration.invoice_url,
          expiresAt: registration.expires_at,
          createdAt: registration.created_at,
          address: (registration.address_postal_code || registration.address_street) ? {
            postalCode: registration.address_postal_code,
            street: registration.address_street,
            number: registration.address_number,
            complement: registration.address_complement,
            neighborhood: registration.address_neighborhood,
            city: registration.address_city,
            state: registration.address_state
          } : null
        },
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          interval: plan.interval
        } : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-pending-payment function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
