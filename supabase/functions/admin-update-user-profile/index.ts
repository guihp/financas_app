import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header')
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      console.error('Error verifying user:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid token or user not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user is a super admin by querying user_roles directly
    console.log('Checking super admin status for user:', user.id)
    const { data: userRoles, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    console.log('Super admin check result:', { hasRole: !!userRoles, hasError: !!roleError })

    if (roleError) {
      console.error('Error checking super admin status:', roleError)
      return new Response(
        JSON.stringify({ error: 'Error checking permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userRoles) {
      console.error('User is not super admin')
      return new Response(
        JSON.stringify({ error: 'Forbidden - Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { user_id, full_name, phone, email } = await req.json()
    console.log('Request to update user profile:', { user_id, full_name, phone, email })

    if (!user_id || !full_name || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, full_name, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the user's email in auth.users
    const { error: updateAuthError } = await supabaseClient.auth.admin.updateUserById(
      user_id,
      { email: email }
    )

    if (updateAuthError) {
      console.error('Error updating user email:', updateAuthError)
      return new Response(
        JSON.stringify({ error: 'Failed to update user email: ' + updateAuthError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User email updated successfully')

    // Update the profile information
    const { error: updateProfileError } = await supabaseClient
      .from('profiles')
      .update({
        full_name: full_name,
        phone: phone,
        email: email,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)

    if (updateProfileError) {
      console.error('Error updating user profile:', updateProfileError)
      return new Response(
        JSON.stringify({ error: 'Failed to update user profile: ' + updateProfileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User profile updated successfully')

    return new Response(
      JSON.stringify({ 
        message: 'User profile updated successfully',
        user_id: user_id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})