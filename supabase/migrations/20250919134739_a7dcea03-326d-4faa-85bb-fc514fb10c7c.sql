-- Remove jobs duplicados de appointment-notifications
SELECT cron.unschedule(jobid::bigint) 
FROM cron.job 
WHERE jobname = 'appointment-notifications';

-- Recria apenas um job correto para notificações de agendamentos
SELECT cron.schedule(
  'appointment-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/appointment-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzeWViZW1odm53a2hueXBxZ2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQyNjE5OTgsImV4cCI6MjAzOTgzNzk5OH0.GIiWLk7KVcNfqAGBpq9MpCD_RgZHctJPaTOtKDJ7g3o"}'::jsonb
  ) as request_id;
  $$
);