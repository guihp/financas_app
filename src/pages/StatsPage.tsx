import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Statistics } from "@/components/Statistics";
import { supabase } from "@/integrations/supabase/client";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { filterTransactionsByDate } from "@/utils/dateFilter";
import type { DateFilterOption, DateRange } from "@/utils/dateFilter";
import { Transaction } from "@/components/Dashboard";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const StatsPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(transactions, dateFilter, dateRange),
    [transactions, dateFilter, dateRange]
  );

  useEffect(() => {
    const fetchTransactions = async () => {
      if (allUserIds.length === 0) return;
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .in("user_id", allUserIds)
          .order("date", { ascending: false });

        if (error) throw error;

        const mappedTransactions = (data || []).map(t => ({
          ...t,
          amount: Number(t.amount),
          date: t.date || t.created_at,
          type: t.type as "income" | "expense"
        }));

        setTransactions(mappedTransactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id && !loadingConnections && allUserIds.length > 0) {
      fetchTransactions();
    }
  }, [user?.id, allUserIds, loadingConnections]);

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
      <Statistics transactions={filteredTransactions} />
    </div>
  );
};

export default StatsPage;
