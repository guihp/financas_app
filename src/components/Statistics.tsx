import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Transaction } from "./Dashboard";
import { useMemo } from "react";

interface StatisticsProps {
  transactions: Transaction[];
}

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
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Estatísticas</h1>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {stats.totalIncome.toFixed(2).replace(".", ",")}
            </div>
            <p className="text-xs text-muted-foreground">
              Média: R$ {stats.averageIncome.toFixed(2).replace(".", ",")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {stats.totalExpenses.toFixed(2).replace(".", ",")}
            </div>
            <p className="text-xs text-muted-foreground">
              Média: R$ {stats.averageExpense.toFixed(2).replace(".", ",")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <DollarSign className={`h-4 w-4 ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.balance >= 0 ? "R$ " : "-R$ "}
              {Math.abs(stats.balance).toFixed(2).replace(".", ",")}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.balance >= 0 ? "Você está no positivo!" : "Atenção aos gastos"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gastos por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.expensesByCategory)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{category}</span>
                  <span className="font-medium">R$ {amount.toFixed(2).replace(".", ",")}</span>
                </div>
              ))}
            {Object.keys(stats.expensesByCategory).length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma despesa registrada
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Receitas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.incomeByCategory)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{category}</span>
                  <span className="font-medium">R$ {amount.toFixed(2).replace(".", ",")}</span>
                </div>
              ))}
            {Object.keys(stats.incomeByCategory).length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma receita registrada
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fluxo Mensal */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.transactionsByMonth).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma transação registrada
            </p>
          ) : (
            <div className="space-y-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(stats.transactionsByMonth)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .slice(-6)
                      .map(([month, data]) => ({
                        month: month,
                        receitas: data.income,
                        despesas: data.expenses,
                      }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium mb-2">{label}</p>
                              {payload.map((entry, index) => (
                                <p key={index} style={{ color: entry.color }} className="text-sm">
                                  {entry.name}: R$ {Number(entry.value).toFixed(2).replace(".", ",")}
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="receitas" 
                      name="Receitas"
                      fill="hsl(142, 76%, 36%)" 
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar 
                      dataKey="despesas" 
                      name="Despesas"
                      fill="hsl(0, 84%, 60%)" 
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-2">
                {Object.entries(stats.transactionsByMonth)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 3)
                  .map(([month, data]) => (
                    <div key={month} className="flex items-center justify-between p-2 text-sm">
                      <span className="font-medium">{month}</span>
                      <div className="flex gap-4">
                        <span className="text-green-600">+R$ {data.income.toFixed(2).replace(".", ",")}</span>
                        <span className="text-red-600">-R$ {data.expenses.toFixed(2).replace(".", ",")}</span>
                        <span className={`font-medium ${(data.income - data.expenses) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(data.income - data.expenses) >= 0 ? "+" : ""}R$ {(data.income - data.expenses).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};