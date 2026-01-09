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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user is a super admin or admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('Current user role:', userRole)

    if (roleError) {
      console.error('Error checking user role:', roleError)
      return new Response(
        JSON.stringify({ error: 'Error checking permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userRole || (userRole.role !== 'super_admin' && userRole.role !== 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Access denied - Admin or Super admin required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { user_id, new_role } = await req.json()

    if (!user_id || !new_role) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id or new_role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['user', 'admin', 'super_admin']
    if (!validRoles.includes(new_role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Updating user ${user_id} role to ${new_role}`)

    // Check if user role record exists
    const { data: existingRole, error: queryError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle()

    console.log('Existing role query result:', { existingRole, queryError })

    if (queryError) {
      console.error('Error querying user roles:', queryError)
      return new Response(
        JSON.stringify({ error: 'Failed to query user roles: ' + queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingRole) {
      // Update existing role
      console.log('Updating existing role for user:', user_id)
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ role: new_role, updated_at: new Date().toISOString() })
        .eq('user_id', user_id)

      if (updateError) {
        console.error('Error updating user role:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update user role: ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('Successfully updated user role')
    } else {
      // Insert new role record
      console.log('Inserting new role record for user:', user_id)
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id, role: new_role })

      if (insertError) {
        console.error('Error inserting user role:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to insert user role: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('Successfully inserted new user role')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User role updated to ${new_role}`,
        user_id,
        new_role 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})