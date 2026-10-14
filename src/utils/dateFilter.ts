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

const pad2 = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Intervalo (YYYY-MM-DD, inclusivo) do filtro, para buscar só o período no banco.
 * null = sem limite ("all"). Custom incompleto devolve um intervalo vazio.
 */
export function getDateFilterBounds(
  dateFilter: DateFilterOption,
  dateRange: DateRange
): { from: string; to: string } | null {
  if (dateFilter === "all") return null;

  if (dateFilter === "custom") {
    if (!dateRange.start || !dateRange.end) return { from: "9999-12-31", to: "0001-01-01" };
    return { from: toYmd(dateRange.start), to: toYmd(dateRange.end) };
  }

  const now = new Date();
  const offset = dateFilter === "lastMonth" ? -1 : 0;
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: toYmd(first), to: toYmd(last) };
}

/**
 * Data de corte do saldo acumulado: "este mês" → fim do mês atual, "mês passado" →
 * fim do mês passado, custom → fim do período, "all" → sem corte (null).
 */
export function getBalanceCutoff(dateFilter: DateFilterOption, dateRange: DateRange): Date | null {
  if (dateFilter === "all") return null;

  if (dateFilter === "lastMonth") {
    return new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999);
  }

  if (dateFilter === "custom") {
    const ref = dateRange.end ?? dateRange.start;
    if (ref) return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  }

  return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);
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
