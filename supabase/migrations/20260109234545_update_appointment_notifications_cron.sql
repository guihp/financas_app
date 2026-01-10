-- Remove jobs antigos/duplicados de appointment-notifications
SELECT cron.unschedule(jobid::bigint) 
FROM cron.job 
WHERE jobname = 'appointment-notifications';

-- Recria o job correto com a URL do projeto atual
-- NOTA: Usando anon key pois a Edge Function usa service_role_key internamente
-- A URL será construída automaticamente baseada no projeto atual
SELECT cron.schedule(
  'appointment-notifications',
  '*/5 * * * *', -- Executa a cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/appointment-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsYml3Z3V6Ymlvc2FveXJjdmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTgxNzIsImV4cCI6MjA4MzUzNDE3Mn0.g31h4C8ugNXinlYVGXL-GrP1TQxUOX-u-eqxhI_Rkjk'
    )
  ) as request_id;
  $$
);
