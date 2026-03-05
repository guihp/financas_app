-- Update pending_registrations status check constraint to allow 'card_registered'
-- This fixes the issue where credit card trials could not be registered

ALTER TABLE public.pending_registrations DROP CONSTRAINT IF EXISTS pending_registrations_status_check;
ALTER TABLE public.pending_registrations ADD CONSTRAINT pending_registrations_status_check 
  CHECK (status = ANY (ARRAY['pending_payment', 'paid', 'expired', 'registered', 'cancelled', 'card_registered']));
