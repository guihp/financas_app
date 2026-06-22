-- payment_history: dedupe por asaas_payment_id + status.
-- O webhook process-asaas-webhook pode receber o mesmo evento mais de uma vez
-- (Asaas reentrega quando o handler timeout, ou quando a fila esta penalizada
-- e depois e reativada). Sem unique constraint cada redelivery inseria uma
-- linha nova em payment_history, inflando os relatorios financeiros.

-- 1) Limpa duplicatas existentes mantendo apenas a mais antiga por (payment_id, status).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY asaas_payment_id, status
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.payment_history
  WHERE asaas_payment_id IS NOT NULL
)
DELETE FROM public.payment_history
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Indice unico que cobre o caso comum (mesmo payment, mesmo status final).
CREATE UNIQUE INDEX IF NOT EXISTS payment_history_payment_status_uniq
  ON public.payment_history (asaas_payment_id, status)
  WHERE asaas_payment_id IS NOT NULL;
