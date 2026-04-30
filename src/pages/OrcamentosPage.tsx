import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useConnectedUserIds } from "@/hooks/useConnectedUserIds";
import { useOutletContext } from "react-router-dom";
import { ShieldAlert, Plus, Pencil, AlertTriangle } from "lucide-react";
import { getCategoryLabel } from "@/constants/financialData";
import { Progress } from "@/components/ui/progress";
import { CategorySelect } from "@/components/CategorySelect";
import { isValidAmount } from "@/utils/validation";

interface User {
  id: string;
}

interface OutletContextType {
  user: User;
}

interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const OrcamentosPage = () => {
  const { toast } = useToast();
  const { user } = useOutletContext<OutletContextType>();
  const { allUserIds, loading: loadingConnections } = useConnectedUserIds(user?.id);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  /** Gasto no mês por dono do orçamento + categoria (evita misturar contas compartilhadas no mesmo teto). */
  const [spentByUserCategory, setSpentByUserCategory] = useState<Record<string, number>>({});
  /** Mesmo modelo da página Categorias / nova transação (linhas completas do Supabase) */
  const [userCategories, setUserCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (Month/Year)
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Add/Edit Dialog
  const [showDialog, setShowDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hiddenFixedSubcats = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("hidden_fixed_subcats") || "[]") as string[];
    } catch {
      return [];
    }
  }, [showDialog, userCategories]);

  const formatBudgetAmountInput = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";
    const numValue = parseInt(numbers, 10) / 100;
    return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currentMonthStr = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  }, [currentDate]);

  useEffect(() => {
    if (user?.id && !loadingConnections && allUserIds.length > 0) {
      loadData();
    }
  }, [user?.id, allUserIds, loadingConnections, currentMonthStr]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch budgets for this month
      const { data: bdgData, error: bdgErr } = await supabase
        .from("budgets")
        .select("*")
        .in("user_id", allUserIds)
        .eq("month_year", currentMonthStr);

      if (bdgErr) throw bdgErr;
      setBudgets((bdgData || []) as Budget[]);

      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (!catErr && catData) {
        setUserCategories(catData);
      }

      // 2. Fetch expenses from this month to map (último dia do mês — evita "-31" inválido em fev/etc.)
      const [y, m] = currentMonthStr.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const endDateStr = `${currentMonthStr}-${String(lastDay).padStart(2, "0")}`;
      const { data: txData, error: txErr } = await supabase
        .from("transactions")
        .select("amount, category, user_id")
        .in("user_id", allUserIds)
        .eq("type", "expense")
        .gte("date", `${currentMonthStr}-01`)
        .lte("date", endDateStr);

      if (txErr) throw txErr;

      const grouped = (txData || []).reduce((acc: Record<string, number>, tx: { amount: number; category: string; user_id: string }) => {
        const key = `${tx.user_id}::${tx.category}`;
        acc[key] = (acc[key] || 0) + Number(tx.amount);
        return acc;
      }, {});
      setSpentByUserCategory(grouped);

    } catch (err: any) {
      console.error("Erro ao carregar orçamentos", err);
      toast({ title: "Ops!", description: "Não pudemos carregar seus orçamentos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + offset);
      return d;
    });
  };

  const handleOpenNew = () => {
    setIsEditMode(false);
    setEditId(null);
    setSelectedCat("");
    setBudgetAmount("");
    setShowDialog(true);
  };

  const handleOpenEdit = (b: Budget) => {
    setIsEditMode(true);
    setEditId(b.id);
    setSelectedCat(b.category);
    setBudgetAmount(
      Number(b.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
    setShowDialog(true);
  };

  const handleSaveBudget = async () => {
    if (!selectedCat || !budgetAmount) return;
    const amountCheck = isValidAmount(budgetAmount);
    if (!amountCheck.valid || amountCheck.value == null) {
      toast({ title: "Valor inválido", description: amountCheck.message, variant: "destructive" });
      return;
    }
    const val = amountCheck.value;

    setIsSubmitting(true);
    try {
      if (isEditMode && editId) {
        const { error } = await supabase
          .from("budgets")
          .update({ amount: val })
          .eq("id", editId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("budgets")
          .insert({
            user_id: user.id,
            category: selectedCat,
            amount: val,
            month_year: currentMonthStr
          });
        // Captura o UNIQUE error se existir
        if (error?.code === '23505') {
            throw new Error("Você já possui um teto de gastos definido para esta Categoria neste Mês.");
        } else if (error) {
            throw error;
        }
      }

      toast({ title: "Sucesso!", description: "Seu teto de gastos foi configurado." });
      setShowDialog(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 pt-20 pb-24 lg:pb-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teto de Gastos</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Guarda-costas financeiro: defina orçamentos para não estourar categorias cruciais.</p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2 shrink-0 bg-primary/90">
          <ShieldAlert className="h-4 w-4" /> Definir Novo Teto
        </Button>
      </div>

      <div className="flex items-center justify-between bg-card border rounded-lg p-2 max-w-xs mx-auto md:mx-0 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}>{"<"}</Button>
        <span className="font-semibold px-4 capitalize">
          {currentDate.toLocaleString("pt-BR", { month: "long", year: "numeric" })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}>{">"}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        {!loading && budgets.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl">
            <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum teto definido para <b>{currentDate.toLocaleString("pt-BR", { month: "long" })}</b>.</p>
            <p className="text-sm mt-1">Crie um clicando no botão acima para monitorar sua categoria de Transporte ou Supermercado.</p>
          </div>
        )}

        {budgets.map(b => {
          const label = getCategoryLabel(b.category);
          const spent = spentByUserCategory[`${b.user_id}::${b.category}`] || 0;
          const limit = Number(b.amount);
          const perc = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const isOver = spent > limit;
          const isWarning = perc >= 80 && !isOver;

          let barColor = "bg-primary";
          if (isOver) barColor = "bg-red-500";
          else if (isWarning) barColor = "bg-amber-500";

          return (
            <Card key={b.id} className={`overflow-hidden transition-all ${isOver ? 'border-red-500/30 bg-red-500/5' : ''}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-lg leading-tight break-words">{label}</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Utilizado ({perc.toFixed(0)}%)</span>
                    <span className="font-medium text-muted-foreground">Teto: {formatCurrency(limit)}</span>
                  </div>
                  <Progress
                    value={perc}
                    className="h-2.5 bg-muted"
                    indicatorClassName={barColor}
                  />
                  
                  <div className="flex justify-between items-baseline pt-1">
                    <span className={`text-xl font-bold ${isOver ? 'text-red-500' : 'text-foreground'}`}>
                      {formatCurrency(spent)}
                    </span>
                    <span className={`text-xs font-medium ${isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-green-500'}`}>
                      {isOver ? (
                        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Excedeu {formatCurrency(spent - limit)}</span>
                      ) : (
                        `Resta ${formatCurrency(limit - spent)}`
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Ajustar Teto de Gastos" : "Definir Novo Teto Mensal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!isEditMode && (
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">Categoria</Label>
                <CategorySelect
                  value={selectedCat}
                  onValueChange={setSelectedCat}
                  type="expense"
                  categories={userCategories}
                  excludeFixedCategoryValues={hiddenFixedSubcats}
                />
              </div>
            )}
            <div>
              <Label htmlFor="budget-amount" className="text-sm font-medium text-foreground mb-1.5 block">
                Limite (R$) para este mês
              </Label>
              <Input
                id="budget-amount"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0,00"
                value={budgetAmount}
                onChange={e => setBudgetAmount(formatBudgetAmountInput(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveBudget} disabled={isSubmitting}>{isEditMode ? "Gravar Alterações" : "Ativar Guarda-Costas"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrcamentosPage;
