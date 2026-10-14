import { useEffect, useState, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Categories } from "@/components/Categories";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Transaction } from "@/components/Dashboard";
import { useToast } from "@/hooks/use-toast";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { filterTransactionsByDate, getDateFilterBounds } from "@/utils/dateFilter";
import type { DateFilterOption, DateRange } from "@/utils/dateFilter";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const CategoriasPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("thisMonth");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  // Só o período do filtro é buscado no banco (null = todo o histórico)
  const bounds = useMemo(() => getDateFilterBounds(dateFilter, dateRange), [dateFilter, dateRange]);
  const boundsKey = bounds ? `${bounds.from}|${bounds.to}` : "all";

  // Ignora respostas atrasadas ao trocar de filtro rapidamente
  const requestIdRef = useRef(0);

  const fetchTransactions = async () => {
    const requestId = ++requestIdRef.current;
    const { data } = await fetchAllRows(() => {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id);
      if (bounds) query = query.gte("date", bounds.from).lte("date", bounds.to);
      return query.order("id");
    });

    if (requestId !== requestIdRef.current) return;
    if (data) {
      const mapped = data.map(t => ({
        ...t,
        amount: Number(t.amount),
        date: t.date || t.created_at,
        type: t.type as "income" | "expense"
      }));
      setTransactions(mapped);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      console.error("Erro ao carregar categorias:", error);
    } else {
      setCategories(data || []);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchCategories();
    }
  }, [user?.id]);

  // Recarrega as transações ao trocar de período
  useEffect(() => {
    if (user?.id) {
      fetchTransactions().finally(() => setLoading(false));
    }
  }, [user?.id, boundsKey]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByDate(transactions as any, dateFilter, dateRange) as unknown as Transaction[],
    [transactions, dateFilter, dateRange]
  );

  const addCategory = async (name: string, parentId?: string) => {
    // Verificar se categoria já existe (case insensitive)
    const normalizedName = name.toLowerCase().trim();
    const exists = categories.some(idx => idx.name.toLowerCase() === normalizedName);

    if (exists) {
      toast({
        title: "Categoria duplicada",
        description: "Você já possui uma categoria com este nome.",
        variant: "destructive",
      });
      return false;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert([{
        name: name.trim(),
        user_id: user.id,
        parent_id: parentId ? parentId.trim() : null
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    if (data) {
      setCategories(prev => [...prev, data]);
      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso!",
      });
      return true;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Categorias</h1>
        <DateRangeFilter
          value={dateFilter}
          dateRange={dateRange}
          onValueChange={setDateFilter}
          onDateRangeChange={setDateRange}
        />
      </div>
      <Categories
        transactions={filteredTransactions}
        categories={categories}
        onAddCategory={addCategory}
        onUpdateCategories={fetchCategories}
      />
    </div>
  );
};


export default CategoriasPage;
