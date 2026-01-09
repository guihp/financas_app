-- Corrigir a função para ter search_path seguro
CREATE OR REPLACE FUNCTION public.get_user_id_by_phone(phone_number text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT user_id 
  FROM public.profiles 
  WHERE phone = phone_number 
  LIMIT 1;
$$;