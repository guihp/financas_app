import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Debug: Starting debug-list-users function')

    // Get all users from auth (with pagination)
    console.log('Fetching auth users...');
    let allAuthUsers = [];
    let page = 1;
    const perPage = 1000; // Maximum allowed by Supabase
    
    while (true) {
      const { data: authUsers, error: authError2 } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: perPage
      });

      if (authError2) {
        console.error('Error fetching auth users:', authError2)
        return new Response(
          JSON.stringify({ error: 'Error fetching users', details: authError2 }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!authUsers?.users || authUsers.users.length === 0) {
        break;
      }

      allAuthUsers.push(...authUsers.users);
      
      // If we got less than perPage, we've reached the end
      if (authUsers.users.length < perPage) {
        break;
      }
      
      page++;
    }

    console.log('Auth users response:', { 
      usersCount: allAuthUsers.length, 
      error: null,
      firstUser: allAuthUsers[0] ? {
        id: allAuthUsers[0].id,
        email: allAuthUsers[0].email,
        created_at: allAuthUsers[0].created_at
      } : null
    });

    console.log('Found auth users:', allAuthUsers.length);

    // Get all profiles
    console.log('Fetching profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return new Response(
        JSON.stringify({ error: 'Error fetching profiles', details: profilesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found profiles:', profiles?.length || 0);

    // Get all user roles
    console.log('Fetching user roles...');
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return new Response(
        JSON.stringify({ error: 'Error fetching roles', details: rolesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found user roles:', userRoles?.length || 0);

    // Combine data
    const users = allAuthUsers.map(authUser => {
      const profile = profiles?.find(p => p.user_id === authUser.id)
      const role = userRoles?.find(r => r.user_id === authUser.id)
      
      return {
        id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || authUser.user_metadata?.full_name,
        phone: profile?.phone,
        role: role?.role || 'user',
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        phone_confirmed_at: authUser.phone_confirmed_at,
        banned_until: authUser.banned_until,
        status: authUser.banned_until ? 'banned' : 'active'
      }
    })

    console.log('Combined users data:', users.length);

    return new Response(
      JSON.stringify({
        success: true,
        users,
        total: users.length,
        debug: {
          authUsersCount: allAuthUsers.length,
          profilesCount: profiles?.length || 0,
          rolesCount: userRoles?.length || 0
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})