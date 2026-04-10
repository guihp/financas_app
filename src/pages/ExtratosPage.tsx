import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { TransactionList } from "@/components/TransactionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { filterTransactionsByDate } from "@/utils/dateFilter";
import type { DateFilterOption, DateRange } from "@/utils/dateFilter";
import { Building2, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { Transaction } from "@/components/Dashboard";

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface OutletContextType {
    user: User;
    isSuperAdmin: boolean;
}

const ExtratosPage = () => {
    const { user } = useOutletContext<OutletContextType>();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [banks, setBanks] = useState<{ id: string, name: string, color: string }[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [dateFilter, setDateFilter] = useState<DateFilterOption>("thisMonth");
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
    const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

    const loadInitialData = async () => {
        if (!user?.id || allUserIds.length === 0) return;
        try {
            setLoading(true);
            // Load Banks
            const { data: banksData, error: banksError } = await supabase
                .from("bank_accounts")
                .select("id, name, color")
                .in("user_id", allUserIds)
                .order("name");

            if (banksError) throw banksError;

            const loadedBanks = banksData || [];
            setBanks(loadedBanks);
            if (loadedBanks.length > 0 && !selectedBankId) {
                setSelectedBankId(loadedBanks[0].id);
            }

            // Load all transactions for all connected users so we can calculate balances
            const { data: transData, error: transError } = await supabase
                .from("transactions")
                .select("*")
                .in("user_id", allUserIds)
                .not("bank_account_id", "is", null)
                .order("date", { ascending: false });

            if (transError) throw transError;

            const mapped = (transData || []).map((t: any) => ({
                ...t,
                amount: Number(t.amount),
                date: t.date || t.created_at,
                type: t.type as "income" | "expense"
            }));
            setTransactions(mapped);
        } catch (error) {
            console.error("Error loading extratos data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id && !loadingConnections && allUserIds.length > 0) {
            loadInitialData();
        }
    }, [user?.id, allUserIds, loadingConnections]);

    // Derived state for the selected bank
    const selectedBank = banks.find(b => b.id === selectedBankId);

    // Filter transactions exactly for the selected bank
    const bankTransactions = useMemo(() => {
        if (!selectedBankId) return [];
        return transactions.filter(t => t.bank_account_id === selectedBankId);
    }, [transactions, selectedBankId]);

    // General Balance for the selected bank (All time, all transactions)
    const bankTotalBalance = useMemo(() => {
        return bankTransactions.reduce((acc, t) => {
            if (t.type === "income" && t.category !== "pagamento_fatura") return acc + t.amount;
            if (t.type === "expense" && t.payment_method !== "credit") return acc - t.amount;
            return acc;
        }, 0);
    }, [bankTransactions]);

    // Transactions filtered by DATE for the UI List
    const periodTransactions = useMemo(() => {
        return filterTransactionsByDate(bankTransactions as any, dateFilter, dateRange) as Transaction[];
    }, [bankTransactions, dateFilter, dateRange]);

    // Period Summary (Income/Expense in the selected month/period)
    const periodSummary = useMemo(() => {
        let income = 0;
        let expense = 0;
        periodTransactions.forEach(t => {
            if (t.type === "income" && t.category !== "pagamento_fatura") income += t.amount;
            if (t.type === "expense" && t.payment_method !== "credit") expense += t.amount;
        });
        return { income, expense };
    }, [periodTransactions]);

    if (loading && banks.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-32 lg:pb-6">
            {/* Header and Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                        <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Extratos Bancários</h1>
                        <p className="text-sm text-muted-foreground">Acompanhe as movimentações por conta</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <DateRangeFilter
                        value={dateFilter}
                        dateRange={dateRange}
                        onValueChange={setDateFilter}
                        onDateRangeChange={setDateRange}
                    />
                </div>
            </div>

            {banks.length === 0 ? (
                <Card className="bg-gradient-card border-border">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <Building2 className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Nenhuma conta encontrada</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Você ainda não possui contas bancárias cadastradas. Vá em Bancos e Cartões para criar uma.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Bank Selector (Horizontal Scroll) */}
                    <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 gap-3 no-scrollbar snap-x">
                        {banks.map(bank => (
                            <button
                                key={bank.id}
                                onClick={() => setSelectedBankId(bank.id)}
                                className={`snap-start min-w-[140px] flex-shrink-0 flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedBankId === bank.id
                                    ? "border-primary bg-primary/10 shadow-sm"
                                    : "border-border bg-card hover:bg-muted/50"
                                    }`}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: bank.color }}
                                >
                                    <Building2 className="h-4 w-4 text-white" />
                                </div>
                                <div className="text-left overflow-hidden">
                                    <p className="text-sm font-semibold truncate text-foreground leading-tight">
                                        {bank.name}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Selected Bank View */}
                    {selectedBank && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-gradient-card border-border relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 rounded-xl relative z-10">
                                            <Wallet className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-sm text-muted-foreground mb-1">Saldo Geral da Conta</p>
                                            <h3 className={`text-2xl font-bold ${bankTotalBalance >= 0 ? "text-foreground" : "text-destructive"}`}>
                                                {formatCurrency(bankTotalBalance)}
                                            </h3>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-gradient-card border-border relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-success/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="p-3 bg-success/10 rounded-xl relative z-10">
                                            <ArrowUpCircle className="w-6 h-6 text-success" />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-sm text-muted-foreground mb-1">Entradas (Período)</p>
                                            <h3 className="text-2xl font-bold text-success">
                                                {formatCurrency(periodSummary.income)}
                                            </h3>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-gradient-card border-border relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="p-3 bg-destructive/10 rounded-xl relative z-10">
                                            <ArrowDownCircle className="w-6 h-6 text-destructive" />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-sm text-muted-foreground mb-1">Saídas (Período)</p>
                                            <h3 className="text-2xl font-bold text-destructive">
                                                {formatCurrency(periodSummary.expense)}
                                            </h3>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Transaction List */}
                            <Card className="bg-gradient-card border-border">
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Extrato Autêntico - {selectedBank.name}
                                        <span className="text-sm font-normal text-muted-foreground ml-2">
                                            ({periodTransactions.length} movimentações no período)
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {periodTransactions.length === 0 ? (
                                        <div className="text-center py-10">
                                            <p className="text-muted-foreground">
                                                Nenhuma movimentação encontrada para esta conta no período selecionado.
                                            </p>
                                        </div>
                                    ) : (
                                        <TransactionList
                                            transactions={periodTransactions}
                                            showAll={true}
                                            onTransactionDeleted={loadInitialData}
                                            currentUserId={user.id}
                                        />
                                    )}
                                </CardContent>
                            </Card>

                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ExtratosPage;
