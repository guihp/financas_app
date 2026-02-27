import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { TransactionList } from "@/components/TransactionList";
import { AddTransactionFab } from "@/components/AddTransactionFab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { filterTransactionsByDate } from "@/utils/dateFilter";
import type { DateFilterOption, DateRange } from "@/utils/dateFilter";
import { Plus } from "lucide-react";
import { Transaction } from "@/components/Dashboard";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const TransactionsPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

  const loadTransactions = async () => {
    if (allUserIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("user_id", allUserIds)
        .order("date", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(t => ({
        ...t,
        amount: Number(t.amount),
        date: t.date || t.created_at,
        type: t.type as "income" | "expense"
      }));
      setTransactions(mapped);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && !loadingConnections && allUserIds.length > 0) {
      loadTransactions();
    }
  }, [user?.id, allUserIds, loadingConnections]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(transactions, dateFilter, dateRange),
    [transactions, dateFilter, dateRange]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Transações</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            value={dateFilter}
            dateRange={dateRange}
            onValueChange={setDateFilter}
            onDateRangeChange={setDateRange}
          />
          <Button onClick={() => setShowAddDialog(true)} className="gap-2 h-8 sm:h-9">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Transação</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      <AddTransactionFab
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onTransactionAdded={loadTransactions}
      />

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>
            {dateFilter === "thisMonth" && "Transações deste mês"}
            {dateFilter === "lastMonth" && "Transações do mês passado"}
            {dateFilter === "all" && "Todas as Transações"}
            {dateFilter === "custom" && "Transações do período"}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({filteredTransactions.length} {filteredTransactions.length === 1 ? "transação" : "transações"})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma transação encontrada para o período selecionado.
            </p>
          ) : (
            <TransactionList
              transactions={filteredTransactions}
              showAll={true}
              onTransactionDeleted={loadTransactions}
              currentUserId={user.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsPage;
