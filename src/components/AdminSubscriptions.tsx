import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CalendarPlus,
  DollarSign,
  Users,
  TrendingUp,
  Gift,
} from "lucide-react";
import { toast } from "sonner";

interface UserSubscription {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  created_at: string;
  subscription_id?: string;
  subscription_status?: string;
  is_trial?: boolean;
  trial_ends_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  plan_name?: string;
  plan_price?: number;
}

export const AdminSubscriptions = () => {
  const [users, setUsers] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [extendingTrial, setExtendingTrial] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState("7");
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("");

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      // Fetch all users
      const debugResponse = await supabase.functions.invoke(
        "debug-list-users",
        { method: "GET" }
      );

      if (debugResponse.error) {
        toast.error("Erro ao carregar usuários");
        return;
      }

      const allUsers = debugResponse.data?.users || [];

      // Fetch all subscriptions (super admin has SELECT access)
      const { data: subscriptions, error: subError } = await supabase
        .from("subscriptions")
        .select("*");

      if (subError) {
        console.error("Error fetching subscriptions:", subError);
      }

      // Combine user data with subscription data
      const combined: UserSubscription[] = allUsers.map((user: any) => {
        const sub = subscriptions?.find((s: any) => s.user_id === user.id);
        return {
          id: user.id,
          email: user.email,
          full_name: user.full_name || "Sem nome",
          phone: user.phone,
          created_at: user.created_at,
          subscription_id: sub?.id,
          subscription_status: sub?.status || "none",
          is_trial: sub?.is_trial || false,
          trial_ends_at: sub?.trial_ends_at,
          current_period_start: sub?.current_period_start,
          current_period_end: sub?.current_period_end,
          plan_name: "Plano Mensal",
          plan_price: 39.9,
        };
      });

      setUsers(combined);
    } catch (error) {
      console.error("Error fetching subscription data:", error);
      toast.error("Erro ao carregar dados de assinaturas");
    } finally {
      setLoading(false);
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedUserId) return;

    setExtendingTrial(selectedUserId);
    try {
      const days = parseInt(trialDays);
      if (isNaN(days) || days < 1 || days > 365) {
        toast.error("Informe um número de dias válido (1-365)");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      // Calculate new trial end date
      const newTrialEnd = new Date();
      newTrialEnd.setDate(newTrialEnd.getDate() + days);

      // Update subscription via direct query or function
      const { error } = await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: selectedUserId,
            is_trial: true,
            trial_ends_at: newTrialEnd.toISOString(),
            status: "active",
            current_period_start: new Date().toISOString().split("T")[0],
            current_period_end: newTrialEnd.toISOString().split("T")[0],
            asaas_customer_id: "trial_extended",
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Error extending trial:", error);
        toast.error("Erro ao estender período gratuito. Verifique as permissões.");
        return;
      }

      toast.success(
        `Período gratuito estendido por ${days} dias para ${selectedUserEmail}`
      );
      setExtendDialogOpen(false);
      fetchSubscriptionData();
    } catch (error) {
      console.error("Error extending trial:", error);
      toast.error("Erro ao estender período gratuito");
    } finally {
      setExtendingTrial(null);
    }
  };

  // Stats
  const stats = {
    total: users.length,
    active: users.filter(
      (u) => u.subscription_status === "active" && !u.is_trial
    ).length,
    trial: users.filter((u) => {
      if (!u.is_trial) return false;
      if (!u.trial_ends_at) return true;
      return new Date(u.trial_ends_at) >= new Date();
    }).length,
    trialExpiring: users.filter((u) => {
      if (!u.is_trial || !u.trial_ends_at) return false;
      const daysLeft = Math.ceil(
        (new Date(u.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysLeft <= 3 && daysLeft >= 0;
    }).length,
    trialExpired: users.filter((u) => {
      if (!u.is_trial || !u.trial_ends_at) return false;
      return new Date(u.trial_ends_at) < new Date();
    }).length,
    expired: users.filter(
      (u) =>
        u.subscription_status === "expired" ||
        u.subscription_status === "cancelled"
    ).length,
    noSubscription: users.filter(
      (u) => u.subscription_status === "none"
    ).length,
    revenue: users.filter(
      (u) => u.subscription_status === "active" && !u.is_trial
    ).length * 29.9,
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);

    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "trial") return matchesSearch && user.is_trial;
    if (filterStatus === "trial_expiring") {
      if (!matchesSearch || !user.is_trial || !user.trial_ends_at) return false;
      const daysLeft = Math.ceil(
        (new Date(user.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysLeft <= 3 && daysLeft >= 0;
    }
    if (filterStatus === "trial_expired") {
      if (!matchesSearch || !user.is_trial || !user.trial_ends_at) return false;
      return new Date(user.trial_ends_at) < new Date();
    }
    if (filterStatus === "paid")
      return (
        matchesSearch &&
        user.subscription_status === "active" &&
        !user.is_trial
      );
    if (filterStatus === "expired")
      return (
        matchesSearch &&
        (user.subscription_status === "expired" ||
          user.subscription_status === "cancelled")
      );
    if (filterStatus === "none")
      return matchesSearch && user.subscription_status === "none";
    return matchesSearch;
  });

  const getStatusBadge = (user: UserSubscription) => {
    if (user.is_trial) {
      const daysLeft = user.trial_ends_at
        ? Math.ceil(
          (new Date(user.trial_ends_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
        )
        : 0;

      if (daysLeft <= 0) {
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Trial Expirado
          </Badge>
        );
      }

      if (daysLeft <= 3) {
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
          >
            <AlertTriangle className="h-3 w-3" />
            Trial ({daysLeft}d)
          </Badge>
        );
      }

      return (
        <Badge
          variant="secondary"
          className="gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30"
        >
          <Gift className="h-3 w-3" />
          Trial ({daysLeft}d)
        </Badge>
      );
    }

    switch (user.subscription_status) {
      case "active":
        return (
          <Badge
            variant="default"
            className="gap-1 bg-green-500/20 text-green-400 border-green-500/30"
          >
            <CheckCircle className="h-3 w-3" />
            Pago
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Atrasado
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Cancelado
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Expirado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            Sem assinatura
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando assinaturas...</CardTitle>
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
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Pagos</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <p className="text-xs text-muted-foreground mt-1">
              R$ {stats.revenue.toFixed(2).replace(".", ",")}/mês
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Gift className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Trial Ativo</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{stats.trial}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.trialExpiring > 0 && (
                <span className="text-yellow-400">{stats.trialExpiring} expirando em breve</span>
              )}
              {stats.trialExpiring === 0 && "Todos com tempo"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-muted-foreground">Trial Expirado</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.trialExpired}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-xs text-muted-foreground">Expirados</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.expired}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cancelados/Expirados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-500/10 to-gray-500/5 border-gray-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-400">
              {stats.total}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.noSubscription} sem plano
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <span className="text-lg font-semibold">
              Assinaturas e Pagamentos ({users.length})
            </span>
            <Button
              onClick={fetchSubscriptionData}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              Atualizar
            </Button>
          </CardTitle>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email, nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="trial">Em Trial</SelectItem>
                <SelectItem value="trial_expiring">Trial Expirando (3d)</SelectItem>
                <SelectItem value="trial_expired">Trial Expirado</SelectItem>
                <SelectItem value="expired">Expirados/Cancelados</SelectItem>
                <SelectItem value="none">Sem Assinatura</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {/* Mobile View - Cards */}
          <div className="block lg:hidden space-y-3">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="p-4 bg-muted/30">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">
                        {user.full_name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {getStatusBadge(user)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block font-medium text-foreground/80">
                        Cadastro
                      </span>
                      {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    {user.is_trial && user.trial_ends_at ? (
                      <div>
                        <span className="block font-medium text-foreground/80">
                          Trial Expira
                        </span>
                        <span
                          className={
                            new Date(user.trial_ends_at) < new Date()
                              ? "text-red-400 font-medium"
                              : Math.ceil(
                                (new Date(user.trial_ends_at).getTime() -
                                  Date.now()) /
                                (1000 * 60 * 60 * 24)
                              ) <= 3
                                ? "text-yellow-400 font-medium"
                                : ""
                          }
                        >
                          {new Date(user.trial_ends_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="block font-medium text-foreground/80">
                          Período Fim
                        </span>
                        {user.current_period_end
                          ? new Date(
                            user.current_period_end
                          ).toLocaleDateString("pt-BR")
                          : "N/A"}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setSelectedUserEmail(user.email);
                      setTrialDays("7");
                      setExtendDialogOpen(true);
                    }}
                  >
                    <CalendarPlus className="h-3 w-3" />
                    Estender Trial
                  </Button>
                </div>
              </Card>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            )}
          </div>

          {/* Desktop View - Table */}
          <div className="hidden lg:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Expira</TableHead>
                  <TableHead>Período Atual</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {user.email}
                    </TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>
                      {user.is_trial && user.trial_ends_at ? (
                        <span
                          className={`text-sm font-medium ${new Date(user.trial_ends_at) < new Date()
                              ? "text-red-400"
                              : Math.ceil(
                                (new Date(user.trial_ends_at).getTime() -
                                  Date.now()) /
                                (1000 * 60 * 60 * 24)
                              ) <= 3
                                ? "text-yellow-400"
                                : "text-blue-400"
                            }`}
                        >
                          {new Date(user.trial_ends_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.current_period_end ? (
                        <span className="text-sm">
                          {new Date(
                            user.current_period_start!
                          ).toLocaleDateString("pt-BR")}{" "}
                          -{" "}
                          {new Date(
                            user.current_period_end
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          N/A
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setSelectedUserEmail(user.email);
                          setTrialDays("7");
                          setExtendDialogOpen(true);
                        }}
                      >
                        <CalendarPlus className="h-3 w-3" />
                        Estender Trial
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Extend Trial Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estender Período Gratuito</DialogTitle>
            <DialogDescription>
              Definir período gratuito para{" "}
              <strong>{selectedUserEmail}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Número de dias a partir de hoje
              </label>
              <Input
                type="number"
                min="1"
                max="365"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                placeholder="7"
              />
              <p className="text-xs text-muted-foreground">
                O trial será ativado por {trialDays} dias a partir de hoje (
                {new Date(
                  Date.now() + parseInt(trialDays || "0") * 86400000
                ).toLocaleDateString("pt-BR")}
                )
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtendDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExtendTrial}
              disabled={extendingTrial === selectedUserId}
            >
              {extendingTrial === selectedUserId
                ? "Salvando..."
                : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
