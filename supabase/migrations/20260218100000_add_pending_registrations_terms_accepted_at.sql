-- Add terms_accepted_at column to pending_registrations table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_registrations' AND column_name = 'terms_accepted_at') THEN
        ALTER TABLE public.pending_registrations ADD COLUMN terms_accepted_at TIMESTAMPTZ;
    END IF;
END $$;
