import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Sector } from "recharts";
import { Transaction } from "./Dashboard";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface PieChartProps {
  transactions: Transaction[];
  type?: "expenses" | "income";
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
    expense: "Despesa",
    income: "Receita",
  };
  return names[categoryName] || categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
};

// Cores vibrantes para o gráfico
const COLORS = [
  "#8b5cf6", // Violeta
  "#06b6d4", // Ciano
  "#f59e0b", // Âmbar
  "#ef4444", // Vermelho
  "#10b981", // Esmeralda
  "#ec4899", // Rosa
  "#3b82f6", // Azul
  "#f97316", // Laranja
  "#14b8a6", // Teal
  "#a855f7", // Roxo
];

// Componente para setor ativo (hover)
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))' }}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 15}
        outerRadius={outerRadius + 18}
        fill={fill}
      />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill="white"
        className="text-sm font-semibold"
      >
        {getCategoryDisplayName(payload.name)}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="white"
        className="text-xs"
      >
        {`R$ ${value.toFixed(2).replace('.', ',')}`}
      </text>
      <text
        x={cx}
        y={cy + 28}
        textAnchor="middle"
        fill="rgba(255,255,255,0.7)"
        className="text-xs"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

export const TransactionPieChart = ({ transactions, type = "expenses" }: PieChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"expenses" | "income">(type === "expenses" ? "expenses" : "income");

  // Filtrar transações pelo tipo
  const transactionType = viewMode === "expenses" ? "expense" : "income";
  const filteredByType = transactions.filter(t => t.type === transactionType);

  // Obter todas as categorias disponíveis
  const allCategories = useMemo(() => {
    const cats = new Set(filteredByType.map(t => t.category || "Outros"));
    return Array.from(cats);
  }, [filteredByType]);

  // Filtrar por categorias selecionadas
  const filteredTransactions = useMemo(() => {
    if (selectedCategories.length === 0) return filteredByType;
    return filteredByType.filter(t => selectedCategories.includes(t.category || "Outros"));
  }, [filteredByType, selectedCategories]);

  // Agrupar transações por categoria
  const chartData = useMemo(() => {
    const categoryData = filteredTransactions.reduce((acc, transaction) => {
      const category = transaction.category || "Outros";
      acc[category] = (acc[category] || 0) + Number(transaction.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Calcular total
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      }
      return [...prev, category];
    });
  };

  const clearFilters = () => {
    setSelectedCategories([]);
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (filteredByType.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p className="text-sm text-center">
          Nenhum dado disponível para {viewMode === "expenses" ? "despesas" : "receitas"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle Despesas/Receitas */}
      <div className="flex gap-2 justify-center">
        <Button
          variant={viewMode === "expenses" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("expenses")}
          className={viewMode === "expenses" ? "bg-red-500 hover:bg-red-600 text-white" : "text-white border-white/30"}
        >
          Despesas
        </Button>
        <Button
          variant={viewMode === "income" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("income")}
          className={viewMode === "income" ? "bg-green-500 hover:bg-green-600 text-white" : "text-white border-white/30"}
        >
          Receitas
        </Button>
      </div>

      {/* Filtros de Categoria */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/70">Filtrar por categoria:</span>
          {selectedCategories.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs text-white/70 hover:text-white">
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((category, index) => (
            <Badge
              key={category}
              variant={selectedCategories.includes(category) ? "default" : "outline"}
              className={`cursor-pointer transition-all text-xs ${
                selectedCategories.includes(category) 
                  ? "text-white" 
                  : "text-white/80 border-white/30 hover:border-white/60"
              }`}
              style={{
                backgroundColor: selectedCategories.includes(category) 
                  ? COLORS[index % COLORS.length] 
                  : 'transparent'
              }}
              onClick={() => toggleCategory(category)}
            >
              {getCategoryDisplayName(category)}
            </Badge>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="text-center">
        <span className="text-white/70 text-sm">Total: </span>
        <span className={`text-lg font-bold ${viewMode === "expenses" ? "text-red-400" : "text-green-400"}`}>
          {formatCurrency(total)}
        </span>
      </div>

      {/* Gráfico de Pizza */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              activeIndex={activeIndex !== null ? activeIndex : undefined}
              activeShape={renderActiveShape}
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              animationBegin={0}
              animationDuration={800}
            >
              {chartData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Valor']}
              contentStyle={{
                backgroundColor: 'hsl(270 25% 18%)',
                border: '1px solid hsl(270 20% 28%)',
                borderRadius: '8px',
                color: 'white'
              }}
              labelFormatter={(label) => getCategoryDisplayName(label)}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda customizada */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {chartData.map((entry, index) => (
          <div 
            key={entry.name} 
            className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => toggleCategory(entry.name)}
          >
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-white/90 truncate text-xs">
              {getCategoryDisplayName(entry.name)}
            </span>
            <span className="text-white/60 text-xs ml-auto">
              {((entry.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
