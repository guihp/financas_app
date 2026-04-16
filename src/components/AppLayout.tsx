import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { TrialExpiredWall } from "@/components/TrialExpiredWall";
import { AutoDarkMode } from "@/components/AutoDarkMode";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  PieChart,
  Calendar,
  LogOut,
  DollarSign,
  Tag,
  Shield,
  Key,
  CreditCard,
  Users,
  Receipt,
  Landmark,
  Moon,
  Sun,
  FileText,
  ShoppingCart,
  ShieldAlert,
} from "lucide-react";

interface SubscriptionCheck {
  hasAccess: boolean;
  isExpired: boolean;
  daysExpiredAgo: number;
}

export const AppLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionCheck, setSubscriptionCheck] = useState<SubscriptionCheck>({
    hasAccess: true,
    isExpired: false,
    daysExpiredAgo: 0,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const GRACE_PERIOD_HOURS = 12; // 12 hours after trial expires before blocking

  const checkSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code === "PGRST116") {
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      if (error) {
        console.error("Subscription check error:", error);
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      if (!data) {
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      if (!data.asaas_customer_id) {
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      const now = new Date();

      // PRIORITY 1: Active paid subscription (not trial)
      if (data.status === "active" && !data.is_trial) {
        return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
      }

      // PRIORITY 2: Active with trial
      if (data.status === "active" && data.is_trial && data.trial_ends_at) {
        const trialEnd = new Date(data.trial_ends_at);

        // Trial still active → grant access
        if (trialEnd >= now) {
          return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
        }

        // Trial expired — add 12h grace period
        const graceEnd = new Date(trialEnd.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);

        // Check if current_period_end indicates payment was already processed
        if (data.current_period_end) {
          const periodEnd = new Date(data.current_period_end);
          if (periodEnd >= new Date(now.toISOString().split("T")[0]) && periodEnd > trialEnd) {
            // Period end is after trial end = payment was processed
            return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
          }
        }

        // Within grace period: verify payment with Asaas
        if (now <= graceEnd) {
          console.log("Trial expired, within 12h grace period. Checking Asaas...");
          try {
            const { data: session } = await supabase.auth.getSession();
            if (session?.session?.access_token) {
              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || "https://dlbiwguzbiosaoyrcvay.supabase.co"}/functions/v1/check-subscription-status`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${session.session.access_token}`,
                    "Content-Type": "application/json",
                  },
                }
              );
              const result = await res.json();
              if (result?.paid) {
                console.log("Asaas confirmed payment! Access granted.");
                return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
              }
            }
          } catch (e) {
            console.warn("Failed to check Asaas status:", e);
          }
          // Still within grace period and no payment confirmed yet — allow access
          return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
        }

        // Past grace period — one last Asaas check before blocking
        try {
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.access_token) {
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || "https://dlbiwguzbiosaoyrcvay.supabase.co"}/functions/v1/check-subscription-status`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${session.session.access_token}`,
                  "Content-Type": "application/json",
                },
              }
            );
            const result = await res.json();
            if (result?.paid) {
              console.log("Asaas confirmed payment after grace period! Access granted.");
              return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
            }
          }
        } catch (e) {
          console.warn("Failed to check Asaas status:", e);
        }

        // Truly expired — no payment found
        const daysAgo = Math.ceil(
          (now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { hasAccess: false, isExpired: true, daysExpiredAgo: Math.max(daysAgo, 0) };
      }

      // Active status without trial_ends_at — grant access
      if (data.status === "active") {
        return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
      }

      // Non-active status with trial
      if (data.is_trial && data.trial_ends_at) {
        const trialEnd = new Date(data.trial_ends_at);
        const graceEnd = new Date(trialEnd.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);
        if (graceEnd < now) {
          const daysAgo = Math.ceil(
            (now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24)
          );
          return { hasAccess: false, isExpired: true, daysExpiredAgo: Math.max(daysAgo, 0) };
        }
        return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
      }

      // Expired / cancelled
      if (data.status === "expired" || data.status === "cancelled") {
        const endDate = data.current_period_end
          ? new Date(data.current_period_end)
          : now;
        const daysAgo = Math.max(
          0,
          Math.ceil(
            (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        return { hasAccess: false, isExpired: true, daysExpiredAgo: daysAgo };
      }

      return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
    } catch (error) {
      console.error("Subscription check error:", error);
      return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (mounted) {
            setLoading(false);
            navigate("/auth");
          }
          return;
        }

        if (mounted) {
          setUser(session.user);
        }

        // Check if super admin or admin
        let isSuperAdminStatus = false;
        let isAdminStatus = false;
        try {
          const { data: roleData } = await supabase.rpc('is_super_admin');
          isSuperAdminStatus = roleData === true;
          if (mounted) {
            setIsSuperAdmin(isSuperAdminStatus);
          }
          
          if (!isSuperAdminStatus) {
            const { data: roles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);
            const userIsAdmin = roles?.some(r => r.role === 'admin');
            isAdminStatus = userIsAdmin === true;
            if (mounted) {
              setIsAdminRole(isAdminStatus);
            }
          }
        } catch (e) {
          console.warn("Could not check super admin status");
        }

        // Check subscription (skip for super admin or admin)
        if (!isSuperAdminStatus && !isAdminStatus) {
          const subCheck = await checkSubscription(session.user.id);
          if (mounted) {
            setSubscriptionCheck(subCheck);
          }
        }

        if (mounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            navigate("/auth");
          }
        } else if (session?.user && mounted) {
          setUser(session.user);
        }
      }
    );

    // Timeout de segurança
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      window.location.href = "/auth";
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = "/auth";
    }
  };

  const menuItems = [
    { path: "/dash", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/transactions", icon: DollarSign, label: "Transações" },
    { path: "/extratos", icon: FileText, label: "Extratos" },
    { path: "/cartoes", icon: Landmark, label: "Cartões" },
    { path: "/faturas", icon: Receipt, label: "Faturas" },
    { path: "/stats", icon: PieChart, label: "Estatísticas" },
    { path: "/agenda", icon: Calendar, label: "Agenda" },
    { path: "/categorias", icon: Tag, label: "Categorias" },
    { path: "/orcamentos", icon: ShieldAlert, label: "Orçamento" },
    { path: "/sharing", icon: Users, label: "Compartilhar" },
    { path: "/lista-compras", icon: ShoppingCart, label: "Lista de Compras" },
    { path: "/assinatura", icon: CreditCard, label: "Assinatura" },
    { path: "/alterar-senha", icon: Key, label: "Alterar Senha" },
  ];

  if (isSuperAdmin) {
    menuItems.push({ path: "/admin/supremo/iafe/financas", icon: Shield, label: "Super Admin" });
  } else if (isAdminRole) {
    menuItems.push({ path: "/admin/supremo/iafe/financas", icon: Shield, label: "Administração" });
  }

  const isActive = (path: string) => location.pathname === path;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Redirect to subscription page if no access and not already there (skip for super admin or admin)
  if (
    !subscriptionCheck.hasAccess &&
    !isSuperAdmin &&
    !isAdminRole &&
    location.pathname !== "/assinatura"
  ) {
    // If expired, show expired wall, otherwise redirect to subscription setup
    if (subscriptionCheck.isExpired) {
      return (
        <TrialExpiredWall
          userEmail={user.email}
          daysExpiredAgo={subscriptionCheck.daysExpiredAgo}
        />
      );
    } else {
      // No subscription found - redirect to setup payment
      navigate("/assinatura", { replace: true });
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Redirecionando para configuração de pagamento...</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        {/* Desktop Sidebar - visible only on lg (1024px+) */}
        <div className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border p-6 min-h-screen sticky top-0 max-h-screen overflow-y-auto">
          <div className="mb-8">
            <Logo size="lg" />
          </div>

          <nav className="space-y-2 flex-1">
            {menuItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 ${isActive(item.path)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-sidebar-border space-y-3">
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-5 w-5" />
                  Modo Claro
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5" />
                  Modo Escuro
                </>
              )}
            </Button>

            <div className="flex items-center gap-3 px-2">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-sidebar-foreground truncate" title={user.email || ""}>
                  {user.email}
                </p>
                <p className="text-xs text-sidebar-foreground/40">Conta conectada</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              Sair da Conta
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 overflow-hidden p-4 lg:p-6 mobile-content lg:pb-6 mobile-scroll">
          <Outlet context={{ user, isSuperAdmin, isAdminRole }} />
        </div>

        {/* Mobile/Tablet Bottom Navigation - visible below lg (1024px) */}
        <div className="lg:hidden">
          <MobileBottomNav userEmail={user.email} isSuperAdmin={isSuperAdmin} />
        </div>

        {/* Desktop Floating Action Buttons (Support & AI) - visible only on lg (1024px+) */}
        <div className="hidden lg:flex fixed bottom-6 right-6 flex-col gap-3 z-50">
          <a
            href="https://wa.me/5519991679072"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-transform hover:scale-105 group"
            title="Falar com Inteligência Artificial"
          >
            <div className="absolute right-full mr-3 bg-card text-card-foreground text-xs px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
              Falar com Inteligência Artificial
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
          </a>
          <a
            href="https://wa.me/5598984999475"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-3 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg transition-transform hover:scale-105 group"
            title="Suporte WhatsApp"
          >
            <div className="absolute right-full mr-3 bg-card text-card-foreground text-xs px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
              Suporte WhatsApp
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></svg>
          </a>
        </div>

        {/* Auto Dark Mode Popup */}
        <AutoDarkMode />
      </div>
    </div>
  );
};

export default AppLayout;
