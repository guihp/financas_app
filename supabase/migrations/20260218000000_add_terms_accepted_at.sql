-- Add terms_accepted_at column to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'terms_accepted_at') THEN
        ALTER TABLE public.profiles ADD COLUMN terms_accepted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted_at ON public.profiles(terms_accepted_at);
