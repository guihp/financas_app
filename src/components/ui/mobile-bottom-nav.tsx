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
    { id: "transactions", label: "Trans.", icon: CreditCard },
    { id: "statistics", label: "Stats", icon: BarChart3 },
    { id: "categories", label: "Categ.", icon: Tag },
    { id: "appointments", label: "Agend.", icon: Calendar },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      {/* Safe area padding for iPhone notch/home indicator */}
      <div 
        className="grid grid-cols-6 items-center px-1 pt-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all active:scale-95 ${
                isActive 
                  ? "text-primary" 
                  : "text-white/60"
              }`}
              onClick={() => setCurrentView(item.id)}
            >
              <div className={`p-1.5 rounded-lg mb-0.5 transition-colors ${isActive ? 'bg-primary/20' : ''}`}>
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              </div>
              <span className={`text-[9px] font-medium leading-tight ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        {/* Add Transaction FAB */}
        <div className="flex justify-center">
          <button
            onClick={onAddTransaction}
            className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 flex items-center justify-center transition-all active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
};