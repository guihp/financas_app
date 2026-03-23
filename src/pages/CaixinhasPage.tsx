import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { useOutletContext } from "react-router-dom";
import { Wallet, TrendingUp, PiggyBank, Plus, Bitcoin, Building2, Pencil } from "lucide-react";

interface User {
  id: string;
}

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: string;
  invested_amount: number;
  current_balance: number;
  created_at: string;
}

interface BankAccount {
  id: string;
  name: string;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const CATEGORIES = [
  { id: "cripto", label: "Criptomoedas", icon: Bitcoin },
  { id: "renda_fixa", label: "Renda Fixa / CDI", icon: PiggyBank },
  { id: "acoes", label: "Ações & FIIs", icon: Building2 },
  { id: "reserva", label: "Reserva Emergência", icon: Wallet },
  { id: "outro", label: "Outros", icon: TrendingUp },
];

const CaixinhasPage = () => {
  const { toast } = useToast();
  const { user } = useOutletContext<OutletContextType>();
  const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog Add Note
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("renda_fixa");
  const [newAmount, setNewAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog Edit Balance
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editItem, setEditItem] = useState<Investment | null>(null);
  const [editBalance, setEditBalance] = useState("");

  useEffect(() => {
    if (user?.id && !loadingConnections && allUserIds.length > 0) {
      loadData();
    }
  }, [user?.id, allUserIds, loadingConnections]);

  const loadData = async () => {
    try {
      const [{ data: invData }, { data: bankData }] = await Promise.all([
        supabase
          .from("investments")
          .select("*")
          .in("user_id", allUserIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("bank_accounts")
          .select("id, name")
          .in("user_id", allUserIds)
          .order("name"),
      ]);

      setInvestments((invData || []) as Investment[]);
      setBanks((bankData || []) as BankAccount[]);
    } catch (error) {
      console.error("Falha ao carregar investimentos", error);
    } finally {
      setLoading(false);
    }
  };

  const totalInvested = useMemo(() => investments.reduce((acc, curr) => acc + Number(curr.invested_amount), 0), [investments]);
  const currentTotal = useMemo(() => investments.reduce((acc, curr) => acc + Number(curr.current_balance), 0), [investments]);
  const rentabilityAmount = currentTotal - totalInvested;
  const rentabilityPerc = totalInvested > 0 ? (rentabilityAmount / totalInvested) * 100 : 0;

  const handleCreateInvestment = async () => {
    if (!newName.trim() || !newAmount || !selectedBank) {
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    const val = parseFloat(newAmount.replace(",", "."));
    if (isNaN(val) || val <= 0) return;

    setIsSubmitting(true);
    try {
      // 1. Debita a conta lançando transação e diminuindo banco fisicamente
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: user.id,
        bank_account_id: selectedBank,
        amount: val,
        type: "expense",
        category: "investimentos", // Categoria q existe no financialData.ts
        description: `Aporte: ${newName}`,
        date: new Date().toISOString().split("T")[0],
        payment_method: "debit",
        status: "paid",
      });

      if (txError) throw txError;

      // 2. Cria a caixinha
      const { error: invError } = await supabase.from("investments").insert({
        user_id: user.id,
        name: newName.trim(),
        type: newType,
        invested_amount: val,
        current_balance: val,
      });

      if (invError) throw invError;

      toast({ title: "Aporte realizado com sucesso!", description: "O valor foi descontado do banco." });
      setShowAddDialog(false);
      setNewName("");
      setNewAmount("");
      setSelectedBank("");
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao criar", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBalance = async () => {
    if (!editItem || !editBalance) return;
    const val = parseFloat(editBalance.replace(",", "."));
    if (isNaN(val) || val < 0) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("investments").update({ current_balance: val }).eq("id", editItem.id);
      if (error) throw error;
      toast({ title: "Saldo atualizado" });
      setShowEditDialog(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="p-4 md:p-8 pt-20 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Caixinhas & Investimentos</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Gerencie seu patrimônio acumulado e redimentos.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2 shrink-0 bg-primary/90">
          <Plus className="h-4 w-4" /> Novo Investimento
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Aportado</h3>
            <p className="text-2xl font-bold">{formatCurrency(totalInvested)}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-primary/80 mb-1">Patrimônio Atual</h3>
            <p className="text-2xl font-bold text-primary">{formatCurrency(currentTotal)}</p>
          </CardContent>
        </Card>
        <Card className={rentabilityAmount >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}>
          <CardContent className="p-6">
            <h3 className={`text-sm font-medium mb-1 ${rentabilityAmount >= 0 ? "text-green-600" : "text-red-600"}`}>Rentabilidade Absoluta</h3>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${rentabilityAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                {rentabilityAmount >= 0 ? "+" : ""}{formatCurrency(rentabilityAmount)}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${rentabilityAmount >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {rentabilityAmount >= 0 ? "+" : ""}{rentabilityPerc.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {investments.map(inv => {
          const CatIcon = CATEGORIES.find(c => c.id === inv.type)?.icon || Wallet;
          const rent = Number(inv.current_balance) - Number(inv.invested_amount);
          
          return (
            <Card key={inv.id} className="overflow-hidden hover:shadow-md transition-shadow relative group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                      <CatIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg line-clamp-1">{inv.name}</h4>
                      <p className="text-xs text-muted-foreground uppercase">{CATEGORIES.find(c => c.id === inv.type)?.label}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor Aportado</span>
                    <span className="text-sm font-medium">{formatCurrency(inv.invested_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-sm text-foreground font-semibold">Saldo Atual</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(inv.current_balance)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Rendimento</span>
                    <span className={rent >= 0 ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                      {rent >= 0 ? "+" : ""}{formatCurrency(rent)}
                    </span>
                  </div>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setEditItem(inv);
                    setEditBalance(String(inv.current_balance));
                    setShowEditDialog(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {investments.length === 0 && (
        <Card className="border-dashed py-12 text-center text-muted-foreground">
          <CardContent>
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Você ainda não registrou nenhum investimento.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog Add */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Novo Investimento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome (Ação, Fundo, etc)</label>
              <Input placeholder="Ex: NuConta Caixinha, BTC, Tesouro Direto" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo do Ativo</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor do Aporte Inicial</label>
              <Input type="number" placeholder="Ex: 500" value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0" step="0.01" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Debitar da Conta</label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger><SelectValue placeholder="Escolha um banco" /></SelectTrigger>
                <SelectContent>
                  {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">O saldo do seu investimento nascerá disto e sumirá das finanças do mês.</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateInvestment} disabled={isSubmitting}>Depositar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Update Balance */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Atualizar Rendimento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">Informe o Saldo Atual do seu investimento em <strong>{editItem?.name}</strong>.</p>
          <Input type="number" placeholder="Novo saldo na corretora..." value={editBalance} onChange={e => setEditBalance(e.target.value)} min="0" step="0.01" />
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveBalance} disabled={isSubmitting}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaixinhasPage;
