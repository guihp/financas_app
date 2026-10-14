import { supabase } from "@/integrations/supabase/client";

export interface BalanceSummary {
  /** Saldo somando todas as transações (com e sem banco). */
  total: number;
  /** Saldo por conta bancária (id do banco → saldo). */
  byBank: Record<string, number>;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local em YYYY-MM-DD (evita o deslocamento de fuso do toISOString). */
export const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Saldo calculado no banco pela RPC get_balance_summary — fonte única da regra
 * (+ receitas exceto pagamento_fatura, − despesas exceto crédito), sem o limite
 * de 1000 linhas de quando o saldo era somado no navegador.
 * `until` limita às transações até essa data (inclusive).
 */
export async function fetchBalanceSummary(
  userIds: string[],
  until?: Date | null
): Promise<BalanceSummary> {
  const { data, error } = await supabase.rpc("get_balance_summary", {
    p_user_ids: userIds,
    p_until: until ? toLocalDateString(until) : null,
  });
  if (error) throw error;

  const byBank: Record<string, number> = {};
  let total = 0;
  for (const row of (data ?? []) as { bank_account_id: string | null; balance: number | string }[]) {
    const balance = Number(row.balance) || 0;
    total += balance;
    if (row.bank_account_id) byBank[row.bank_account_id] = balance;
  }
  return { total, byBank };
}
