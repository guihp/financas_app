import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Circle,
  Scale,
  Package,
  Pencil,
  ChevronDown,
  ChevronUp,
  Target,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  budget: number;
  is_active: boolean;
}

interface ShoppingItem {
  id: string;
  list_id: string;
  user_id: string;
  name: string;
  category: string;
  quantity: number;
  unit_type: "un" | "kg";
  weight_per_unit: number;
  price: number;
  checked: boolean;
  require_price: boolean;
}

const DEFAULT_CATEGORIES = [
  "🍎 Frutas",
  "🥕 Legumes e Verduras",
  "🛒 Mercado",
  "🥩 Proteínas",
  "🧴 Higiene",
  "🧹 Limpeza",
  "🥤 Bebidas",
  "🍞 Padaria",
  "🧀 Frios e Laticínios",
  "🍬 Doces e Snacks",
  "📦 Outros",
];

const ListaComprasPage = () => {
  const { toast } = useToast();
  const { user } = useOutletContext<OutletContextType>();

  // State
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Add item dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnitType, setNewItemUnitType] = useState<"un" | "kg">("un");
  const [newItemWeight, setNewItemWeight] = useState("0");
  const [newItemPrice, setNewItemPrice] = useState("0");
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);

  // Price alert dialog
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  const [priceAlertItem, setPriceAlertItem] = useState<ShoppingItem | null>(null);
  const [priceAlertValue, setPriceAlertValue] = useState("");

  // Delete confirmation
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Budget edit
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");

  // Load data
  const loadData = useCallback(async () => {
    try {
      // Try to load active list
      let { data: listData, error: listError } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (listError) throw listError;

      // Create a new list if none exists
      if (!listData) {
        const { data: newList, error: createError } = await supabase
          .from("shopping_lists")
          .insert({ user_id: user.id, name: "Minha Lista", budget: 0, is_active: true })
          .select()
          .single();
        if (createError) throw createError;
        listData = newList;
      }

      setList(listData as ShoppingList);

      // Load items
      const { data: itemsData, error: itemsError } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("list_id", listData!.id)
        .eq("user_id", user.id)
        .order("checked", { ascending: true })
        .order("category")
        .order("name");

      if (itemsError) throw itemsError;
      setItems((itemsData || []) as ShoppingItem[]);
    } catch (error) {
      console.error("Error loading shopping list:", error);
      toast({ title: "Erro", description: "Erro ao carregar lista de compras.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user.id, toast]);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id, loadData]);

  // Calculations
  const totalChecked = items.filter(i => i.checked).length;
  const totalItems = items.length;

  const totalValue = useMemo(() => {
    return items.filter(i => i.checked).reduce((sum, item) => {
      if (item.unit_type === "kg") {
        return sum + item.quantity * item.weight_per_unit * item.price;
      }
      return sum + item.quantity * item.price;
    }, 0);
  }, [items]);

  const budget = list?.budget || 0;
  const budgetPercent = budget > 0 ? Math.min((totalValue / budget) * 100, 100) : 0;
  const overBudget = budget > 0 && totalValue > budget;
  const itemsPercent = totalItems > 0 ? (totalChecked / totalItems) * 100 : 0;

  // Custom categories from items
  const customCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return Array.from(cats).filter(c => !DEFAULT_CATEGORIES.includes(c));
  }, [items]);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  // Filtered & grouped items
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(term) ||
      i.category.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    // Sort: unchecked categories first
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aAllChecked = a.every(i => i.checked);
      const bAllChecked = b.every(i => i.checked);
      if (aAllChecked && !bAllChecked) return 1;
      if (!aAllChecked && bAllChecked) return -1;
      return 0;
    });
  }, [filteredItems]);

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const calcItemTotal = (item: ShoppingItem) => {
    if (item.unit_type === "kg") return item.quantity * item.weight_per_unit * item.price;
    return item.quantity * item.price;
  };

  // Handlers
  const handleToggleCheck = async (item: ShoppingItem) => {
    if (!item.checked && item.price <= 0 && item.require_price) {
      setPriceAlertItem(item);
      setPriceAlertValue("");
      setShowPriceAlert(true);
      return;
    }

    const { error } = await supabase
      .from("shopping_items")
      .update({ checked: !item.checked } as any)
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
  };

  const handlePriceAlertConfirm = async () => {
    if (!priceAlertItem) return;
    const price = parseFloat(priceAlertValue.replace(",", ".")) || 0;

    const { error } = await supabase
      .from("shopping_items")
      .update({ price, checked: true } as any)
      .eq("id", priceAlertItem.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setItems(prev => prev.map(i => i.id === priceAlertItem.id ? { ...i, price, checked: true } : i));
    setShowPriceAlert(false);
    setPriceAlertItem(null);
  };

  const handlePriceAlertSkip = async () => {
    if (!priceAlertItem) return;
    const { error } = await supabase
      .from("shopping_items")
      .update({ checked: true } as any)
      .eq("id", priceAlertItem.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setItems(prev => prev.map(i => i.id === priceAlertItem.id ? { ...i, checked: true } : i));
    setShowPriceAlert(false);
    setPriceAlertItem(null);
  };

  const handleToggleUnitType = async (item: ShoppingItem) => {
    const newType = item.unit_type === "un" ? "kg" : "un";
    const { error } = await supabase
      .from("shopping_items")
      .update({ unit_type: newType } as any)
      .eq("id", item.id);

    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, unit_type: newType } : i));
    }
  };

  const handleUpdateField = async (item: ShoppingItem, field: string, value: number) => {
    const { error } = await supabase
      .from("shopping_items")
      .update({ [field]: value } as any)
      .eq("id", item.id);

    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, [field]: value } : i));
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || !list) return;

    const category = showCustomCategoryInput && newCustomCategory.trim()
      ? newCustomCategory.trim()
      : newItemCategory;

    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        list_id: list.id,
        user_id: user.id,
        name: newItemName.trim(),
        category,
        quantity: parseFloat(newItemQty) || 1,
        unit_type: newItemUnitType,
        weight_per_unit: parseFloat(newItemWeight.replace(",", ".")) || 0,
        price: parseFloat(newItemPrice.replace(",", ".")) || 0,
        checked: false,
        require_price: true,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setItems(prev => [...prev, data as ShoppingItem]);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemWeight("0");
    setNewItemPrice("0");
    setNewItemUnitType("un");
    setShowCustomCategoryInput(false);
    setNewCustomCategory("");
    setShowAddDialog(false);
    toast({ title: "Item adicionado!", description: `${newItemName.trim()} foi adicionado à lista.` });
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    const { error } = await supabase.from("shopping_items").delete().eq("id", deleteItemId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== deleteItemId));
    setDeleteItemId(null);
    toast({ title: "Item removido!" });
  };

  const handleUpdateBudget = async () => {
    if (!list) return;
    const val = parseFloat(budgetValue.replace(",", ".")) || 0;
    const { error } = await supabase
      .from("shopping_lists")
      .update({ budget: val } as any)
      .eq("id", list.id);

    if (!error) {
      setList(prev => prev ? { ...prev, budget: val } : prev);
    }
    setEditingBudget(false);
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/20 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-pink-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Lista de Compras</h1>
            <p className="text-sm text-muted-foreground">{list?.name || "Minha Lista"}</p>
          </div>
        </div>
      </div>

      {/* Smart Panel */}
      <Card className="bg-gradient-card border-border overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Budget Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Orçamento</span>
            </div>
            {editingBudget ? (
              <div className="flex items-center gap-2">
                <Input
                  className="h-7 w-28 text-sm text-right"
                  value={budgetValue}
                  onChange={e => setBudgetValue(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleUpdateBudget()}
                  autoFocus
                  placeholder="0,00"
                />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleUpdateBudget}>OK</Button>
              </div>
            ) : (
              <button
                onClick={() => { setBudgetValue(String(budget)); setEditingBudget(true); }}
                className="flex items-center gap-1 text-sm font-bold text-foreground hover:text-primary transition-colors"
              >
                {formatCurrency(budget)}
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Budget Progress */}
          {budget > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={overBudget ? "text-red-500 font-medium" : "text-green-500 font-medium"}>
                  {formatCurrency(totalValue)} de {formatCurrency(budget)}
                </span>
                <span className={overBudget ? "text-red-500" : "text-muted-foreground"}>
                  {budgetPercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${overBudget ? "bg-red-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Items Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{totalChecked}</span>/{totalItems} itens no carrinho
              </span>
              <span className="text-muted-foreground">{itemsPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${itemsPercent}%` }}
              />
            </div>
          </div>

          {/* Total Value */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">Total no carrinho</span>
            </div>
            <span className={`text-lg font-bold ${overBudget ? "text-red-500" : "text-green-500"}`}>
              {formatCurrency(totalValue)}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items by Category */}
      {groupedItems.length === 0 ? (
        <Card className="bg-gradient-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Lista vazia</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Adicione itens clicando no botão abaixo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedItems.map(([category, catItems]) => {
            const collapsed = collapsedCategories.has(category);
            const catChecked = catItems.filter(i => i.checked).length;
            const allDone = catChecked === catItems.length;

            return (
              <Card key={category} className={`border-border overflow-hidden transition-all ${allDone ? "opacity-60" : ""}`}>
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{category}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {catChecked}/{catItems.length}
                    </span>
                  </div>
                  {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                </button>

                {/* Items */}
                {!collapsed && (
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {catItems.map(item => (
                        <div
                          key={item.id}
                          className={`px-4 py-3 transition-colors ${item.checked ? "bg-muted/30" : "hover:bg-muted/20"}`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Check */}
                            <button
                              onClick={() => handleToggleCheck(item)}
                              className="flex-shrink-0"
                            >
                              {item.checked ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                              )}
                            </button>

                            {/* Name & Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {/* Unit type toggle */}
                                <button
                                  onClick={() => handleToggleUnitType(item)}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors"
                                  title={item.unit_type === "kg" ? "Peso (Kg)" : "Unidade"}
                                >
                                  {item.unit_type === "kg" ? "⚖️ Kg" : "📦 Un"}
                                </button>

                                {/* Qty */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">QTD:</span>
                                  <input
                                    type="number"
                                    className="w-10 h-5 text-[11px] text-center bg-muted/50 border border-border rounded px-0.5"
                                    value={item.quantity}
                                    onChange={e => handleUpdateField(item, "quantity", parseFloat(e.target.value) || 0)}
                                    min="0"
                                    step="1"
                                  />
                                </div>

                                {/* Weight per unit (only for kg) */}
                                {item.unit_type === "kg" && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">PESO:</span>
                                    <input
                                      type="number"
                                      className="w-14 h-5 text-[11px] text-center bg-muted/50 border border-border rounded px-0.5"
                                      value={item.weight_per_unit}
                                      onChange={e => handleUpdateField(item, "weight_per_unit", parseFloat(e.target.value) || 0)}
                                      min="0"
                                      step="0.01"
                                      placeholder="kg"
                                    />
                                  </div>
                                )}

                                {/* Price */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">R$:</span>
                                  <input
                                    type="number"
                                    className="w-16 h-5 text-[11px] text-center bg-muted/50 border border-border rounded px-0.5"
                                    value={item.price}
                                    onChange={e => handleUpdateField(item, "price", parseFloat(e.target.value) || 0)}
                                    min="0"
                                    step="0.01"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Total & Delete */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs font-semibold ${item.checked ? "text-green-500" : "text-foreground"}`}>
                                {formatCurrency(calcItemTotal(item))}
                              </span>
                              <button
                                onClick={() => setDeleteItemId(item.id)}
                                className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* FAB - Add Item */}
      <Button
        onClick={() => setShowAddDialog(true)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 h-14 w-14 rounded-full shadow-xl bg-pink-500 hover:bg-pink-600 text-white z-50"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-pink-500" />
              Adicionar Produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Nome do produto"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              autoFocus
            />

            {/* Category */}
            <div className="space-y-2">
              <Select
                value={showCustomCategoryInput ? "__custom__" : newItemCategory}
                onValueChange={v => {
                  if (v === "__custom__") {
                    setShowCustomCategoryInput(true);
                  } else {
                    setShowCustomCategoryInput(false);
                    setNewItemCategory(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Nova categoria...</SelectItem>
                </SelectContent>
              </Select>
              {showCustomCategoryInput && (
                <Input
                  placeholder="Nome da nova categoria"
                  value={newCustomCategory}
                  onChange={e => setNewCustomCategory(e.target.value)}
                />
              )}
            </div>

            {/* Qty & Type row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
                <Input
                  type="number"
                  value={newItemQty}
                  onChange={e => setNewItemQty(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                <Select value={newItemUnitType} onValueChange={v => setNewItemUnitType(v as "un" | "kg")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">📦 Unidade</SelectItem>
                    <SelectItem value="kg">⚖️ Quilograma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Weight per unit (if kg) */}
            {newItemUnitType === "kg" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Peso estimado por unidade (kg)</label>
                <Input
                  type="number"
                  value={newItemWeight}
                  onChange={e => setNewItemWeight(e.target.value)}
                  min="0" step="0.01"
                  placeholder="Ex: 0.15 para 150g"
                />
              </div>
            )}

            {/* Price */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Preço {newItemUnitType === "kg" ? "por Kg" : "unitário"} (opcional)
              </label>
              <Input
                type="number"
                value={newItemPrice}
                onChange={e => setNewItemPrice(e.target.value)}
                min="0" step="0.01"
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddItem} disabled={!newItemName.trim()} className="bg-pink-500 hover:bg-pink-600">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Alert Dialog */}
      <Dialog open={showPriceAlert} onOpenChange={setShowPriceAlert}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-500" />
              Preço do produto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O item <strong className="text-foreground">{priceAlertItem?.name}</strong> está com preço R$ 0,00. Informe o valor para calcular corretamente.
          </p>
          <Input
            type="number"
            placeholder="Ex: 5.99"
            value={priceAlertValue}
            onChange={e => setPriceAlertValue(e.target.value)}
            autoFocus
            min="0" step="0.01"
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handlePriceAlertSkip}>Pular</Button>
            <Button onClick={handlePriceAlertConfirm} disabled={!priceAlertValue}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={open => { if (!open) setDeleteItemId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar item?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar este item da lista? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground">
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ListaComprasPage;
