import { Button } from "@/components/ui/button";
import { TrendingUp, CreditCard, BarChart3, Tag, Calendar, Plus } from "lucide-react";

interface MobileBottomNavProps {
  currentView: "dashboard" | "transactions" | "statistics" | "categories" | "appointments" | "api-test" | "change-password";
  setCurrentView: (view: "dashboard" | "transactions" | "statistics" | "categories" | "appointments" | "api-test" | "change-password") => void;
  onAddTransaction: () => void;
}

export const MobileBottomNav = ({ 
  currentView, 
  setCurrentView, 
  onAddTransaction 
}: MobileBottomNavProps) => {
  const navItems: Array<{
    id: "dashboard" | "transactions" | "statistics" | "categories" | "appointments";
    label: string;
    icon: any;
  }> = [
    { id: "dashboard", label: "Início", icon: TrendingUp },
    { id: "transactions", label: "Transações", icon: CreditCard },
    { id: "statistics", label: "Estatísticas", icon: BarChart3 },
    { id: "categories", label: "Categorias", icon: Tag },
    { id: "appointments", label: "Agendamentos", icon: Calendar },
  ];

  return (
    <div className="mobile-bottom-nav lg:hidden">
      <div className="grid grid-cols-6 items-center px-2 py-3 safe-area-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center justify-center h-12 px-1 py-1 ${
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setCurrentView(item.id)}
            >
              <Icon className={`h-4 w-4 mb-1 ${isActive ? "text-primary" : ""}`} />
              <span className="text-[10px] leading-tight truncate max-w-[60px]">{item.label}</span>
            </Button>
          );
        })}
        
        {/* Add Transaction FAB */}
        <div className="flex justify-center">
          <Button
            size="sm"
            onClick={onAddTransaction}
            className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};