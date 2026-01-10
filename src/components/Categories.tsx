import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tag, TrendingUp, TrendingDown, Plus, Edit, Trash2 } from "lucide-react";
import { Transaction } from "./Dashboard";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CategoriesProps {
  transactions: Transaction[];
  categories: any[];
  onAddCategory: (name: string) => Promise<boolean>;
  onUpdateCategories: () => void;
}

export const Categories = ({ transactions, categories, onAddCategory, onUpdateCategories }: CategoriesProps) => {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    const success = await onAddCategory(newCategoryName.trim());
    if (success) {
      setNewCategoryName("");
      setIsAddDialogOpen(false);
      toast.success("Categoria criada com sucesso!");
      onUpdateCategories();
    }
  };

  const handleEditCategory = async () => {
    if (!editCategoryName.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    try {
      // Verificar se usuário ainda está ativo
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão inválida. Por favor, faça login novamente.");
        await supabase.auth.signOut();
        return;
      }

      // Atualizar apenas se categoria pertencer ao usuário (RLS também protege)
      const { error } = await supabase
        .from('categories')
        .update({ name: editCategoryName.trim() })
        .eq('id', editingCategory.id)
        .eq('user_id', user.id); // CRÍTICO: Garantir que só atualiza suas próprias categorias

      if (error) throw error;

      setEditingCategory(null);
      setEditCategoryName("");
      setIsEditDialogOpen(false);
      toast.success("Categoria atualizada com sucesso!");
      onUpdateCategories();
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      toast.error("Erro ao atualizar categoria");
    }
  };

  const handleDeleteCategory = async (category: any) => {
    try {
      // Verificar se usuário ainda está ativo
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão inválida. Por favor, faça login novamente.");
        await supabase.auth.signOut();
        return;
      }

      // Deletar apenas se categoria pertencer ao usuário (RLS também protege)
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user.id); // CRÍTICO: Garantir que só deleta suas próprias categorias

      if (error) throw error;

      toast.success("Categoria excluída com sucesso!");
      onUpdateCategories();
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast.error("Erro ao excluir categoria");
    }
  };

  const openEditDialog = (category: any) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setIsEditDialogOpen(true);
  };
  const categoryStats = useMemo(() => {
    const stats: Record<string, { 
      income: number; 
      expenses: number; 
      count: number;
      lastTransaction: Date;
    }> = {};

    transactions.forEach(t => {
      if (!stats[t.category]) {
        stats[t.category] = { income: 0, expenses: 0, count: 0, lastTransaction: new Date(0) };
      }

      const amount = Number(t.amount);
      const transactionDate = new Date(t.date || t.created_at);

      if (t.type === "income") {
        stats[t.category].income += amount;
      } else {
        stats[t.category].expenses += amount;
      }
      
      stats[t.category].count += 1;
      
      if (transactionDate > stats[t.category].lastTransaction) {
        stats[t.category].lastTransaction = transactionDate;
      }
    });

    return Object.entries(stats)
      .map(([category, data]) => ({
        category,
        ...data,
        balance: data.income - data.expenses,
        total: data.income + data.expenses,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const categoriesList = [
    "alimentacao",
    "transporte", 
    "saude",
    "lazer",
    "educacao",
    "casa",
    "trabalho",
    "geral",
    ...categories.map(c => c.name)
  ].filter((value, index, self) => self.indexOf(value) === index);

  const getCategoryDisplayName = (category: string) => {
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
    return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const formatDate = (date: Date) => {
    if (date.getTime() === 0) return "Nunca";
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Categorias</h1>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Nome da categoria"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddCategory}>
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo das Categorias Ativas */}
      {categoryStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Categorias com Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {categoryStats.map(({ category, income, expenses, count, balance, lastTransaction }) => (
                <div key={category} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{getCategoryDisplayName(category)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {count} transaç{count === 1 ? "ão" : "ões"} • Última: {formatDate(lastTransaction)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex gap-4 text-sm">
                      {income > 0 && (
                        <span className="text-green-600 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          R$ {income.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                      {expenses > 0 && (
                        <span className="text-red-600 flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" />
                          R$ {expenses.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </div>
                    <div className={`font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Saldo: {balance >= 0 ? "+" : ""}R$ {balance.toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Todas as Categorias Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoriesList.map(category => {
              const stats = categoryStats.find(s => s.category === category);
              const hasTransactions = !!stats;
              const customCategory = categories.find(c => c.name === category);
              const isCustomCategory = !!customCategory;

              return (
                <div 
                  key={category} 
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    hasTransactions 
                      ? 'border-primary/20 bg-primary/5' 
                      : 'border-dashed border-muted-foreground/30 bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Tag className={`w-4 h-4 ${hasTransactions ? 'text-primary' : 'text-muted-foreground'}`} />
                      <h3 className="font-medium">{getCategoryDisplayName(category)}</h3>
                    </div>
                    
                    {isCustomCategory && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(customCategory)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a categoria "{getCategoryDisplayName(category)}"? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCategory(customCategory)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                  
                  {hasTransactions && stats ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transações:</span>
                        <span>{stats.count}</span>
                      </div>
                      {stats.income > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Receitas:</span>
                          <span className="text-green-600">R$ {stats.income.toFixed(2).replace(".", ",")}</span>
                        </div>
                      )}
                      {stats.expenses > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Despesas:</span>
                          <span className="text-red-600">R$ {stats.expenses.toFixed(2).replace(".", ",")}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span>Saldo:</span>
                        <span className={stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {stats.balance >= 0 ? "+" : ""}R$ {stats.balance.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma transação registrada
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para editar categoria */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da categoria"
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditCategory()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditCategory}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};