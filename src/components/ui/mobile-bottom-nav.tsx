import { useNavigate, useLocation } from "react-router-dom";
import {
  TrendingUp,
  CreditCard,
  BarChart3,
  Tag,
  Calendar,
  Plus,
  Settings,
  Key,
  LogOut,
  User,
  Shield,
  Crown,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AddTransactionFab } from "@/components/AddTransactionFab";
import { supabase } from "@/integrations/supabase/client";
import { Dock, DockIcon } from "@/components/ui/dock";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface MobileBottomNavProps {
  currentView?: string;
  setCurrentView?: (view: any) => void;
  onAddTransaction?: () => void;
  userEmail?: string;
  isSuperAdmin?: boolean;
}

export const MobileBottomNav = ({
  currentView,
  setCurrentView,
  onAddTransaction,
  userEmail,
  isSuperAdmin = false,
}: MobileBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
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
      setShowSettings(false);
      await supabase.auth.signOut({ scope: 'local' });
      window.location.href = "/auth";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/auth";
    }
  };

  const handleTransactionAdded = () => {
    if (setCurrentView) {
      setCurrentView("transactions");
    } else {
      navigate("/transactions");
    }
  };

  const isRouterMode = !setCurrentView;

  return (
    <>
      {/* Dock - hide when settings sheet is open */}
      <AnimatePresence>
        {!showSettings && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <Dock
              iconSize={40}
              iconMagnification={56}
              iconDistance={120}
              direction="bottom"
              className="mx-3 h-[56px] gap-1 rounded-2xl border-border/40 bg-card/90 backdrop-blur-2xl px-1.5 pb-1.5 shadow-[0_-2px_30px_rgba(0,0,0,0.4)]"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isRouterMode
                  ? location.pathname === item.path
                  : currentView === item.view;

                return (
                  <DockIcon
                    key={item.path}
                    label={item.label}
                    active={active}
                    onClick={() => {
                      if (isRouterMode) {
                        navigate(item.path);
                      } else {
                        setCurrentView?.(item.view);
                      }
                    }}
                    className={active ? "text-primary" : "text-white/60"}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                  </DockIcon>
                );
              })}

              {/* Separator */}
              <div className="h-8 w-px bg-border/40 self-center mx-0.5" />

              {/* Add Transaction Button */}
              <DockIcon
                label="Novo"
                onClick={() => {
                  if (onAddTransaction) {
                    onAddTransaction();
                  } else {
                    setShowAddDialog(true);
                  }
                }}
                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30"
              >
                <Plus className="h-5 w-5 text-white" />
              </DockIcon>

              {/* Separator */}
              <div className="h-8 w-px bg-border/40 self-center mx-0.5" />

              {/* Settings Button */}
              <DockIcon
                label="Config"
                active={showSettings}
                onClick={() => setShowSettings(true)}
                className={
                  showSettings
                    ? "text-primary"
                    : "text-white/60"
                }
              >
                <Settings
                  className={`h-5 w-5 ${
                    showSettings ? "text-primary" : ""
                  }`}
                />
              </DockIcon>
            </Dock>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Sheet - slides up from bottom, dock hides */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="text-lg font-semibold">
              Configurações
            </SheetTitle>
          </SheetHeader>

          {/* User Info */}
          {userEmail && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl mb-6">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userEmail}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conta conectada
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {/* Super Admin - only visible for super admins */}
            {isSuperAdmin && (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-4 h-14 text-base rounded-xl"
                  onClick={() => {
                    setShowSettings(false);
                    navigate("/super-admin");
                  }}
                >
                  <div className="h-9 w-9 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-orange-500" />
                  </div>
                  <span className="text-orange-500 font-medium">Painel Admin</span>
                </Button>
                <Separator className="my-2" />
              </>
            )}

            {/* Assinatura */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-4 h-14 text-base rounded-xl"
              onClick={() => {
                setShowSettings(false);
                navigate("/assinatura");
              }}
            >
              <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <span>Minha Assinatura</span>
            </Button>

            {/* Change Password */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-4 h-14 text-base rounded-xl"
              onClick={() => {
                setShowSettings(false);
                navigate("/alterar-senha");
              }}
            >
              <div className="h-9 w-9 rounded-lg bg-muted/80 flex items-center justify-center">
                <Key className="h-5 w-5" />
              </div>
              <span>Alterar Senha</span>
            </Button>

            <Separator className="my-2" />

            {/* Logout */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-4 h-14 text-base rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-5 w-5" />
              </div>
              <span>Sair da Conta</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Internal Add Transaction Dialog */}
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
