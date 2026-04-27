-- Fix stale subscriptions that were marked to cancel at period end
-- but kept active status after the access period already finished.
UPDATE public.subscriptions
SET
  status = 'cancelled',
  updated_at = now()
WHERE cancel_at_period_end = true
  AND status IN ('active', 'overdue', 'pending')
  AND current_period_end < CURRENT_DATE;
