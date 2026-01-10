import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Statistics } from "@/components/Statistics";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const StatsPage = () => {
  const { user } = useOutletContext<OutletContextType>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Estatísticas</h1>
      <Statistics />
    </div>
  );
};

export default StatsPage;
