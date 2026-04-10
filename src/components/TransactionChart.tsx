import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Transaction } from "./Dashboard";

interface TransactionChartProps {
  transactions: Transaction[];
  type?: "expenses" | "income";
  /** Preenche a altura do container pai (ex.: card ao lado do pizza chart no desktop). */
  fillHeight?: boolean;
}

const formatYAxisTick = (value: number) => {
  const n = Number(value);
  if (n === 0) return "R$ 0";
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `R$ ${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
};

export const TransactionChart = ({ transactions, type = "expenses", fillHeight = false }: TransactionChartProps) => {
  const parseTxDate = (value?: string) => {
    if (!value) return new Date(NaN);
    return new Date(value + (value.includes("T") ? "" : "T12:00:00"));
  };
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
      const transactionDate = parseTxDate(t.date || t.created_at);
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
      const date = parseTxDate(t.date || t.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      acc[key] = (acc[key] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const sortedDays = Object.entries(allTransactionsByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7);

    finalChartData = sortedDays.map(([key, amount]) => {
      const [year, month, day] = key.split("-");
      return {
      day: `${day}/${month}`,
      amount
    };});
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const barColor = type === "expenses" ? "#ef4444" : "#22c55e";

  const outerClass = fillHeight
    ? "h-full w-full min-h-[200px] lg:min-h-[260px]"
    : "h-48 sm:h-64";

  // Se não há dados, mostrar mensagem
  if (finalChartData.every(d => d.amount === 0)) {
    return (
      <div className={`${outerClass} flex items-center justify-center text-muted-foreground`}>
        <p className="text-sm">Nenhum dado para exibir</p>
      </div>
    );
  }

  const maxAmount = Math.max(...finalChartData.map((d) => d.amount), 0);

  return (
    <div className={outerClass}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={finalChartData}
          margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
          barCategoryGap="18%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={formatYAxisTick}
            width={52}
            domain={[0, maxAmount > 0 ? Math.ceil(maxAmount * 1.08) : 1]}
            allowDecimals={false}
            tickCount={5}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
                    <p className="font-medium text-foreground text-sm">{label}</p>
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