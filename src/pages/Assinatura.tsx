import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  QrCode,
  FileText,
  CheckCircle,
  Gift,
  Sparkles,
  Crown,
  Shield,
} from "lucide-react";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

interface SubscriptionInfo {
  status: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
  days_remaining: number;
}

const Assinatura = () => {
  const { user } = useOutletContext<OutletContextType>();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadSubscription();
    }
  }, [user?.id]);

  const loadSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading subscription:", error);
      }

      if (data) {
        const now = new Date();
        let daysRemaining = 0;

        if (data.is_trial && data.trial_ends_at) {
          daysRemaining = Math.ceil(
            (new Date(data.trial_ends_at).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          );
        } else if (data.current_period_end) {
          daysRemaining = Math.ceil(
            (new Date(data.current_period_end).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          );
        }

        setSubscription({
          status: data.status,
          is_trial: data.is_trial || false,
          trial_ends_at: data.trial_ends_at,
          current_period_end: data.current_period_end,
          days_remaining: daysRemaining,
        });
      } else {
        // No subscription at all
        setSubscription({
          status: "none",
          is_trial: false,
          trial_ends_at: null,
          current_period_end: null,
          days_remaining: 0,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const isExpired =
    subscription &&
    (subscription.status === "expired" ||
      subscription.status === "cancelled" ||
      subscription.days_remaining <= 0);

  const isTrialActive =
    subscription &&
    subscription.is_trial &&
    subscription.days_remaining > 0;

  const isPaid =
    subscription &&
    subscription.status === "active" &&
    !subscription.is_trial &&
    subscription.days_remaining > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 xl:pb-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Sua Assinatura</h1>
        <p className="text-muted-foreground">
          Gerencie seu plano e pagamentos
        </p>
      </div>

      {/* Current Status Card */}
      <Card
        className={`border-2 ${
          isPaid
            ? "border-green-500/30 bg-green-500/5"
            : isTrialActive
            ? "border-blue-500/30 bg-blue-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                isPaid
                  ? "bg-green-500/20"
                  : isTrialActive
                  ? "bg-blue-500/20"
                  : "bg-red-500/20"
              }`}
            >
              {isPaid ? (
                <Crown className="h-7 w-7 text-green-400" />
              ) : isTrialActive ? (
                <Gift className="h-7 w-7 text-blue-400" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-red-400" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">
                  {isPaid
                    ? "Plano Ativo"
                    : isTrialActive
                    ? "Período Gratuito"
                    : "Assinatura Expirada"}
                </h3>
                <Badge
                  className={
                    isPaid
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : isTrialActive
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }
                >
                  {isPaid
                    ? "Pago"
                    : isTrialActive
                    ? "Trial"
                    : "Expirado"}
                </Badge>
              </div>

              {isTrialActive && subscription && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Você tem{" "}
                    <strong className="text-blue-400">
                      {subscription.days_remaining} dias
                    </strong>{" "}
                    restantes no período gratuito.
                  </p>
                  {subscription.trial_ends_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expira em:{" "}
                      {new Date(subscription.trial_ends_at).toLocaleDateString(
                        "pt-BR",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </p>
                  )}
                </div>
              )}

              {isPaid && subscription && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Plano Mensal - R$ 29,90/mês
                  </p>
                  {subscription.current_period_end && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Próxima cobrança:{" "}
                      {new Date(
                        subscription.current_period_end
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              )}

              {isExpired && (
                <p className="text-sm text-red-400">
                  Seu acesso expirou. Assine para continuar usando o IAFÉ
                  Finanças.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Options - Show when expired or trial */}
      {(isExpired || isTrialActive) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {isExpired ? "Assine Agora" : "Assine e Continue Após o Trial"}
            </CardTitle>
            <CardDescription>
              {isExpired
                ? "Escolha um método de pagamento para reativar sua conta"
                : "Garanta seu acesso quando o período gratuito acabar"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Plan Card */}
            <div className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Plano Mensal</h3>
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  Popular
                </Badge>
              </div>
              <div className="flex items-baseline gap-1 mb-3">
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
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Escolha como pagar:</p>

              <Button
                className="w-full h-14 justify-start gap-4 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
                variant="outline"
                onClick={() =>
                  navigate("/pagamento-pendente?method=PIX")
                }
              >
                <div className="h-9 w-9 rounded-lg bg-green-600/20 flex items-center justify-center">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">PIX</p>
                  <p className="text-xs opacity-70">
                    Aprovação instantânea
                  </p>
                </div>
              </Button>

              <Button
                className="w-full h-14 justify-start gap-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30"
                variant="outline"
                onClick={() =>
                  navigate("/pagamento-pendente?method=BOLETO")
                }
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
                onClick={() =>
                  navigate("/pagamento-pendente?method=CREDIT_CARD")
                }
              >
                <div className="h-9 w-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Cartão de Crédito</p>
                  <p className="text-xs opacity-70">
                    Aprovação imediata
                  </p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paid Status */}
      {isPaid && (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <Shield className="h-12 w-12 text-green-400 mx-auto" />
            <h3 className="text-lg font-semibold">Tudo certo!</h3>
            <p className="text-sm text-muted-foreground">
              Sua assinatura está ativa. Aproveite todas as funcionalidades
              do IAFÉ Finanças.
            </p>
            <Button variant="outline" onClick={() => navigate("/dash")}>
              Ir para o Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Assinatura;
