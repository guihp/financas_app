import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Receipt,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    CalendarDays,
    CheckCircle2,
    Landmark,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { parseTransactionDate } from "@/utils/dateFilter";

interface OutletContextType {
    user: User;
    isSuperAdmin: boolean;
}

interface FaturaTransaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    credit_card_id: string;
    total_installments: number;
    installment_number: number;
    installment_group_id: string | null;
}

interface CreditCardInfo {
    id: string;
    name: string;
    closing_day: number;
    due_day: number;
    color: string;
    card_limit: number;
    bank_account_id?: string;
}

const FaturasPage = () => {
    const { toast } = useToast();
    const { user } = useOutletContext<OutletContextType>();
    const [cards, setCards] = useState<CreditCardInfo[]>([]);
    const [transactions, setTransactions] = useState<FaturaTransaction[]>([]);
    const [paidInvoices, setPaidInvoices] = useState<{ description: string; amount: number; credit_card_id?: string | null }[]>([]);
    const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return { month: now.getMonth(), year: now.getFullYear() };
    });

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState<string>("");
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("debit");
    const [paymentData, setPaymentData] = useState<{
        cardId: string;
        monthName: string;
        amount: number;
    } | null>(null);
    const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

    const loadData = async () => {
        if (allUserIds.length === 0) return;
        try {
            // Load cards
            const { data: cardsData, error: cardsError } = await supabase
                .from("credit_cards")
                .select("id, name, closing_day, due_day, color, card_limit")
                .in("user_id", allUserIds)
                .order("name");

            if (cardsError) throw cardsError;
            setCards(cardsData || []);

            // Load banks
            const { data: banksData, error: banksError } = await supabase
                .from("bank_accounts")
                .select("id, name")
                .in("user_id", allUserIds)
                .order("name");

            if (banksError) throw banksError;
            setBanks(banksData || []);

            // Load credit transactions for a wide range to cover installments
            const { data: txData, error: txError } = await supabase
                .from("transactions")
                .select(
                    "id, description, amount, date, category, credit_card_id, total_installments, installment_number, installment_group_id"
                )
                .in("user_id", allUserIds)
                .eq("payment_method", "credit")
                .not("credit_card_id", "is", null)
                .order("date", { ascending: false });

            if (txError) throw txError;
            setTransactions(txData || []);

            // Load explicit invoice payments (with amounts)
            const { data: paymentsData, error: paymentsError } = await supabase
                .from("transactions")
                .select("description, amount, credit_card_id")
                .in("user_id", allUserIds)
                .eq("category", "pagamento_fatura");

            if (paymentsError) throw paymentsError;
            setPaidInvoices(
                paymentsData?.map(p => ({
                    description: p.description || "",
                    amount: Number(p.amount) || 0,
                    credit_card_id: p.credit_card_id ?? null
                })) || []
            );
        } catch (error) {
            console.error("Error loading faturas data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id && !loadingConnections && allUserIds.length > 0) {
            loadData();
        }
    }, [user?.id, loadingConnections, allUserIds]);

    const navigateMonth = (direction: number) => {
        setSelectedMonth((prev) => {
            let newMonth = prev.month + direction;
            let newYear = prev.year;
            if (newMonth > 11) {
                newMonth = 0;
                newYear++;
            } else if (newMonth < 0) {
                newMonth = 11;
                newYear--;
            }
            return { month: newMonth, year: newYear };
        });
    };

    const monthLabel = useMemo(() => {
        const months = [
            "Janeiro",
            "Fevereiro",
            "Março",
            "Abril",
            "Maio",
            "Junho",
            "Julho",
            "Agosto",
            "Setembro",
            "Outubro",
            "Novembro",
            "Dezembro",
        ];
        return `${months[selectedMonth.month]} ${selectedMonth.year}`;
    }, [selectedMonth]);

    // Filter transactions per card by BILLING CYCLE (closing_day), not calendar month.
    // Ex: closing_day 10 → "Fatura Fevereiro" = Jan 11 to Feb 10. Expense on Jan 27 goes to Feb invoice.
    const faturasByCard = useMemo(() => {
        const result: Record<string, FaturaTransaction[]> = {};

        cards.forEach((card) => {
            const closing = card.closing_day;
            const year = selectedMonth.year;
            const month = selectedMonth.month;

            // Cycle: from (closing+1) of previous month to closing of selected month
            // e.g. Feb with closing 10: Jan 11 00:00 to Feb 10 23:59
            const cycleStart = new Date(year, month - 1, closing + 1, 0, 0, 0);
            const lastDay = new Date(year, month + 1, 0).getDate();
            const cycleEndDay = Math.min(closing, lastDay);
            const cycleEnd = new Date(year, month, cycleEndDay, 23, 59, 59);

            result[card.id] = transactions.filter((t) => {
                if (t.credit_card_id !== card.id) return false;
                const txDate = parseTransactionDate(String(t.date));
                if (Number.isNaN(txDate.getTime())) return false;
                return txDate >= cycleStart && txDate <= cycleEnd;
            });
        });

        return result;
    }, [cards, transactions, selectedMonth]);

    const faturaTotal = useMemo(() => {
        let total = 0;
        Object.values(faturasByCard).forEach((txs) => {
            txs.forEach((t) => {
                total += Number(t.amount);
            });
        });
        return total;
    }, [faturasByCard]);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);

    const getCategoryDisplayName = (category: string) => {
        const names: Record<string, string> = {
            alimentacao: "Alimentação",
            transporte: "Transporte",
            saude: "Saúde",
            lazer: "Lazer",
            educacao: "Educação",
            casa: "Casa",
            trabalho: "Trabalho",
            geral: "Geral",
        };
        return (
            names[category] ||
            category.charAt(0).toUpperCase() + category.slice(1)
        );
    };

    const [payingCardId, setPayingCardId] = useState<string | null>(null);

    const handlePayInvoice = (cardId: string, monthName: string, amount: number) => {
        if (amount <= 0) {
            toast({ title: "Fatura Zerada", description: "Não há valor para pagar nesta fatura." });
            return;
        }
        setPaymentData({ cardId, monthName, amount });
        setIsPaymentModalOpen(true);
    };

    const confirmPayment = async () => {
        if (!paymentData) return;
        if (!selectedBankId) {
            toast({ title: "Erro", description: "Selecione a conta bancária para debitar o valor.", variant: "destructive" });
            return;
        }

        setPayingCardId(paymentData.cardId);
        setIsPaymentModalOpen(false); // Fecha logo o modal pra dar feedback visual no botão atrás
        try {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const expenseDesc = `Fatura ${cards.find(c => c.id === paymentData.cardId)?.name} - ${paymentData.monthName}`;

            const { error } = await supabase.from("transactions").insert({
                user_id: user.id,
                type: "expense",
                amount: paymentData.amount,
                category: "pagamento_fatura",
                description: expenseDesc,
                date: today,
                transaction_date: today,
                payment_method: selectedPaymentMethod,
                bank_account_id: selectedBankId,
                credit_card_id: paymentData.cardId,
                total_installments: 1,
                installment_number: 1
            });

            if (error) throw error;
            setPaidInvoices(prev => [...prev, { description: expenseDesc, amount: paymentData.amount, credit_card_id: paymentData.cardId }]);
            toast({ title: "Fatura Paga", description: "✅ O valor da fatura foi debitado da sua conta bancária!" });
        } catch (err: any) {
            toast({ title: "Erro ao pagar", description: err.message, variant: "destructive" });
        } finally {
            setPayingCardId(null);
            setPaymentData(null);
            setSelectedBankId(""); // reset
            setSelectedPaymentMethod("debit");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 lg:pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                    <Receipt className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                        Faturas
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Acompanhe as faturas de cada cartão
                    </p>
                </div>
            </div>

            {/* Month Selector */}
            <div className="flex items-center justify-between bg-gradient-card border border-border rounded-xl p-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth(-1)}
                    className="h-9 w-9 p-0"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="text-center">
                    <p className="font-semibold text-lg">{monthLabel}</p>
                    <p className="text-sm text-muted-foreground">
                        Total: {formatCurrency(faturaTotal)}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth(1)}
                    className="h-9 w-9 p-0"
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            {/* Cards Empty State */}
            {cards.length === 0 ? (
                <Card className="bg-gradient-card border-border">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                            Nenhum cartão cadastrado
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Cadastre seus cartões na página de Cartões para ver as faturas
                            aqui.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {cards.map((card) => {
                        const cardTxs = faturasByCard[card.id] || [];
                        const cardTotal = cardTxs.reduce(
                            (sum, t) => sum + Number(t.amount),
                            0
                        );

                        const invoiceKey = `Fatura ${card.name} - ${monthLabel}`;
                        const totalPaid = paidInvoices
                            .filter(p => {
                                const monthMatch = p.description.endsWith(` - ${monthLabel}`) || p.description === invoiceKey;
                                const cardMatch = p.credit_card_id ? p.credit_card_id === card.id : p.description === invoiceKey;
                                return monthMatch && cardMatch;
                            })
                            .reduce((sum, p) => sum + p.amount, 0);
                        const remaining = cardTotal - totalPaid;
                        const isFullyPaid = totalPaid >= cardTotal && cardTotal > 0;
                        const isPartiallyPaid = totalPaid > 0 && totalPaid < cardTotal;

                        // Check if overdue
                        const nowDate = new Date();
                        const dueDate = new Date(selectedMonth.year, selectedMonth.month, card.due_day, 23, 59, 59);
                        const isOverdue = !isFullyPaid && cardTotal > 0 && nowDate > dueDate;

                        return (
                            <Card
                                key={card.id}
                                className="overflow-hidden border-0 shadow-lg"
                                style={{
                                    background: `linear-gradient(135deg, ${card.color}15, ${card.color}05)`,
                                    borderLeft: isOverdue ? `4px solid #ef4444` : `4px solid ${card.color}`,
                                }}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: card.color }}
                                            >
                                                <CreditCard className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{card.name}</CardTitle>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" />
                                                    Fecha dia {card.closing_day} • Vence dia{" "}
                                                    {card.due_day}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p
                                                className="text-xl font-bold"
                                                style={{ color: isOverdue ? '#ef4444' : card.color }}
                                            >
                                                {formatCurrency(cardTotal)}
                                            </p>
                                            {card.card_limit > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    de {formatCurrency(card.card_limit)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Overdue indicator */}
                                    {isOverdue && (
                                        <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium bg-red-500/10 rounded-lg px-3 py-1.5 mt-2">
                                            <span>⚠️</span>
                                            <span>Fatura vencida! Vencimento era dia {card.due_day}</span>
                                        </div>
                                    )}

                                    {/* Partial paid indicator */}
                                    {isPartiallyPaid && (
                                        <div className="text-xs text-muted-foreground mt-2 px-1">
                                            Já pago: {formatCurrency(totalPaid)} • Restante: <span className="text-orange-400 font-medium">{formatCurrency(remaining)}</span>
                                        </div>
                                    )}

                                    {/* Pay button */}
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                                        {isFullyPaid ? (
                                            <div className="w-full flex items-center justify-center gap-2 text-sm text-green-500 font-medium py-2">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Fatura Paga
                                            </div>
                                        ) : (
                                            <Button
                                                className="w-full text-xs gap-1.5 font-medium transition-all bg-green-600 hover:bg-green-700 text-white"
                                                disabled={payingCardId === card.id || cardTotal <= 0}
                                                onClick={() => handlePayInvoice(card.id, monthLabel, remaining > 0 ? remaining : cardTotal)}
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                {payingCardId === card.id
                                                    ? "Pagando..."
                                                    : isPartiallyPaid
                                                        ? `Pagar Restante (${formatCurrency(remaining)})`
                                                        : "Pagar Fatura"}
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {cardTxs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Nenhuma transação neste mês
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {cardTxs.map((tx) => (
                                                <div
                                                    key={tx.id}
                                                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium truncate">
                                                                {tx.description}
                                                            </p>
                                                            {tx.total_installments > 1 && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium whitespace-nowrap">
                                                                    {tx.installment_number}/{tx.total_installments}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {parseTransactionDate(String(tx.date)).toLocaleDateString(
                                                                "pt-BR"
                                                            )}{" "}
                                                            • {getCategoryDisplayName(tx.category)}
                                                        </p>
                                                    </div>
                                                    <p
                                                        className="text-sm font-medium ml-4"
                                                        style={{ color: card.color }}
                                                    >
                                                        {formatCurrency(Number(tx.amount))}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Payment Modal */}
            <Dialog open={isPaymentModalOpen} onOpenChange={(open) => {
                setIsPaymentModalOpen(open);
                if (!open) {
                    setSelectedBankId("");
                    setSelectedPaymentMethod("debit");
                    setPaymentData(null);
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pagar Fatura</DialogTitle>
                        <DialogDescription>
                            Selecione a conta bancária de onde o pagamento da fatura será debitado.
                            Valor: <strong className="text-foreground">{paymentData ? formatCurrency(paymentData.amount) : "R$ 0,00"}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione um banco..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {banks.map(bank => (
                                        <SelectItem key={bank.id} value={bank.id}>
                                            <div className="flex items-center gap-2">
                                                <Landmark className="w-4 h-4 text-muted-foreground" />
                                                {bank.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Método de pagamento" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="debit">Débito</SelectItem>
                                    <SelectItem value="pix">PIX</SelectItem>
                                    <SelectItem value="boleto">Boleto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={confirmPayment} disabled={!selectedBankId || !selectedPaymentMethod}>
                            Confirmar Pagamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FaturasPage;
