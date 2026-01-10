import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Disparando webhook de teste...');

    // Prepare webhook payload de exemplo
    const webhookPayload = {
      notification_type: '1_hour_15_minutes_before',
      appointment: {
        id: 'test-appointment-123',
        title: 'Consulta de Teste',
        description: 'Esta é uma consulta de teste para testar o webhook',
        date: '2025-09-21',
        time: '14:30',
        user_phone: '11999999999',
        user_name: 'João da Silva'
      },
      scheduled_datetime: new Date(Date.now() + 75 * 60 * 1000).toISOString(), // 1h15min no futuro
      notification_time: new Date().toISOString()
    };

    console.log('Payload do webhook:', JSON.stringify(webhookPayload, null, 2));

    // Get webhook base URL from environment variable
    const webhookBaseUrl = Deno.env.get('WEBHOOK_BASE_URL') || '';
    const webhookUrl = webhookBaseUrl ? `${webhookBaseUrl}/webhook/registra_ai_lembrete` : null;
    
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'WEBHOOK_BASE_URL not configured. Please set this environment variable in Supabase Dashboard.'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Send webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await webhookResponse.text();
    console.log('Resposta do webhook:', webhookResponse.status, responseText);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook de teste disparado com sucesso',
        webhook_status: webhookResponse.status,
        webhook_response: responseText,
        payload: webhookPayload
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro ao disparar webhook de teste:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});