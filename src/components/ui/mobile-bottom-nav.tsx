import { useNavigate, useLocation } from "react-router-dom";
import { TrendingUp, CreditCard, BarChart3, Tag, Calendar, Plus } from "lucide-react";
import { useState } from "react";
import { AddTransactionFab } from "@/components/AddTransactionFab";

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const navItems = [
    { path: "/dash", label: "Início", icon: TrendingUp },
    { path: "/transactions", label: "Trans.", icon: CreditCard },
    { path: "/stats", label: "Stats", icon: BarChart3 },
    { path: "/categorias", label: "Categ.", icon: Tag },
    { path: "/agenda", label: "Agend.", icon: Calendar },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleTransactionAdded = () => {
    // Navegar para transações após adicionar
    navigate("/transactions");
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        {/* Safe area padding for iPhone notch/home indicator */}
        <div 
          className="grid grid-cols-6 items-center px-1 pt-2 min-h-[70px]"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <button
                key={item.path}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all active:scale-95 ${
                  active 
                    ? "text-primary" 
                    : "text-white/60"
                }`}
                onClick={() => navigate(item.path)}
              >
                <div className={`p-1.5 rounded-lg mb-0.5 transition-colors ${active ? 'bg-primary/20' : ''}`}>
                  <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                </div>
                <span className={`text-[9px] font-medium leading-tight ${active ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          
          {/* Add Transaction FAB */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowAddDialog(true)}
              className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 flex items-center justify-center transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Add Transaction Dialog */}
      <AddTransactionFab 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onTransactionAdded={handleTransactionAdded}
      />
    </>
  );
};
