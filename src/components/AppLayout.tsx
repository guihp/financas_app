import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { TrialExpiredWall } from "@/components/TrialExpiredWall";
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
} from "lucide-react";

interface SubscriptionCheck {
  hasAccess: boolean;
  isExpired: boolean;
  daysExpiredAgo: number;
}

export const AppLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionCheck, setSubscriptionCheck] = useState<SubscriptionCheck>({
    hasAccess: true,
    isExpired: false,
    daysExpiredAgo: 0,
  });
  const navigate = useNavigate();
  const location = useLocation();

  const checkSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code === "PGRST116") {
        // No subscription found - user needs to set up payment
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      if (error) {
        console.error("Subscription check error:", error);
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      if (!data) {
        // No subscription data - user needs to set up payment
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      // Check if user has payment method configured (asaas_customer_id)
      // Even for trial, user must configure payment method first
      if (!data.asaas_customer_id) {
        // Trial without payment method - user needs to set up payment
        return { hasAccess: false, isExpired: false, daysExpiredAgo: 0 };
      }

      const now = new Date();

      // If trial active, check trial_ends_at
      if (data.is_trial && data.trial_ends_at) {
        const trialEnd = new Date(data.trial_ends_at);
        if (trialEnd < now) {
          const daysAgo = Math.ceil(
            (now.getTime() - trialEnd.getTime()) / (1000 * 60 * 60 * 24)
          );
          return { hasAccess: false, isExpired: true, daysExpiredAgo: daysAgo };
        }
        return { hasAccess: true, isExpired: false, daysExpiredAgo: 0 };
      }

      // Active paid subscription
      if (data.status === "active" && !data.is_trial) {
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

        // Check if super admin
        let isAdmin = false;
        try {
          const { data: roleData } = await supabase.rpc('is_super_admin');
          isAdmin = roleData === true;
          if (mounted) {
            setIsSuperAdmin(isAdmin);
          }
        } catch (e) {
          console.warn("Could not check super admin status");
        }

        // Check subscription (skip for super admin)
        if (!isAdmin) {
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
    { path: "/stats", icon: PieChart, label: "Estatísticas" },
    { path: "/agenda", icon: Calendar, label: "Agenda" },
    { path: "/categorias", icon: Tag, label: "Categorias" },
    { path: "/sharing", icon: Users, label: "Compartilhar" },
    { path: "/assinatura", icon: CreditCard, label: "Assinatura" },
    { path: "/alterar-senha", icon: Key, label: "Alterar Senha" },
  ];

  if (isSuperAdmin) {
    menuItems.push({ path: "/super-admin", icon: Shield, label: "Super Admin" });
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

  // Redirect to subscription page if no access and not already there (skip for super admin)
  if (
    !subscriptionCheck.hasAccess &&
    !isSuperAdmin &&
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
      <div className="flex flex-col xl:flex-row">
        {/* Desktop Sidebar - visible only on xl (1280px+) */}
        <div className="hidden xl:flex w-64 flex-col bg-sidebar border-r border-sidebar-border p-6 min-h-screen sticky top-0 max-h-screen overflow-y-auto">
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
        <div className="flex-1 p-4 xl:p-6 mobile-content xl:pb-6 mobile-scroll">
          <Outlet context={{ user, isSuperAdmin }} />
        </div>

        {/* Mobile/Tablet Bottom Navigation - visible below xl (1280px) */}
        <div className="xl:hidden">
          <MobileBottomNav userEmail={user.email} isSuperAdmin={isSuperAdmin} />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
