import { useEffect, useState, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Statistics } from "@/components/Statistics";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { fetchBalanceSummary } from "@/lib/balanceSummary";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { filterTransactionsByDate, getBalanceCutoff, getDateFilterBounds } from "@/utils/dateFilter";
import type { DateFilterOption, DateRange } from "@/utils/dateFilter";
import { Transaction } from "@/components/Dashboard";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const StatsPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

  // Só o período do filtro é buscado no banco (null = todo o histórico)
  const bounds = useMemo(() => getDateFilterBounds(dateFilter, dateRange), [dateFilter, dateRange]);
  const boundsKey = bounds ? `${bounds.from}|${bounds.to}` : "all";
  const balanceCutoff = useMemo(() => getBalanceCutoff(dateFilter, dateRange), [dateFilter, dateRange]);
  const cutoffKey = balanceCutoff ? balanceCutoff.getTime() : "all";

  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(transactions as any, dateFilter, dateRange) as unknown as Transaction[],
    [transactions, dateFilter, dateRange]
  );

  // Ignora respostas atrasadas ao trocar de filtro rapidamente
  const requestIdRef = useRef(0);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (allUserIds.length === 0) return;
      const requestId = ++requestIdRef.current;
      try {
        const [{ data, error }, summary] = await Promise.all([
          fetchAllRows(() => {
            let query = supabase
              .from("transactions")
              .select("*")
              .in("user_id", allUserIds);
            if (bounds) query = query.gte("date", bounds.from).lte("date", bounds.to);
            return query
              .order("date", { ascending: false })
              .order("id");
          }),
          // Saldo acumulado até o fim do período, calculado no banco
          fetchBalanceSummary(allUserIds, balanceCutoff),
        ]);

        if (error) throw error;
        if (requestId !== requestIdRef.current) return;

        const mappedTransactions = (data || []).map(t => ({
          ...t,
          category: t.category?.toLowerCase() || "",
          amount: Number(t.amount),
          date: t.date || t.created_at,
          type: t.type as "income" | "expense",
          payment_method: t.payment_method
        })) as unknown as Transaction[];

        setTransactions(mappedTransactions);
        setBalance(summary.total);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id && !loadingConnections && allUserIds.length > 0) {
      fetchTransactions();
    }
  }, [user?.id, allUserIds, loadingConnections, boundsKey, cutoffKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Estatísticas</h1>
        <DateRangeFilter
          value={dateFilter}
          dateRange={dateRange}
          onValueChange={setDateFilter}
          onDateRangeChange={setDateRange}
        />
      </div>
      <Statistics
        transactions={filteredTransactions}
        balance={balance}
        dateFilter={dateFilter}
        dateRange={dateRange}
      />
    </div>
  );
};

export default StatsPage;
