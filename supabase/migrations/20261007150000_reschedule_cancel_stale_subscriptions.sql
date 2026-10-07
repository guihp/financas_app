-- O job cancel-stale-subscriptions (20260519120000) tinha sumido do pg_cron.
-- Reagendado depois da correcao do webhook (renovacoes voltaram a estender o
-- periodo) e da reconciliacao de 2026-10-07, para nao cancelar quem pagou.
DO $$
BEGIN
  PERFORM cron.unschedule('cancel-stale-subscriptions');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

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
