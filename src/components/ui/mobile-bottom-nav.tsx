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
  Receipt,
  Landmark,
  Users,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AddTransactionFab } from "@/components/AddTransactionFab";
import { supabase } from "@/integrations/supabase/client";
import { Dock, DockIcon } from "@/components/ui/dock";
import { Button } from "@/components/ui/button";

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
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const navItems = [
    { path: "/dash", view: "dashboard", label: "Início", icon: TrendingUp },
    { path: "/transactions", view: "transactions", label: "Trans.", icon: CreditCard },
    { path: "/stats", view: "statistics", label: "Stats", icon: BarChart3 },
    { path: "/categorias", view: "categories", label: "Categ.", icon: Tag },
    { path: "/agenda", view: "appointments", label: "Agend.", icon: Calendar },
  ];

  const moreMenuItems = [
    { path: "/cartoes", label: "Bancos e Cartões", icon: Landmark, color: "text-blue-400", bg: "bg-blue-500/15" },
    { path: "/faturas", label: "Faturas", icon: Receipt, color: "text-amber-400", bg: "bg-amber-500/15" },
    { path: "/sharing", label: "Compartilhar", icon: Users, color: "text-cyan-400", bg: "bg-cyan-500/15" },
    { path: "/assinatura", label: "Assinatura", icon: Crown, color: "text-purple-400", bg: "bg-purple-500/15" },
    { path: "/alterar-senha", label: "Alterar Senha", icon: Key, color: "text-slate-400", bg: "bg-slate-500/15" },
    ...(isSuperAdmin ? [{ path: "/super-admin", label: "Painel Admin", icon: Shield, color: "text-orange-400", bg: "bg-orange-500/15" }] : []),
  ];

  const handleLogout = async () => {
    try {
      setShowMoreMenu(false);
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

  const handleNavigation = (path: string) => {
    setShowMoreMenu(false);
    if (isRouterMode) {
      navigate(path);
    }
  };

  return (
    <>
      {/* Backdrop for more menu */}
      <AnimatePresence>
        {showMoreMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMoreMenu(false)}
          />
        )}
      </AnimatePresence>

      {/* More Menu - Floating Card */}
      <AnimatePresence>
        {showMoreMenu && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 left-4 right-4 z-[95] max-w-sm mx-auto"
          >
            <div className="bg-card/95 backdrop-blur-2xl rounded-2xl border border-border/50 shadow-2xl shadow-black/40 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                {userEmail && (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{userEmail}</p>
                      <p className="text-[10px] text-muted-foreground">Conta conectada</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0 ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-3 gap-1 p-3">
                {moreMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <motion.button
                      key={item.path}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, type: "spring", damping: 20, stiffness: 300 }}
                      onClick={() => handleNavigation(item.path)}
                      className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all active:scale-95 ${isActive
                          ? "bg-primary/15 ring-1 ring-primary/30"
                          : "hover:bg-muted/50 active:bg-muted"
                        }`}
                    >
                      <div className={`h-10 w-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${isActive ? "text-primary" : item.color}`} />
                      </div>
                      <span className={`text-[11px] font-medium leading-tight text-center ${isActive ? "text-primary" : "text-foreground/80"
                        }`}>
                        {item.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Logout */}
              <div className="px-3 pb-3 pt-1">
                <div className="h-px bg-border/50 mb-2" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors active:scale-[0.98]"
                >
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Sair da Conta</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dock */}
      <AnimatePresence>
        {!showMoreMenu && (
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

              {/* More Menu Button */}
              <DockIcon
                label="Mais"
                active={showMoreMenu || moreMenuItems.some(i => location.pathname === i.path)}
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={
                  showMoreMenu || moreMenuItems.some(i => location.pathname === i.path)
                    ? "text-primary"
                    : "text-white/60"
                }
              >
                <MoreHorizontal
                  className={`h-5 w-5 ${showMoreMenu || moreMenuItems.some(i => location.pathname === i.path) ? "text-primary" : ""
                    }`}
                />
              </DockIcon>
            </Dock>
          </motion.div>
        )}
      </AnimatePresence>

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
