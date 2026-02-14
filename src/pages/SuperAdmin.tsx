import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { AdminUserList } from "@/components/AdminUserList";
import { AdminCreateUser } from "@/components/AdminCreateUser";
import { AdminSubscriptions } from "@/components/AdminSubscriptions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Shield, CreditCard, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const SuperAdmin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userStats, setUserStats] = useState({ total: 0, active: 0, admins: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    checkSuperAdminAccess();
    fetchUserStats();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Verificar se usuário existe e está ativo
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (profileError || !profileData) {
        toast.error("Usuário não encontrado");
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      // Check if user is super admin
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (error) {
        if (error.code !== "PGRST116") {
          try {
            const { data: isSuperAdminData } = await supabase.rpc(
              "is_super_admin"
            );
            if (isSuperAdminData !== true) {
              toast.error("Acesso negado - Apenas super administradores");
              navigate("/");
              return;
            }
          } catch (rpcError) {
            toast.error("Erro ao verificar permissões");
            navigate("/");
            return;
          }
        } else {
          toast.error("Acesso negado - Apenas super administradores");
          navigate("/");
          return;
        }
      }

      const isSuperAdmin =
        userRoles?.some((role) => role.role === "super_admin") || false;

      if (!isSuperAdmin) {
        toast.error("Acesso negado - Apenas super administradores");
        navigate("/");
        return;
      }

      setIsSuperAdmin(true);
    } catch (error) {
      console.error("Error in super admin check:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await supabase.functions.invoke("debug-list-users", {
        method: "GET",
      });
      if (response.data && response.data.users) {
        const users = response.data.users;
        const total = users.length;
        const active = users.filter((u: any) => !u.banned_until).length;
        const admins = users.filter(
          (u: any) => u.role === "super_admin" || u.role === "admin"
        ).length;
        setUserStats({ total, active, admins });
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6 pb-24 xl:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Painel Admin</h1>
          <p className="text-sm text-muted-foreground">
            Gerenciamento de usuários e assinaturas
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Usuários
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {userStats.total}
            </div>
            <p className="text-xs text-muted-foreground">
              Registrados na plataforma
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Usuários Ativos
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {userStats.active}
            </div>
            <p className="text-xs text-muted-foreground">
              Com acesso à plataforma
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20 sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Administradores
            </CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {userStats.admins}
            </div>
            <p className="text-xs text-muted-foreground">
              Com privilégios elevados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
          <TabsTrigger
            value="users"
            className="flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Usuários</span>
            <span className="sm:hidden">Usuários</span>
          </TabsTrigger>
          <TabsTrigger
            value="subscriptions"
            className="flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Assinaturas</span>
            <span className="sm:hidden">Assin.</span>
          </TabsTrigger>
          <TabsTrigger
            value="create"
            className="flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Criar Usuário</span>
            <span className="sm:hidden">Criar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUserList />
        </TabsContent>

        <TabsContent value="subscriptions">
          <AdminSubscriptions />
        </TabsContent>

        <TabsContent value="create">
          <AdminCreateUser />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuperAdmin;
