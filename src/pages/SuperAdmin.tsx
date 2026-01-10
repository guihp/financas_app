import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { AdminUserList } from "@/components/AdminUserList";
import { AdminCreateUser } from "@/components/AdminCreateUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Shield } from "lucide-react";
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
      console.log('Checking super admin access...');
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('Session user:', session?.user?.email);
      
      if (!session) {
        console.log('No session found, redirecting to auth');
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Verificar se usuário existe e está ativo
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (profileError || !profileData) {
        console.error('User profile not found:', profileError);
        toast.error("Usuário não encontrado");
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      // Check if user is super admin - buscar todas as roles
      console.log('Checking if user is super admin...');
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      
      console.log('Super admin check result:', { userRoles, error });
      
      if (error) {
        // Se erro 406 ou outro erro, tentar usar função RPC
        if (error.code !== 'PGRST116') {
          console.error('Error checking super admin status:', error);
          // Tentar função RPC como fallback
          try {
            const { data: isSuperAdminData } = await supabase.rpc('is_super_admin');
            if (isSuperAdminData !== true) {
              toast.error("Acesso negado - Apenas super administradores");
              navigate("/");
              return;
            }
          } catch (rpcError) {
            console.error('Error with RPC fallback:', rpcError);
            toast.error("Erro ao verificar permissões");
            navigate("/");
            return;
          }
        } else {
          // PGRST116 = no rows found - não é super admin
          toast.error("Acesso negado - Apenas super administradores");
          navigate("/");
          return;
        }
      }

      // Verificar se tem role super_admin
      const isSuperAdmin = userRoles?.some(role => role.role === 'super_admin') || false;

      if (!isSuperAdmin) {
        console.log('User is not super admin');
        toast.error("Acesso negado - Apenas super administradores");
        navigate("/");
        return;
      }

      console.log('User is super admin, setting access to true');
      setIsSuperAdmin(true);
    } catch (error) {
      console.error('Error in super admin check:', error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await supabase.functions.invoke('debug-list-users', {
        method: 'GET'
      });
      if (response.data && response.data.users) {
        const users = response.data.users;
        const total = users.length;
        const active = users.filter((u: any) => !u.banned_until).length;
        const admins = users.filter((u: any) => u.role === 'super_admin' || u.role === 'admin').length;
        setUserStats({ total, active, admins });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h1 className="text-xl sm:text-2xl font-bold">Super Admin</h1>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                {user?.email}
              </span>
              <Button variant="outline" onClick={handleSignOut} size="sm" className="w-full sm:w-auto">
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Usuários
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{userStats.total}</div>
              <p className="text-xs text-muted-foreground">
                Registrados na plataforma
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Usuários Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{userStats.active}</div>
              <p className="text-xs text-muted-foreground">
                Com acesso à plataforma
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20 sm:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Administradores
              </CardTitle>
              <Shield className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{userStats.admins}</div>
              <p className="text-xs text-muted-foreground">
                Com privilégios elevados
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2">
            <TabsTrigger value="users" className="flex items-center justify-center lg:justify-start space-x-2 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Gerenciar Usuários</span>
              <span className="sm:hidden">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center justify-center lg:justify-start space-x-2 text-xs sm:text-sm">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Criar Usuário</span>
              <span className="sm:hidden">Criar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <AdminUserList />
          </TabsContent>

          <TabsContent value="create">
            <AdminCreateUser />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SuperAdmin;