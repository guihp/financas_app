-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_param UUID)
RETURNS app_role
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = user_id_param 
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'user' THEN 3 
    END 
  LIMIT 1;
$$;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id_param UUID, role_param app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role = role_param
  );
$$;

-- Create function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin');
$$;

-- RLS policies for user_roles table
CREATE POLICY "Super admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.is_super_admin());

CREATE POLICY "Super admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_super_admin());

CREATE POLICY "Super admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (public.is_super_admin());

CREATE POLICY "Users can view their own role" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update profiles RLS to allow super admin access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile or super admin can view all" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id OR public.is_super_admin());

-- Allow super admin to update any profile
CREATE POLICY "Super admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (public.is_super_admin());

-- Allow super admin to insert profiles
CREATE POLICY "Super admins can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.is_super_admin());

-- Create trigger for updated_at on user_roles
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert super admin role for the specified email
-- Note: This will be done after user registration
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
WHERE u.email = 'brunofacosta@hotmail.com'
ON CONFLICT (user_id, role) DO NOTHING;