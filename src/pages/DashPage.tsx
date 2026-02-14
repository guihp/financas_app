import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { TransactionList } from "@/components/TransactionList";
import { AddTransactionFab } from "@/components/AddTransactionFab";
import { TransactionChart } from "@/components/TransactionChart";
import { TransactionPieChart } from "@/components/PieChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, Plus, Filter } from "lucide-react";
import { Transaction } from "@/components/Dashboard";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

type DateFilterOption = "thisMonth" | "lastMonth" | "all";

const DashPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("thisMonth");

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
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
    if (user?.id) {
      loadTransactions();
    }
  }, [user?.id]);

  // Filtered transactions based on date filter
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (dateFilter === "all") {
      return transactions;
    }

    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const transactionMonth = transactionDate.getMonth();
      const transactionYear = transactionDate.getFullYear();

      if (dateFilter === "thisMonth") {
        return transactionMonth === currentMonth && transactionYear === currentYear;
      } else if (dateFilter === "lastMonth") {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return transactionMonth === lastMonth && transactionYear === lastMonthYear;
      }
      return true;
    });
  }, [transactions, dateFilter]);

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpense;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-24 xl:pb-6">
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <Filter className="h-4 w-4 text-muted-foreground ml-2" />
            <Button
              variant={dateFilter === "thisMonth" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDateFilter("thisMonth")}
            >
              Este Mês
            </Button>
            <Button
              variant={dateFilter === "lastMonth" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDateFilter("lastMonth")}
            >
              Mês Passado
            </Button>
            <Button
              variant={dateFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDateFilter("all")}
            >
              Todos
            </Button>
          </div>
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

      {/* Cards de Resumo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-gradient-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Receitas
            </CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-sm sm:text-2xl font-bold text-green-500">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Despesas
            </CardTitle>
            <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-sm sm:text-2xl font-bold text-red-500">
              {formatCurrency(totalExpense)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Saldo
            </CardTitle>
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className={`text-sm sm:text-2xl font-bold ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart - Gastos por Categoria */}
        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionPieChart transactions={filteredTransactions} type="expenses" />
          </CardContent>
        </Card>

        {/* Bar Chart - Visão Geral */}
        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Visão Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionChart transactions={filteredTransactions} />
          </CardContent>
        </Card>
      </div>

      {/* Últimas Transações */}
      <Card className="bg-gradient-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Últimas Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList
            transactions={filteredTransactions.slice(0, 10)}
            onTransactionDeleted={loadTransactions}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default DashPage;

