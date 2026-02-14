import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidAmount, sanitizeDescription, sanitizeCategoryName } from "@/utils/validation";

interface AddTransactionFabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionAdded?: () => void;
}

export const AddTransactionFab = ({
  open,
  onOpenChange,
  onTransactionAdded,
}: AddTransactionFabProps) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id);

      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const formatCurrency = (value: string) => {
    let numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    const numValue = parseInt(numbers, 10) / 100;
    return numValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setAmount(formatted);
  };

  const defaultCategories = [
    "alimentacao",
    "transporte", 
    "saude",
    "lazer",
    "educacao",
    "casa",
    "trabalho",
    "geral"
  ];

  const allCategories = [
    ...defaultCategories,
    ...categories.map(c => c.name)
  ].filter((value, index, self) => self.indexOf(value) === index);

  const getCategoryDisplayName = (categoryName: string) => {
    const names: Record<string, string> = {
      alimentacao: "Alimentação",
      transporte: "Transporte",
      saude: "Saúde", 
      lazer: "Lazer",
      educacao: "Educação",
      casa: "Casa",
      trabalho: "Trabalho",
      geral: "Geral"
    };
    return names[categoryName] || categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !description || !category) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const amountValidation = isValidAmount(amount);
    if (!amountValidation.valid) {
      toast({
        title: "Erro",
        description: amountValidation.message,
        variant: "destructive",
      });
      return;
    }

    const sanitizedDescription = sanitizeDescription(description);
    const sanitizedCategory = sanitizeCategoryName(category);

    if (!sanitizedDescription || sanitizedDescription.length < 3) {
      toast({
        title: "Erro",
        description: "Descrição deve ter pelo menos 3 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type,
          amount: amountValidation.value,
          description: sanitizedDescription,
          category: sanitizedCategory,
          transaction_date: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação adicionada com sucesso!",
      });

      // Reset form
      setAmount("");
      setDescription("");
      setCategory("");
      onOpenChange(false);
      onTransactionAdded?.();
    } catch (error: any) {
      console.error("Error adding transaction:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao adicionar transação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-white">Tipo</Label>
            <RadioGroup value={type} onValueChange={(value) => setType(value as "income" | "expense")} className="flex gap-6 mt-2">
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

          <div>
            <Label htmlFor="amount-fab" className="text-sm font-medium text-white">Valor (R$)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 font-medium">R$</span>
              <Input
                id="amount-fab"
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                className="pl-10 text-white text-right font-semibold text-lg"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description-fab" className="text-sm font-medium text-white">Descrição</Label>
            <Input
              id="description-fab"
              type="text"
              placeholder="Descreva a transação"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 text-white"
            />
          </div>

          <div>
            <Label htmlFor="category-fab" className="text-sm font-medium text-white">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {getCategoryDisplayName(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
