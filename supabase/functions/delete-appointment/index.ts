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

    if (req.method !== 'DELETE') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { phone, appointment_id } = await req.json();

    if (!phone || !appointment_id) {
      return new Response(
        JSON.stringify({ error: 'Telefone e ID do agendamento são obrigatórios' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Deleting appointment for phone:', phone, 'appointment ID:', appointment_id);

    // Get user by phone using existing function
    const { data: userId, error: userIdError } = await supabaseClient
      .rpc('get_user_id_by_phone', { phone_number: phone });

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

    // Check if appointment exists and belongs to user
    const { data: appointment, error: appointmentError } = await supabaseClient
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .eq('user_id', userId)
      .single();

    if (appointmentError || !appointment) {
      console.error('Appointment not found or unauthorized:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Agendamento não encontrado ou acesso negado' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Delete appointment
    const { error: deleteError } = await supabaseClient
      .from('appointments')
      .delete()
      .eq('id', appointment_id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting appointment:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir agendamento' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Appointment deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Agendamento excluído com sucesso' 
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in delete-appointment function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});