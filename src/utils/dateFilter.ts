/**
 * Filtra transações por período
 */

/** Parse seguro: datas só YYYY-MM-DD ganham T12:00:00; ISO com "T" não recebe sufixo (evita data inválida e saldo errado). */
export function parseTransactionDate(value: string | Date | null | undefined): Date {
  if (value == null || value === "") return new Date(NaN);
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s) return new Date(NaN);
  if (s.includes("T")) return new Date(s);
  return new Date(`${s}T12:00:00`);
}

export type DateFilterOption = "thisMonth" | "lastMonth" | "all" | "custom";

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export function filterTransactionsByDate<T extends { date: string }>(
  transactions: T[],
  dateFilter: DateFilterOption,
  dateRange: DateRange
): T[] {
  if (dateFilter === "all") return transactions;

  if (dateFilter === "custom") {
    if (!dateRange.start || !dateRange.end) return [];
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();
    return transactions.filter((t) => {
      const txDate = parseTransactionDate(String(t.date)).getTime();
      return txDate >= startTime && txDate <= endTime;
    });
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return transactions.filter((t) => {
    const txDate = parseTransactionDate(String(t.date));
    const txMonth = txDate.getMonth();
    const txYear = txDate.getFullYear();

    if (dateFilter === "thisMonth") {
      return txMonth === currentMonth && txYear === currentYear;
    }
    if (dateFilter === "lastMonth") {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return txMonth === lastMonth && txYear === lastMonthYear;
    }
    return true;
  });
}
