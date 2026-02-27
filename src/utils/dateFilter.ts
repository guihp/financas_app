/**
 * Filtra transações por período
 */
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

  if (dateFilter === "custom" && dateRange.start && dateRange.end) {
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();
    return transactions.filter((t) => {
      const txDate = new Date(t.date + (t.date.includes("T") ? "" : "T12:00:00")).getTime();
      return txDate >= startTime && txDate <= endTime;
    });
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return transactions.filter((t) => {
    const txDate = new Date(t.date + (t.date.includes("T") ? "" : "T12:00:00"));
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
