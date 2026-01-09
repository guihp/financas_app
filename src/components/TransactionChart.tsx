import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Transaction } from "./Dashboard";

interface TransactionChartProps {
  transactions: Transaction[];
  type?: "expenses" | "income";
}

export const TransactionChart = ({ transactions, type = "expenses" }: TransactionChartProps) => {
  // Filtrar transações do tipo especificado
  // Converter "expenses" para "expense" e manter "income" como está
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
    // Agrupar todas as transações por dia
    const allTransactionsByDay = filteredTransactions.reduce((acc, t) => {
      const date = new Date(t.date || t.created_at);
      const day = date.getDate().toString().padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
      acc[day] = (acc[day] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    // Pegar os últimos 7 dias com dados
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

  return (
    <div className="h-24 sm:h-32">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={finalChartData} 
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          barCategoryGap="15%"
        >
          <XAxis 
            dataKey="day" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis 
            hide 
            domain={[0, 'dataMax']}
          />
          <Bar 
            dataKey="amount" 
            fill={type === "expenses" ? "hsl(var(--destructive))" : "hsl(var(--success))"}
            radius={[4, 4, 0, 0]}
            minPointSize={5}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};