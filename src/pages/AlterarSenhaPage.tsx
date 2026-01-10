import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { ChangePassword } from "@/components/ChangePassword";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const AlterarSenhaPage = () => {
  const { user } = useOutletContext<OutletContextType>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Alterar Senha</h1>
      <ChangePassword />
    </div>
  );
};

export default AlterarSenhaPage;
