-- Fecha brechas de seguranca expostas via PostgREST (anon key publica).
--
-- 1) Funcoes SECURITY DEFINER que qualquer pessoa conseguia chamar via
--    /rest/v1/rpc/* (ex.: assign_super_admin_to_email, get_transactions_by_phone).
--    Ficam restritas a service_role. Funcoes usadas em policies RLS ou pelo
--    frontend (is_super_admin, is_admin_or_super, get_connected_user_ids,
--    has_role) continuam liberadas.
--    Trigger functions nao precisam de EXECUTE do papel que dispara o trigger.

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'add_appointment',
        'add_transaction_by_phone',
        'assign_super_admin_to_email',
        'cancel_transaction_by_phone',
        'check_user_subscription',
        'cleanup_expired_pending_registrations',
        'create_user_via_api',
        'delete_appointment',
        'dispatch_notification_http',
        'ensure_notification_preferences',
        'expire_overdue_subscriptions',
        'get_appointments_by_phone',
        'get_transactions_by_phone',
        'get_user_id_by_phone',
        'get_user_role',
        'handle_new_user',
        'is_subscription_inactive',
        'reset_user_password',
        'sync_ia_ativa_for_user',
        'trg_notify_shopping_item',
        'trg_notify_shopping_list',
        'trg_notify_transaction',
        'trg_subscription_sync_ia_ativa',
        'update_updated_at_column',
        'user_exists_and_active',
        'user_has_profile',
        'validate_user_active',
        'validate_user_has_profile'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- 2) desistentes estava sem RLS (leitura/escrita aberta para anon).
--    Escrita so acontece via service_role (cancel-subscription).
ALTER TABLE public.desistentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desistentes FROM anon;

DROP POLICY IF EXISTS "Admins can view desistentes" ON public.desistentes;
CREATE POLICY "Admins can view desistentes"
  ON public.desistentes
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin_or_super()));

-- 3) partial_leads tinha SELECT/UPDATE com USING (true): qualquer pessoa lia e
--    alterava todos os leads. A captura passa a ser feita por uma funcao que
--    so grava (nao devolve dados). Leitura fica so para admins (policy existente).
DROP POLICY IF EXISTS "Enable select for service role" ON public.partial_leads;
DROP POLICY IF EXISTS "Enable update for public based on email" ON public.partial_leads;
DROP POLICY IF EXISTS "Enable insert for public" ON public.partial_leads;
REVOKE INSERT, UPDATE, DELETE ON public.partial_leads FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_partial_lead(
  p_email text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL
     OR length(v_email) > 254
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN;
  END IF;

  INSERT INTO public.partial_leads (email, full_name, phone, updated_at)
  VALUES (
    v_email,
    nullif(left(trim(p_full_name), 200), ''),
    nullif(left(trim(p_phone), 32), ''),
    now()
  )
  ON CONFLICT (email) DO UPDATE
    SET full_name = coalesce(excluded.full_name, public.partial_leads.full_name),
        phone = coalesce(excluded.phone, public.partial_leads.phone),
        updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.capture_partial_lead(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_partial_lead(text, text, text) TO anon, authenticated, service_role;
