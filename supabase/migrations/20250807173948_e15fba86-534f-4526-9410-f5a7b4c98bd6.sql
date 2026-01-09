-- Adicionar campo de telefone na tabela profiles se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone text UNIQUE;
    END IF;
END $$;

-- Criar índice para busca rápida por telefone
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- Criar função para buscar user_id por telefone
CREATE OR REPLACE FUNCTION public.get_user_id_by_phone(phone_number text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id 
  FROM public.profiles 
  WHERE phone = phone_number 
  LIMIT 1;
$$;