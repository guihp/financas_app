import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { TransactionList } from "@/components/TransactionList";
import { AddTransactionFab } from "@/components/AddTransactionFab";
import { TransactionChart } from "@/components/TransactionChart";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { TransactionPieChart } from "@/components/PieChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { filterTransactionsByDate } from "@/utils/dateFilter";
import type { DateFilterOption, DateRange } from "@/utils/dateFilter";
import { TrendingUp, TrendingDown, Wallet, Plus, Receipt, CheckCircle2, AlertTriangle, CreditCard } from "lucide-react";
import { Transaction } from "@/components/Dashboard";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface CreditCardInfo {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  card_limit: number;
  color: string;
}

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const DashPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardInfo[]>([]);
  const [paidInvoiceDescs, setPaidInvoiceDescs] = useState<{ description: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("thisMonth");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

  const loadTransactions = async () => {
    if (allUserIds.length === 0) return;
    try {
      // Load transactions
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
        type: t.type as "income" | "expense",
        payment_method: t.payment_method,
        credit_card_id: t.credit_card_id,
        total_installments: t.total_installments,
        installment_number: t.installment_number,
        installment_group_id: t.installment_group_id,
      }));
      setTransactions(mapped);

      // Load credit cards
      const { data: cardsData } = await supabase
        .from("credit_cards")
        .select("id, name, closing_day, due_day, card_limit, color")
        .in("user_id", allUserIds)
        .order("name");
      setCreditCards(cardsData || []);

      // Load paid invoice descriptions with amounts
      const { data: paidData } = await supabase
        .from("transactions")
        .select("description, amount")
        .in("user_id", allUserIds)
        .eq("payment_method", "debit")
        .like("description", "Fatura %");
      setPaidInvoiceDescs(
        paidData?.map(p => ({
          description: p.description || "",
          amount: Number(p.amount) || 0
        })) || []
      );
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
    () => filterTransactionsByDate(transactions, dateFilter, dateRange) as Transaction[],
    [transactions, dateFilter, dateRange]
  );

  // Filtro puro para exibição visual (Pizza, Barras, TotalExpense e Income), ignorando duplicidades
  const validDisplayTransactions = useMemo(() => {
    return filteredTransactions.filter(t => 
      t.category !== "transferencia" && t.category !== "pagamento_fatura"
    );
  }, [filteredTransactions]);

  const totalIncome = validDisplayTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Expenses from debit/PIX (affects balance, so we keep using filteredTransactions)
  const totalExpenseDebitPix = (filteredTransactions as Transaction[])
    .filter((t) => t.type === "expense" && t.payment_method !== "credit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // All expenses (for display)
  const totalExpense = validDisplayTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Global Balance: Saldo deve ser global (todo o tempo), não resetar quando vira o mês
  const globalValidTransactions = transactions.filter(t => 
    t.category !== "transferencia" && t.category !== "pagamento_fatura"
  );
  
  const globalTotalIncome = globalValidTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const globalTotalExpenseDebitPix = (transactions as Transaction[])
    .filter((t) => t.type === "expense" && t.payment_method !== "credit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = globalTotalIncome - globalTotalExpenseDebitPix;

  // Credit expenses (faturas) — calculado por ciclo de fechamento baseado no filtro
  const now = new Date();
  const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Determine which month/year to show faturas for based on the filter
  const targetDate = useMemo(() => {
    if (dateFilter === "lastMonth") {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    if (dateFilter === "custom" && dateRange.start) {
      return dateRange.start;
    }
    // "thisMonth" or "all" → use current month
    return new Date();
  }, [dateFilter, dateRange.start]);

  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  const targetMonthLabel = `${MONTH_NAMES[targetMonth]} ${targetYear}`;

  const faturasPerCard = useMemo(() => {
    return creditCards.map(card => {
      const closing = card.closing_day;
      // Cycle: from (closing+1) of previous month to closing of target month
      const cycleStart = new Date(targetYear, targetMonth - 1, closing + 1, 0, 0, 0);
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      const cycleEndDay = Math.min(closing, lastDay);
      const cycleEnd = new Date(targetYear, targetMonth, cycleEndDay, 23, 59, 59);

      const cardTxs = transactions.filter(t => {
        if (t.credit_card_id !== card.id || t.payment_method !== 'credit') return false;
        const txDate = new Date(String(t.date) + 'T12:00:00');
        return txDate >= cycleStart && txDate <= cycleEnd;
      });

      const total = cardTxs.reduce((sum, t) => sum + Number(t.amount), 0);

      // Calculate total paid for this invoice
      const invoiceKey = `Fatura ${card.name} - ${targetMonthLabel}`;
      const totalPaid = paidInvoiceDescs
        .filter(p => p.description === invoiceKey)
        .reduce((sum, p) => sum + p.amount, 0);
      const remaining = total - totalPaid;
      const isPaid = totalPaid >= total && total > 0;

      // Check if overdue: due_day of target month has passed and not fully paid
      const dueDate = new Date(targetYear, targetMonth, card.due_day, 23, 59, 59);
      const isOverdue = !isPaid && total > 0 && now > dueDate;

      return { card, total, isPaid, isOverdue, txCount: cardTxs.length, remaining: remaining > 0 ? remaining : 0 };
    });
  }, [creditCards, transactions, paidInvoiceDescs, targetMonth, targetYear, targetMonthLabel]);

  const totalFaturas = faturasPerCard.reduce((sum, f) => sum + f.total, 0);
  const totalFaturasAbertas = faturasPerCard.filter(f => !f.isPaid).reduce((sum, f) => sum + f.remaining, 0);
  const allPaid = faturasPerCard.length > 0 && faturasPerCard.every(f => f.isPaid || f.total === 0);
  const allZero = faturasPerCard.length > 0 && faturasPerCard.every(f => f.total === 0);
  const hasOverdue = faturasPerCard.some(f => f.isOverdue);

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
    <div className="space-y-4 md:space-y-6 pb-24 lg:pb-6">
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
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

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
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
            <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5">
              Débito + PIX
            </p>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-card border-border cursor-pointer hover:shadow-md transition-shadow"
          style={{ borderLeft: hasOverdue ? '3px solid #ef4444' : totalFaturas > 0 ? '3px solid #a855f7' : undefined }}
          onClick={() => navigate('/faturas')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Faturas
            </CardTitle>
            <Receipt className={`h-3 w-3 sm:h-4 sm:w-4 ${hasOverdue ? 'text-red-500' : 'text-purple-500'}`} />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className={`text-sm sm:text-2xl font-bold ${allPaid ? 'text-green-500' : hasOverdue ? 'text-red-500' : 'text-purple-500'}`}>
              {allPaid ? formatCurrency(0) : formatCurrency(totalFaturasAbertas)}
            </div>
            {/* Status line */}
            {allZero ? (
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="text-[9px] sm:text-xs text-emerald-500 font-medium">Faturas zeradas</span>
              </div>
            ) : allPaid ? (
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="text-[9px] sm:text-xs text-green-500 font-medium">Tudo pago</span>
              </div>
            ) : hasOverdue ? (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <span className="text-[9px] sm:text-xs text-red-500 font-medium">Fatura vencida!</span>
              </div>
            ) : (
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5">
                Em aberto
              </p>
            )}
            {/* Mini card breakdown */}
            {faturasPerCard.length > 0 && (
              <div className="mt-2 space-y-1 hidden sm:block">
                {faturasPerCard.filter(f => f.total > 0).map(f => (
                  <div key={f.card.id} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.card.color }} />
                      <span className="text-muted-foreground truncate">{f.card.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className={f.isPaid ? 'text-green-500 line-through' : f.isOverdue ? 'text-red-500 font-semibold' : 'text-foreground'}>
                        {formatCurrency(f.total)}
                      </span>
                      {f.isPaid && <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />}
                      {f.isOverdue && <AlertTriangle className="h-2.5 w-2.5 text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <TransactionPieChart transactions={validDisplayTransactions} type="expenses" />
          </CardContent>
        </Card>

        {/* Bar Chart - Visão Geral */}
        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Visão Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionChart transactions={validDisplayTransactions} />
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
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default DashPage;

