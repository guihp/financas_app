-- First let's check if the user exists and assign super admin role
-- Find user by email and assign super admin role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
WHERE u.email = 'brunofacosta@hotmail.com'
ON CONFLICT (user_id, role) DO UPDATE SET role = 'super_admin';