import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { isValidAmount, sanitizeDescription, sanitizeCategoryName } from "@/utils/validation";

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  date: Date | string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
  categories: any[];
  onAddCategory: (name: string) => Promise<boolean>;
}

export const AddTransactionDialog = ({
  open,
  onOpenChange,
  onAddTransaction,
  categories,
  onAddCategory,
}: AddTransactionDialogProps) => {
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const { toast } = useToast();

  // Formatar valor como moeda brasileira (1.234,56)
  const formatCurrency = (value: string) => {
    // Remove tudo que não é número
    let numbers = value.replace(/\D/g, '');
    
    // Se não há números, retorna vazio
    if (!numbers) return '';
    
    // Converte para número e divide por 100 para ter 2 casas decimais
    const numValue = parseInt(numbers, 10) / 100;
    
    // Formata com separador de milhar e decimal brasileiro
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

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const success = await onAddCategory(newCategoryName.trim());
    if (success) {
      setCategory(newCategoryName.toLowerCase());
      setNewCategoryName("");
      setShowNewCategoryInput(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !description || !category) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Validar e sanitizar valor
    const amountValidation = isValidAmount(amount);
    if (!amountValidation.valid) {
      toast({
        title: "Erro",
        description: amountValidation.message,
        variant: "destructive",
      });
      return;
    }

    // Sanitizar descrição e categoria
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

    if (!sanitizedCategory) {
      toast({
        title: "Erro",
        description: "Categoria inválida",
        variant: "destructive",
      });
      return;
    }

    onAddTransaction({
      type,
      amount: amountValidation.value!,
      description: sanitizedDescription,
      category: sanitizedCategory,
      date: new Date(),
    });

    // Reset form
    setAmount("");
    setDescription("");
    setCategory("");
    setNewCategoryName("");
    setShowNewCategoryInput(false);
    onOpenChange(false);
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
                <RadioGroupItem value="expense" id="expense" />
                <Label htmlFor="expense" className="text-white">Despesa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="income" />
                <Label htmlFor="income" className="text-white">Receita</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="amount" className="text-sm font-medium text-white">Valor (R$)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 font-medium">R$</span>
              <Input
                id="amount"
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
            <Label htmlFor="description" className="text-sm font-medium text-white">Descrição</Label>
            <Input
              id="description"
              type="text"
              placeholder="Descreva a transação"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 text-white"
            />
          </div>

          <div>
            <Label htmlFor="category" className="text-sm font-medium text-white">Categoria</Label>
            <div className="space-y-2 mt-1">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
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

              {!showNewCategoryInput ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewCategoryInput(true)}
                  className="w-full"
                >
                  + Criar Nova Categoria
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da nova categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreateCategory()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategory}
                  >
                    Criar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategoryName("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};