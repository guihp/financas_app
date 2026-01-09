import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Only allow GET requests
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get phone and optional filters from query parameters
    const url = new URL(req.url);
    const phone = url.searchParams.get('phone');
    const type = url.searchParams.get('type'); // 'income' or 'expense'
    const category = url.searchParams.get('category');
    const limit = url.searchParams.get('limit');

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Getting transactions for phone:', phone);

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

    let userId = null;
    let userError = null;

    // Try each variation
    for (const phoneVariation of variations) {
      console.log(`Trying phone variation: ${phoneVariation}`);
      const { data, error } = await supabase
        .rpc('get_user_id_by_phone', { phone_number: phoneVariation });
      
      if (!error && data) {
        userId = data;
        console.log(`Found user with phone variation: ${phoneVariation}`);
        break;
      }
    }

    if (!userId) {
      userError = { message: 'User not found with any phone variation' };
    }

    if (userError) {
      console.error('Error getting user by phone:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to find user' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User not found with this phone number' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build query with filters
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId);

    // Apply optional filters
    if (type && (type === 'income' || type === 'expense')) {
      query = query.eq('type', type);
    }

    if (category) {
      query = query.eq('category', category);
    }

    // Apply limit if specified
    if (limit && !isNaN(parseInt(limit))) {
      query = query.limit(parseInt(limit));
    }

    // Order by date (most recent first)
    query = query.order('date', { ascending: false })
                 .order('created_at', { ascending: false });

    const { data: transactions, error: transactionsError } = await query;

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate totals
    const totalIncome = transactions?.filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    
    const totalExpense = transactions?.filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

    const balance = totalIncome - totalExpense;

    console.log(`Found ${transactions?.length || 0} transactions for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        transactions: transactions || [],
        summary: {
          total: transactions?.length || 0,
          totalIncome,
          totalExpense,
          balance
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in get-transactions function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});