import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, TrendingUp, TrendingDown, Plus, Edit, Trash2, CornerDownRight } from "lucide-react";
import { Transaction } from "./Dashboard";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeCategoryName } from "@/utils/validation";
import { FIXED_CATEGORIES, getCategoriesByType, getCategoryGroupsByType, getCategoryLabel } from "@/constants/financialData";

interface CategoriesProps {
  transactions: Transaction[];
  categories: any[];
  onAddCategory: (name: string, parentId?: string) => Promise<boolean>;
  onUpdateCategories: () => void;
}

export const Categories = ({ transactions, categories, onAddCategory, onUpdateCategories }: CategoriesProps) => {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string>("none");
  const [newSubcategories, setNewSubcategories] = useState<string[]>([]);
  const [addMode, setAddMode] = useState<"category" | "subcategory">("category");

  const [hiddenFixedSubcats, setHiddenFixedSubcats] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hidden_fixed_subcats') || '[]'); } catch { return []; }
  });

  const handleHideFixedSubcategory = (subValue: string) => {
    const newHidden = [...hiddenFixedSubcats, subValue];
    setHiddenFixedSubcats(newHidden);
    localStorage.setItem('hidden_fixed_subcats', JSON.stringify(newHidden));
    toast.success("Subcategoria nativa ocultada com sucesso!");
  };

  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryParentId, setEditCategoryParentId] = useState<string>("none");
  const [editNewSubcategory, setEditNewSubcategory] = useState("");
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
      if (addMode === "subcategory") {
        if (newCategoryParentId === "none") {
          toast.error("Para criar uma subcategoria, escolha a Categoria Pai");
          setIsSubmitting(false);
          return;
        }
        const success = await onAddCategory(sanitized, newCategoryParentId);
        if (success) {
          setNewCategoryName("");
          setNewCategoryParentId("none");
          setIsAddDialogOpen(false);
          toast.success("Subcategoria criada com sucesso!");
          onUpdateCategories();
        }
      } else {
        const success = await onAddCategory(sanitized, undefined);
        if (success) {
          // Salva as subcategorias aninhadas logo após a criação da principal
          for (const sub of newSubcategories) {
            const trimmed = sub.trim();
            if (trimmed) {
              const sanitizedSub = sanitizeCategoryName(trimmed);
              if (sanitizedSub && sanitizedSub.length >= 2) {
                await onAddCategory(sanitizedSub, sanitized);
              }
            }
          }
          setNewCategoryName("");
          setNewSubcategories([]);
          setIsAddDialogOpen(false);
          toast.success("Categoria criada com sucesso!");
          onUpdateCategories();
        }
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

    const sanitizedName = sanitizeCategoryName(editCategoryName);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão inválida. Por favor, faça login novamente.");
        await supabase.auth.signOut();
        return;
      }

      const { error } = await supabase
        .from('categories')
        .update({
          name: sanitizedName,
          parent_id: editCategoryParentId !== "none" ? editCategoryParentId : null
        } as any)
        .eq('id', editingCategory.id)
        .eq('user_id', user.id);

      if (error) throw error;

      if (!editingCategory.parent_id && sanitizedName !== editingCategory.name) {
        await supabase
          .from('categories')
          .update({ parent_id: sanitizedName } as any)
          .ilike('parent_id', editingCategory.name)
          .eq('user_id', user.id);
      }

      setEditingCategory(null);
      setEditCategoryName("");
      setEditCategoryParentId("none");
      setIsEditDialogOpen(false);
      toast.success("Categoria atualizada com sucesso!");
      onUpdateCategories();
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      toast.error("Erro ao atualizar categoria");
    }
  };

  const handleAddSubcategoryFromEdit = async () => {
    if (!editNewSubcategory.trim()) return;

    const sanitizedSub = sanitizeCategoryName(editNewSubcategory);
    if (!sanitizedSub || sanitizedSub.length < 2) {
      toast.error("Nome inválido para subcategoria.");
      return;
    }

    setIsSubmitting(true);
    const success = await onAddCategory(sanitizedSub, editingCategory.name);

    if (success) {
      setEditNewSubcategory("");
      onUpdateCategories();
      toast.success("Subcategoria adicionada!");
    }
    setIsSubmitting(false);
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
    setEditCategoryParentId(category.parent_id || "none");
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

            <Tabs value={addMode} onValueChange={(v) => setAddMode(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="category">Nova Categoria</TabsTrigger>
                <TabsTrigger value="subcategory">Subcategoria</TabsTrigger>
              </TabsList>

              <TabsContent value="category" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Nome da categoria principal"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={isSubmitting}
                  />

                  <div className="space-y-3 pt-4">
                    <p className="text-sm font-medium text-muted-foreground">Adicionar subcategorias (Opcional)</p>
                    {newSubcategories.map((sub, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`Subcategoria ${index + 1}`}
                          value={sub}
                          onChange={(e) => {
                            const newSubs = [...newSubcategories];
                            newSubs[index] = e.target.value;
                            setNewSubcategories(newSubs);
                          }}
                          disabled={isSubmitting}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newSubs = [...newSubcategories];
                            newSubs.splice(index, 1);
                            setNewSubcategories(newSubs);
                          }}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewSubcategories([...newSubcategories, ""])}
                      disabled={isSubmitting}
                      className="w-full border-dashed"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Subcategoria nesta Categoria
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddCategory} disabled={isSubmitting}>
                    {isSubmitting ? "Salvando..." : "Salvar Categoria"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="subcategory" className="space-y-4 pt-4">
                <Select value={newCategoryParentId} onValueChange={setNewCategoryParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a Categoria Pai" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    <SelectItem value="none">Selecione uma Categoria Pai</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">Categorias Nativas</div>
                    {filteredGroups.map(group => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                    {categories.filter(c => !c.parent_id).length > 0 && (
                      <div>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">Minhas Categorias</div>
                        {categories.filter(c => !c.parent_id).map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                          </SelectItem>
                        ))}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nome da subcategoria"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  disabled={isSubmitting}
                />

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddCategory} disabled={isSubmitting}>
                    {isSubmitting ? "Salvando..." : "Salvar Subcategoria"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
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

      {/* Grade Unificada de Categorias (Grupos Nativos + Customizadas Principais) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Gerenciar Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. Grupos Fixos */}
            {filteredGroups.map(group => {
              const nativas = filteredCategories.filter(c => c.group === group && !hiddenFixedSubcats.includes(c.value));
              const customizadas = categories.filter(c => c.parent_id?.toLowerCase() === group.toLowerCase());

              const subcategories = [
                ...nativas.map(n => ({ id: n.value, name: n.label, value: n.value, isFixed: true, originalCat: null })),
                ...customizadas.map(c => ({ id: c.id, name: c.name.charAt(0).toUpperCase() + c.name.slice(1), value: c.name, isFixed: false, originalCat: c }))
              ];

              let mainCount = 0; let mainIncome = 0; let mainExpenses = 0;
              const directStats = categoryStats.find(s => s.category.toLowerCase() === group.toLowerCase() || s.category === group);

              if (directStats) {
                mainCount += directStats.count; mainIncome += directStats.income; mainExpenses += directStats.expenses;
              }
              subcategories.forEach(sub => {
                const sStats = categoryStats.find(s => s.category.toLowerCase() === sub.value.toLowerCase());
                if (sStats) {
                  mainCount += sStats.count; mainIncome += sStats.income; mainExpenses += sStats.expenses;
                }
              });

              const hasTransactions = mainCount > 0;
              const emoji = getCategoriesByType(activeTab).find(c => c.group === group)?.emoji || '📌';

              return (
                <div key={group} className={`p-3 rounded-lg border-2 transition-colors ${hasTransactions ? 'border-primary/20 bg-primary/5' : 'border-dashed border-muted-foreground/20 bg-muted/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{emoji}</span>
                      <h3 className="font-bold text-sm tracking-tight">{group}</h3>
                    </div>
                  </div>

                  {hasTransactions ? (
                    <div className="space-y-0.5 text-xs mt-2 font-medium">
                      <div className="flex justify-between"><span className="text-muted-foreground">Movimentações:</span><span>{mainCount}</span></div>
                      {mainIncome > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Receitas:</span><span className="text-green-500">R$ {mainIncome.toFixed(2).replace(".", ",")}</span></div>}
                      {mainExpenses > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Despesas:</span><span className="text-red-500">R$ {mainExpenses.toFixed(2).replace(".", ",")}</span></div>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 mt-1">Sem movimentações</p>
                  )}

                  {subcategories.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-2">
                      {subcategories.map(sub => {
                        const subStats = categoryStats.find(s => s.category === sub.value);
                        return (
                          <div key={sub.id} className="flex items-center justify-between text-xs bg-muted/40 p-1.5 rounded-md border border-border/30">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CornerDownRight className="w-3 h-3" />
                              <span className="font-medium text-foreground">{sub.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {subStats && <span className="text-muted-foreground mr-1">{subStats.count} tr</span>}
                              {sub.isFixed ? (
                                <Button variant="ghost" size="sm" onClick={() => handleHideFixedSubcategory(sub.value)} className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" title="Ocultar subcategoria nativa"><Trash2 className="w-3 h-3" /></Button>
                              ) : (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive/70 hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Excluir subcategoria</AlertDialogTitle><AlertDialogDescription>Deseja excluir "{sub.name}"?</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCategory(sub.originalCat)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 2. Customizadas Principais */}
            {categories.filter(c => !c.parent_id).map(category => {
              const customizadas = categories.filter(c => c.parent_id?.toLowerCase() === category.name.toLowerCase());
              const subcategories = customizadas.map(c => ({ id: c.id, name: c.name.charAt(0).toUpperCase() + c.name.slice(1), value: c.name, isFixed: false, originalCat: c }));

              let mainCount = 0; let mainIncome = 0; let mainExpenses = 0;
              const directStats = categoryStats.find(s => s.category.toLowerCase() === category.name.toLowerCase());
              if (directStats) {
                mainCount += directStats.count; mainIncome += directStats.income; mainExpenses += directStats.expenses;
              }
              subcategories.forEach(sub => {
                const sStats = categoryStats.find(s => s.category.toLowerCase() === sub.value.toLowerCase());
                if (sStats) {
                  mainCount += sStats.count; mainIncome += sStats.income; mainExpenses += sStats.expenses;
                }
              });

              const hasTransactions = mainCount > 0;

              return (
                <div key={category.id} className={`p-3 rounded-lg border-2 transition-colors ${hasTransactions ? 'border-primary/20 bg-primary/5' : 'border-dashed border-muted-foreground/20 bg-muted/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Tag className={`w-4 h-4 ${hasTransactions ? 'text-primary' : 'text-muted-foreground'}`} />
                      <h3 className="font-bold text-sm tracking-tight">{category.name.charAt(0).toUpperCase() + category.name.slice(1)}</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)} className="h-6 w-6 p-0"><Edit className="w-3 h-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir categoria</AlertDialogTitle><AlertDialogDescription>Deseja excluir "{category.name}"?</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCategory(category)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {hasTransactions ? (
                    <div className="space-y-0.5 text-xs mt-2 font-medium">
                      <div className="flex justify-between"><span className="text-muted-foreground">Movimentações:</span><span>{mainCount}</span></div>
                      {mainIncome > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Receitas:</span><span className="text-green-500">R$ {mainIncome.toFixed(2).replace(".", ",")}</span></div>}
                      {mainExpenses > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Despesas:</span><span className="text-red-500">R$ {mainExpenses.toFixed(2).replace(".", ",")}</span></div>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 mt-1">Sem movimentações</p>
                  )}

                  {subcategories.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-2">
                      {subcategories.map(sub => {
                        const subStats = categoryStats.find(s => s.category === sub.value);
                        return (
                          <div key={sub.id} className="flex items-center justify-between text-xs bg-muted/40 p-1.5 rounded-md border border-border/30">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CornerDownRight className="w-3 h-3" />
                              <span className="font-medium text-foreground">{sub.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {subStats && <span className="text-muted-foreground mr-1">{subStats.count} tr</span>}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive/70 hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Excluir subcategoria</AlertDialogTitle><AlertDialogDescription>Deseja excluir "{sub.name}"?</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCategory(sub.originalCat)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
            <DialogTitle>{editingCategory?.parent_id ? "Editar Subcategoria" : "Editar Categoria e Subcategorias"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome da {editingCategory?.parent_id ? "Subcategoria" : "Categoria"}</label>
              <Input
                placeholder="Nome"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditCategory()}
              />
            </div>

            {/* SE FOR UMA CATEGORIA PRINCIPAL: MOSTRAR SUBCATEGORIAS EM VEZ DO PARENT SELECTOR */}
            {!editingCategory?.parent_id ? (
              <div className="pt-4 border-t border-border mt-4">
                <p className="text-sm font-medium mb-3">Subcategorias</p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 mb-3">
                  {categories.filter(c => c.parent_id?.toLowerCase() === editingCategory?.name.toLowerCase()).length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 bg-muted/20 rounded border border-dashed">Nenhuma subcategoria criada.</p>
                  ) : (
                    categories.filter(c => c.parent_id?.toLowerCase() === editingCategory?.name.toLowerCase()).map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border/50">
                        <span className="text-sm font-medium">{sub.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(sub)}
                          className="h-6 w-6 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Nova subcategoria..."
                    value={editNewSubcategory}
                    onChange={(e) => setEditNewSubcategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategoryFromEdit()}
                    disabled={isSubmitting}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddSubcategoryFromEdit}
                    disabled={isSubmitting || !editNewSubcategory.trim()}
                    variant="secondary"
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            ) : (
              /* SE FOR UMA SUBCATEGORIA: MOSTRAR O SELETOR DE PAI CASO QUEIRA MOVER */
              <div>
                <label className="text-sm font-medium mb-1 block">Mover para outra Categoria Pai (Opcional)</label>
                <Select value={editCategoryParentId} onValueChange={setEditCategoryParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria Pai" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    <SelectItem value="none">Tornar Categoria Principal (Remover Pai)</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">Categorias Nativas</div>
                    {filteredGroups.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                    {categories.filter(c => !c.parent_id && c.id !== editingCategory?.id).length > 0 && (
                      <div>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">Minhas Categorias Principais</div>
                        {categories.filter(c => !c.parent_id && c.id !== editingCategory?.id).map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                          </SelectItem>
                        ))}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-border mt-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditCategory} disabled={isSubmitting}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};