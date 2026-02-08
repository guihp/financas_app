import { useNavigate, useLocation } from "react-router-dom";
import { TrendingUp, CreditCard, BarChart3, Tag, Calendar, Plus, Settings, Key, LogOut, X, User } from "lucide-react";
import { useState } from "react";
import { AddTransactionFab } from "@/components/AddTransactionFab";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface MobileBottomNavProps {
  currentView?: string;
  setCurrentView?: (view: any) => void;
  onAddTransaction?: () => void;
  userEmail?: string;
}

export const MobileBottomNav = ({ currentView, setCurrentView, onAddTransaction, userEmail }: MobileBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const navItems = [
    { path: "/dash", view: "dashboard", label: "Início", icon: TrendingUp },
    { path: "/transactions", view: "transactions", label: "Trans.", icon: CreditCard },
    { path: "/stats", view: "statistics", label: "Stats", icon: BarChart3 },
    { path: "/categorias", view: "categories", label: "Categ.", icon: Tag },
    { path: "/agenda", view: "appointments", label: "Agend.", icon: Calendar },
  ];

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      setShowSettings(false);
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Erro",
        description: "Erro ao fazer logout. Tente novamente.",
        variant: "destructive"
      });
    }
  };

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
          className="grid grid-cols-7 items-center px-1 pt-3 min-h-[80px]"
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
                className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-lg transition-all active:scale-95 ${active
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
                <span className={`text-[8px] font-medium leading-tight ${active ? 'text-primary' : ''}`}>
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
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 flex items-center justify-center transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Settings Button */}
          <Sheet open={showSettings} onOpenChange={setShowSettings}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-lg transition-all active:scale-95 ${
                  location.pathname === "/alterar-senha"
                    ? "text-primary"
                    : "text-white/60"
                }`}
              >
                <div className={`p-1.5 rounded-lg mb-0.5 transition-colors ${
                  location.pathname === "/alterar-senha" ? 'bg-primary/20' : ''
                }`}>
                  <Settings className={`h-5 w-5 ${location.pathname === "/alterar-senha" ? "text-primary" : ""}`} />
                </div>
                <span className={`text-[8px] font-medium leading-tight ${
                  location.pathname === "/alterar-senha" ? 'text-primary' : ''
                }`}>
                  Config
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="mb-4">
                <SheetTitle>Configurações</SheetTitle>
              </SheetHeader>
              
              {/* User Info */}
              {userEmail && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{userEmail}</p>
                    <p className="text-xs text-muted-foreground">Conta conectada</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {/* Change Password */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12"
                  onClick={() => {
                    setShowSettings(false);
                    navigate("/alterar-senha");
                  }}
                >
                  <Key className="h-5 w-5" />
                  Alterar Senha
                </Button>

                {/* Logout */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" />
                  Sair da Conta
                </Button>
              </div>
            </SheetContent>
          </Sheet>
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
