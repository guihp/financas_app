import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { MobileBottomNav } from "@/components/ui/mobile-bottom-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  PieChart,
  Calendar,
  Settings,
  LogOut,
  DollarSign,
  Tag,
  Shield,
  Key
} from "lucide-react";

export const AppLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

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
        try {
          const { data: roleData } = await supabase.rpc('is_super_admin');
          if (mounted) {
            setIsSuperAdmin(roleData === true);
          }
        } catch (e) {
          console.warn("Could not check super admin status");
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
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const menuItems = [
    { path: "/dash", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/transactions", icon: DollarSign, label: "Transações" },
    { path: "/stats", icon: PieChart, label: "Estatísticas" },
    { path: "/agenda", icon: Calendar, label: "Agenda" },
    { path: "/categorias", icon: Tag, label: "Categorias" },
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

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border p-6 min-h-screen">
            <div className="mb-8">
              <Logo />
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

            <div className="mt-auto pt-4 border-t border-sidebar-border">
              <div className="text-sm text-sidebar-foreground/60 mb-2 px-2 truncate" title={user.email || ""}>
                {user.email}
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                Sair
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-6 mobile-content lg:pb-6 mobile-scroll">
          <Outlet context={{ user, isSuperAdmin }} />
        </div>

        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileBottomNav />}
      </div>
    </div>
  );
};

export default AppLayout;
