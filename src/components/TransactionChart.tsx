import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Transaction } from "./Dashboard";

interface TransactionChartProps {
  transactions: Transaction[];
  type?: "expenses" | "income";
}

export const TransactionChart = ({ transactions, type = "expenses" }: TransactionChartProps) => {
  // Filtrar transações do tipo especificado
  const transactionType = type === "expenses" ? "expense" : "income";
  const filteredTransactions = transactions.filter(t => t.type === transactionType);

  // Group transactions by day for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  }).reverse();

  const chartData = last7Days.map(date => {
    const dayTransactions = filteredTransactions.filter(t => {
      const transactionDate = new Date(t.date || t.created_at);
      return transactionDate.toDateString() === date.toDateString();
    });

    const amount = dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      day: date.getDate().toString().padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0'),
      amount: amount,
    };
  });

  // Se não há dados nos últimos 7 dias, mostrar dados históricos
  const hasRecentData = chartData.some(d => d.amount > 0);
  let finalChartData = chartData;

  if (!hasRecentData && filteredTransactions.length > 0) {
    const allTransactionsByDay = filteredTransactions.reduce((acc, t) => {
      const date = new Date(t.date || t.created_at);
      const day = date.getDate().toString().padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
      acc[day] = (acc[day] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const sortedDays = Object.entries(allTransactionsByDay)
      .sort(([a], [b]) => {
        const [dayA, monthA] = a.split('/').map(Number);
        const [dayB, monthB] = b.split('/').map(Number);
        const dateA = new Date(2024, monthA - 1, dayA);
        const dateB = new Date(2024, monthB - 1, dayB);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-7);

    finalChartData = sortedDays.map(([day, amount]) => ({
      day,
      amount
    }));
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const barColor = type === "expenses" ? "#ef4444" : "#22c55e";

  // Se não há dados, mostrar mensagem
  if (finalChartData.every(d => d.amount === 0)) {
    return (
      <div className="h-48 sm:h-64 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Nenhum dado para exibir</p>
      </div>
    );
  }

  return (
    <div className="h-48 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={finalChartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.6)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
            width={45}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
                    <p className="font-medium text-white text-sm">{label}</p>
                    <p className={`text-sm font-bold ${type === "expenses" ? "text-red-400" : "text-green-400"}`}>
                      {formatCurrency(Number(payload[0].value))}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="amount"
            fill={barColor}
            radius={[6, 6, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};