import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Transaction } from "./Dashboard";

interface PieChartProps {
  transactions: Transaction[];
  type?: "expenses" | "income";
}

export const TransactionPieChart = ({ transactions, type = "expenses" }: PieChartProps) => {
  const filteredTransactions = transactions.filter(t => t.type === type);

  // Agrupar transações por categoria
  const categoryData = filteredTransactions.reduce((acc, transaction) => {
    const category = transaction.category || "Outros";
    acc[category] = (acc[category] || 0) + Number(transaction.amount);
    return acc;
  }, {} as Record<string, number>);

  // Converter para formato do gráfico
  const chartData = Object.entries(categoryData).map(([category, amount]) => ({
    name: category,
    value: amount,
  }));

  // Cores para o gráfico de pizza usando o gradiente da IAFÉ Finanças
  const colors = [
    "#a855f7", // Roxo primário
    "#9333ea", // Roxo médio
    "#7c3aed", // Roxo escuro
    "#6b21a8", // Roxo mais escuro
    "#f97316", // Laranja primário
    "#ea580c", // Laranja médio
    "#c2410c", // Laranja escuro
    "#9a3412", // Laranja mais escuro
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (chartData.length === 0) {
    return (
      <div className="h-48 sm:h-64 flex items-center justify-center text-muted-foreground">
        <p className="text-sm text-center">Nenhum dado disponível para {type === "expenses" ? "despesas" : "receitas"}</p>
      </div>
    );
  }

  return (
    <div className="h-48 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={60}
            dataKey="value"
            label={({ name, percent }) => 
              chartData.length <= 6 ? `${name} ${(percent * 100).toFixed(0)}%` : `${(percent * 100).toFixed(0)}%`
            }
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [formatCurrency(value), 'Valor']}
            labelStyle={{ color: 'var(--foreground)' }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};