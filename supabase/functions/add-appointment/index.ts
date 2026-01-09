import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { phone, title, description, date, time } = await req.json();

    if (!phone || !title || !date) {
      return new Response(
        JSON.stringify({ error: 'Telefone, título e data são obrigatórios' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Creating appointment for phone (updated):', phone);

    // Normalize phone number and try different variations
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Generate phone variations similar to get-user-by-phone function
    const variations = [
      normalizedPhone, // Original: 558788053483
      `+${normalizedPhone}`, // +558788053483
      normalizedPhone.length > 10 ? normalizedPhone.substring(2) : normalizedPhone, // 8788053483
      // Add the missing 9 for mobile numbers
      normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ? 
        `55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}` : null, // 5587988053483
      normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ? 
        `+55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}` : null, // +5587988053483
      normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ? 
        `${normalizedPhone.substring(4)}` : null // 988053483
    ].filter(Boolean);

    console.log('Trying phone variations:', variations);

    let userId = null;
    let userIdError = null;

    // Try each variation
    for (const phoneVariation of variations) {
      console.log(`Trying phone variation: ${phoneVariation}`);
      const { data, error } = await supabaseClient
        .rpc('get_user_id_by_phone', { phone_number: phoneVariation });
      
      if (!error && data) {
        userId = data;
        console.log(`Found user with phone variation: ${phoneVariation}`);
        break;
      }
    }

    if (!userId) {
      userIdError = { message: 'User not found with any phone variation' };
    }

    if (userIdError || !userId) {
      console.error('User not found for phone:', phone, userIdError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado para este telefone' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create appointment
    const { data: appointment, error: appointmentError } = await supabaseClient
      .from('appointments')
      .insert({
        user_id: userId,
        title,
        description: description || null,
        date,
        time: time || null,
        status: 'pending'
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Error creating appointment:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar agendamento' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Appointment created successfully:', appointment);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Agendamento criado com sucesso',
        appointment 
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in add-appointment function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});