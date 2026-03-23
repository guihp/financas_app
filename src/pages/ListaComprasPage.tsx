import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
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
  ChevronDown,
  ChevronUp,
  Target,
  DollarSign,
  ArrowLeft,
  History,
  Copy,
  ShoppingBag,
  Pencil,
  CalendarCheck,
  ClipboardList,
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
  finished_at: string | null;
  final_value: number | null;
  payment_method: string | null;
  bank_id: string | null;
  credit_card_id: string | null;
  created_at: string;
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

interface BankAccount {
  id: string;
  name: string;
}

interface CreditCardInfo {
  id: string;
  name: string;
  color: string;
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

  // View state: "lists" or "detail"
  const [view, setView] = useState<"lists" | "detail">("lists");
  const [loading, setLoading] = useState(true);

  // All lists
  const [allLists, setAllLists] = useState<ShoppingList[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardInfo[]>([]);

  // Active list detail
  const [currentList, setCurrentList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Create list dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("Minha Lista");
  const [newListBudget, setNewListBudget] = useState("");
  const [wantBudget, setWantBudget] = useState(false);

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

  // Price alert
  const [showPriceAlert, setShowPriceAlert] = useState(false);
  const [priceAlertItem, setPriceAlertItem] = useState<ShoppingItem | null>(null);
  const [priceAlertValue, setPriceAlertValue] = useState("");

  // Delete item
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Budget edit
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");

  // Finalize dialog
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalValue, setFinalValue] = useState("");
  const [finalPaymentMethod, setFinalPaymentMethod] = useState("debit");
  const [finalBankId, setFinalBankId] = useState("");
  const [finalCreditCardId, setFinalCreditCardId] = useState("");

  // Delete list
  const [deleteListId, setDeleteListId] = useState<string | null>(null);

  // ───────── Load ─────────
  const loadLists = useCallback(async () => {
    try {
      const [{ data: lists }, { data: banksData }, { data: cardsData }] = await Promise.all([
        supabase
          .from("shopping_lists")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("bank_accounts")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("credit_cards")
          .select("id, name, color")
          .eq("user_id", user.id)
          .order("name"),
      ]);

      setAllLists((lists || []) as ShoppingList[]);
      setBanks((banksData || []) as BankAccount[]);
      setCreditCards((cardsData || []) as CreditCardInfo[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (user?.id) loadLists();
  }, [user?.id, loadLists]);

  const loadItems = async (listId: string) => {
    const { data } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .order("checked")
      .order("category")
      .order("name");
    setItems((data || []) as ShoppingItem[]);
  };

  const openList = async (list: ShoppingList) => {
    setCurrentList(list);
    await loadItems(list.id);
    setSearchTerm("");
    setCollapsedCategories(new Set());
    setView("detail");
  };

  // ───────── Calculations ─────────
  const totalChecked = items.filter(i => i.checked).length;
  const totalItems = items.length;

  const totalValue = useMemo(() => {
    return items.filter(i => i.checked).reduce((sum, item) => {
      if (item.unit_type === "kg") return sum + item.quantity * item.weight_per_unit * item.price;
      return sum + item.quantity * item.price;
    }, 0);
  }, [items]);

  const budget = currentList?.budget || 0;
  const budgetPercent = budget > 0 ? Math.min((totalValue / budget) * 100, 100) : 0;
  const overBudget = budget > 0 && totalValue > budget;
  const itemsPercent = totalItems > 0 ? (totalChecked / totalItems) * 100 : 0;

  const customCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return Array.from(cats).filter(c => !DEFAULT_CATEGORIES.includes(c));
  }, [items]);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term));
  }, [items, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aAll = a.every(i => i.checked);
      const bAll = b.every(i => i.checked);
      if (aAll && !bAll) return 1;
      if (!aAll && bAll) return -1;
      return 0;
    });
  }, [filteredItems]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const calcItemTotal = (item: ShoppingItem) => {
    if (item.unit_type === "kg") return item.quantity * item.weight_per_unit * item.price;
    return item.quantity * item.price;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  // ───────── Handlers ─────────
  const handleCreateList = async () => {
    const name = newListName.trim() || "Minha Lista";
    const budgetVal = wantBudget ? parseFloat(newListBudget.replace(",", ".")) || 0 : 0;

    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, name, budget: budgetVal, is_active: true })
      .select()
      .single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setShowCreateDialog(false);
    setNewListName("Minha Lista");
    setNewListBudget("");
    setWantBudget(false);
    await loadLists();
    openList(data as ShoppingList);
  };

  const handleReuseList = async (sourceList: ShoppingList) => {
    // Create new list copying the name
    const { data: newList, error: listErr } = await supabase
      .from("shopping_lists")
      .insert({
        user_id: user.id,
        name: `${sourceList.name} (cópia)`,
        budget: sourceList.budget,
        is_active: true,
      })
      .select()
      .single();

    if (listErr || !newList) {
      toast({ title: "Erro", description: listErr?.message || "Erro ao copiar lista.", variant: "destructive" });
      return;
    }

    // Copy items from source
    const { data: sourceItems } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("list_id", sourceList.id);

    if (sourceItems && sourceItems.length > 0) {
      const newItems = sourceItems.map((si: any) => ({
        list_id: newList.id,
        user_id: user.id,
        name: si.name,
        category: si.category,
        quantity: si.quantity,
        unit_type: si.unit_type,
        weight_per_unit: si.weight_per_unit,
        price: si.price,
        checked: false,
        require_price: si.require_price,
      }));
      await supabase.from("shopping_items").insert(newItems);
    }

    await loadLists();
    openList(newList as ShoppingList);
    toast({ title: "Lista copiada!", description: "Itens da lista anterior foram reutilizados." });
  };

  const handleDeleteList = async () => {
    if (!deleteListId) return;
    await supabase.from("shopping_items").delete().eq("list_id", deleteListId);
    await supabase.from("shopping_lists").delete().eq("id", deleteListId);
    setDeleteListId(null);
    if (currentList?.id === deleteListId) {
      setView("lists");
      setCurrentList(null);
    }
    await loadLists();
    toast({ title: "Lista excluída!" });
  };

  const handleFinalizeList = async () => {
    if (!currentList) return;
    const val = parseFloat(finalValue.replace(",", ".")) || totalValue;
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const newName = `Compras ${dateStr}`;

    const updateData: any = {
      is_active: false,
      finished_at: now.toISOString(),
      final_value: val,
      payment_method: finalPaymentMethod,
      name: newName,
    };
    if (finalPaymentMethod === "credit" && finalCreditCardId) {
      updateData.credit_card_id = finalCreditCardId;
    } else if (finalBankId) {
      updateData.bank_id = finalBankId;
    }

    const { error } = await supabase
      .from("shopping_lists")
      .update(updateData)
      .eq("id", currentList.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    // Create transaction
    const txData: any = {
      user_id: user.id,
      type: "expense",
      amount: val,
      description: newName,
      category: "Mercado",
      payment_method: finalPaymentMethod,
      date: now.toISOString().split("T")[0],
    };
    if (finalPaymentMethod === "credit" && finalCreditCardId) {
      txData.credit_card_id = finalCreditCardId;
    } else if (finalBankId) {
      txData.bank_id = finalBankId;
    }

    await supabase.from("transactions").insert(txData);

    setShowFinalizeDialog(false);
    setView("lists");
    setCurrentList(null);
    await loadLists();
    toast({ title: "Compra finalizada! 🎉", description: `Transação de ${formatCurrency(val)} registrada.` });
  };

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
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
  };

  const handlePriceAlertConfirm = async () => {
    if (!priceAlertItem) return;
    const price = parseFloat(priceAlertValue.replace(",", ".")) || 0;
    const { error } = await supabase
      .from("shopping_items")
      .update({ price, checked: true } as any)
      .eq("id", priceAlertItem.id);
    if (!error) setItems(prev => prev.map(i => i.id === priceAlertItem.id ? { ...i, price, checked: true } : i));
    setShowPriceAlert(false);
  };

  const handlePriceAlertSkip = async () => {
    if (!priceAlertItem) return;
    const { error } = await supabase
      .from("shopping_items")
      .update({ checked: true } as any)
      .eq("id", priceAlertItem.id);
    if (!error) setItems(prev => prev.map(i => i.id === priceAlertItem.id ? { ...i, checked: true } : i));
    setShowPriceAlert(false);
  };

  const handleToggleUnitType = async (item: ShoppingItem) => {
    const newType = item.unit_type === "un" ? "kg" : "un";
    const { error } = await supabase.from("shopping_items").update({ unit_type: newType } as any).eq("id", item.id);
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, unit_type: newType } : i));
  };

  const handleUpdateField = async (item: ShoppingItem, field: string, value: number) => {
    const { error } = await supabase.from("shopping_items").update({ [field]: value } as any).eq("id", item.id);
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, [field]: value } : i));
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || !currentList) return;
    const category = showCustomCategoryInput && newCustomCategory.trim() ? newCustomCategory.trim() : newItemCategory;
    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        list_id: currentList.id,
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
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setItems(prev => [...prev, data as ShoppingItem]);
    setNewItemName(""); setNewItemQty("1"); setNewItemWeight("0"); setNewItemPrice("0");
    setNewItemUnitType("un"); setShowCustomCategoryInput(false); setNewCustomCategory("");
    setShowAddDialog(false);
    toast({ title: "Item adicionado!" });
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    await supabase.from("shopping_items").delete().eq("id", deleteItemId);
    setItems(prev => prev.filter(i => i.id !== deleteItemId));
    setDeleteItemId(null);
  };

  const handleUpdateBudget = async () => {
    if (!currentList) return;
    const val = parseFloat(budgetValue.replace(",", ".")) || 0;
    await supabase.from("shopping_lists").update({ budget: val } as any).eq("id", currentList.id);
    setCurrentList(prev => prev ? { ...prev, budget: val } : prev);
    setEditingBudget(false);
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat); else n.add(cat);
      return n;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  // ═══════════ LISTS VIEW ═══════════
  if (view === "lists") {
    const activeLists = allLists.filter(l => l.is_active);
    const finishedLists = allLists.filter(l => !l.is_active);

    return (
      <div className="space-y-6 pb-24 lg:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-pink-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Lista de Compras</h1>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova Lista
          </Button>
        </div>

        {/* Active Lists */}
        {activeLists.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Listas Ativas
            </h2>
            {activeLists.map(list => (
              <Card key={list.id} className="border-border hover:border-pink-500/30 transition-all cursor-pointer" onClick={() => openList(list)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-pink-500/15 flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-pink-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(list.created_at)}
                        {list.budget > 0 && ` • Orçamento: ${formatCurrency(list.budget)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteListId(list.id); }}
                      className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {activeLists.length === 0 && (
          <Card className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Nenhuma lista ativa</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie uma nova lista para começar suas compras.</p>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Criar Lista
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History */}
        {finishedLists.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico ({finishedLists.length})
            </h2>
            {finishedLists.map(list => (
              <Card key={list.id} className="border-border opacity-70 hover:opacity-100 transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => openList(list)}>
                    <div className="h-10 w-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                      <CalendarCheck className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {list.finished_at ? formatDate(list.finished_at) : formatDate(list.created_at)}
                        {list.final_value != null && ` • ${formatCurrency(list.final_value)}`}
                        {list.payment_method && ` • ${list.payment_method === "credit" ? "Crédito" : list.payment_method === "pix" ? "PIX" : "Débito"}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      onClick={e => { e.stopPropagation(); handleReuseList(list); }}
                      className="h-8 px-2 text-xs gap-1 text-primary"
                      title="Reutilizar esta lista"
                    >
                      <Copy className="h-3.5 w-3.5" /> Reutilizar
                    </Button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteListId(list.id); }}
                      className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create List Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-pink-500" />
                Nova Lista de Compras
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                placeholder="Nome da lista"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setWantBudget(!wantBudget)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm ${wantBudget ? "border-pink-500 bg-pink-500/10 text-pink-500" : "border-border text-muted-foreground hover:border-border/80"}`}
                >
                  <Target className="h-4 w-4" />
                  {wantBudget ? "Com orçamento" : "Definir orçamento?"}
                </button>
              </div>
              {wantBudget && (
                <Input
                  type="number"
                  placeholder="Valor do orçamento (ex: 500)"
                  value={newListBudget}
                  onChange={e => setNewListBudget(e.target.value)}
                  min="0" step="0.01"
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateList}>Criar Lista</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete list confirm */}
        <AlertDialog open={!!deleteListId} onOpenChange={open => { if (!open) setDeleteListId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar lista?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação remove a lista e todos os itens. Não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteList} className="bg-destructive text-destructive-foreground">Apagar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ═══════════ DETAIL VIEW ═══════════
  const isFinished = !currentList?.is_active;

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setView("lists")} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-bold">{currentList?.name}</h1>
          <p className="text-xs text-muted-foreground">
            {isFinished ? `Finalizada em ${formatDate(currentList?.finished_at || currentList?.created_at || "")}` : "Lista ativa"}
          </p>
        </div>
        {!isFinished && (
          <Button
            onClick={() => { setFinalValue(String(totalValue.toFixed(2))); setShowFinalizeDialog(true); }}
            className="bg-green-600 hover:bg-green-700 gap-1.5 text-xs px-3"
          >
            <CheckCircle2 className="h-4 w-4" /> Finalizar
          </Button>
        )}
      </div>

      {/* Smart Panel */}
      <Card className="border-border overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Budget */}
          {!isFinished && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Orçamento</span>
              </div>
              {editingBudget ? (
                <div className="flex items-center gap-2">
                  <Input className="h-7 w-28 text-sm text-right" value={budgetValue} onChange={e => setBudgetValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleUpdateBudget()} autoFocus placeholder="0,00" />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={handleUpdateBudget}>OK</Button>
                </div>
              ) : (
                <button onClick={() => { setBudgetValue(String(budget)); setEditingBudget(true); }} className="flex items-center gap-1 text-sm font-bold text-foreground hover:text-primary transition-colors">
                  {formatCurrency(budget)} <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {budget > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={overBudget ? "text-red-500 font-medium" : "text-green-500 font-medium"}>
                  {formatCurrency(totalValue)} de {formatCurrency(budget)}
                </span>
                <span className={overBudget ? "text-red-500" : "text-muted-foreground"}>{budgetPercent.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${overBudget ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${Math.min(budgetPercent, 100)}%` }} />
              </div>
            </div>
          )}

          {/* Items progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground"><span className="font-medium text-foreground">{totalChecked}</span>/{totalItems} itens</span>
              <span className="text-muted-foreground">{itemsPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${itemsPercent}%` }} />
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">{isFinished ? "Valor final" : "Total no carrinho"}</span>
            </div>
            <span className={`text-lg font-bold ${overBudget ? "text-red-500" : "text-green-500"}`}>
              {isFinished && currentList?.final_value != null ? formatCurrency(currentList.final_value) : formatCurrency(totalValue)}
            </span>
          </div>

          {/* Search */}
          {!isFinished && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." className="pl-9 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      {groupedItems.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Lista vazia</h3>
            <p className="text-sm text-muted-foreground">Adicione itens com o botão +</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedItems.map(([category, catItems]) => {
            const collapsed = collapsedCategories.has(category);
            const done = catItems.filter(i => i.checked).length;
            const allDone = done === catItems.length;
            return (
              <Card key={category} className={`border-border overflow-hidden transition-all ${allDone ? "opacity-60" : ""}`}>
                <button onClick={() => toggleCategory(category)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{category}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{done}/{catItems.length}</span>
                  </div>
                  {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                </button>
                {!collapsed && (
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {catItems.map(item => (
                        <div key={item.id} className={`px-4 py-3 transition-colors ${item.checked ? "bg-muted/30" : "hover:bg-muted/20"}`}>
                          <div className="flex items-center gap-3">
                            <button onClick={() => !isFinished && handleToggleCheck(item)} className="flex-shrink-0" disabled={isFinished}>
                              {item.checked ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}>{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <button onClick={() => !isFinished && handleToggleUnitType(item)} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium" disabled={isFinished}>
                                  {item.unit_type === "kg" ? "⚖️ Kg" : "📦 Un"}
                                </button>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">QTD:</span>
                                  <input type="number" className="w-10 h-5 text-[11px] text-center bg-muted/50 border border-border rounded px-0.5" value={item.quantity} onChange={e => handleUpdateField(item, "quantity", parseFloat(e.target.value) || 0)} min="0" step="1" disabled={isFinished} />
                                </div>
                                {item.unit_type === "kg" && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">PESO:</span>
                                    <input type="number" className="w-14 h-5 text-[11px] text-center bg-muted/50 border border-border rounded px-0.5" value={item.weight_per_unit} onChange={e => handleUpdateField(item, "weight_per_unit", parseFloat(e.target.value) || 0)} min="0" step="0.01" disabled={isFinished} />
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground">R$:</span>
                                  <input type="number" className="w-16 h-5 text-[11px] text-center bg-muted/50 border border-border rounded px-0.5" value={item.price} onChange={e => handleUpdateField(item, "price", parseFloat(e.target.value) || 0)} min="0" step="0.01" disabled={isFinished} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs font-semibold ${item.checked ? "text-green-500" : "text-foreground"}`}>{formatCurrency(calcItemTotal(item))}</span>
                              {!isFinished && (
                                <button onClick={() => setDeleteItemId(item.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
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

      {/* FAB */}
      {!isFinished && (
        <Button onClick={() => setShowAddDialog(true)} className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 h-14 w-14 rounded-full shadow-xl bg-pink-500 hover:bg-pink-600 text-white z-50">
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* ──── Dialogs ──── */}

      {/* Add Item */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-pink-500" /> Adicionar Produto</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Nome do produto" value={newItemName} onChange={e => setNewItemName(e.target.value)} autoFocus />
            <Select value={showCustomCategoryInput ? "__custom__" : newItemCategory} onValueChange={v => { if (v === "__custom__") { setShowCustomCategoryInput(true); } else { setShowCustomCategoryInput(false); setNewItemCategory(v); } }}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>{allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}<SelectItem value="__custom__">+ Nova categoria...</SelectItem></SelectContent>
            </Select>
            {showCustomCategoryInput && <Input placeholder="Nome da nova categoria" value={newCustomCategory} onChange={e => setNewCustomCategory(e.target.value)} />}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Quantidade</label><Input type="number" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} min="1" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Tipo</label><Select value={newItemUnitType} onValueChange={v => setNewItemUnitType(v as "un" | "kg")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="un">📦 Unidade</SelectItem><SelectItem value="kg">⚖️ Kg</SelectItem></SelectContent></Select></div>
            </div>
            {newItemUnitType === "kg" && <div><label className="text-xs text-muted-foreground mb-1 block">Peso estimado (kg)</label><Input type="number" value={newItemWeight} onChange={e => setNewItemWeight(e.target.value)} min="0" step="0.01" /></div>}
            <div><label className="text-xs text-muted-foreground mb-1 block">Preço {newItemUnitType === "kg" ? "por Kg" : "unitário"} (opcional)</label><Input type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} min="0" step="0.01" /></div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddItem} disabled={!newItemName.trim()} className="bg-pink-500 hover:bg-pink-600">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Alert */}
      <Dialog open={showPriceAlert} onOpenChange={setShowPriceAlert}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-amber-500" /> Preço do produto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O item <strong className="text-foreground">{priceAlertItem?.name}</strong> está com preço R$ 0,00.</p>
          <Input type="number" placeholder="Ex: 5.99" value={priceAlertValue} onChange={e => setPriceAlertValue(e.target.value)} autoFocus min="0" step="0.01" />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handlePriceAlertSkip}>Pular</Button>
            <Button onClick={handlePriceAlertConfirm} disabled={!priceAlertValue}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete item */}
      <AlertDialog open={!!deleteItemId} onOpenChange={o => { if (!o) setDeleteItemId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Apagar item?</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja apagar este item?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground">Apagar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finalize Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" /> Finalizar Compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor total da compra</label>
              <Input type="number" value={finalValue} onChange={e => setFinalValue(e.target.value)} min="0" step="0.01" placeholder="0,00" autoFocus />
              <p className="text-xs text-muted-foreground mt-1">Total estimado: {formatCurrency(totalValue)}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Forma de pagamento</label>
              <Select value={finalPaymentMethod} onValueChange={setFinalPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">💳 Débito</SelectItem>
                  <SelectItem value="credit">💳 Crédito</SelectItem>
                  <SelectItem value="pix">📱 PIX</SelectItem>
                  <SelectItem value="cash">💵 Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {finalPaymentMethod === "credit" ? (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cartão de Crédito</label>
                <Select value={finalCreditCardId} onValueChange={setFinalCreditCardId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                  <SelectContent>
                    {creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : finalPaymentMethod !== "cash" ? (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Conta Bancária</label>
                <Select value={finalBankId} onValueChange={setFinalBankId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>Cancelar</Button>
            <Button onClick={handleFinalizeList} className="bg-green-600 hover:bg-green-700 gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Finalizar e Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListaComprasPage;
