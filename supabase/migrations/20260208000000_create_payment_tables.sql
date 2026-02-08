-- Migration: Create payment tables for Asaas integration
-- Description: Tables for plans, pending registrations, and subscriptions

-- ============================================
-- 1. PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    interval TEXT NOT NULL CHECK (interval IN ('MONTHLY', 'YEARLY', 'WEEKLY')),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default monthly plan
INSERT INTO public.plans (name, price, interval, description, active)
VALUES ('Plano Mensal', 29.90, 'MONTHLY', 'Acesso completo ao IAFÉ Finanças por 1 mês', true)
ON CONFLICT DO NOTHING;

-- RLS for plans (public read, admin write)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
    ON public.plans
    FOR SELECT
    USING (active = true);

CREATE POLICY "Super admins can manage plans"
    ON public.plans
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- ============================================
-- 2. PENDING_REGISTRATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    asaas_customer_id TEXT,
    asaas_payment_id TEXT,
    plan_id UUID REFERENCES public.plans(id),
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'expired', 'registered', 'cancelled')),
    payment_method TEXT CHECK (payment_method IN ('PIX', 'BOLETO', 'CREDIT_CARD')),
    pix_code TEXT,
    pix_qr_code_url TEXT,
    boleto_url TEXT,
    invoice_url TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for pending_registrations
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON public.pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_phone ON public.pending_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status ON public.pending_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_asaas_payment_id ON public.pending_registrations(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_asaas_customer_id ON public.pending_registrations(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires_at ON public.pending_registrations(expires_at);

-- RLS for pending_registrations (service role only)
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pending registrations"
    ON public.pending_registrations
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- 3. SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asaas_customer_id TEXT NOT NULL,
    asaas_subscription_id TEXT,
    plan_id UUID REFERENCES public.plans(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'overdue', 'cancelled', 'expired', 'pending')),
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_customer_id ON public.subscriptions(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON public.subscriptions(current_period_end);

-- RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
    ON public.subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
    ON public.subscriptions
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Super admins can view all subscriptions"
    ON public.subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- ============================================
-- 4. PAYMENTS HISTORY TABLE (optional but useful)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    asaas_payment_id TEXT NOT NULL,
    asaas_customer_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL,
    payment_method TEXT,
    paid_at TIMESTAMPTZ,
    due_date DATE,
    invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for payment_history
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON public.payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_asaas_payment_id ON public.payment_history(asaas_payment_id);

-- RLS for payment_history
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment history"
    ON public.payment_history
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment history"
    ON public.payment_history
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- 5. TRIGGERS FOR updated_at
-- ============================================
CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_registrations_updated_at
    BEFORE UPDATE ON public.pending_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. CLEANUP FUNCTION FOR EXPIRED REGISTRATIONS
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_pending_registrations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.pending_registrations
    SET status = 'expired'
    WHERE status = 'pending_payment'
    AND expires_at < now();
END;
$$;

-- ============================================
-- 7. FUNCTION TO CHECK SUBSCRIPTION STATUS
-- ============================================
CREATE OR REPLACE FUNCTION check_user_subscription(p_user_id UUID)
RETURNS TABLE(
    has_active_subscription BOOLEAN,
    subscription_status TEXT,
    days_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (s.status = 'active' AND s.current_period_end >= CURRENT_DATE) AS has_active_subscription,
        s.status AS subscription_status,
        (s.current_period_end - CURRENT_DATE)::INTEGER AS days_remaining
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
    LIMIT 1;
    
    -- If no subscription found, return defaults
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'none'::TEXT, 0;
    END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_subscription(UUID) TO authenticated;

-- ============================================
-- 8. COMMENT ON TABLES
-- ============================================
COMMENT ON TABLE public.plans IS 'Available subscription plans for the application';
COMMENT ON TABLE public.pending_registrations IS 'Temporary storage for users awaiting payment confirmation before registration';
COMMENT ON TABLE public.subscriptions IS 'Active subscriptions linking users to their payment plans';
COMMENT ON TABLE public.payment_history IS 'Historical record of all payments processed';
