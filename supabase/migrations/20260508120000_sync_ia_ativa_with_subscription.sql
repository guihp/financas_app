-- Sync registraAi_dados.ia_ativa with subscription state
-- Rule: ia_ativa = FALSE when subscription is inactive (cancelled, expired, overdue,
-- or trial expired past 12h grace). ia_ativa = TRUE when subscription is active.
-- Match registraAi_dados → user via phone (suffix match against id which has
-- format <phone_with_DDI>@s.whatsapp.net). profiles.phone is the source of truth.

-- 1) Function: returns TRUE when the user's subscription is currently inactive
CREATE OR REPLACE FUNCTION public.is_subscription_inactive(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub subscriptions%ROWTYPE;
  v_grace_period INTERVAL := INTERVAL '12 hours';
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id LIMIT 1;

  IF NOT FOUND THEN RETURN TRUE; END IF;
  IF v_sub.asaas_customer_id IS NULL THEN RETURN TRUE; END IF;

  -- Active paid, not trial
  IF v_sub.status = 'active' AND COALESCE(v_sub.is_trial, FALSE) = FALSE THEN
    IF v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end < CURRENT_DATE THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Active in trial
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

  -- Non-active states
  IF v_sub.status IN ('expired', 'cancelled', 'overdue') THEN RETURN TRUE; END IF;

  -- Trial flagged but no recognized status
  IF v_sub.is_trial = TRUE AND v_sub.trial_ends_at IS NOT NULL THEN
    IF NOW() <= v_sub.trial_ends_at + v_grace_period THEN RETURN FALSE; END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2) Function: sync ia_ativa for a given user (matches registraAi_dados by phone)
CREATE OR REPLACE FUNCTION public.sync_ia_ativa_for_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_blocked BOOLEAN;
BEGIN
  SELECT phone INTO v_phone FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN; END IF;

  v_blocked := public.is_subscription_inactive(p_user_id);

  UPDATE public."registraAi_dados"
  SET ia_ativa = NOT v_blocked,
      updated_at = NOW()
  WHERE id LIKE '%' || v_phone || '@s.whatsapp.net';
END;
$$;

-- 3) Trigger function: fires on subscriptions UPDATE/INSERT
CREATE OR REPLACE FUNCTION public.trg_subscription_sync_ia_ativa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_ia_ativa_for_user(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_sync_ia_ativa ON public.subscriptions;
CREATE TRIGGER subscription_sync_ia_ativa
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_sync_ia_ativa();

-- 4) Backfill: sync ia_ativa for every existing user with a subscription
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM subscriptions LOOP
    PERFORM public.sync_ia_ativa_for_user(r.user_id);
  END LOOP;
END;
$$;
