import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone, type, amount, description, category, date } = await req.json();

    // Validar dados obrigatórios
    if (!phone || !type || !amount || !description || !category) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: phone, type, amount, description, category' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validar tipo de transação
    if (type !== 'income' && type !== 'expense') {
      return new Response(
        JSON.stringify({ 
          error: 'Tipo deve ser "income" ou "expense"' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Buscando usuário pelo telefone: ${phone}`);

    // Normalize phone number and try different variations
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Generate phone variations
    const variations = [
      normalizedPhone, // Original
      `+${normalizedPhone}`, 
      normalizedPhone.length > 10 ? normalizedPhone.substring(2) : normalizedPhone,
      // Add the missing 9 for mobile numbers
      normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ? 
        `55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}` : null,
      normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ? 
        `+55${normalizedPhone.substring(2, 4)}9${normalizedPhone.substring(4)}` : null,
      normalizedPhone.length === 12 && normalizedPhone.startsWith('55') ? 
        `${normalizedPhone.substring(4)}` : null
    ].filter(Boolean);

    console.log('Trying phone variations:', variations);

    let userData = null;
    let userError = null;

    // Try each variation
    for (const phoneVariation of variations) {
      console.log(`Trying phone variation: ${phoneVariation}`);
      const { data, error } = await supabase
        .rpc('get_user_id_by_phone', { phone_number: phoneVariation });
      
      if (!error && data) {
        userData = data;
        console.log(`Found user with phone variation: ${phoneVariation}`);
        break;
      }
    }

    if (!userData) {
      userError = { message: 'User not found with any phone variation' };
    }

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro interno do servidor',
          details: userError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!userData) {
      console.log(`Usuário não encontrado para o telefone: ${phone}`);
      return new Response(
        JSON.stringify({ 
          error: 'Usuário não encontrado com esse número de telefone',
          phone: phone 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Usuário encontrado: ${userData}`);

    // Inserir transação
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .insert([{
        type: type,
        amount: parseFloat(amount),
        description: description,
        category: category,
        date: date || new Date().toISOString().split('T')[0],
        user_id: userData,
      }])
      .select()
      .single();

    if (transactionError) {
      console.error('Erro ao inserir transação:', transactionError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar transação',
          details: transactionError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Transação criada com sucesso:', transactionData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction: transactionData,
        message: `${type === 'income' ? 'Receita' : 'Despesa'} adicionada com sucesso!`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});