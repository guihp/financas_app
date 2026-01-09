import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // This function is triggered by a webhook when a user signs up
    const { record } = await req.json()
    
    console.log('New user registered:', record.email)

    // Check if this is the super admin email
    if (record.email === 'brunofacosta@hotmail.com') {
      console.log('Assigning super admin role to:', record.email)
      
      // Assign super admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: record.id,
          role: 'super_admin'
        })

      if (roleError) {
        console.error('Error assigning super admin role:', roleError)
      } else {
        console.log('Super admin role assigned successfully')
      }
    } else {
      // Assign default user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: record.id,
          role: 'user'
        })

      if (roleError) {
        console.error('Error assigning user role:', roleError)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in auto-assign-super-admin:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})