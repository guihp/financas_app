-- 1) Quem cancela uma assinatura paga mantem acesso ate o fim do periodo ja
--    pago (cancel-subscription promete isso ao usuario). Antes, status
--    'cancelled' bloqueava o bot imediatamente.
CREATE OR REPLACE FUNCTION public.is_subscription_inactive(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Cancelada mas com periodo pago ainda vigente: mantem acesso ate o fim.
  IF v_sub.status = 'cancelled'
     AND COALESCE(v_sub.is_trial, FALSE) = FALSE
     AND v_sub.current_period_end IS NOT NULL
     AND v_sub.current_period_end >= CURRENT_DATE THEN
    RETURN FALSE;
  END IF;

  IF v_sub.status IN ('expired', 'cancelled', 'overdue') THEN RETURN TRUE; END IF;

  IF v_sub.is_trial = TRUE AND v_sub.trial_ends_at IS NOT NULL THEN
    IF NOW() <= v_sub.trial_ends_at + v_grace_period THEN RETURN FALSE; END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$;

-- 2) pending_registrations.password_hash guarda a senha em base64 (reversivel).
--    So e necessaria ate a conta ser criada. Remove das linhas que ja nao vao
--    virar conta (registradas, canceladas ou abandonadas ha mais de 30 dias);
--    register-user passa a limpar ao criar a conta.
ALTER TABLE public.pending_registrations ALTER COLUMN password_hash DROP NOT NULL;

UPDATE public.pending_registrations
SET password_hash = NULL
WHERE password_hash IS NOT NULL
  AND (
    status IN ('registered', 'cancelled')
    OR (status IN ('pending_payment', 'expired') AND created_at < now() - interval '30 days')
  );
