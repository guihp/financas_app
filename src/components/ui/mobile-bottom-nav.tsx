import { useNavigate, useLocation } from "react-router-dom";
import { TrendingUp, CreditCard, BarChart3, Tag, Calendar, Plus } from "lucide-react";
import { useState } from "react";
import { AddTransactionFab } from "@/components/AddTransactionFab";

interface MobileBottomNavProps {
  currentView?: string;
  setCurrentView?: (view: any) => void;
  onAddTransaction?: () => void;
}

export const MobileBottomNav = ({ currentView, setCurrentView, onAddTransaction }: MobileBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const navItems = [
    { path: "/dash", view: "dashboard", label: "Início", icon: TrendingUp },
    { path: "/transactions", view: "transactions", label: "Trans.", icon: CreditCard },
    { path: "/stats", view: "statistics", label: "Stats", icon: BarChart3 },
    { path: "/categorias", view: "categories", label: "Categ.", icon: Tag },
    { path: "/agenda", view: "appointments", label: "Agend.", icon: Calendar },
  ];

  const handleTransactionAdded = () => {
    // Se estiver usando state mode
    if (setCurrentView) {
      setCurrentView("transactions");
    } else {
      // Se estiver usando router mode
      navigate("/transactions");
    }
  };

  const isRouterMode = !setCurrentView;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        {/* Safe area padding for iPhone notch/home indicator */}
        <div
          className="grid grid-cols-6 items-center px-2 pt-3 min-h-[80px]"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isRouterMode
              ? location.pathname === item.path
              : currentView === item.view;

            return (
              <button
                key={item.path}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all active:scale-95 ${active
                  ? "text-primary"
                  : "text-white/60"
                  }`}
                onClick={() => {
                  if (isRouterMode) {
                    navigate(item.path);
                  } else {
                    setCurrentView?.(item.view);
                  }
                }}
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
              onClick={() => {
                if (onAddTransaction) {
                  onAddTransaction();
                } else {
                  setShowAddDialog(true);
                }
              }}
              className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 flex items-center justify-center transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Internal Add Transaction Dialog - only used if no external handler provided */}
      {!onAddTransaction && (
        <AddTransactionFab
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onTransactionAdded={handleTransactionAdded}
        />
      )}
    </>
  );
};
