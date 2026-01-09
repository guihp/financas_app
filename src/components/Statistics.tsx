import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, PieChart, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import { Transaction } from "./Dashboard";
import { useMemo } from "react";

interface StatisticsProps {
  transactions: Transaction[];
}

// Mapeamento de nomes de categorias
const getCategoryDisplayName = (categoryName: string) => {
  const names: Record<string, string> = {
    alimentacao: "Alimentação",
    transporte: "Transporte",
    saude: "Saúde",
    lazer: "Lazer",
    educacao: "Educação",
    casa: "Casa",
    trabalho: "Trabalho",
    geral: "Geral",
  };
  return names[categoryName] || categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
};

export const Statistics = ({ transactions }: StatisticsProps) => {
  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpenses;

    // Gastos por categoria
    const expensesByCategory = transactions
      .filter(t => t.type === "expense")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    // Receitas por categoria
    const incomeByCategory = transactions
      .filter(t => t.type === "income")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    // Transações por mês
    const transactionsByMonth = transactions.reduce((acc, t) => {
      const date = new Date(t.date || t.created_at);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[month]) {
        acc[month] = { income: 0, expenses: 0 };
      }
      if (t.type === "income") {
        acc[month].income += Number(t.amount);
      } else {
        acc[month].expenses += Number(t.amount);
      }
      return acc;
    }, {} as Record<string, { income: number; expenses: number }>);

    return {
      totalIncome,
      totalExpenses,
      balance,
      expensesByCategory,
      incomeByCategory,
      transactionsByMonth,
      averageExpense: totalExpenses / Math.max(transactions.filter(t => t.type === "expense").length, 1),
      averageIncome: totalIncome / Math.max(transactions.filter(t => t.type === "income").length, 1),
      transactionCount: transactions.length,
    };
  }, [transactions]);

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/20 rounded-lg">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Estatísticas</h1>
          <p className="text-sm text-white/60">{stats.transactionCount} transações registradas</p>
        </div>
      </div>

      {/* Resumo Geral - Cards maiores e mais visuais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Total de Receitas</CardTitle>
            <div className="p-2 bg-green-500/20 rounded-full">
              <ArrowUpRight className="h-4 w-4 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl lg:text-4xl font-bold text-green-400">
              R$ {stats.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-white/50 mt-2">
              Média por transação: R$ {stats.averageIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Total de Despesas</CardTitle>
            <div className="p-2 bg-red-500/20 rounded-full">
              <ArrowDownRight className="h-4 w-4 text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl lg:text-4xl font-bold text-red-400">
              R$ {stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-white/50 mt-2">
              Média por transação: R$ {stats.averageExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${stats.balance >= 0 ? 'from-emerald-500/20 to-teal-600/10 border-emerald-500/30' : 'from-orange-500/20 to-red-600/10 border-orange-500/30'} overflow-hidden relative`}>
          <div className={`absolute top-0 right-0 w-32 h-32 ${stats.balance >= 0 ? 'bg-emerald-500/10' : 'bg-orange-500/10'} rounded-full -mr-16 -mt-16`} />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/80">Saldo Total</CardTitle>
            <div className={`p-2 ${stats.balance >= 0 ? 'bg-emerald-500/20' : 'bg-orange-500/20'} rounded-full`}>
              <Wallet className={`h-4 w-4 ${stats.balance >= 0 ? 'text-emerald-400' : 'text-orange-400'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl lg:text-4xl font-bold ${stats.balance >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {stats.balance >= 0 ? "" : "-"}R$ {Math.abs(stats.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-white/50 mt-2">
              {stats.balance >= 0 ? "🎉 Você está no positivo!" : "⚠️ Atenção aos gastos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gastos por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-1.5 bg-red-500/20 rounded">
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.expensesByCategory)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 6)
              .map(([category, amount], index) => {
                const percentage = (amount / stats.totalExpenses) * 100;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/90">{getCategoryDisplayName(category)}</span>
                      <span className="font-medium text-white">
                        R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/50">{percentage.toFixed(1)}%</span>
                  </div>
                );
              })}
            {Object.keys(stats.expensesByCategory).length === 0 && (
              <p className="text-white/50 text-center py-4">
                Nenhuma despesa registrada
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-1.5 bg-green-500/20 rounded">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              Receitas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.incomeByCategory)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 6)
              .map(([category, amount], index) => {
                const percentage = (amount / stats.totalIncome) * 100;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/90">{getCategoryDisplayName(category)}</span>
                      <span className="font-medium text-white">
                        R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/50">{percentage.toFixed(1)}%</span>
                  </div>
                );
              })}
            {Object.keys(stats.incomeByCategory).length === 0 && (
              <p className="text-white/50 text-center py-4">
                Nenhuma receita registrada
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fluxo Mensal - Gráfico Melhorado */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-1.5 bg-primary/20 rounded">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            Fluxo Mensal
          </CardTitle>
          <p className="text-sm text-white/50">Comparativo de receitas e despesas por mês</p>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.transactionsByMonth).length === 0 ? (
            <p className="text-white/50 text-center py-8">
              Nenhuma transação registrada
            </p>
          ) : (
            <div className="space-y-6">
              <div className="h-72 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(stats.transactionsByMonth)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .slice(-6)
                      .map(([month, data]) => ({
                        month: formatMonth(month),
                        receitas: data.income,
                        despesas: data.expenses,
                        saldo: data.income - data.expenses,
                      }))}
                    margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "rgba(255,255,255,0.7)" }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                      tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`}
                      width={60}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const saldo = Number(payload[0]?.payload?.saldo || 0);
                          return (
                            <div className="bg-card border border-border rounded-lg p-4 shadow-xl">
                              <p className="font-semibold text-white mb-3 text-base">{label}</p>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-6">
                                  <span className="flex items-center gap-2 text-green-400">
                                    <div className="w-3 h-3 bg-green-500 rounded" />
                                    Receitas
                                  </span>
                                  <span className="font-medium text-green-400">
                                    R$ {Number(payload[0]?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                  <span className="flex items-center gap-2 text-red-400">
                                    <div className="w-3 h-3 bg-red-500 rounded" />
                                    Despesas
                                  </span>
                                  <span className="font-medium text-red-400">
                                    R$ {Number(payload[1]?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="border-t border-white/10 pt-2 mt-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white/70">Saldo</span>
                                    <span className={`font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                      {saldo >= 0 ? '+' : ''}R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      formatter={(value) => <span className="text-white/80 text-sm">{value}</span>}
                    />
                    <Bar 
                      dataKey="receitas" 
                      name="Receitas"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                    <Bar 
                      dataKey="despesas" 
                      name="Despesas"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Resumo dos últimos meses */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white/70 mb-3">Resumo dos Últimos Meses</h4>
                <div className="space-y-2">
                  {Object.entries(stats.transactionsByMonth)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 3)
                    .map(([month, data]) => {
                      const saldo = data.income - data.expenses;
                      return (
                        <div key={month} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                          <span className="font-medium text-white">{formatMonth(month)}</span>
                          <div className="flex items-center gap-4 lg:gap-8">
                            <div className="text-right">
                              <span className="text-xs text-white/50 block">Receitas</span>
                              <span className="text-green-400 font-medium">
                                +R$ {data.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-white/50 block">Despesas</span>
                              <span className="text-red-400 font-medium">
                                -R$ {data.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-right min-w-[100px]">
                              <span className="text-xs text-white/50 block">Saldo</span>
                              <span className={`font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                {saldo >= 0 ? '+' : ''}R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};