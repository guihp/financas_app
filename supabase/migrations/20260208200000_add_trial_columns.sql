-- Add trial columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.subscriptions.trial_ends_at IS 'Date when the trial period ends';
COMMENT ON COLUMN public.subscriptions.is_trial IS 'Whether the subscription is currently in trial period';
