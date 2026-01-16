import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Appointments } from "@/components/Appointments";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const AgendaPage = () => {
  const { user } = useOutletContext<OutletContextType>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
      <Appointments user={user} />
    </div>
  );
};

export default AgendaPage;
