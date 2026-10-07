import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { findUserByEmail, requireRole } from "../_shared/admin-auth.ts";

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

    const auth = await requireRole(req, supabase, ['admin', 'super_admin']);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, enabled } = await req.json();

    // Convert string to boolean if needed
    const enabledBool = typeof enabled === 'string' ? enabled === 'true' : enabled;

    // Validate required fields
    if (!email || typeof enabledBool !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Email and enabled (boolean) are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user by email
    const { user, error: getUserError } = await findUserByEmail(supabase, email);
    
    if (getUserError) {
      console.error('Error fetching users:', getUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Admin comum nao pode banir/excluir super_admin nem a propria conta
    const { data: targetRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const targetIsSuper = (targetRoles ?? []).some((r) => r.role === 'super_admin');
    if (user.id === auth.user.id || (targetIsSuper && !auth.roles.includes('super_admin'))) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user status
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { 
        email_confirm: enabledBool,
        phone_confirm: enabledBool,
        banned_until: enabledBool ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() // Ban for 100 years if disabled
      }
    );

    if (error) {
      console.error('Error updating user:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update user status' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `User ${enabledBool ? 'enabled' : 'disabled'} successfully`,
        user: {
          id: data.user.id,
          email: data.user.email,
          enabled: enabledBool
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('General error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});