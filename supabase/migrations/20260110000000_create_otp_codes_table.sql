-- Add full_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'otp_codes' 
    AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.otp_codes ADD COLUMN full_name TEXT;
  END IF;
END $$;

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes(phone);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON public.otp_codes(code);

-- Create index on verified status
CREATE INDEX IF NOT EXISTS idx_otp_codes_verified ON public.otp_codes(verified);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON public.otp_codes(expires_at);

-- Create composite index for faster lookups during verification
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_verified_expires 
ON public.otp_codes(phone, verified, expires_at);

-- Ensure RLS is enabled
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Service role can manage OTP codes" ON public.otp_codes;

-- Create policy for service role to manage all OTP codes
-- Service role is used by Edge Functions
CREATE POLICY "Service role can manage OTP codes" 
ON public.otp_codes 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create a function to automatically delete expired OTP codes (optional cleanup)
-- This can be run periodically via cron or manually
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$;
