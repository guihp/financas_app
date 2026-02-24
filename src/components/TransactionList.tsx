import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Trash2, Users, CreditCard, Banknote, Zap } from "lucide-react";
import { Transaction } from "./Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryLabel } from "@/constants/financialData";
import { useToast } from "@/hooks/use-toast";

interface TransactionListProps {
  transactions: Transaction[];
  showAll?: boolean;
  onTransactionDeleted?: () => void;
  currentUserId?: string;
}

const PaymentMethodBadge = ({ method }: { method?: string | null }) => {
  if (!method) return null;

  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    debit: {
      icon: <Banknote className="w-2.5 h-2.5" />,
      label: "Débito",
      className: "bg-blue-500/20 text-blue-400",
    },
    pix: {
      icon: <Zap className="w-2.5 h-2.5" />,
      label: "PIX",
      className: "bg-green-500/20 text-green-400",
    },
    credit: {
      icon: <CreditCard className="w-2.5 h-2.5" />,
      label: "Crédito",
      className: "bg-purple-500/20 text-purple-400",
    },
    boleto: {
      icon: <Banknote className="w-2.5 h-2.5" />,
      label: "Boleto",
      className: "bg-amber-500/20 text-amber-400",
    },
  };

  const badge = config[method];
  if (!badge) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${badge.className}`}>
      {badge.icon}
      {badge.label}
    </span>
  );
};

export const TransactionList = ({ transactions, showAll = false, onTransactionDeleted, currentUserId }: TransactionListProps) => {
  const displayTransactions = showAll ? transactions : transactions.slice(0, 5);
  const { toast } = useToast();

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      // Verificar se usuário ainda está ativo
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Sessão inválida",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      // Deletar apenas se transação pertencer ao usuário (RLS também protege)
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id); // CRÍTICO: Garantir que só deleta suas próprias transações

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
                  <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${transaction.type === "expense"
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm truncate">{transaction.description}</p>
                      <PaymentMethodBadge method={transaction.payment_method} />
                      {transaction.total_installments && transaction.total_installments > 1 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-primary flex-shrink-0">
                          {transaction.installment_number}/{transaction.total_installments}
                        </span>
                      )}
                      {currentUserId && transaction.user_id && transaction.user_id !== currentUserId && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400 flex-shrink-0">
                          <Users className="w-2.5 h-2.5" />
                          Compartilhado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {date.toLocaleDateString("pt-BR")} • {getCategoryLabel(transaction.category)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-xs lg:text-sm font-medium text-right flex-shrink-0 ${transaction.type === "expense" ? "text-destructive" : "text-success"
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