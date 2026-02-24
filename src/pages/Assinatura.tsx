import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  FileText,
  CheckCircle,
  Gift,
  Sparkles,
  Crown,
  Shield,
  XCircle,
  Loader2,
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
  cancel_at_period_end: boolean;
}

const Assinatura = () => {
  const { user } = useOutletContext<OutletContextType>();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

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
          cancel_at_period_end: data.cancel_at_period_end || false,
        });
      } else {
        // No subscription at all
        setSubscription({
          status: "none",
          is_trial: false,
          trial_ends_at: null,
          current_period_end: null,
          days_remaining: 0,
          cancel_at_period_end: false,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Only mark as expired if:
  // 1. Status is explicitly expired or cancelled, OR
  // 2. Trial ended (is_trial is true AND days_remaining <= 0 AND trial_ends_at is in the past)
  const isExpired =
    subscription &&
    (subscription.status === "expired" ||
      subscription.status === "cancelled" ||
      (subscription.is_trial &&
        subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) < new Date() &&
        subscription.days_remaining <= 0));

  const isTrialActive =
    subscription &&
    subscription.is_trial &&
    subscription.days_remaining > 0;

  const isPaid =
    subscription &&
    subscription.status === "active" &&
    !subscription.is_trial &&
    subscription.days_remaining > 0;

  const isCancellingAtEnd =
    subscription &&
    subscription.cancel_at_period_end === true &&
    subscription.status === "active";

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: data.cancelledImmediately ? "Trial cancelado" : "Assinatura cancelada",
        description: data.message,
      });

      // Reload subscription data
      await loadSubscription();
    } catch (err: any) {
      console.error('Cancel error:', err);
      toast({
        title: "Erro ao cancelar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

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
        className={`border-2 ${isPaid
          ? "border-green-500/30 bg-green-500/5"
          : isTrialActive
            ? "border-blue-500/30 bg-blue-500/5"
            : "border-red-500/30 bg-red-500/5"
          }`}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isPaid
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
                    Plano Mensal - <span className="line-through text-muted-foreground/60">R$ 49,90</span>{" "}<span className="text-green-400">R$ 39,90</span>/mês{" "}<span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">PROMOÇÃO</span>
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
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground line-through">R$ 49,90</span>
                  <span className="text-3xl font-bold text-green-400">R$ 39,90</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                  PROMOÇÃO
                </Badge>
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
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  Controle de cartões e faturas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  Gestão por banco (débito, PIX, boleto)
                </li>
              </ul>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Cadastre seu cartão para começar:</p>

              {/* Credit Card with Trial */}
              <Button
                className="w-full h-14 justify-start gap-4 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/30"
                variant="outline"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  const userEmail = session?.user?.email || "";

                  if (userEmail) {
                    navigate(`/pagamento-pendente?method=CREDIT_CARD&email=${encodeURIComponent(userEmail)}`);
                  } else {
                    navigate("/pagamento-pendente?method=CREDIT_CARD");
                  }
                }}
              >
                <div className="h-9 w-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Começar 7 dias grátis</p>
                  <p className="text-xs opacity-70">
                    Cartão de crédito · Sem cobrança agora
                  </p>
                </div>
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                Nenhuma cobrança será feita durante os 7 dias gratuitos. Cancele a qualquer momento antes do término do trial.
              </p>
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
            {isCancellingAtEnd && subscription?.current_period_end && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400 font-medium">
                  ⚠️ Cancelamento agendado
                </p>
                <p className="text-xs text-muted-foreground">
                  Sua assinatura não será renovada. Acesso até{" "}
                  <strong>{new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}</strong>.
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/dash")}>
                Ir para o Dashboard
              </Button>
              {!isCancellingAtEnd && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancelar assinatura
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sua assinatura será cancelada, mas você continuará com acesso até o final do período já pago
                        {subscription?.current_period_end && (
                          <> (<strong>{new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}</strong>)</>)}.
                        <br /><br />
                        <strong>Não haverá reembolso</strong> do período atual. Nenhuma cobrança futura será feita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                      >
                        {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Confirmar cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel button for trial users */}
      {isTrialActive && (
        <Card className="border-border">
          <CardContent className="p-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar período gratuito
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar período gratuito?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você perderá o acesso <strong>imediatamente</strong>. Nenhuma cobrança será feita.
                    <br /><br />
                    Tem certeza que deseja cancelar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                  >
                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Sim, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Assinatura;
