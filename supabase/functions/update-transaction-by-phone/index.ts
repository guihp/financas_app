import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeCategorySlug } from '../_shared/categories.ts'
import { isUserSubscriptionInactive, SUBSCRIPTION_BLOCK_MESSAGE, SUBSCRIPTION_INACTIVE_CODE } from "../_shared/subscription.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeDateInputToYyyyMmDd(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s)
  if (br) {
    const day = parseInt(br[1], 10)
    const month = parseInt(br[2], 10)
    const year = parseInt(br[3], 10)
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
    const dt = new Date(year, month - 1, day)
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Only allow PUT method
    if (req.method !== 'PUT') {
      console.log(`Method ${req.method} not allowed`)
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const body = await req.json()
    console.log('Update transaction request body:', body)

    const { phone, transaction_id, type, amount, description, category, date } = body

    // Validate required fields
    if (!phone || !transaction_id) {
      console.log('Missing required fields: phone or transaction_id')
      return new Response(
        JSON.stringify({ error: 'Phone and transaction_id are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user ID by phone with variations
    console.log('Getting user ID by phone:', phone)
    
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

    if (userError || !userId) {
      console.log('Error getting user ID:', userError)
      return new Response(
        JSON.stringify({ error: 'User not found with this phone number' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User ID found:', userId)

    if (await isUserSubscriptionInactive(supabase, userId)) {
      return new Response(
        JSON.stringify({ error: SUBSCRIPTION_INACTIVE_CODE, message: SUBSCRIPTION_BLOCK_MESSAGE }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update data - only include fields that are provided
    const updateData: any = {}
    if (type !== undefined) updateData.type = type
    if (amount !== undefined) updateData.amount = amount
    if (description !== undefined) updateData.description = description
    if (category !== undefined) {
      updateData.category = normalizeCategorySlug(String(category))
    }
    if (date !== undefined) {
      const normalized = normalizeDateInputToYyyyMmDd(String(date))
      if (!normalized) {
        return new Response(
          JSON.stringify({
            error: 'Invalid date. Use YYYY-MM-DD or DD/MM/YYYY (Brasil).',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      updateData.date = normalized
      updateData.transaction_date = normalized
    }
    updateData.updated_at = new Date().toISOString()

    // Update the transaction
    console.log('Updating transaction with ID:', transaction_id, 'for user:', userId)
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transaction_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.log('Error updating transaction:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update transaction: ' + updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!transaction) {
      console.log('Transaction not found or not owned by user')
      return new Response(
        JSON.stringify({ error: 'Transaction not found or you do not have permission to update it' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Transaction updated successfully:', transaction)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transaction updated successfully',
        transaction: transaction
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})