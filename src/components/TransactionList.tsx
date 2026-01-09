import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { Transaction } from "./Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TransactionListProps {
  transactions: Transaction[];
  showAll?: boolean;
  onTransactionDeleted?: () => void;
}

export const TransactionList = ({ transactions, showAll = false, onTransactionDeleted }: TransactionListProps) => {
  const displayTransactions = showAll ? transactions : transactions.slice(0, 5);
  const { toast } = useToast();

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;

      toast({
        title: "Transação excluída",
        description: "A transação foi excluída com sucesso.",
      });

      if (onTransactionDeleted) {
        onTransactionDeleted();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a transação.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">
          {showAll ? "Todas as Transações" : "Transações Recentes"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 lg:space-y-3">
        {displayTransactions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">Nenhuma transação encontrada</p>
          </div>
        ) : (
          displayTransactions.map((transaction) => {
            const date = new Date(transaction.date || transaction.created_at);
            return (
              <div key={transaction.id} className="flex items-center justify-between p-2 lg:p-0 hover:bg-muted/50 rounded-lg lg:rounded-none lg:hover:bg-transparent transition-colors group">
                <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
                  <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    transaction.type === "expense" 
                      ? "bg-destructive/20 text-destructive" 
                      : "bg-success/20 text-success"
                  }`}>
                    {transaction.type === "expense" ? (
                      <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4" />
                    ) : (
                      <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {date.toLocaleDateString("pt-BR")} • {transaction.category}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-xs lg:text-sm font-medium text-right flex-shrink-0 ${
                    transaction.type === "expense" ? "text-destructive" : "text-success"
                  }`}>
                    {transaction.type === "expense" ? "-" : "+"}R$ {Number(transaction.amount).toFixed(2).replace(".", ",")}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTransaction(transaction.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};