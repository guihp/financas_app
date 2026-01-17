import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Statistics } from "@/components/Statistics";
import { supabase } from "@/integrations/supabase/client";
import { Transaction } from "@/components/Dashboard";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const StatsPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false });

        if (error) throw error;

        const mappedTransactions = (data || []).map(t => ({
          ...t,
          amount: Number(t.amount),
          date: t.date || t.created_at,
          type: t.type as "income" | "expense"
        }));

        setTransactions(mappedTransactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchTransactions();
    }
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 lg:pb-6">
      <h1 className="text-2xl font-bold text-foreground">Estatísticas</h1>
      <Statistics transactions={transactions} />
    </div>
  );
};

export default StatsPage;
