import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Receipt,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    CalendarDays,
} from "lucide-react";

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
}

const FaturasPage = () => {
    const { user } = useOutletContext<OutletContextType>();
    const [cards, setCards] = useState<CreditCardInfo[]>([]);
    const [transactions, setTransactions] = useState<FaturaTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return { month: now.getMonth(), year: now.getFullYear() };
    });

    const loadData = async () => {
        try {
            // Load cards
            const { data: cardsData, error: cardsError } = await supabase
                .from("credit_cards")
                .select("id, name, closing_day, due_day, color, card_limit")
                .eq("user_id", user.id)
                .order("name");

            if (cardsError) throw cardsError;
            setCards(cardsData || []);

            // Load credit transactions for a wide range to cover installments
            const { data: txData, error: txError } = await supabase
                .from("transactions")
                .select(
                    "id, description, amount, date, category, credit_card_id, total_installments, installment_number, installment_group_id"
                )
                .eq("user_id", user.id)
                .eq("payment_method", "credit")
                .not("credit_card_id", "is", null)
                .order("date", { ascending: false });

            if (txError) throw txError;
            setTransactions(txData || []);
        } catch (error) {
            console.error("Error loading faturas data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id) {
            loadData();
        }
    }, [user?.id]);

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
                const txDate = new Date(t.date + "T12:00:00");
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

                        return (
                            <Card
                                key={card.id}
                                className="overflow-hidden border-0 shadow-lg"
                                style={{
                                    background: `linear-gradient(135deg, ${card.color}15, ${card.color}05)`,
                                    borderLeft: `4px solid ${card.color}`,
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
                                                style={{ color: card.color }}
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
                                                            {new Date(tx.date + "T12:00:00").toLocaleDateString(
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
        </div>
    );
};

export default FaturasPage;
