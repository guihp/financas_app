-- Add address columns to pending_registrations for PIX and Cartão flows
ALTER TABLE public.pending_registrations
  ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT;

COMMENT ON COLUMN public.pending_registrations.address_postal_code IS 'CEP';
COMMENT ON COLUMN public.pending_registrations.address_street IS 'Logradouro';
COMMENT ON COLUMN public.pending_registrations.address_number IS 'Número';
COMMENT ON COLUMN public.pending_registrations.address_complement IS 'Complemento';
COMMENT ON COLUMN public.pending_registrations.address_neighborhood IS 'Bairro';
COMMENT ON COLUMN public.pending_registrations.address_city IS 'Cidade';
COMMENT ON COLUMN public.pending_registrations.address_state IS 'UF';
