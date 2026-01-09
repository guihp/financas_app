-- Remove a foreign key constraint da coluna phone
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_phone_fkey;

-- Alterar o tipo da coluna phone para TEXT (mais flexível)
ALTER TABLE public.transactions ALTER COLUMN phone TYPE TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.transactions.phone IS 'Phone no formato WhatsApp: 55{DDD}{numero}@s.whatsapp.net';
