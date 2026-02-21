import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, DollarSign, CreditCard, BarChart3, Tag, LogOut, Calendar, Settings, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { TransactionChart } from "./TransactionChart";
import { TransactionList } from "./TransactionList";
import { AddTransactionDialog } from "./AddTransactionDialog";
import { Statistics } from "./Statistics";
import { Categories } from "./Categories";
import { Logo } from "./Logo";
import { TransactionPieChart } from "./PieChart";
import { ApiTestForm } from "./ApiTestForm";
import { Appointments } from "./Appointments";
import { ChangePassword } from "./ChangePassword";
import { TestWebhook } from "./TestWebhook";
import { MobileBottomNav } from "./ui/mobile-bottom-nav";


export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string;
  date: Date | string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

interface DashboardProps {
  user: User;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"dashboard" | "transactions" | "statistics" | "categories" | "appointments" | "api-test" | "change-password">("dashboard");
  const [loading, setLoading] = useState(true);
  const [summaryView, setSummaryView] = useState<"expenses" | "income">("expenses");
  const [categories, setCategories] = useState<any[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const totalBalance = transactions.reduce((acc, transaction) => {
    return transaction.type === "income"
      ? acc + transaction.amount
      : acc - transaction.amount;
  }, 0);

  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, t) => acc + Number(t.amount), 0);

  // Load transactions and categories from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        // Verificar se usuário existe e está ativo
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser || authUser.id !== user.id) {
          toast({
            title: "Sessão inválida",
            description: "Usuário não encontrado ou sessão expirada. Por favor, faça login novamente.",
            variant: "destructive",
          });
          setLoading(false);
          await supabase.auth.signOut();
          navigate("/auth");
          return;
        }

        // Verificar se usuário tem perfil (se foi deletado, não terá perfil)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profileData) {
          toast({
            title: "Usuário não encontrado",
            description: "Seu perfil não foi encontrado. Por favor, entre em contato com o suporte.",
            variant: "destructive",
          });
          setLoading(false);
          await supabase.auth.signOut();
          navigate("/auth");
          return;
        }

        // Check if user is super admin - buscar todas as roles e verificar no frontend
        const { data: userRolesData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        // Se erro, verificar se é 406 (Not Acceptable) ou outro
        if (roleError) {
          console.error("Error checking user roles:", roleError);
          // Se erro 406, pode ser problema de RLS - não bloquear, apenas não definir como super admin
          if (roleError.code === 'PGRST116') {
            // No rows found - usuário não tem role, não é super admin
            setIsSuperAdmin(false);
          } else {
            // Outro erro - tentar usar função RPC como fallback
            try {
              const { data: isSuperAdminData } = await supabase
                .rpc('is_super_admin');
              setIsSuperAdmin(isSuperAdminData === true);
            } catch (rpcError) {
              console.error("Error with RPC fallback:", rpcError);
              setIsSuperAdmin(false);
            }
          }
        } else {
          // Verificar se tem role super_admin
          const isSuperAdmin = userRolesData?.some(role => role.role === 'super_admin') || false;
          setIsSuperAdmin(isSuperAdmin);
        }

        // Load transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (transactionsError) {
          toast({
            title: "Erro ao carregar transações",
            description: transactionsError.message,
            variant: "destructive",
          });
        } else {
          const mappedTransactions = (transactionsData || []).map(t => ({
            ...t,
            amount: Number(t.amount),
            date: t.date || t.created_at,
            type: t.type as "income" | "expense"
          }));
          setTransactions(mappedTransactions);
        }


        // Load categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .order('name');

        if (categoriesError) {
          console.error("Erro ao carregar categorias:", categoriesError);
        } else {
          setCategories(categoriesData || []);
        }

      } catch (error) {
        console.error("Error loading dashboard data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Ocorreu um erro ao carregar os dados. Por favor, tente novamente.",
          variant: "destructive",
        });
      } finally {
        // Garantir que loading seja false ao final (sucesso ou erro)
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Timeout de segurança - se dados não carregarem em 15 segundos, libera a tela
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("Dashboard data load timeout triggered explicitly");
        setLoading(false);
        toast({
          title: "Carregamento lento",
          description: "A conexão parece instável. Alguns dados podem não ter sido carregados completamente.",
          variant: "default",
        });
      }
    }, 15000);

    let isMounted = true;
    loadData();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [user.id, toast, navigate]);

  const addTransaction = async (transaction: Omit<Transaction, "id">) => {
    // Buscar o phone do usuário na tabela profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('phone')
      .eq('user_id', user.id)
      .single();

    // Formatar o phone no padrão WhatsApp: 55{phone}@s.whatsapp.net
    let formattedPhone = null;
    if (profileData?.phone) {
      // Remove caracteres não numéricos do phone
      const cleanPhone = profileData.phone.replace(/\D/g, '');
      // Adiciona 55 se não começar com 55
      const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      formattedPhone = `${phoneWithCountry}@s.whatsapp.net`;
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : transaction.date,
        user_id: user.id,
        phone: formattedPhone,
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro ao adicionar transação",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      const mappedTransaction = {
        ...data,
        amount: Number(data.amount),
        date: data.date || data.created_at,
        type: data.type as "income" | "expense"
      };
      setTransactions(prev => [mappedTransaction, ...prev]);
      toast({
        title: "Sucesso",
        description: `${transaction.type === "income" ? "Receita" : "Despesa"} adicionada com sucesso!`,
      });
    }
  };

  const addCategory = async (name: string) => {
    // Verificar se categoria já existe (case insensitive)
    const normalizedName = name.toLowerCase().trim();
    const exists = categories.some(idx => idx.name.toLowerCase() === normalizedName);

    if (exists) {
      toast({
        title: "Categoria duplicada",
        description: "Você já possui uma categoria com este nome.",
        variant: "destructive", // ou warning se preferir
      });
      return false;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert([{
        name: normalizedName,
        user_id: user.id,
      }])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase ao criar categoria:", error);
      toast({
        title: "Erro ao criar categoria",
        description: error.message || "Erro desconhecido ao salvar categoria.",
        variant: "destructive",
      });
      return false;
    }

    if (data) {
      setCategories(prev => [...prev, data]);
      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso!",
      });
      return true;
    }
    return false;
  };

  const fetchCategories = async () => {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (categoriesError) {
      console.error("Erro ao carregar categorias:", categoriesError);
    } else {
      setCategories(categoriesData || []);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden bg-sidebar border-b border-sidebar-border p-4 flex items-center justify-between sticky top-0 z-10">
          <Logo variant="horizontal" size="sm" />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="text-sidebar-foreground"
            >
              <Plus className="w-5 h-5" />
            </Button>
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/super-admin")}
                className="text-orange-500"
              >
                <Shield className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex lg:flex-col lg:w-64 bg-sidebar border-r border-sidebar-border p-6 h-screen sticky top-0 overflow-y-auto">
          <div className="mb-8 flex-shrink-0">
            <Logo variant="horizontal" size="md" />
          </div>

          <nav className="space-y-2 flex-1 overflow-y-auto">
            <Button
              variant={currentView === "dashboard" ? "default" : "ghost"}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              size="sm"
              onClick={() => setCurrentView("dashboard")}
            >
              <TrendingUp className="w-4 h-4 mr-3" />
              Início
            </Button>
            <Button
              variant={currentView === "transactions" ? "default" : "ghost"}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              size="sm"
              onClick={() => setCurrentView("transactions")}
            >
              <CreditCard className="w-4 h-4 mr-3" />
              Transações
            </Button>
            <Button
              variant={currentView === "statistics" ? "default" : "ghost"}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              size="sm"
              onClick={() => setCurrentView("statistics")}
            >
              <BarChart3 className="w-4 h-4 mr-3" />
              Estatísticas
            </Button>
            <Button
              variant={currentView === "categories" ? "default" : "ghost"}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              size="sm"
              onClick={() => setCurrentView("categories")}
            >
              <Tag className="w-4 h-4 mr-3" />
              Categorias
            </Button>
            <Button
              variant={currentView === "appointments" ? "default" : "ghost"}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              size="sm"
              onClick={() => setCurrentView("appointments")}
            >
              <Calendar className="w-4 h-4 mr-3" />
              Agendamentos
            </Button>
            <Button
              variant={currentView === "change-password" ? "default" : "ghost"}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              size="sm"
              onClick={() => setCurrentView("change-password")}
            >
              <Settings className="w-4 h-4 mr-3" />
              Nova Senha
            </Button>

            {isSuperAdmin && (
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent border border-orange-500/20 bg-orange-500/10"
                size="sm"
                onClick={() => navigate("/super-admin")}
              >
                <Shield className="w-4 h-4 mr-3 text-orange-500" />
                <span className="text-orange-500 font-medium">Super Admin</span>
              </Button>
            )}
          </nav>

          <div className="mt-auto pt-4 border-t border-sidebar-border flex-shrink-0 space-y-4">
            <div className="text-sm text-sidebar-foreground/60 mb-2 px-2 truncate" title={user.email}>
              {user.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sair
            </Button>

            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-6 mobile-content lg:pb-6 mobile-scroll overflow-y-auto lg:h-screen lg:overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6 min-h-full">
              {currentView === "dashboard" && (
                <>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6 mb-4 lg:mb-6">
                    {/* Balance Card */}
                    <Card className="bg-gradient-card shadow-card border-border xl:col-span-2">
                      <CardContent className="p-4 lg:p-6">
                        <div className="mb-4 lg:mb-6">
                          <h3 className="text-sm text-muted-foreground mb-2">Seu Saldo</h3>
                          <div className="text-2xl lg:text-3xl font-bold text-foreground">
                            {totalBalance >= 0 ? "R$ " : "-R$ "}
                            {Math.abs(totalBalance).toFixed(2).replace(".", ",")}
                          </div>
                        </div>

                        {/* Quick Actions - Hidden on mobile to avoid clutter */}
                        <div className="hidden sm:grid grid-cols-3 gap-2 lg:gap-4">
                          <Button
                            variant="ghost"
                            className="h-12 lg:h-16 flex-col gap-1 lg:gap-2 bg-muted/50 hover:bg-muted/70 text-xs lg:text-sm"
                            onClick={() => setIsAddDialogOpen(true)}
                          >
                            <Plus className="w-4 h-4 lg:w-5 lg:h-5" />
                            <span className="text-xs">Novo</span>
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-12 lg:h-16 flex-col gap-1 lg:gap-2 bg-muted/50 hover:bg-muted/70 text-xs lg:text-sm"
                            onClick={() => setCurrentView("transactions")}
                          >
                            <CreditCard className="w-4 h-4 lg:w-5 lg:h-5" />
                            <span className="text-xs">Transações</span>
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-12 lg:h-16 flex-col gap-1 lg:gap-2 bg-muted/50 hover:bg-muted/70 text-xs lg:text-sm"
                            onClick={() => setCurrentView("categories")}
                          >
                            <Tag className="w-4 h-4 lg:w-5 lg:h-5" />
                            <span className="text-xs">Categorias</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Monthly Summary */}
                    <Card className="bg-gradient-card shadow-card border-border">
                      <CardHeader className="pb-3 p-4 lg:p-6">
                        <CardTitle className="text-sm text-muted-foreground">Resumo Mensal</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            variant={summaryView === "expenses" ? "destructive" : "ghost"}
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() => setSummaryView("expenses")}
                          >
                            Despesas
                          </Button>
                          <Button
                            variant={summaryView === "income" ? "default" : "ghost"}
                            size="sm"
                            className="h-7 px-3 text-xs text-muted-foreground"
                            onClick={() => setSummaryView("income")}
                          >
                            Receitas
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 p-4 lg:p-6 lg:pt-0">
                        <div className={`text-xl lg:text-2xl font-bold mb-2 lg:mb-4 ${summaryView === "expenses" ? "text-destructive" : "text-green-600"}`}>
                          R$ {(summaryView === "expenses" ? totalExpense : totalIncome).toFixed(2).replace(".", ",")}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Total de {summaryView === "expenses" ? "despesas" : "receitas"}
                        </div>
                        <TransactionChart transactions={transactions} type={summaryView} />
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    {/* Pie Chart - Análise por Categoria */}
                    <Card className="bg-gradient-card shadow-card border-border lg:row-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                          Análise por Categoria
                        </CardTitle>
                        <p className="text-xs text-white/60">Clique nas categorias para filtrar</p>
                      </CardHeader>
                      <CardContent>
                        <TransactionPieChart transactions={transactions} type="expenses" />
                      </CardContent>
                    </Card>

                    {/* Recent Transactions */}
                    <div>
                      <TransactionList
                        transactions={transactions}
                        onTransactionDeleted={() => {
                          // Reload transactions after deletion
                          const loadData = async () => {
                            const { data: transactionsData } = await supabase
                              .from('transactions')
                              .select('*')
                              .eq('user_id', user.id)
                              .order('created_at', { ascending: false });

                            if (transactionsData) {
                              const mappedTransactions = transactionsData.map(t => ({
                                ...t,
                                amount: Number(t.amount),
                                date: t.date || t.created_at,
                                type: t.type as "income" | "expense"
                              }));
                              setTransactions(mappedTransactions);
                            }
                          };
                          loadData();
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <Appointments user={user} />
                  </div>
                </>
              )}

              {currentView === "transactions" && (
                <div className="min-h-[calc(100vh-120px)]">
                  <TransactionList
                    transactions={transactions}
                    showAll={true}
                    onTransactionDeleted={() => {
                      // Reload transactions after deletion
                      const loadData = async () => {
                        const { data: transactionsData } = await supabase
                          .from('transactions')
                          .select('*')
                          .eq('user_id', user.id)
                          .order('created_at', { ascending: false });

                        if (transactionsData) {
                          const mappedTransactions = transactionsData.map(t => ({
                            ...t,
                            amount: Number(t.amount),
                            date: t.date || t.created_at,
                            type: t.type as "income" | "expense"
                          }));
                          setTransactions(mappedTransactions);
                        }
                      };
                      loadData();
                    }}
                  />
                </div>
              )}

              {currentView === "statistics" && (
                <Statistics transactions={transactions} />
              )}

              {currentView === "categories" && (
                <Categories
                  transactions={transactions}
                  categories={categories}
                  onAddCategory={addCategory}
                  onUpdateCategories={fetchCategories}
                />
              )}

              {currentView === "appointments" && (
                <div className="min-h-[calc(100vh-120px)]">
                  <Appointments user={user} />
                </div>
              )}

              {currentView === "api-test" && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-6">Teste API - Adicionar Transação por Telefone</h2>
                    <ApiTestForm />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold mb-6">Teste Webhook - Lembrete</h2>
                    <TestWebhook />
                  </div>

                  <div className="mt-8 p-6 bg-muted/30 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Como usar a API:</h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <strong>URL:</strong>
                        <code className="block bg-background p-2 rounded mt-1">
                          https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/add-transaction-by-phone
                        </code>
                      </div>
                      <div>
                        <strong>Método:</strong> POST
                      </div>
                      <div>
                        <strong>Headers:</strong>
                        <code className="block bg-background p-2 rounded mt-1">
                          Content-Type: application/json
                        </code>
                      </div>
                      <div>
                        <strong>Body (JSON):</strong>
                        <code className="block bg-background p-2 rounded mt-1 whitespace-pre">
                          {`{
  "phone": "+5511999999999",
  "type": "expense",
  "amount": 50.00,
  "description": "Almoço",
  "category": "alimentação",
  "date": "2025-08-07"
}`}
                        </code>
                      </div>
                      <div>
                        <strong>Observações:</strong>
                        <ul className="list-disc ml-5 mt-2">
                          <li>O campo "date" é opcional, se não informado será usado a data atual</li>
                          <li>O "type" pode ser "income" ou "expense"</li>
                          <li>O telefone deve estar cadastrado no perfil do usuário</li>
                          <li>Todos os outros campos são obrigatórios</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentView === "change-password" && (
                <div className="min-h-[calc(100vh-120px)]">
                  <ChangePassword />
                </div>
              )}

              {/* Spacer final para garantir 10px de espaço antes do menu mobile */}
              <div className="h-10 lg:hidden" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Debug menu - apenas para desenvolvimento */}
        {user.email === "visionmarck@outlook.com" && (
          <div className="fixed top-4 right-4 z-50">
            <Button
              variant={currentView === "api-test" ? "default" : "secondary"}
              size="sm"
              onClick={() => setCurrentView("api-test")}
            >
              🔧 API Test
            </Button>
          </div>
        )}

      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        onAddTransaction={() => setIsAddDialogOpen(true)}
      />

      <AddTransactionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddTransaction={addTransaction}
        categories={categories}
        onAddCategory={addCategory}
      />
    </div>
  );
};