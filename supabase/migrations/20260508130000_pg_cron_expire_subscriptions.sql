-- Phase 2-B: scheduled detection of expired subscriptions
-- - Updates is_subscription_inactive to whitelist admin/super_admin roles
-- - Adds expire_overdue_subscriptions() to flip status='active' → 'expired' for
--   trial-past-grace and period-ended-without-renewal cases
-- - Schedules pg_cron job to run hourly
-- The existing trigger subscription_sync_ia_ativa cascades to registraAi_dados.ia_ativa

-- 1) Refine is_subscription_inactive: admins/super_admins are always allowed
CREATE OR REPLACE FUNCTION public.is_subscription_inactive(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub subscriptions%ROWTYPE;
  v_grace_period INTERVAL := INTERVAL '12 hours';
  v_has_admin_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role IN ('admin', 'super_admin')
  ) INTO v_has_admin_role;
  IF v_has_admin_role THEN RETURN FALSE; END IF;

  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id LIMIT 1;
  IF NOT FOUND THEN RETURN TRUE; END IF;
  IF v_sub.asaas_customer_id IS NULL THEN RETURN TRUE; END IF;

  IF v_sub.status = 'active' AND COALESCE(v_sub.is_trial, FALSE) = FALSE THEN
    IF v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end < CURRENT_DATE THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  IF v_sub.status = 'active' AND v_sub.is_trial = TRUE AND v_sub.trial_ends_at IS NOT NULL THEN
    IF v_sub.trial_ends_at >= NOW() THEN RETURN FALSE; END IF;
    IF v_sub.current_period_end IS NOT NULL
       AND v_sub.current_period_end >= CURRENT_DATE
       AND v_sub.current_period_end > v_sub.trial_ends_at::DATE THEN
      RETURN FALSE;
    END IF;
    IF NOW() <= v_sub.trial_ends_at + v_grace_period THEN RETURN FALSE; END IF;
    RETURN TRUE;
  END IF;

  IF v_sub.status IN ('expired', 'cancelled', 'overdue') THEN RETURN TRUE; END IF;

  IF v_sub.is_trial = TRUE AND v_sub.trial_ends_at IS NOT NULL THEN
    IF NOW() <= v_sub.trial_ends_at + v_grace_period THEN RETURN FALSE; END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2) Function: flip stale 'active' rows to 'expired' (trigger sync_ia_ativa cascades)
-- Skips admins/super_admins so internal accounts stay clean
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_grace_period INTERVAL := INTERVAL '12 hours';
BEGIN
  WITH expired_trials AS (
    UPDATE public.subscriptions s
    SET status = 'expired', updated_at = NOW()
    WHERE s.status = 'active'
      AND s.is_trial = TRUE
      AND s.trial_ends_at IS NOT NULL
      AND (s.trial_ends_at + v_grace_period) < NOW()
      AND (s.current_period_end IS NULL OR s.current_period_end <= s.trial_ends_at::DATE)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = s.user_id AND r.role IN ('admin', 'super_admin')
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM expired_trials;

  WITH expired_periods AS (
    UPDATE public.subscriptions s
    SET status = 'expired', updated_at = NOW()
    WHERE s.status = 'active'
      AND COALESCE(s.is_trial, FALSE) = FALSE
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = s.user_id AND r.role IN ('admin', 'super_admin')
      )
    RETURNING 1
  )
  SELECT v_count + count(*) INTO v_count FROM expired_periods;

  RETURN v_count;
END;
$$;

-- 3) pg_cron: hourly schedule. Idempotent (unschedule if exists).
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('expire-overdue-subscriptions');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'expire-overdue-subscriptions',
  '0 * * * *',
  $cron$ SELECT public.expire_overdue_subscriptions(); $cron$
);

-- 4) Re-sync ia_ativa for admin/super_admin users
-- The 2-A backfill ran before the whitelist existed, so admins with stale
-- subscriptions may have ia_ativa=FALSE. This re-syncs only those rows.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT s.user_id
    FROM public.subscriptions s
    JOIN public.user_roles ur ON ur.user_id = s.user_id
    WHERE ur.role IN ('admin', 'super_admin')
  LOOP
    PERFORM public.sync_ia_ativa_for_user(r.user_id);
  END LOOP;
END;
$$;
