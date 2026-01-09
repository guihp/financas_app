import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Shield, User, Crown } from "lucide-react";
import { toast } from "sonner";
import { ChangeUserPasswordDialog } from "./ChangeUserPasswordDialog";
import { EditUserDialog } from "./EditUserDialog";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  banned_until?: string;
  status: string;
}

export const AdminUserList = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('AdminUserList: Starting fetchUsers...');
      
      // Try the debug function first to get all users
      console.log('AdminUserList: Calling debug-list-users function...');
      const debugResponse = await supabase.functions.invoke('debug-list-users', {
        method: 'GET'
      });
      console.log('AdminUserList: Debug response received:', {
        error: debugResponse.error,
        data: debugResponse.data,
        hasUsers: debugResponse.data?.users?.length > 0
      });
      
      if (debugResponse.error) {
        console.error('AdminUserList: Debug function error:', debugResponse.error);
        toast.error("Erro ao carregar usuários: " + debugResponse.error.message);
        return;
      }

      if (debugResponse.data && debugResponse.data.users) {
        console.log('AdminUserList: Setting users data:', debugResponse.data.users.length, 'users');
        setUsers(debugResponse.data.users);
        return;
      }

      console.log('AdminUserList: No users data found in response');
      setUsers([]);
      toast.error("Nenhum dado de usuário encontrado na resposta");
    } catch (error) {
      console.error('AdminUserList: Error fetching users:', error);
      toast.error("Erro ao carregar usuários: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const variants = {
      super_admin: "destructive",
      admin: "secondary",
      user: "outline"
    } as const;

    const labels = {
      super_admin: "Super Admin",
      admin: "Admin",
      user: "Usuário"
    };

    return (
      <Badge variant={variants[role as keyof typeof variants] || "outline"}>
        {getRoleIcon(role)}
        <span className="ml-1">{labels[role as keyof typeof labels] || role}</span>
      </Badge>
    );
  };

  const getStatusBadge = (status: string, banned_until?: string) => {
    if (banned_until) {
      return <Badge variant="destructive">Banido</Badge>;
    }
    
    return status === 'active' ? 
      <Badge variant="default">Ativo</Badge> : 
      <Badge variant="secondary">Inativo</Badge>;
  };

  const handleStatusChange = async (userEmail: string, newStatus: 'active' | 'banned') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar autenticado para alterar status');
        return;
      }

      const enabled = newStatus === 'active';
      const response = await supabase.functions.invoke('toggle-user-status', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { email: userEmail, enabled }
      });

      if (response.error) {
        toast.error(`Erro ao alterar status: ${response.error.message}`);
        return;
      }

      toast.success(`Status alterado para ${newStatus === 'active' ? 'ativo' : 'banido'}`);
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error changing user status:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar autenticado para alterar perfis');
        return;
      }

      const response = await supabase.functions.invoke('admin-update-user-role', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { user_id: userId, new_role: newRole }
      });

      if (response.error) {
        toast.error(`Erro ao alterar perfil: ${response.error.message}`);
        return;
      }

      toast.success(`Perfil alterado para ${newRole}`);
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error changing user role:', error);
      toast.error('Erro ao alterar perfil do usuário');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando usuários...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-lg font-semibold">Usuários da Plataforma ({users.length})</span>
          <Button onClick={fetchUsers} variant="outline" size="sm" className="w-full sm:w-auto">
            Atualizar
          </Button>
        </CardTitle>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Mobile View - Cards */}
        <div className="block lg:hidden space-y-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="p-4 bg-muted/30">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-sm">{user.full_name || "Sem nome"}</h3>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {getRoleBadge(user.role)}
                    {getStatusBadge(user.status, user.banned_until)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Perfil</label>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Status</label>
                    <Select
                      value={user.banned_until ? 'banned' : 'active'}
                      onValueChange={(newStatus) => handleStatusChange(user.email, newStatus as 'active' | 'banned')}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="banned">Banido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="pt-2 flex flex-col gap-2">
                  <EditUserDialog 
                    userId={user.id} 
                    userEmail={user.email}
                    userName={user.full_name}
                    userPhone={user.phone}
                    onSuccess={fetchUsers}
                  />
                  <ChangeUserPasswordDialog userId={user.id} userEmail={user.email} />
                </div>
                
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  <span>Criado: {new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                  <span className="mx-2">•</span>
                  <span>Último acesso: {user.last_sign_in_at ? 
                    new Date(user.last_sign_in_at).toLocaleDateString('pt-BR') : 
                    "Nunca"
                  }</span>
                </div>
              </div>
            </Card>
          ))}
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhum usuário encontrado com esse filtro" : "Nenhum usuário encontrado"}
            </div>
          )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden lg:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name || "Sem nome"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{user.email}</TableCell>
                  <TableCell>{user.phone || "-"}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.banned_until ? 'banned' : 'active'}
                      onValueChange={(newStatus) => handleStatusChange(user.email, newStatus as 'active' | 'banned')}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="banned">Banido</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {user.last_sign_in_at ? 
                      new Date(user.last_sign_in_at).toLocaleDateString('pt-BR') : 
                      "Nunca"
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 items-center">
                      <EditUserDialog 
                        userId={user.id} 
                        userEmail={user.email}
                        userName={user.full_name}
                        userPhone={user.phone}
                        onSuccess={fetchUsers}
                      />
                      <ChangeUserPasswordDialog userId={user.id} userEmail={user.email} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nenhum usuário encontrado com esse filtro" : "Nenhum usuário encontrado"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};