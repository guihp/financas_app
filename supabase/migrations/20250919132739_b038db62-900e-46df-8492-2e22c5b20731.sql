-- Create table to track sent notifications
CREATE TABLE public.appointment_notifications_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('1_hour_before', '15_minutes_before', 'now')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  webhook_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_notifications_sent ENABLE ROW LEVEL SECURITY;

-- Create policy for system access (no user-level restrictions needed for this system table)
CREATE POLICY "Service role can manage notifications" 
ON public.appointment_notifications_sent 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_appointment_notifications_appointment_id ON public.appointment_notifications_sent(appointment_id);
CREATE INDEX idx_appointment_notifications_type ON public.appointment_notifications_sent(notification_type);