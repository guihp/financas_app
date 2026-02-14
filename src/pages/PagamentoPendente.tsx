import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Mail, 
  ArrowLeft, 
  QrCode, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  Copy, 
  Clock,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { isValidEmail } from "@/utils/validation";

interface PendingPayment {
  id: string;
  email: string;
  fullName: string;
  status: string;
  paymentMethod: string;
  pixCode?: string;
  pixQrCodeUrl?: string;
  boletoUrl?: string;
  invoiceUrl?: string;
  expiresAt: string;
  createdAt: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
}

const PagamentoPendente = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'not_found' | 'pending' | 'expired' | 'paid' | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Auto-search if email is in URL
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam && isValidEmail(emailParam)) {
      handleSearch();
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!email || !isValidEmail(email)) {
      setMessage("Por favor, informe um e-mail válido.");
      return;
    }

    setLoading(true);
    setMessage("");
    setPendingPayment(null);
    setPlan(null);
    setPaymentStatus(null);

    try {
      const { data, error } = await supabase.functions.invoke('get-pending-payment', {
        body: { email: email.trim().toLowerCase() }
      });

      if (error) {
        throw new Error(error.message || "Erro ao buscar pagamento.");
      }

      if (!data.found) {
        setPaymentStatus('not_found');
        setMessage(data.message || "Nenhum pagamento pendente encontrado.");
        return;
      }

      if (data.expired) {
        setPaymentStatus('expired');
        setMessage(data.message);
        return;
      }

      if (data.paid) {
        setPaymentStatus('paid');
        setMessage(data.message);
        return;
      }

      // Found pending payment
      setPaymentStatus('pending');
      setPendingPayment(data.registration);
      setPlan(data.plan);

      // Start polling for payment status
      startPaymentPolling(data.registration.id);

    } catch (error: any) {
      setMessage(error.message || "Erro ao buscar pagamento.");
    } finally {
      setLoading(false);
    }
  };

  const startPaymentPolling = (registrationId: string) => {
    // Stop any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    // Poll every 5 seconds
    pollingRef.current = setInterval(async () => {
      await checkPaymentStatus(registrationId);
    }, 5000);
  };

  const checkPaymentStatus = async (registrationId: string) => {
    try {
      setCheckingPayment(true);
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { registrationId }
      });

      if (error) {
        console.error('Payment status check error:', error);
        return;
      }

      if (data.isPaid || data.registrationStatus === 'paid') {
        setPaymentStatus('paid');
        setMessage("Pagamento confirmado! Você pode fazer login na sua conta.");
        
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }

        toast({
          title: "Pagamento confirmado!",
          description: "Você pode fazer login na sua conta agora.",
        });
      }
    } catch (error) {
      console.error('Payment status check error:', error);
    } finally {
      setCheckingPayment(false);
    }
  };

  const copyPixCode = async () => {
    if (pendingPayment?.pixCode) {
      try {
        await navigator.clipboard.writeText(pendingPayment.pixCode);
        toast({
          title: "Código copiado!",
          description: "Cole no app do seu banco para pagar.",
        });
      } catch (error) {
        toast({
          title: "Erro ao copiar",
          description: "Copie o código manualmente.",
          variant: "destructive"
        });
      }
    }
  };

  const formatExpirationDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Logo variant="horizontal" size="md" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Pagamento Pendente</CardTitle>
            <CardDescription>
              Informe seu e-mail para visualizar seu pagamento
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Form */}
          {!pendingPayment && paymentStatus !== 'paid' && (
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail cadastrado</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {message && (
                <Alert variant={paymentStatus === 'not_found' || paymentStatus === 'expired' ? 'destructive' : 'default'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Buscando...
                  </>
                ) : (
                  "Buscar Pagamento"
                )}
              </Button>
            </form>
          )}

          {/* Payment Status: Paid */}
          {paymentStatus === 'paid' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-semibold text-green-600">Pagamento Confirmado!</h3>
              <p className="text-muted-foreground">{message}</p>
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Fazer Login
              </Button>
            </div>
          )}

          {/* Payment Status: Expired */}
          {paymentStatus === 'expired' && (
            <div className="text-center space-y-4">
              <Clock className="h-16 w-16 text-yellow-500 mx-auto" />
              <h3 className="text-xl font-semibold text-yellow-600">Pagamento Expirado</h3>
              <p className="text-muted-foreground">{message}</p>
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Iniciar Novo Cadastro
              </Button>
            </div>
          )}

          {/* Pending Payment Info */}
          {pendingPayment && paymentStatus === 'pending' && (
            <div className="space-y-4">
              {/* Plan Info */}
              {plan && (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-2xl font-bold text-primary">
                    R$ {plan.price.toFixed(2).replace('.', ',')}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
              )}

              {/* Expiration Info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Expira em: {formatExpirationDate(pendingPayment.expiresAt)}</span>
              </div>

              {/* PIX Payment */}
              {pendingPayment.paymentMethod === 'PIX' && pendingPayment.pixQrCodeUrl && (
                <div className="space-y-4 text-center">
                  <h3 className="font-semibold flex items-center justify-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Pague com PIX
                  </h3>
                  <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                    <img 
                      src={pendingPayment.pixQrCodeUrl} 
                      alt="QR Code PIX" 
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                  {pendingPayment.pixCode && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Ou copie o código:</p>
                      <div className="flex gap-2">
                        <Input 
                          value={pendingPayment.pixCode} 
                          readOnly 
                          className="text-xs font-mono"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={copyPixCode}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Boleto Payment */}
              {pendingPayment.paymentMethod === 'BOLETO' && (
                <div className="space-y-4 text-center">
                  <h3 className="font-semibold flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5" />
                    Boleto Bancário
                  </h3>
                  <Button 
                    type="button"
                    onClick={() => window.open(pendingPayment.boletoUrl || pendingPayment.invoiceUrl, '_blank')}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Boleto
                  </Button>
                </div>
              )}

              {/* Invoice Link */}
              {pendingPayment.invoiceUrl && (
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => window.open(pendingPayment.invoiceUrl, '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Fatura Completa
                </Button>
              )}

              {/* Checking Payment Status */}
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  {checkingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verificando pagamento...</span>
                    </>
                  ) : (
                    <span>Aguardando confirmação do pagamento...</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  A página será atualizada automaticamente quando o pagamento for confirmado.
                </p>
              </div>

              {/* Manual Check Button */}
              <Button 
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => checkPaymentStatus(pendingPayment.id)}
                disabled={checkingPayment}
              >
                {checkingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  "Já paguei"
                )}
              </Button>

              {/* Back Button */}
              <Button 
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                  }
                  setPendingPayment(null);
                  setPaymentStatus(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Buscar outro email
              </Button>
            </div>
          )}

          {/* Back to Auth */}
          {(!pendingPayment || paymentStatus === 'not_found') && (
            <div className="pt-4 border-t">
              <Button 
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PagamentoPendente;
