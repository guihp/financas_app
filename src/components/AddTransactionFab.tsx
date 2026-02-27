import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidAmount, sanitizeDescription, sanitizeCategoryName } from "@/utils/validation";
import { CreditCard, Banknote, Zap, FileText, Building2, ArrowLeftRight } from "lucide-react";
import { FIXED_CATEGORIES, CATEGORY_GROUPS, getCategoryLabel, getCategoriesByType, getCategoryGroupsByType } from "@/constants/financialData";

interface AddTransactionFabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionAdded?: () => void;
}

interface CreditCardOption { id: string; name: string; color: string; }
interface BankAccountOption { id: string; name: string; color: string; }

export const AddTransactionFab = ({ open, onOpenChange, onTransactionAdded }: AddTransactionFabProps) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Payment method & bank/card selection
  const [paymentMethod, setPaymentMethod] = useState<"debit" | "pix" | "credit" | "boleto" | "transfer">("debit");
  const [selectedBankToId, setSelectedBankToId] = useState("");
  const [creditCards, setCreditCards] = useState<CreditCardOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("2");

  useEffect(() => {
    if (open) {
      loadCategories();
      loadCreditCards();
      loadBankAccounts();
    }
  }, [open]);

  useEffect(() => {
    if (type === "income") {
      setPaymentMethod("debit");
      setIsInstallment(false);
      setSelectedCardId("");
    }
  }, [type]);

  // Reset card/bank when switching payment method
  useEffect(() => {
    if (paymentMethod !== "credit") setSelectedCardId("");
    if (paymentMethod === "credit") setSelectedBankId("");
  }, [paymentMethod]);

  const loadCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("categories").select("*").eq("user_id", user.id);
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadCreditCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("credit_cards").select("id, name, color").eq("user_id", user.id).order("name");
      setCreditCards((data as CreditCardOption[]) || []);
    } catch (error) {
      console.error("Error loading credit cards:", error);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("bank_accounts").select("id, name, color").eq("user_id", user.id).order("name");
      setBankAccounts((data as BankAccountOption[]) || []);
    } catch (error) {
      console.error("Error loading bank accounts:", error);
    }
  };

  const formatCurrency = (value: string) => {
    let numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    const numValue = parseInt(numbers, 10) / 100;
    return numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatCurrency(e.target.value));
  };

  // Merge fixed categories with user custom categories
  const userCategoryValues = categories.map(c => c.name);
  const allCategoryValues = [
    ...FIXED_CATEGORIES.map(c => c.value),
    ...userCategoryValues.filter(v => !FIXED_CATEGORIES.find(fc => fc.value === v)),
  ];

  const getCategoryDisplayName = (cat: string) => {
    return getCategoryLabel(cat);
  };

  // Filter categories by type
  const filteredCategories = getCategoriesByType(type);
  const filteredGroups = getCategoryGroupsByType(type);

  // Whether current method requires a bank account
  const needsBank = type === "income" || (type === "expense" && ["debit", "pix", "boleto", "transfer"].includes(paymentMethod));
  const needsCreditCard = type === "expense" && paymentMethod === "credit";
  const isTransfer = type === "expense" && paymentMethod === "transfer";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !description || !category) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    if (needsBank && !selectedBankId) {
      toast({ title: "Erro", description: "Selecione o banco", variant: "destructive" });
      return;
    }

    if (needsCreditCard && !selectedCardId) {
      toast({ title: "Erro", description: "Selecione o cartão de crédito", variant: "destructive" });
      return;
    }

    const amountValidation = isValidAmount(amount);
    if (!amountValidation.valid) {
      toast({ title: "Erro", description: amountValidation.message, variant: "destructive" });
      return;
    }

    const sanitizedDescription = sanitizeDescription(description);
    const sanitizedCategory = sanitizeCategoryName(category);

    if (!sanitizedDescription || sanitizedDescription.length < 3) {
      toast({ title: "Erro", description: "Descrição deve ter pelo menos 3 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const today = new Date().toISOString().split('T')[0];
      const effectivePaymentMethod = type === "expense" ? paymentMethod : null;

      if (effectivePaymentMethod === "credit" && isInstallment) {
        const totalInstallments = parseInt(installmentCount) || 2;
        const installmentAmount = Math.round((amountValidation.value! / totalInstallments) * 100) / 100;
        const groupId = crypto.randomUUID();

        const installments = [];
        for (let i = 0; i < totalInstallments; i++) {
          const installmentDate = new Date();
          installmentDate.setMonth(installmentDate.getMonth() + i);
          const dateStr = installmentDate.toISOString().split('T')[0];
          let currentAmount = installmentAmount;
          if (i === totalInstallments - 1) {
            currentAmount = Math.round((amountValidation.value! - (installmentAmount * (totalInstallments - 1))) * 100) / 100;
          }
          installments.push({
            user_id: user.id, type: "expense", amount: currentAmount,
            description: sanitizedDescription, category: sanitizedCategory,
            date: dateStr, transaction_date: dateStr, payment_method: "credit",
            credit_card_id: selectedCardId, bank_account_id: null,
            total_installments: totalInstallments, installment_number: i + 1,
            installment_group_id: groupId,
          });
        }

        const { error } = await supabase.from("transactions").insert(installments);
        if (error) throw error;
        toast({ title: "Sucesso", description: `Compra parcelada em ${totalInstallments}x adicionada!` });
      } else {
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id, type, amount: amountValidation.value,
          description: sanitizedDescription, category: sanitizedCategory,
          date: today, transaction_date: today,
          payment_method: effectivePaymentMethod,
          credit_card_id: needsCreditCard ? selectedCardId : null,
          bank_account_id: needsBank ? selectedBankId : null,
          total_installments: 1, installment_number: 1,
        });
        if (error) throw error;
        toast({ title: "Sucesso", description: `${type === "income" ? "Receita" : "Despesa"} adicionada!` });
      }

      // Reset
      setAmount(""); setDescription(""); setCategory("");
      setPaymentMethod("debit"); setSelectedCardId(""); setSelectedBankId("");
      setIsInstallment(false); setInstallmentCount("2");
      onOpenChange(false);
      onTransactionAdded?.();
    } catch (error: any) {
      console.error("Error adding transaction:", error);
      toast({ title: "Erro", description: error.message || "Erro ao adicionar transação", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto max-sm:left-6 max-sm:right-6 max-sm:top-6 max-sm:bottom-6 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-none max-sm:pb-12 max-sm:w-[calc(100vw-3rem)] max-sm:max-w-[calc(100vw-3rem)]">
        <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div>
            <Label className="text-sm font-medium text-white">Tipo</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as "income" | "expense")} className="flex gap-6 mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expense" id="expense-fab" />
                <Label htmlFor="expense-fab" className="text-white">Despesa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="income-fab" />
                <Label htmlFor="income-fab" className="text-white">Receita</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Método de Pagamento - only for expenses */}
          {type === "expense" && (
            <div>
              <Label className="text-sm font-medium text-white mb-2 block">Método de Pagamento</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {([
                  { key: "debit", icon: <Banknote className="h-4 w-4" />, label: "Débito", activeClass: "border-blue-500 bg-blue-500/10 text-blue-400" },
                  { key: "pix", icon: <Zap className="h-4 w-4" />, label: "PIX", activeClass: "border-green-500 bg-green-500/10 text-green-400" },
                  { key: "credit", icon: <CreditCard className="h-4 w-4" />, label: "Crédito", activeClass: "border-purple-500 bg-purple-500/10 text-purple-400" },
                  { key: "boleto", icon: <FileText className="h-4 w-4" />, label: "Boleto", activeClass: "border-amber-500 bg-amber-500/10 text-amber-400" },
                  { key: "transfer", icon: <ArrowLeftRight className="h-4 w-4" />, label: "Transf.", activeClass: "border-cyan-500 bg-cyan-500/10 text-cyan-400" },
                ] as const).map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { setPaymentMethod(item.key); setIsInstallment(false); if (item.key === 'transfer') setCategory('transferencia'); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${paymentMethod === item.key
                      ? item.activeClass
                      : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                      }`}
                  >
                    {item.icon}
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bank Account Selection - for debit, pix, boleto, transfer, income */}
          {needsBank && (
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <Label className="text-sm font-medium text-white flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {isTransfer ? "Banco de origem" : type === "income" ? "Banco de destino" : "Banco"}
              </Label>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">Nenhum banco cadastrado. Vá em Bancos e Cartões para cadastrar.</p>
              ) : (
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(bank => (
                      <SelectItem key={bank.id} value={bank.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bank.color }} />
                          {bank.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Bank Destination - for transfers */}
              {isTransfer && bankAccounts.length > 0 && (
                <div className="mt-3">
                  <Label className="text-sm font-medium text-white flex items-center gap-1.5">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Banco de destino
                  </Label>
                  <Select value={selectedBankToId} onValueChange={setSelectedBankToId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o banco de destino" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.filter(b => b.id !== selectedBankId).map(bank => (
                        <SelectItem key={bank.id} value={bank.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bank.color }} />
                            {bank.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Credit Card Selection - for credit method only */}
          {needsCreditCard && (
            <div className="space-y-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
              <div>
                <Label className="text-sm font-medium text-white flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Cartão
                </Label>
                {creditCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum cartão cadastrado. Vá em Bancos e Cartões para cadastrar.</p>
                ) : (
                  <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                    <SelectContent>
                      {creditCards.map(card => (
                        <SelectItem key={card.id} value={card.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                            {card.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">Parcelado?</Label>
                <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
              </div>
              {isInstallment && (
                <div>
                  <Label className="text-sm font-medium text-white">Quantas parcelas?</Label>
                  <Select value={installmentCount} onValueChange={setInstallmentCount}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 23 }, (_, i) => i + 2).map(n => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Valor */}
          <div>
            <Label htmlFor="amount-fab" className="text-sm font-medium text-white">Valor (R$)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 font-medium">R$</span>
              <Input id="amount-fab" type="text" inputMode="numeric" placeholder="0,00" value={amount} onChange={handleAmountChange} className="pl-10 text-white text-right font-semibold text-lg" />
            </div>
            {needsCreditCard && isInstallment && amount && (
              <p className="text-xs text-muted-foreground mt-1">
                {parseInt(installmentCount) || 2}x de R$ {formatCurrency(
                  String(Math.round((parseFloat(amount.replace(/\./g, '').replace(',', '.')) / (parseInt(installmentCount) || 2)) * 100))
                )}
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="description-fab" className="text-sm font-medium text-white">Descrição</Label>
            <Input id="description-fab" type="text" placeholder="Descreva a transação" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 text-white" />
          </div>

          {/* Categoria */}
          {!isTransfer && (
            <div>
              <Label htmlFor="category-fab" className="text-sm font-medium text-white">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredGroups.map(group => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">{group}</div>
                      {filteredCategories.filter(c => c.group === group).map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.emoji} {cat.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                  {/* Custom user categories */}
                  {userCategoryValues.filter(v => !FIXED_CATEGORIES.find(fc => fc.value === v)).length > 0 && (
                    <div>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">Minhas Categorias</div>
                      {userCategoryValues.filter(v => !FIXED_CATEGORIES.find(fc => fc.value === v)).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                      ))}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={loading}>{loading ? "Adicionando..." : "Adicionar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
