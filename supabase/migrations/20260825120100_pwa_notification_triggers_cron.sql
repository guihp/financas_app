-- Notification triggers (pg_net → dispatch-notification) + engagement cron
-- Requires vault secrets app_supabase_url + app_service_role_key (see cancel-stale migration)

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure vault secrets exist (placeholder if missing — operator must update service_role)
DO $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'app_supabase_url';
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret('https://dlbiwguzbiosaoyrcvay.supabase.co', 'app_supabase_url');
  END IF;

  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'app_service_role_key';
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret('PLACEHOLDER_SET_VIA_VAULT_UPDATE_SECRET', 'app_service_role_key');
  END IF;
END;
$$;

-- Shared helper: POST to dispatch-notification via pg_net
CREATE OR REPLACE FUNCTION public.dispatch_notification_http(payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  request_id bigint;
  base_url text;
  service_key text;
BEGIN
  SELECT decrypted_secret INTO base_url
  FROM vault.decrypted_secrets
  WHERE name = 'app_supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'app_service_role_key'
  LIMIT 1;

  IF base_url IS NULL OR service_key IS NULL
     OR service_key = 'PLACEHOLDER_SET_VIA_VAULT_UPDATE_SECRET' THEN
    RAISE WARNING 'dispatch_notification_http: vault secrets missing or placeholder';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := base_url || '/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := payload,
    timeout_milliseconds := 15000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_notification_http(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_notification_http(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_notification_http(jsonb) TO postgres;

-- ---------------------------------------------------------------------------
-- transactions INSERT → expense / income (+ optional budget threshold)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_type text;
  title text;
  body text;
  amount_fmt text;
  month_key text;
  spent numeric;
  budget_amt numeric;
  pct numeric;
  threshold_label text;
BEGIN
  IF NEW.type = 'expense' THEN
    notif_type := 'transaction_expense';
    title := 'Nova despesa';
  ELSIF NEW.type = 'income' THEN
    notif_type := 'transaction_income';
    title := 'Nova receita';
  ELSE
    RETURN NEW;
  END IF;

  amount_fmt := to_char(NEW.amount, 'FM999G999G990D00');
  body := coalesce(NEW.description, NEW.category) || ' — R$ ' || amount_fmt;

  PERFORM public.dispatch_notification_http(jsonb_build_object(
    'user_id', NEW.user_id,
    'type', notif_type,
    'title', title,
    'body', body,
    'data', jsonb_build_object(
      'entity_id', NEW.id::text,
      'transaction_id', NEW.id,
      'deep_link', '/transactions',
      'category', NEW.category,
      'amount', NEW.amount,
      'tx_type', NEW.type
    )
  ));

  -- Budget threshold (expense only): notify when crossing 80% or 100%
  IF NEW.type = 'expense' THEN
    month_key := to_char(
      coalesce(NEW.transaction_date, NEW.date, CURRENT_DATE)::date,
      'YYYY-MM'
    );

    SELECT b.amount INTO budget_amt
    FROM public.budgets b
    WHERE b.user_id = NEW.user_id
      AND b.category = NEW.category
      AND b.month_year = month_key
    LIMIT 1;

    IF budget_amt IS NOT NULL AND budget_amt > 0 THEN
      SELECT coalesce(sum(t.amount), 0) INTO spent
      FROM public.transactions t
      WHERE t.user_id = NEW.user_id
        AND t.type = 'expense'
        AND t.category = NEW.category
        AND to_char(coalesce(t.transaction_date, t.date, t.created_at::date), 'YYYY-MM') = month_key;

      pct := (spent / budget_amt) * 100;

      IF pct >= 100 THEN
        threshold_label := '100';
      ELSIF pct >= 80 THEN
        threshold_label := '80';
      ELSE
        threshold_label := NULL;
      END IF;

      IF threshold_label IS NOT NULL THEN
        PERFORM public.dispatch_notification_http(jsonb_build_object(
          'user_id', NEW.user_id,
          'type', 'budget_threshold',
          'title', 'Orçamento em ' || threshold_label || '%',
          'body', NEW.category || ': R$ ' || to_char(spent, 'FM999G999G990D00') ||
                  ' de R$ ' || to_char(budget_amt, 'FM999G999G990D00'),
          'data', jsonb_build_object(
            'entity_id', NEW.user_id::text || ':' || NEW.category || ':' || month_key || ':' || threshold_label,
            'category', NEW.category,
            'month_year', month_key,
            'percent', round(pct, 1),
            'deep_link', '/orcamentos'
          )
        ));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_notify ON public.transactions;
CREATE TRIGGER trg_transactions_notify
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_transaction();

-- ---------------------------------------------------------------------------
-- shopping_lists INSERT / finished_at update
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_shopping_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.dispatch_notification_http(jsonb_build_object(
      'user_id', NEW.user_id,
      'type', 'shopping_list_created',
      'title', 'Lista de compras criada',
      'body', NEW.name,
      'data', jsonb_build_object(
        'entity_id', NEW.id::text,
        'list_id', NEW.id,
        'deep_link', '/lista-compras'
      )
    ));
  ELSIF TG_OP = 'UPDATE'
     AND NEW.finished_at IS NOT NULL
     AND (OLD.finished_at IS NULL) THEN
    PERFORM public.dispatch_notification_http(jsonb_build_object(
      'user_id', NEW.user_id,
      'type', 'shopping_list_finished',
      'title', 'Lista finalizada',
      'body', NEW.name || coalesce(
        ' — R$ ' || to_char(NEW.final_value, 'FM999G999G990D00'),
        ''
      ),
      'data', jsonb_build_object(
        'entity_id', NEW.id::text || ':finished',
        'list_id', NEW.id,
        'deep_link', '/lista-compras'
      )
    ));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_lists_notify ON public.shopping_lists;
CREATE TRIGGER trg_shopping_lists_notify
  AFTER INSERT OR UPDATE OF finished_at ON public.shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_shopping_list();

-- ---------------------------------------------------------------------------
-- shopping_items INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_shopping_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  list_name text;
BEGIN
  SELECT name INTO list_name
  FROM public.shopping_lists
  WHERE id = NEW.list_id;

  PERFORM public.dispatch_notification_http(jsonb_build_object(
    'user_id', NEW.user_id,
    'type', 'shopping_item_added',
    'title', 'Item adicionado',
    'body', NEW.name || coalesce(' em ' || list_name, ''),
    'data', jsonb_build_object(
      'entity_id', NEW.id::text,
      'item_id', NEW.id,
      'list_id', NEW.list_id,
      'deep_link', '/lista-compras'
    )
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_items_notify ON public.shopping_items;
CREATE TRIGGER trg_shopping_items_notify
  AFTER INSERT ON public.shopping_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_shopping_item();

-- ---------------------------------------------------------------------------
-- engagement-notifications cron ~09:00 America/Sao_Paulo (= 12:00 UTC)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('engagement-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'engagement-notifications',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_supabase_url')
           || '/functions/v1/engagement-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
