-- Add super_admin role to visionmarck@outlook.com user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users
WHERE email = 'visionmarck@outlook.com'
ON CONFLICT (user_id, role) DO NOTHING;