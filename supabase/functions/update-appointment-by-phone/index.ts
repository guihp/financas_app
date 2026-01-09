import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    console.log('Update appointment request body:', body)

    const { phone, appointment_id, title, description, date, time, status } = body

    // Validate required fields
    if (!phone || !appointment_id) {
      console.log('Missing required fields: phone or appointment_id')
      return new Response(
        JSON.stringify({ error: 'Phone and appointment_id are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user ID by phone
    console.log('Getting user ID by phone:', phone)
    const { data: userId, error: userError } = await supabase
      .rpc('get_user_id_by_phone', { phone_number: phone })

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

    // Prepare update data - only include fields that are provided
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (date !== undefined) updateData.date = date
    if (time !== undefined) updateData.time = time
    if (status !== undefined) updateData.status = status
    updateData.updated_at = new Date().toISOString()

    // Update the appointment
    console.log('Updating appointment with ID:', appointment_id, 'for user:', userId)
    const { data: appointment, error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointment_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.log('Error updating appointment:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update appointment: ' + updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!appointment) {
      console.log('Appointment not found or not owned by user')
      return new Response(
        JSON.stringify({ error: 'Appointment not found or you do not have permission to update it' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Appointment updated successfully:', appointment)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Appointment updated successfully',
        appointment: appointment
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