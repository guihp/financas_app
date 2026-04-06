import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Gift, Activity, CircleUser, TrendingUp, UserPlus, CreditCard, CalendarDays, Settings } from "lucide-react";
import { toast } from "sonner";
import { AdminPromotionalCodes } from "@/components/AdminPromotionalCodes";
import { AdminUserList } from "@/components/AdminUserList";
import { AdminCreateUser } from "@/components/AdminCreateUser";
import { AdminSubscriptions } from "@/components/AdminSubscriptions";
import { AdminLeadsList } from "@/components/AdminLeadsList";
import { AdminAppSettings } from "@/components/AdminAppSettings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminSupremoFinancas = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [kpiStats, setKpiStats] = useState({
        totalUsers: 0,
        partialRegistrations: 0,
        payingUsers: 0,
        trialUsers: 0,
        usersWithPromo: 0,
        mrr: 0,
        topPromo: "Nenhum"
    });
    const [growthData, setGrowthData] = useState<any[]>([]);
    const [chartPeriod, setChartPeriod] = useState("7");

    const navigate = useNavigate();

    useEffect(() => {
        checkSuperAdminAccess();
    }, []);

    useEffect(() => {
        if (isSuperAdmin) {
            fetchGrowthData();
        }
    }, [chartPeriod]);

    const checkSuperAdminAccess = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                navigate("/auth");
                return;
            }

            setUser(session.user);

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

            const hasSuperAdminRole =
                userRoles?.some((role) => role.role === "super_admin") || false;

            if (!hasSuperAdminRole) {
                toast.error("Acesso negado - Apenas super administradores");
                navigate("/");
                return;
            }

            setIsSuperAdmin(true);
            fetchKpis();
        } catch (error) {
            console.error("Error in super admin check:", error);
            navigate("/");
        } finally {
            setLoading(false);
        }
    };

    const fetchKpis = async () => {
        try {
            let totalUsersCount = 0;
            const { count: countTotal } = await supabase
                .from("profiles")
                .select('*', { count: 'exact', head: true });
            totalUsersCount = countTotal || 0;

            let partialRegCount = 0;
            const { count: countPartial } = await supabase
                .from("otp_codes")
                .select('*', { count: 'exact', head: true })
                .eq("verified", false);
            partialRegCount = countPartial || 0;

            let payingUsersCount = 0;
            const { count: countPaying } = await supabase
                .from("subscriptions")
                .select('*', { count: 'exact', head: true })
                .eq("status", "active")
                .eq("is_trial", false);
            payingUsersCount = countPaying || 0;

            let trialUsersCount = 0;
            const { count: countTrial } = await supabase
                .from("subscriptions")
                .select('*', { count: 'exact', head: true })
                .eq("status", "active")
                .eq("is_trial", true);
            trialUsersCount = countTrial || 0;

            let promoUsersCount = 0;
            const { count: countPromo } = await supabase
                .from("subscriptions")
                .select('*', { count: 'exact', head: true })
                .not("promotional_code_id", "is", null);
            promoUsersCount = countPromo || 0;

            // Calculate MRR and Top Promo Code
            const { data: subsData } = await supabase
                .from("subscriptions")
                .select("promotional_code_id, status, is_trial");

            let currentMrr = 0;
            const promoCounts: Record<string, number> = {};

            if (subsData) {
                subsData.forEach(sub => {
                    if (sub.status === 'active' && !sub.is_trial) {
                        // Base value check or 29.9 default
                        currentMrr += 29.90; // Fixed plan base estimation for MVP
                    }
                    if (sub.promotional_code_id) {
                        promoCounts[sub.promotional_code_id] = (promoCounts[sub.promotional_code_id] || 0) + 1;
                    }
                });
            }

            let topPromoName = "Nenhum";
            if (Object.keys(promoCounts).length > 0) {
                const topPromoId = Object.keys(promoCounts).reduce((a, b) => promoCounts[a] > promoCounts[b] ? a : b);
                const { data: pcData } = await supabase.from('promotional_codes').select('code').eq('id', topPromoId).single();
                if (pcData) topPromoName = `${pcData.code} (${promoCounts[topPromoId]} usos)`;
            }

            setKpiStats({
                totalUsers: totalUsersCount,
                partialRegistrations: partialRegCount,
                payingUsers: payingUsersCount,
                trialUsers: trialUsersCount,
                usersWithPromo: promoUsersCount,
                mrr: currentMrr,
                topPromo: topPromoName
            });

            // Initial fetch
            await fetchGrowthData();

        } catch (error) {
            console.error("Error fetching KPIs:", error);
            toast.error("Erro ao carregar as métricas do painel.");
        }
    };

    const fetchGrowthData = async () => {
        try {
            const endDate = endOfDay(new Date());
            let startDate = startOfDay(subDays(endDate, 6)); // default 7
            let daysToSub = 6;

            if (chartPeriod === "15") {
                daysToSub = 14;
                startDate = startOfDay(subDays(endDate, daysToSub));
            } else if (chartPeriod === "30") {
                daysToSub = 29;
                startDate = startOfDay(subDays(endDate, daysToSub));
            } else if (chartPeriod === "mes_atual") {
                startDate = startOfDay(startOfMonth(new Date()));
                daysToSub = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('created_at')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());

            if (error) throw error;

            // Group by day
            const groupedData = data.reduce((acc: any, curr) => {
                const date = format(new Date(curr.created_at), 'dd/MM (EEE)', { locale: ptBR });
                if (!acc[date]) {
                    acc[date] = 0;
                }
                acc[date]++;
                return acc;
            }, {});

            // Create array
            const finalData = [];
            for (let i = daysToSub; i >= 0; i--) {
                const day = subDays(endDate, i);
                const dateStr = format(day, 'dd/MM (EEE)', { locale: ptBR });
                finalData.push({
                    name: dateStr,
                    usuarios: groupedData[dateStr] || 0
                });
            }

            setGrowthData(finalData);

        } catch (error) {
            console.error("Error fetching growth data:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Verificando permissões seguras...</p>
                </div>
            </div>
        );
    }

    if (!isSuperAdmin) {
        return null;
    }

    return (
        <div className="space-y-6 pb-24 lg:pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold">Gerenciamento Supremo</h1>
                    <p className="text-sm text-muted-foreground">
                        Métricas de Conversão, Promoções e Cadastros
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto overflow-x-auto bg-card border rounded-lg p-1 h-auto">
                    <TabsTrigger value="overview" className="flex items-center justify-center gap-2 py-2.5">
                        <Activity className="h-4 w-4" />
                        <span className="text-sm font-medium">Métricas & Assinantes</span>
                    </TabsTrigger>
                    <TabsTrigger value="leads" className="flex items-center justify-center gap-2 py-2.5">
                        <CircleUser className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium text-orange-500">Funil (Abandonos)</span>
                    </TabsTrigger>
                    <TabsTrigger value="users" className="flex items-center justify-center gap-2 py-2.5">
                        <Users className="h-4 w-4" />
                        <span className="text-sm font-medium">Usuários & Cadastros</span>
                    </TabsTrigger>
                    <TabsTrigger value="promo_codes" className="flex items-center justify-center gap-2 py-2.5">
                        <Gift className="h-4 w-4" />
                        <span className="text-sm font-medium">Marketing & Códigos</span>
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex items-center justify-center gap-2 py-2.5">
                        <Settings className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium text-purple-500">Configurações</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-emerald-600/10 to-emerald-600/5 border-emerald-600/30 col-span-2 lg:col-span-1 shadow-md relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp className="h-16 w-16 text-emerald-600" />
                            </div>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                                <CardTitle className="text-sm font-bold text-emerald-500 uppercase tracking-wider">MRR Estimado</CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-3xl font-bold text-emerald-600">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiStats.mrr)}
                                </div>
                                <p className="text-xs text-emerald-600/70 font-medium mt-1">Receita Mensal Recorrente</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Cadastros Parciais (Leads)</CardTitle>
                                <CircleUser className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{kpiStats.partialRegistrations}</div>
                                <p className="text-xs text-muted-foreground">Estão no funil</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pessoas no Trial (7 Dias)</CardTitle>
                                <Activity className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-500">{kpiStats.trialUsers}</div>
                                <p className="text-xs text-muted-foreground">Em período de teste</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-emerald-600/5 to-emerald-600/10 border-emerald-600/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Usuários Pagantes (Ativos)</CardTitle>
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-600">{kpiStats.payingUsers}</div>
                                <p className="text-xs text-muted-foreground">Convertidos após teste</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20 col-span-2 lg:col-span-1">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-purple-600">Top Cupom/Influenciador</CardTitle>
                                <Gift className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold text-purple-600 truncate" title={kpiStats.topPromo}>{kpiStats.topPromo}</div>
                                <p className="text-xs text-purple-600/70 font-medium mt-1">Mais utilizado</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Gráficos de Crescimento */}
                    <div className="grid grid-cols-1 gap-4">
                        <Card className="border-border shadow-sm">
                            <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-primary" />
                                    Crescimento da Plataforma
                                </CardTitle>
                                <div className="w-full sm:w-[180px]">
                                    <Select value={chartPeriod} onValueChange={setChartPeriod}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Período" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="7">Últimos 7 dias</SelectItem>
                                            <SelectItem value="15">Últimos 15 dias</SelectItem>
                                            <SelectItem value="30">Últimos 30 dias</SelectItem>
                                            <SelectItem value="mes_atual">Mês Atual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent className="h-[300px] mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#888', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#888', fontSize: 12 }}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        />
                                        <Bar
                                            dataKey="usuarios"
                                            fill="#f97316"
                                            radius={[4, 4, 0, 0]}
                                            maxBarSize={50}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Subscriptions Table */}
                    <div className="pt-4 border-t mt-6">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-primary" />
                                Gestão de Assinaturas
                            </h2>
                            <p className="text-sm text-muted-foreground">Listagem e administração de todas as assinaturas ativas e inativas.</p>
                        </div>
                        <AdminSubscriptions />
                    </div>
                </TabsContent>

                <TabsContent value="leads">
                    <AdminLeadsList />
                </TabsContent>

                <TabsContent value="users" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="p-4 rounded-xl border bg-card/50">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-primary" />
                                Adicionar Novo Perfil Interno
                            </h3>
                            <AdminCreateUser />
                        </div>
                        <div className="pt-2">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Lista de Perfis Sociais
                            </h3>
                            <AdminUserList />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="promo_codes">
                    <AdminPromotionalCodes />
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                    <AdminAppSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AdminSupremoFinancas;
