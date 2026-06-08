-- payment_history: idempotência por asaas_payment_id
--
-- Problema: process-asaas-webhook fazia INSERT a cada entrega de evento. O Asaas
-- reentrega o mesmo pagamento em retries (backoff) e também manda CONFIRMED e
-- RECEIVED do mesmo pay_id — cada um virava uma linha nova. Resultado: payment_history
-- inflado com duplicatas (ex.: um pagamento gravado 20x), tornando qualquer soma de
-- receita incorreta. O webhook agora usa upsert(onConflict: 'asaas_payment_id'),
-- que exige esta constraint UNIQUE.
--
-- Esta migration: (1) deduplica as linhas existentes mantendo a melhor por pay_id
-- (prefere user_id preenchido, depois a mais antiga); (2) cria a UNIQUE.

-- (1) Dedup — mantém rn=1 por asaas_payment_id (não-nulo)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY asaas_payment_id
           ORDER BY (user_id IS NOT NULL) DESC, created_at ASC, id ASC
         ) AS rn
  FROM payment_history
  WHERE asaas_payment_id IS NOT NULL
)
DELETE FROM payment_history ph
USING ranked r
WHERE ph.id = r.id
  AND r.rn > 1;

-- (2) UNIQUE em asaas_payment_id (NULLs continuam permitidos, múltiplos)
ALTER TABLE payment_history
  ADD CONSTRAINT payment_history_asaas_payment_id_key UNIQUE (asaas_payment_id);
