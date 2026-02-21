-- Create account_connections table
CREATE TABLE IF NOT EXISTS public.account_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL, -- Email of the invited user
    recipient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable initially, populated if user exists or when they register
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_connections_requester ON public.account_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_account_connections_recipient ON public.account_connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_account_connections_email ON public.account_connections(email);
CREATE INDEX IF NOT EXISTS idx_account_connections_status ON public.account_connections(status);

-- RLS for account_connections
ALTER TABLE public.account_connections ENABLE ROW LEVEL SECURITY;

-- Users can view connections involving them
CREATE POLICY "Users can view their own connections" ON public.account_connections
    FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Users can insert connections (initiator)
CREATE POLICY "Users can create connections" ON public.account_connections
    FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

-- Users can update connections involving them (e.g., to accept/reject)
CREATE POLICY "Users can update their connections" ON public.account_connections
    FOR UPDATE
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Users can delete connections they initiated (cancel invite) or if they are recipient (remove connection)
CREATE POLICY "Users can delete their connections" ON public.account_connections
    FOR DELETE
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);


-- Function to get connected user IDs for a given user
CREATE OR REPLACE FUNCTION public.get_connected_user_ids(user_uuid UUID)
RETURNS TABLE (connected_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT CASE 
        WHEN requester_id = user_uuid THEN recipient_id
        ELSE requester_id
    END
    FROM public.account_connections
    WHERE (requester_id = user_uuid OR recipient_id = user_uuid)
      AND status = 'accepted';
END;
$$;

-- UPDATE RLS POLICIES FOR SHARED DATA
-- We need to allow access if auth.uid() is the owner OR if auth.uid() is connected to the owner

-- Transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view own and shared transactions" ON public.transactions
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users can insert transactions for self or shared" ON public.transactions
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update own and shared transactions" ON public.transactions
    FOR UPDATE
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
CREATE POLICY "Users can delete own and shared transactions" ON public.transactions
    FOR DELETE
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

-- Categories (Similar logic)
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
CREATE POLICY "Users can view own and shared categories" ON public.categories
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert their own categories" ON public.categories;
CREATE POLICY "Users can insert categories for self or shared" ON public.categories
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update own and shared categories" ON public.categories
    FOR UPDATE
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
CREATE POLICY "Users can delete own and shared categories" ON public.categories
    FOR DELETE
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

-- Appointments (Similar logic)
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view own and shared appointments" ON public.appointments
    FOR SELECT
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can insert their own appointments" ON public.appointments;
CREATE POLICY "Users can insert appointments for self or shared" ON public.appointments
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
CREATE POLICY "Users can update own and shared appointments" ON public.appointments
    FOR UPDATE
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );

DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.appointments;
CREATE POLICY "Users can delete own and shared appointments" ON public.appointments
    FOR DELETE
    USING (
        auth.uid() = user_id 
        OR 
        user_id IN (SELECT connected_user_id FROM public.get_connected_user_ids(auth.uid()))
    );
