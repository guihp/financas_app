-- Saldo calculado no banco (fonte única para app e WhatsApp).
-- Antes o front baixava todas as transações e somava no navegador; acima de 1000
-- linhas o PostgREST truncava e o saldo ficava errado.
--
-- Regra (a mesma que o app já usava):
--   + receitas, exceto categoria 'pagamento_fatura'
--   - despesas, exceto as pagas no cartão de crédito (entram na fatura)
--
-- Uma linha por conta bancária; transações sem banco vêm com bank_account_id NULL.
-- O saldo total é a soma de todas as linhas.
-- SECURITY INVOKER: o RLS de transactions continua valendo (próprio usuário +
-- contas compartilhadas). Edge functions com service_role passam o user_id.

create index if not exists idx_transactions_user_id_date
  on public.transactions (user_id, date);

create or replace function public.get_balance_summary(
  p_user_ids uuid[],
  p_until date default null
)
returns table (
  bank_account_id uuid,
  income numeric,
  expense numeric,
  balance numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.bank_account_id,
    coalesce(sum(t.amount) filter (
      where t.type = 'income' and t.category is distinct from 'pagamento_fatura'
    ), 0) as income,
    coalesce(sum(t.amount) filter (
      where t.type = 'expense' and t.payment_method is distinct from 'credit'
    ), 0) as expense,
    coalesce(sum(t.amount) filter (
      where t.type = 'income' and t.category is distinct from 'pagamento_fatura'
    ), 0)
    - coalesce(sum(t.amount) filter (
      where t.type = 'expense' and t.payment_method is distinct from 'credit'
    ), 0) as balance
  from public.transactions t
  where t.user_id = any (p_user_ids)
    and (p_until is null or coalesce(t.transaction_date, t.date) <= p_until)
  group by t.bank_account_id;
$$;

revoke execute on function public.get_balance_summary(uuid[], date) from public, anon;
grant execute on function public.get_balance_summary(uuid[], date) to authenticated, service_role;
