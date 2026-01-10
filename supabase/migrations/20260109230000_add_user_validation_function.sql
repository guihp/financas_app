-- Função para verificar se usuário está ativo e existe
CREATE OR REPLACE FUNCTION public.validate_user_active(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = user_id_param 
    AND deleted_at IS NULL
    AND email_confirmed_at IS NOT NULL
  );
$$;

-- Função para verificar se usuário tem perfil ativo
CREATE OR REPLACE FUNCTION public.validate_user_has_profile(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = user_id_param
  );
$$;
