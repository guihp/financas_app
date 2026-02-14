import { Logo } from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  QrCode,
  FileText,
  CreditCard,
  CheckCircle,
  Sparkles,
  LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface TrialExpiredWallProps {
  userEmail?: string;
  daysExpiredAgo?: number;
}

export const TrialExpiredWall = ({
  userEmail,
  daysExpiredAgo = 0,
}: TrialExpiredWallProps) => {
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
      window.location.href = "/auth";
    } catch {
      window.location.href = "/auth";
    }
  };

  const handlePayment = (method: string) => {
    window.location.href = `/pagamento-pendente?method=${method}&email=${encodeURIComponent(userEmail || "")}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo variant="horizontal" size="lg" />
        </div>

        {/* Expired Notice */}
        <Card className="border-2 border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold">
              Seu período gratuito expirou
            </h2>
            <p className="text-sm text-muted-foreground">
              {daysExpiredAgo > 0
                ? `Seu trial expirou há ${daysExpiredAgo} dias.`
                : "Seu período de teste chegou ao fim."}{" "}
              Para continuar usando o IAFÉ Finanças, escolha um plano abaixo.
            </p>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Plano Mensal</h3>
              <Badge className="bg-primary/20 text-primary border-primary/30 ml-auto">
                Popular
              </Badge>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">R$ 29,90</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                Transações ilimitadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                Estatísticas e gráficos completos
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                Agenda financeira
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                Categorias personalizadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                Suporte via WhatsApp
              </li>
            </ul>

            {/* Payment Methods */}
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-center">Escolha como pagar:</p>

              <Button
                className="w-full h-14 justify-start gap-4 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
                variant="outline"
                onClick={() => handlePayment("PIX")}
              >
                <div className="h-9 w-9 rounded-lg bg-green-600/20 flex items-center justify-center">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">PIX</p>
                  <p className="text-xs opacity-70">Aprovação instantânea</p>
                </div>
              </Button>

              <Button
                className="w-full h-14 justify-start gap-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30"
                variant="outline"
                onClick={() => handlePayment("BOLETO")}
              >
                <div className="h-9 w-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Boleto Bancário</p>
                  <p className="text-xs opacity-70">
                    Até 3 dias úteis para compensar
                  </p>
                </div>
              </Button>

              <Button
                className="w-full h-14 justify-start gap-4 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/30"
                variant="outline"
                onClick={() => handlePayment("CREDIT_CARD")}
              >
                <div className="h-9 w-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Cartão de Crédito</p>
                  <p className="text-xs opacity-70">Aprovação imediata</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair da Conta
        </Button>
      </div>
    </div>
  );
};
