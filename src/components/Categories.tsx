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
import { sanitizeCategoryName } from "@/utils/validation";
import { FIXED_CATEGORIES, getCategoriesByType, getCategoryGroupsByType, getCategoryLabel } from "@/constants/financialData";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    const sanitized = sanitizeCategoryName(newCategoryName);
    if (!sanitized || sanitized.length < 2) {
      toast.error("Nome da categoria deve ter pelo menos 2 caracteres e não pode conter caracteres especiais");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onAddCategory(sanitized);
      if (success) {
        setNewCategoryName("");
        setIsAddDialogOpen(false);
        toast.success("Categoria criada com sucesso!");
        onUpdateCategories();
      }
    } catch (error) {
      console.error("Erro interno ao adicionar categoria:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = async () => {
    if (!editCategoryName.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão inválida. Por favor, faça login novamente.");
        await supabase.auth.signOut();
        return;
      }

      const { error } = await supabase
        .from('categories')
        .update({ name: editCategoryName.trim() })
        .eq('id', editingCategory.id)
        .eq('user_id', user.id);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão inválida. Por favor, faça login novamente.");
        await supabase.auth.signOut();
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('user_id', user.id);

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

  // Get categories filtered by active tab
  const filteredCategories = getCategoriesByType(activeTab);
  const filteredGroups = getCategoryGroupsByType(activeTab);

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
                onKeyDown={(e) => e.key === 'Enter' && !isSubmitting && handleAddCategory()}
                disabled={isSubmitting}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button onClick={handleAddCategory} disabled={isSubmitting}>
                  {isSubmitting ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs: Despesas / Receitas */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("expense")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${activeTab === "expense"
              ? "bg-red-500/15 text-red-400 border-2 border-red-500/40"
              : "bg-muted/30 text-muted-foreground border-2 border-transparent hover:bg-muted/50"
            }`}
        >
          <TrendingDown className="w-4 h-4" />
          Despesas
        </button>
        <button
          onClick={() => setActiveTab("income")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${activeTab === "income"
              ? "bg-green-500/15 text-green-400 border-2 border-green-500/40"
              : "bg-muted/30 text-muted-foreground border-2 border-transparent hover:bg-muted/50"
            }`}
        >
          <TrendingUp className="w-4 h-4" />
          Receitas
        </button>
      </div>

      {/* Categorias por grupo */}
      {filteredGroups.map(group => {
        const groupCategories = filteredCategories.filter(c => c.group === group);
        return (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{group}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupCategories.map(cat => {
                  const stats = categoryStats.find(s => s.category === cat.value);
                  const hasTransactions = !!stats;

                  return (
                    <div
                      key={cat.value}
                      className={`p-3 rounded-lg border-2 transition-colors ${hasTransactions
                        ? 'border-primary/20 bg-primary/5'
                        : 'border-dashed border-muted-foreground/20 bg-muted/10'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.emoji}</span>
                          <h3 className="font-medium text-sm">{cat.label}</h3>
                        </div>
                      </div>

                      {hasTransactions && stats ? (
                        <div className="space-y-0.5 text-xs mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Transações:</span>
                            <span>{stats.count}</span>
                          </div>
                          {stats.income > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Receitas:</span>
                              <span className="text-green-500">R$ {stats.income.toFixed(2).replace(".", ",")}</span>
                            </div>
                          )}
                          {stats.expenses > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Despesas:</span>
                              <span className="text-red-500">R$ {stats.expenses.toFixed(2).replace(".", ",")}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Sem movimentações
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Minhas Categorias Personalizadas */}
      {categories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Minhas Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map(category => {
                const stats = categoryStats.find(s => s.category === category.name);
                const hasTransactions = !!stats;

                return (
                  <div
                    key={category.id}
                    className={`p-3 rounded-lg border-2 transition-colors ${hasTransactions
                      ? 'border-primary/20 bg-primary/5'
                      : 'border-dashed border-muted-foreground/20 bg-muted/10'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Tag className={`w-4 h-4 ${hasTransactions ? 'text-primary' : 'text-muted-foreground'}`} />
                        <h3 className="font-medium text-sm">{category.name.charAt(0).toUpperCase() + category.name.slice(1)}</h3>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(category)}
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
                                Tem certeza que deseja excluir a categoria "{category.name}"?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCategory(category)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {hasTransactions && stats ? (
                      <div className="space-y-0.5 text-xs mt-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transações:</span>
                          <span>{stats.count}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Sem movimentações
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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