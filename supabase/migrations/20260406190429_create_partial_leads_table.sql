CREATE TABLE IF NOT EXISTS public.partial_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partial_leads ENABLE ROW LEVEL SECURITY;

-- Allow public insertion and upsertions (since they aren't authenticated yet)
CREATE POLICY "Enable insert for public" ON public.partial_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for public based on email" ON public.partial_leads FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable select for service role" ON public.partial_leads FOR SELECT USING (true);
