-- Validacao de cupom pelo checkout: devolve so o cupom digitado (se ativo).
-- Substitui a leitura direta da tabela pelo navegador, que exigia uma policy
-- de SELECT publico e expunha todos os codigos. A policy e removida em
-- 20261007180000, depois do deploy do frontend.
-- (promotional_codes.status e GENERATED ALWAYS AS (active), entao `active`
-- e a unica fonte de verdade.)
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text)
RETURNS TABLE (id uuid, code text, discount_percentage numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.code, p.discount_percentage
  FROM public.promotional_codes p
  WHERE p.code = upper(trim(p_code))
    AND p.active = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_promo_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text) TO anon, authenticated, service_role;
