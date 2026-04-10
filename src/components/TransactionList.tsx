import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Trash2, Users, CreditCard, Banknote, Zap, Download } from "lucide-react";
import { Transaction } from "./Dashboard";
import React, { useState, useMemo } from 'react';
import fullLogoImg from '@/assets/Documento_3.png';
import { supabase } from "@/integrations/supabase/client";
import { getCategoryLabel } from "@/constants/financialData";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface TransactionListProps {
  transactions: Transaction[];
  showAll?: boolean;
  limit?: number;
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
    <span className={`inline - flex items - center gap - 0.5 px - 1.5 py - 0.5 rounded - full text - [10px] font - medium flex - shrink - 0 ${badge.className} `}>
      {badge.icon}
      {badge.label}
    </span>
  );
};

export const TransactionList = ({ transactions, showAll = false, limit = 5, onTransactionDeleted, currentUserId }: TransactionListProps) => {
  const displayTransactions = showAll ? transactions : transactions.slice(0, limit);
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

  const generatePDF = async () => {
    if (displayTransactions.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há transações para exportar.",
      });
      return;
    }

    const doc = new jsPDF();
    let textStartY = 32; // Default starting Y position if logo fails

    try {
      // 1) Converter a logo para Base64 dinamicamente sem inchar o JS
      const imgData = await fetch(fullLogoImg)
        .then(res => res.blob())
        .then(blob => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }));

      // Calculate dynamic aspect ratio height for a width of 35
      const imgInfo = await new Promise<{ w: number, h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.onerror = reject;
        img.src = imgData;
      });
      const targetWidth = 35;
      const targetHeight = (imgInfo.h * targetWidth) / imgInfo.w;

      // Inserir logo no canto superior direito (A4: 210 - 14 margem - 35 largura = 161)
      doc.addImage(imgData, 'PNG', 161, 10, targetWidth, targetHeight);

      // Calculate dynamic text start position based on logo height ensuring it doesn't overlap text on the left if it's very tall
      textStartY = Math.max(32, 10 + targetHeight + 5);
    } catch (e) {
      console.warn("Logo não encontrada para o PDF", e);
    }

    const tableColumn = ["Data", "Descrição", "Categoria", "Método", "Valor (R$)"];
    const tableRows: any[] = [];

    displayTransactions.forEach(t => {
      const isExpense = t.type === "expense";
      let dateStr = "N/A";
      try {
        if (t.date || t.created_at) {
          const rawDate = t.date || t.created_at;
          // Append T12:00:00 to date-only strings to avoid UTC midnight timezone shift
          const safeDateStr = typeof rawDate === 'string' && rawDate.length === 10 ? rawDate + 'T12:00:00' : rawDate;
          const dateObj = new Date(safeDateStr);
          dateStr = dateObj.toLocaleDateString("pt-BR");
        }
      } catch (e) {
        // fallback
      }
      const signedAmount = `${isExpense ? "-" : "+"}${Number(t.amount).toFixed(2).replace(".", ",")} `;
      const methodLabel = t.payment_method ? (
        t.payment_method === 'transfer' ? 'Transferência' :
          t.payment_method.charAt(0).toUpperCase() + t.payment_method.slice(1)
      ) : "-";

      // Regex para remover emojis e caracteres não normais da categoria que o jsPDF não entende
      const cleanCategory = getCategoryLabel(t.category).replace(/[^\x20-\x7E\xC0-\xFF]/g, '').trim();

      const transactionData = [
        dateStr,
        t.description,
        cleanCategory,
        methodLabel,
        signedAmount
      ];
      tableRows.push(transactionData);
    });

    const monthStr = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    doc.setFontSize(16);
    // Título Deslocado para baixo para respeitar a logo
    doc.text(`Relatório de Transações - ${monthStr} `, 14, textStartY);

    // Totais de caixa real para manter consistência com os cards principais
    const totalIncome = displayTransactions
      .filter(t => t.type === "income" && t.category !== "pagamento_fatura")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const totalExpense = displayTransactions
      .filter(t => t.type === "expense" && t.payment_method !== "credit")
      .reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = totalIncome - totalExpense;

    doc.setFontSize(11);
    doc.text(`Receitas: R$ ${totalIncome.toFixed(2).replace('.', ',')} | Despesas: R$ ${totalExpense.toFixed(2).replace('.', ',')} | Saldo: R$ ${balance.toFixed(2).replace('.', ',')} `, 14, textStartY + 8);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: textStartY + 15,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] }, // Dark/IAFÉ Theme
      didParseCell: function (data) {
        // Color amount column
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw.toString().startsWith('-')) {
            data.cell.styles.textColor = [220, 53, 69]; // red
          } else {
            data.cell.styles.textColor = [34, 197, 94]; // emerald-500
          }
        }
      }
    });

    doc.save(`relatorio_financeiro_${new Date().getTime()}.pdf`);
    toast({
      title: "Sucesso",
      description: "PDF gerado e baixado com sucesso!",
    });
  };

  return (
    <Card className="bg-gradient-card shadow-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">
          {showAll ? "Todas as Transações" : "Transações Recentes"}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={generatePDF} className="gap-2 h-8 text-xs font-medium">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 lg:space-y-3">
        {displayTransactions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">Nenhuma transação encontrada</p>
          </div>
        ) : (
          displayTransactions.map((transaction) => {
            const rawDate = transaction.date || transaction.created_at;
            // Append T12:00:00 to date-only strings to avoid UTC midnight timezone shift
            const safeDateStr = typeof rawDate === 'string' && rawDate.length === 10 ? rawDate + 'T12:00:00' : rawDate;
            const date = new Date(safeDateStr);
            return (
              <div key={transaction.id} className="flex items-center justify-between p-2 lg:p-0 hover:bg-muted/50 rounded-lg lg:rounded-none lg:hover:bg-transparent transition-colors group">
                <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
                  <div className={`w - 6 h - 6 lg: w - 8 lg: h - 8 rounded - full flex items - center justify - center flex - shrink - 0 ${transaction.type === "expense"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-success/20 text-success"
                    } `}>
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
                  <div className={`text - xs lg: text - sm font - medium text - right flex - shrink - 0 ${transaction.type === "expense" ? "text-destructive" : "text-success"
                    } `}>
                    {transaction.type === "expense" ? "-" : "+"}R$ {Number(transaction.amount).toFixed(2).replace(".", ",")}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir esta transação? Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteTransaction(transaction.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};