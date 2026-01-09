-- Add super_admin role to brunofacosta@hotmail.com user
INSERT INTO public.user_roles (user_id, role)
VALUES ('20b8a8c2-d357-465e-ba1b-4845e4e9261e', 'super_admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;