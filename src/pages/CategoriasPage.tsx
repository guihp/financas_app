import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Categories } from "@/components/Categories";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const CategoriasPage = () => {
  const { user } = useOutletContext<OutletContextType>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
      <Categories />
    </div>
  );
};

export default CategoriasPage;
