-- Protecao contra forca bruta no OTP (6 digitos).
-- verify-otp passa a chamar verify_otp_code, que serializa as tentativas por
-- telefone (advisory lock) e bloqueia apos 5 erros na ultima hora.

ALTER TABLE public.otp_codes
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS otp_codes_phone_created_at_idx
  ON public.otp_codes (phone, created_at DESC);

CREATE OR REPLACE FUNCTION public.verify_otp_code(p_phone text, p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_failures integer;
  v_otp record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('otp:' || p_phone));

  SELECT coalesce(sum(failed_attempts), 0) INTO v_failures
  FROM public.otp_codes
  WHERE phone = p_phone
    AND created_at > now() - interval '1 hour';

  IF v_failures >= 5 THEN
    RETURN 'locked';
  END IF;

  SELECT id, code INTO v_otp
  FROM public.otp_codes
  WHERE phone = p_phone
    AND verified = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'expired';
  END IF;

  IF trim(v_otp.code) = trim(p_code) THEN
    UPDATE public.otp_codes SET verified = true WHERE id = v_otp.id;
    RETURN 'ok';
  END IF;

  UPDATE public.otp_codes
  SET failed_attempts = failed_attempts + 1
  WHERE id = v_otp.id;
  RETURN 'invalid';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_otp_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_otp_code(text, text) TO service_role;
