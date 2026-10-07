-- 1) payment_history: o indice unico parcial (WHERE asaas_payment_id IS NOT NULL)
--    nao pode ser usado por INSERT ... ON CONFLICT (asaas_payment_id, status)
--    sem repetir o predicado, entao todo upsert do webhook falhava com 42P10
--    desde 2026-06-23. Um indice nao parcial tem o mesmo efeito (NULLs continuam
--    distintos) e e inferido pelo ON CONFLICT.
DROP INDEX IF EXISTS public.payment_history_payment_status_uniq;
CREATE UNIQUE INDEX payment_history_payment_status_uniq
  ON public.payment_history (asaas_payment_id, status);

-- 2) Registra um pagamento confirmado e estende a assinatura UMA vez por
--    cobrança. A Asaas envia PAYMENT_CONFIRMED e depois PAYMENT_RECEIVED para
--    a mesma cobrança de cartao; antes cada evento somava +30 dias.
--    Novo fim = maior entre o fim atual e a data do pagamento, + 1 mes.
--    Retorna o novo current_period_end, ou NULL se a cobrança ja tinha sido aplicada.
CREATE OR REPLACE FUNCTION public.record_subscription_payment(
  p_subscription_id uuid,
  p_asaas_payment_id text,
  p_status text,
  p_amount numeric,
  p_payment_method text,
  p_asaas_customer_id text DEFAULT NULL,
  p_paid_date date DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_invoice_url text DEFAULT NULL
)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub record;
  v_already_applied boolean;
  v_paid_date date := coalesce(p_paid_date, current_date);
  v_new_end date;
BEGIN
  IF p_asaas_payment_id IS NULL OR p_asaas_payment_id = '' THEN
    RAISE EXCEPTION 'p_asaas_payment_id is required';
  END IF;

  SELECT id, user_id, current_period_end
  INTO v_sub
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription % not found', p_subscription_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.payment_history
    WHERE asaas_payment_id = p_asaas_payment_id
      AND status IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
  ) INTO v_already_applied;

  INSERT INTO public.payment_history (
    user_id, subscription_id, asaas_payment_id, asaas_customer_id, amount,
    status, payment_method, paid_at, due_date, invoice_url
  ) VALUES (
    v_sub.user_id, v_sub.id, p_asaas_payment_id, p_asaas_customer_id, coalesce(p_amount, 0),
    coalesce(p_status, 'CONFIRMED'), p_payment_method, now(), p_due_date, p_invoice_url
  )
  ON CONFLICT (asaas_payment_id, status) DO NOTHING;

  IF v_already_applied THEN
    RETURN NULL;
  END IF;

  v_new_end := (greatest(coalesce(v_sub.current_period_end, v_paid_date), v_paid_date)
                + interval '1 month')::date;

  UPDATE public.subscriptions
  SET status = 'active',
      is_trial = false,
      cancel_at_period_end = false,
      cancelled_at = null,
      current_period_start = v_paid_date,
      current_period_end = v_new_end,
      updated_at = now()
  WHERE id = v_sub.id;

  RETURN v_new_end;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_subscription_payment(uuid, text, text, numeric, text, text, date, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_subscription_payment(uuid, text, text, numeric, text, text, date, date, text)
  TO service_role;

-- 3) Contagem de uso dos cupons (nunca era incrementada).
CREATE OR REPLACE FUNCTION public.increment_promo_usage(p_promo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.promotional_codes
  SET usage_count = coalesce(usage_count, 0) + 1,
      updated_at = now()
  WHERE id = p_promo_id;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_promo_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_usage(uuid) TO service_role;

-- Backfill: usos = assinaturas criadas com o cupom.
UPDATE public.promotional_codes p
SET usage_count = sub.n
FROM (
  SELECT promotional_code_id, count(*) AS n
  FROM public.subscriptions
  WHERE promotional_code_id IS NOT NULL
  GROUP BY promotional_code_id
) sub
WHERE sub.promotional_code_id = p.id;
