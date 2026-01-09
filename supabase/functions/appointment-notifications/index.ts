import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running appointment notifications check...');

    // Get current datetime in Brazil timezone (UTC-3)
    const now = new Date();
    const brazilOffset = -3 * 60 * 60 * 1000; // -3 hours in milliseconds
    const brazilNow = new Date(now.getTime() + brazilOffset);
    
    console.log('Current Brazil time:', brazilNow.toISOString());

    // Fetch all pending appointments
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        title,
        description,
        date,
        time,
        user_id
      `)
      .eq('status', 'pending');

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    console.log(`Found ${appointments?.length || 0} pending appointments`);

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending appointments found' }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const notificationsToSend = [];

    for (const appointment of appointments) {
      // Get user profile for phone number
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('user_id', appointment.user_id)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`No phone found for appointment ${appointment.id}`);
        continue;
      }

      // Create appointment datetime
      const appointmentDate = new Date(`${appointment.date}T${appointment.time || '00:00:00'}`);
      
      // Calculate notification times (considering Brazil timezone)
      const oneHourFifteenBefore = new Date(appointmentDate.getTime() - (75 * 60 * 1000)); // 1h15min = 75 minutes
      const oneHourBefore = new Date(appointmentDate.getTime() - (60 * 60 * 1000));
      const fifteenMinsBefore = new Date(appointmentDate.getTime() - (15 * 60 * 1000));
      const appointmentTime = appointmentDate;

      console.log(`Appointment ${appointment.id} scheduled for:`, appointmentDate.toISOString());
      console.log('1h15min before:', oneHourFifteenBefore.toISOString());
      console.log('1h before:', oneHourBefore.toISOString());
      console.log('15min before:', fifteenMinsBefore.toISOString());
      console.log('Appointment time:', appointmentTime.toISOString());

      // Check which notifications need to be sent (within 5-minute window)
      const fiveMinutes = 5 * 60 * 1000;
      const currentTime = brazilNow.getTime();

      // Check for 1 hour 15 minutes before notification
      if (Math.abs(currentTime - oneHourFifteenBefore.getTime()) <= fiveMinutes) {
        await checkAndSendNotification(supabase, appointment, profile, 'one_hour_fifteen_before', appointmentDate);
      }

      // Check for 1 hour before notification
      if (Math.abs(currentTime - oneHourBefore.getTime()) <= fiveMinutes) {
        await checkAndSendNotification(supabase, appointment, profile, 'one_hour_before', appointmentDate);
      }

      // Check for 15 minutes before notification
      if (Math.abs(currentTime - fifteenMinsBefore.getTime()) <= fiveMinutes) {
        await checkAndSendNotification(supabase, appointment, profile, 'fifteen_minutes_before', appointmentDate);
      }

      // Check for "now" notification
      if (Math.abs(currentTime - appointmentTime.getTime()) <= fiveMinutes) {
        await checkAndSendNotification(supabase, appointment, profile, 'now', appointmentDate);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Appointment notifications processed successfully',
        processed_appointments: appointments.length
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in appointment notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function checkAndSendNotification(
  supabase: any,
  appointment: any,
  profile: any,
  notificationType: string,
  appointmentDate: Date
) {
  // Map notification types to database values
  const dbNotificationType = notificationType === 'one_hour_fifteen_before' ? '1_hour_15_minutes_before' :
                             notificationType === 'one_hour_before' ? '1_hour_before' : 
                             notificationType === 'fifteen_minutes_before' ? '15_minutes_before' : 'now';

  // Check if notification already sent
  const { data: existingNotification } = await supabase
    .from('appointment_notifications_sent')
    .select('id')
    .eq('appointment_id', appointment.id)
    .eq('notification_type', dbNotificationType)
    .single();

  if (existingNotification) {
    console.log(`Notification ${dbNotificationType} already sent for appointment ${appointment.id}`);
    return;
  }

  // Prepare webhook payload
  const webhookPayload = {
    notification_type: dbNotificationType,
    appointment: {
      id: appointment.id,
      title: appointment.title,
      description: appointment.description,
      date: appointment.date,
      time: appointment.time,
      user_phone: profile.phone,
      user_name: profile.full_name
    },
    scheduled_datetime: appointmentDate.toISOString(),
    notification_time: new Date().toISOString()
  };

  console.log(`Sending ${dbNotificationType} notification for appointment ${appointment.id}`);
  console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));

  try {
    // Send webhook
    const webhookResponse = await fetch('https://webhook.auto.visionmarck.com.br/webhook/registra_ai_lembrete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await webhookResponse.text();
    console.log('Webhook response:', webhookResponse.status, responseText);

    // Record notification as sent
    const { error: insertError } = await supabase
      .from('appointment_notifications_sent')
      .insert({
        appointment_id: appointment.id,
        notification_type: dbNotificationType,
        webhook_response: responseText
      });

    if (insertError) {
      console.error('Error recording notification:', insertError);
    } else {
      console.log(`Notification ${dbNotificationType} sent and recorded for appointment ${appointment.id}`);
    }

  } catch (webhookError) {
    console.error('Error sending webhook:', webhookError);
    
    // Still record the attempt
    await supabase
      .from('appointment_notifications_sent')
      .insert({
        appointment_id: appointment.id,
        notification_type: dbNotificationType,
        webhook_response: `Error: ${webhookError.message}`
      });
  }
}