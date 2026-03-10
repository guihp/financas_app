CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_full_price NUMERIC(10,2) NOT NULL DEFAULT 49.90,
    product_promo_price NUMERIC(10,2) NOT NULL DEFAULT 29.90,
    trial_days INTEGER NOT NULL DEFAULT 7,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read
CREATE POLICY "App settings are viewable by everyone" ON public.app_settings
    FOR SELECT USING (true);

-- Policy: Super Admins can update
CREATE POLICY "Super admins can update app settings" ON public.app_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can insert app settings" ON public.app_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can delete app settings" ON public.app_settings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'super_admin'
        )
    );

-- Insert a single default record
INSERT INTO public.app_settings (product_full_price, product_promo_price, trial_days)
SELECT 49.90, 29.90, 7
WHERE NOT EXISTS (
    SELECT 1 FROM public.app_settings LIMIT 1
);
