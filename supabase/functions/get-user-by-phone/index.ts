import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Only allow GET method
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get phone parameter from URL
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Searching for user with phone: ${phone}`)

    // Normalize phone number - remove + and any non-digits, then add +55 if needed
    let normalizedPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }
    
    const phoneVariations = [
      normalizedPhone,
      '+' + normalizedPhone,
      normalizedPhone.substring(2), // Remove country code
    ];

    // For Brazilian mobile numbers, also try with/without the 9th digit
    if (normalizedPhone.startsWith('55') && normalizedPhone.length >= 12) {
      const areaCode = normalizedPhone.substring(2, 4);
      const number = normalizedPhone.substring(4);
      
      // If number has 9 digits, try without the first 9
      if (number.length === 9 && number.startsWith('9')) {
        const without9 = '55' + areaCode + number.substring(1);
        phoneVariations.push(without9);
        phoneVariations.push('+' + without9);
        phoneVariations.push(areaCode + number.substring(1));
      }
      
      // If number has 8 digits, try with 9 prefix
      if (number.length === 8) {
        const with9 = '55' + areaCode + '9' + number;
        phoneVariations.push(with9);
        phoneVariations.push('+' + with9);
        phoneVariations.push(areaCode + '9' + number);
      }
    }

    console.log(`Searching for phone variations: ${phoneVariations.join(', ')}`)

    // Try to find user with any phone variation
    let userId = null;
    for (const phoneVar of phoneVariations) {
      const { data, error } = await supabase
        .rpc('get_user_id_by_phone', { phone_number: phoneVar });
      
      if (!error && data) {
        userId = data;
        console.log(`Found user with phone variation: ${phoneVar}`);
        break;
      }
    }


    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'User not found with this phone number',
          phone: phone,
          active: false
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone, created_at, updated_at')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Error fetching user profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user exists in auth.users (to verify if account is active)
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)

    if (authError) {
      console.error('Error checking auth user:', authError)
      return new Response(
        JSON.stringify({ 
          user: profile,
          active: false,
          status: 'inactive',
          reason: 'User not found in authentication system'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const isActive = authUser?.user && !authUser.user.banned_until

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          created_at: profile.created_at,
          updated_at: profile.updated_at
        },
        active: isActive,
        status: isActive ? 'active' : 'inactive',
        auth_status: authUser?.user ? {
          email_confirmed: authUser.user.email_confirmed_at ? true : false,
          phone_confirmed: authUser.user.phone_confirmed_at ? true : false,
          last_sign_in: authUser.user.last_sign_in_at,
          banned_until: authUser.user.banned_until
        } : null
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