import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Categories } from "@/components/Categories";
import { supabase } from "@/integrations/supabase/client";
import { Transaction } from "@/components/Dashboard";
import { useToast } from "@/hooks/use-toast";

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

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id);

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

  const loadData = async () => {
    await Promise.all([fetchTransactions(), fetchCategories()]);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const addCategory = async (name: string) => {
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
        name: normalizedName,
        user_id: user.id,
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
    <div className="space-y-6 pb-32 xl:pb-6">
      <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
      <Categories
        transactions={transactions}
        categories={categories}
        onAddCategory={addCategory}
        onUpdateCategories={fetchCategories}
      />
    </div>
  );
};


export default CategoriasPage;
