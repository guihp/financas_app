import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

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

    const numericAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Erro",
        description: "Valor deve ser um número positivo",
        variant: "destructive",
      });
      return;
    }

    onAddTransaction({
      type,
      amount: numericAmount,
      description,
      category,
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
            <Label className="text-sm font-medium">Tipo</Label>
            <RadioGroup value={type} onValueChange={(value) => setType(value as "income" | "expense")} className="flex gap-6 mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expense" id="expense" />
                <Label htmlFor="expense">Despesa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="income" />
                <Label htmlFor="income">Receita</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="amount" className="text-sm font-medium">Valor (R$)</Label>
            <Input
              id="amount"
              type="text"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">Descrição</Label>
            <Input
              id="description"
              type="text"
              placeholder="Descreva a transação"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="category" className="text-sm font-medium">Categoria</Label>
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