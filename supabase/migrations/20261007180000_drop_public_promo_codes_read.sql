-- APLICAR SOMENTE DEPOIS do deploy do frontend que usa validate_promo_code
-- (PagamentoPendente.tsx). A tabela era legivel por qualquer visitante
-- (policy USING true), expondo todos os codigos de cupom.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.promotional_codes;
