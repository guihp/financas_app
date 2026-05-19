-- Replace old expire_overdue_subscriptions cron (which only flipped local state)
-- with an hourly call to the new cancel-stale-subscriptions edge function
-- that ALSO cancels the subscription on Asaas (root fix for orphan billings).

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop old jobs (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-overdue-subscriptions');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('cancel-stale-subscriptions');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- Vault secrets: created here only if missing. UPDATE via:
--   SELECT vault.update_secret('<secret_id>', '<new_value>');
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
    -- Placeholder. Operator MUST update this with the real service_role JWT:
    --   SELECT vault.update_secret(
    --     (SELECT id FROM vault.secrets WHERE name='app_service_role_key'),
    --     '<service_role_jwt>'
    --   );
    PERFORM vault.create_secret('PLACEHOLDER_SET_VIA_VAULT_UPDATE_SECRET', 'app_service_role_key');
  END IF;
END;
$$;

-- Schedule new job: every hour at minute 0
SELECT cron.schedule(
  'cancel-stale-subscriptions',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_supabase_url') || '/functions/v1/cancel-stale-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
