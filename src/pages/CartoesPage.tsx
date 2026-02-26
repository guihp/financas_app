import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreditCard, Plus, Edit, Trash2, Landmark, Building2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BANK_PRESETS } from "@/constants/financialData";

interface OutletContextType {
    user: User;
    isSuperAdmin: boolean;
}

export interface CreditCardType {
    id: string;
    user_id: string;
    name: string;
    closing_day: number;
    due_day: number;
    card_limit: number;
    color: string;
    created_at: string;
    updated_at: string;
}

export interface BankAccountType {
    id: string;
    user_id: string;
    name: string;
    color: string;
    created_at: string;
    updated_at: string;
}

const CARD_COLORS = [
    "#8B5CF6", "#F97316", "#3B82F6", "#EF4444", "#10B981",
    "#F59E0B", "#EC4899", "#6366F1", "#14B8A6", "#64748B",
];

const CartoesPage = () => {
    const { user } = useOutletContext<OutletContextType>();
    const [cards, setCards] = useState<CreditCardType[]>([]);
    const [banks, setBanks] = useState<BankAccountType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCardDialog, setShowCardDialog] = useState(false);
    const [showBankDialog, setShowBankDialog] = useState(false);
    const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
    const [editingBank, setEditingBank] = useState<BankAccountType | null>(null);
    const [faturasTotals, setFaturasTotals] = useState<Record<string, number>>({});
    const { toast } = useToast();

    // Card form state
    const [formName, setFormName] = useState("");
    const [formClosingDay, setFormClosingDay] = useState("5");
    const [formDueDay, setFormDueDay] = useState("15");
    const [formLimit, setFormLimit] = useState("");
    const [formColor, setFormColor] = useState(CARD_COLORS[0]);
    const [submitting, setSubmitting] = useState(false);

    // Bank form state
    const [bankFormName, setBankFormName] = useState("");
    const [bankFormColor, setBankFormColor] = useState(CARD_COLORS[2]);

    const loadCards = async () => {
        try {
            const { data, error } = await supabase
                .from("credit_cards")
                .select("*")
                .eq("user_id", user.id)
                .order("name");
            if (error) throw error;
            setCards((data as CreditCardType[]) || []);
        } catch (error) {
            console.error("Error loading cards:", error);
        }
    };

    const loadBanks = async () => {
        try {
            const { data, error } = await supabase
                .from("bank_accounts")
                .select("*")
                .eq("user_id", user.id)
                .order("name");
            if (error) throw error;
            setBanks((data as BankAccountType[]) || []);
        } catch (error) {
            console.error("Error loading banks:", error);
        }
    };

    const loadFaturasTotals = async () => {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

            const { data, error } = await supabase
                .from("transactions")
                .select("credit_card_id, amount")
                .eq("user_id", user.id)
                .eq("payment_method", "credit")
                .gte("date", startOfMonth)
                .lte("date", endOfMonth);

            if (error) throw error;
            const totals: Record<string, number> = {};
            (data || []).forEach((t: any) => {
                if (t.credit_card_id) {
                    totals[t.credit_card_id] = (totals[t.credit_card_id] || 0) + Number(t.amount);
                }
            });
            setFaturasTotals(totals);
        } catch (error) {
            console.error("Error loading faturas totals:", error);
        }
    };

    useEffect(() => {
        if (user?.id) {
            Promise.all([loadCards(), loadBanks(), loadFaturasTotals()]).finally(() => setLoading(false));
        }
    }, [user?.id]);

    // ---- Credit Card helpers ----
    const resetCardForm = () => {
        setFormName(""); setFormClosingDay("5"); setFormDueDay("15"); setFormLimit(""); setFormColor(CARD_COLORS[0]); setEditingCard(null);
    };

    const openEditCardDialog = (card: CreditCardType) => {
        setEditingCard(card); setFormName(card.name); setFormClosingDay(String(card.closing_day));
        setFormDueDay(String(card.due_day)); setFormLimit(card.card_limit ? String(card.card_limit) : "");
        setFormColor(card.color || CARD_COLORS[0]); setShowCardDialog(true);
    };

    const handleSubmitCard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) { toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" }); return; }
        const closingDay = parseInt(formClosingDay);
        const dueDay = parseInt(formDueDay);
        if (isNaN(closingDay) || closingDay < 1 || closingDay > 31 || isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
            toast({ title: "Erro", description: "Dias devem ser entre 1 e 31", variant: "destructive" }); return;
        }
        setSubmitting(true);
        try {
            const cardData = { name: formName.trim(), closing_day: closingDay, due_day: dueDay, card_limit: formLimit ? parseFloat(formLimit.replace(",", ".")) : 0, color: formColor, user_id: user.id };
            if (editingCard) {
                const { error } = await supabase.from("credit_cards").update(cardData).eq("id", editingCard.id).eq("user_id", user.id);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Cartão atualizado!" });
            } else {
                const { error } = await supabase.from("credit_cards").insert(cardData);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Cartão adicionado!" });
            }
            resetCardForm(); setShowCardDialog(false); loadCards();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Erro ao salvar", variant: "destructive" });
        } finally { setSubmitting(false); }
    };

    const handleDeleteCard = async (cardId: string) => {
        try {
            const { error } = await supabase.from("credit_cards").delete().eq("id", cardId).eq("user_id", user.id);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Cartão excluído!" }); loadCards();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Erro ao excluir", variant: "destructive" });
        }
    };

    // ---- Bank Account helpers ----
    const resetBankForm = () => {
        setBankFormName(""); setBankFormColor(CARD_COLORS[2]); setEditingBank(null);
    };

    const openEditBankDialog = (bank: BankAccountType) => {
        setEditingBank(bank); setBankFormName(bank.name); setBankFormColor(bank.color || CARD_COLORS[2]); setShowBankDialog(true);
    };

    const handleSubmitBank = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bankFormName.trim()) { toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" }); return; }
        setSubmitting(true);
        try {
            const bankData = { name: bankFormName.trim(), color: bankFormColor, user_id: user.id };
            if (editingBank) {
                const { error } = await supabase.from("bank_accounts").update(bankData).eq("id", editingBank.id).eq("user_id", user.id);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Banco atualizado!" });
            } else {
                const { error } = await supabase.from("bank_accounts").insert(bankData);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Banco adicionado!" });
            }
            resetBankForm(); setShowBankDialog(false); loadBanks();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Erro ao salvar", variant: "destructive" });
        } finally { setSubmitting(false); }
    };

    const handleDeleteBank = async (bankId: string) => {
        try {
            const { error } = await supabase.from("bank_accounts").delete().eq("id", bankId).eq("user_id", user.id);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Banco excluído!" }); loadBanks();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Erro ao excluir", variant: "destructive" });
        }
    };

    // Quick-add a preset bank
    const handleQuickAddBank = async (preset: typeof BANK_PRESETS[0]) => {
        setSubmitting(true);
        try {
            const { error } = await supabase.from("bank_accounts").insert({
                name: preset.name, color: preset.color, user_id: user.id,
            });
            if (error) throw error;
            toast({ title: "Sucesso", description: `${preset.name} adicionado!` });
            loadBanks();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Erro ao adicionar", variant: "destructive" });
        } finally { setSubmitting(false); }
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

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
                    <Landmark className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bancos e Cartões</h1>
                    <p className="text-sm text-muted-foreground">Gerencie suas contas bancárias e cartões de crédito</p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="banks" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="banks" className="gap-2">
                        <Building2 className="h-4 w-4" />
                        Contas Bancárias
                    </TabsTrigger>
                    <TabsTrigger value="cards" className="gap-2">
                        <CreditCard className="h-4 w-4" />
                        Cartões de Crédito
                    </TabsTrigger>
                </TabsList>

                {/* =============== BANK ACCOUNTS TAB =============== */}
                <TabsContent value="banks" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => { resetBankForm(); setShowBankDialog(true); }} className="gap-2">
                            <Plus className="h-4 w-4" /> Novo Banco
                        </Button>
                    </div>

                    {banks.length === 0 ? (
                        <Card className="bg-gradient-card border-border">
                            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="p-4 bg-muted/50 rounded-full mb-4"><Building2 className="h-10 w-10 text-muted-foreground" /></div>
                                <h3 className="text-lg font-semibold mb-2">Nenhum banco cadastrado</h3>
                                <p className="text-sm text-muted-foreground mb-4 max-w-md">Adicione rapidamente clicando em um banco abaixo, ou crie manualmente.</p>
                            </CardContent>
                        </Card>
                    ) : null}

                    {/* Preset Banks Quick-Add */}
                    {(() => {
                        const availablePresets = BANK_PRESETS.filter(p => !banks.find(b => b.name === p.name));
                        if (availablePresets.length === 0) return null;
                        return (
                            <div>
                                <p className="text-sm text-muted-foreground mb-3">Adicionar rapidamente:</p>
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                    {availablePresets.map((preset) => (
                                        <button
                                            key={preset.name}
                                            onClick={() => handleQuickAddBank(preset)}
                                            disabled={submitting}
                                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/50 transition-all disabled:opacity-50"
                                        >
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                                                style={{ backgroundColor: preset.color }}
                                            >
                                                {preset.initials}
                                            </div>
                                            <span className="text-[10px] text-center font-medium text-muted-foreground leading-tight">
                                                {preset.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Already added banks */}
                    {banks.length > 0 && (
                        <>
                            <p className="text-sm text-muted-foreground mt-2">Seus bancos:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {banks.map((bank) => (
                                    <Card key={bank.id} className="overflow-hidden border-0 shadow-lg relative group" style={{ background: `linear-gradient(135deg, ${bank.color}22, ${bank.color}08)`, borderLeft: `4px solid ${bank.color}` }}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: bank.color }}>
                                                        <Building2 className="h-5 w-5 text-white" />
                                                    </div>
                                                    <CardTitle className="text-lg">{bank.name}</CardTitle>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditBankDialog(bank)}><Edit className="h-3.5 w-3.5" /></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Excluir banco</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir "{bank.name}"?</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBank(bank.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </TabsContent>

                {/* =============== CREDIT CARDS TAB =============== */}
                <TabsContent value="cards" className="space-y-4">
                    <div className="flex justify-end">
                        <Button onClick={() => { resetCardForm(); setShowCardDialog(true); }} className="gap-2">
                            <Plus className="h-4 w-4" /> Novo Cartão
                        </Button>
                    </div>

                    {cards.length === 0 ? (
                        <Card className="bg-gradient-card border-border">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="p-4 bg-muted/50 rounded-full mb-4"><CreditCard className="h-10 w-10 text-muted-foreground" /></div>
                                <h3 className="text-lg font-semibold mb-2">Nenhum cartão cadastrado</h3>
                                <p className="text-sm text-muted-foreground mb-4 max-w-md">Cadastre seus cartões de crédito para controlar as faturas de cada banco.</p>
                                <Button onClick={() => { resetCardForm(); setShowCardDialog(true); }} className="gap-2"><Plus className="h-4 w-4" />Cadastrar Cartão</Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cards.map((card) => (
                                <Card key={card.id} className="overflow-hidden border-0 shadow-lg relative group" style={{ background: `linear-gradient(135deg, ${card.color}22, ${card.color}08)`, borderLeft: `4px solid ${card.color}` }}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ backgroundColor: card.color }}>
                                                    <CreditCard className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{card.name}</CardTitle>
                                                    <p className="text-xs text-muted-foreground">Fecha dia {card.closing_day} • Vence dia {card.due_day}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditCardDialog(card)}><Edit className="h-3.5 w-3.5" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Excluir cartão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir "{card.name}"?</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCard(card.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Fatura Atual</p>
                                                <p className="text-2xl font-bold" style={{ color: card.color }}>{formatCurrency(faturasTotals[card.id] || 0)}</p>
                                            </div>
                                            {card.card_limit > 0 && (
                                                <div>
                                                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                        <span>Limite utilizado</span>
                                                        <span>{formatCurrency(faturasTotals[card.id] || 0)} / {formatCurrency(card.card_limit)}</span>
                                                    </div>
                                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(((faturasTotals[card.id] || 0) / card.card_limit) * 100, 100)}%`, backgroundColor: card.color }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* =============== BANK ACCOUNT DIALOG =============== */}
            <Dialog open={showBankDialog} onOpenChange={(open) => { setShowBankDialog(open); if (!open) resetBankForm(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingBank ? "Editar Banco" : "Novo Banco"}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmitBank} className="space-y-4">
                        <div>
                            <Label htmlFor="bank-name" className="text-sm font-medium">Nome do Banco</Label>
                            <Input id="bank-name" placeholder="Ex: Nubank, Itaú, Inter..." value={bankFormName} onChange={(e) => setBankFormName(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-sm font-medium">Cor</Label>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {CARD_COLORS.map((color) => (
                                    <button key={color} type="button" className={`w-8 h-8 rounded-full transition-all ${bankFormColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"}`} style={{ backgroundColor: color }} onClick={() => setBankFormColor(color)} />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => { setShowBankDialog(false); resetBankForm(); }} className="flex-1" disabled={submitting}>Cancelar</Button>
                            <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? "Salvando..." : editingBank ? "Salvar" : "Adicionar"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* =============== CREDIT CARD DIALOG =============== */}
            <Dialog open={showCardDialog} onOpenChange={(open) => { setShowCardDialog(open); if (!open) resetCardForm(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingCard ? "Editar Cartão" : "Novo Cartão de Crédito"}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmitCard} className="space-y-4">
                        <div>
                            <Label htmlFor="card-name" className="text-sm font-medium">Nome do Banco/Cartão</Label>
                            <Input id="card-name" placeholder="Ex: Nubank, Itaú, Inter..." value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="closing-day" className="text-sm font-medium">Dia de Fechamento</Label>
                                <Input id="closing-day" type="number" min="1" max="31" value={formClosingDay} onChange={(e) => setFormClosingDay(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <Label htmlFor="due-day" className="text-sm font-medium">Dia de Vencimento</Label>
                                <Input id="due-day" type="number" min="1" max="31" value={formDueDay} onChange={(e) => setFormDueDay(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="card-limit" className="text-sm font-medium">Limite (opcional)</Label>
                            <div className="relative mt-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                                <Input id="card-limit" type="text" inputMode="decimal" placeholder="0,00" value={formLimit} onChange={(e) => setFormLimit(e.target.value)} className="pl-10" />
                            </div>
                        </div>
                        <div>
                            <Label className="text-sm font-medium">Cor</Label>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {CARD_COLORS.map((color) => (
                                    <button key={color} type="button" className={`w-8 h-8 rounded-full transition-all ${formColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"}`} style={{ backgroundColor: color }} onClick={() => setFormColor(color)} />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => { setShowCardDialog(false); resetCardForm(); }} className="flex-1" disabled={submitting}>Cancelar</Button>
                            <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? "Salvando..." : editingCard ? "Salvar" : "Adicionar"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CartoesPage;
