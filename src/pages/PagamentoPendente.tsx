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
import { CreditCardInput, type CreditCardData, type CardHolderInfo } from "@/components/ui/credit-card-input";
import { AddressForm, type PaymentAddress, isPaymentAddressValid } from "@/components/AddressForm";

interface PendingPayment {
  id: string;
  customerId?: string;
  email: string;
  fullName: string;
  phone?: string;
  status: string;
  paymentMethod: string;
  pixCode?: string;
  pixQrCodeUrl?: string;
  boletoUrl?: string;
  invoiceUrl?: string;
  expiresAt: string;
  createdAt: string;
  address?: PaymentAddress | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
}

// Format CPF/CNPJ for display
const formatCpfCnpj = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 11) {
    return clean.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return clean.slice(0, 14).replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const PagamentoPendente = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'not_found' | 'pending' | 'expired' | 'paid' | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showPixCpfForm, setShowPixCpfForm] = useState(false);
  const [pixCpfCnpj, setPixCpfCnpj] = useState("");
  const [cardData, setCardData] = useState<CreditCardData | null>(null);
  const [holderInfo, setHolderInfo] = useState<CardHolderInfo | null>(null);
  const [address, setAddress] = useState<PaymentAddress | null>(null);
  const hasAutoSearched = useRef(false);
  const pixCpfCnpjRef = useRef("");
  pixCpfCnpjRef.current = pixCpfCnpj;
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const createPayment = async (billingType: 'PIX' | 'CREDIT_CARD', creditCard?: CreditCardData, creditCardHolderInfo?: CardHolderInfo, cpfCnpjForPix?: string) => {
    console.log('createPayment called', { billingType, hasCard: !!creditCard, hasHolderInfo: !!creditCardHolderInfo, hasAddress: !!address, pendingPaymentId: pendingPayment?.id, customerId: pendingPayment?.customerId });
    if (!pendingPayment?.id) {
      setMessage("Dados do pagamento incompletos. Busque pelo e-mail novamente.");
      return;
    }
    let customerId = pendingPayment.customerId;
    if (!customerId) {
      setCreatingPayment(true);
      setMessage("Vinculando cadastro ao sistema de pagamento...");
      try {
        const { data: fixData, error: fixError } = await supabase.functions.invoke('create-asaas-customer', {
          body: { registrationId: pendingPayment.id }
        });
        if (fixError) throw new Error(fixError.message);
        if (fixData?.error) throw new Error(fixData.error);
        customerId = fixData?.customerId;
        if (customerId) {
          const { data: refetch } = await supabase.functions.invoke('get-pending-payment', { body: { email: (pendingPayment.email || email).trim().toLowerCase() } });
          if (refetch?.found && refetch.registration) {
            setPendingPayment(refetch.registration);
            setPlan(refetch.plan ?? null);
            if (refetch.registration.address) setAddress(refetch.registration.address);
            customerId = refetch.registration.customerId ?? customerId;
          }
        }
        setMessage("");
      } catch (fixErr: any) {
        setCreatingPayment(false);
        setMessage(fixErr.message || "Não foi possível vincular. Tente iniciar um novo cadastro.");
        toast({ title: "Erro", description: fixErr.message, variant: "destructive" });
        return;
      }
      if (!customerId) {
        setCreatingPayment(false);
        setMessage("Dados do pagamento incompletos. Busque pelo e-mail novamente.");
        return;
      }
    }
    if (!isPaymentAddressValid(address)) {
      setCreatingPayment(false);
      setMessage("Preencha o endereço completo (CEP, logradouro, número, bairro, cidade e UF) antes de continuar.");
      toast({ title: "Endereço obrigatório", description: "Preencha todos os campos do endereço.", variant: "destructive" });
      return;
    }
    if (billingType === 'CREDIT_CARD' && (!creditCard || !creditCardHolderInfo)) {
      setCreatingPayment(false);
      setShowCardForm(true);
      return;
    }
    if (billingType === 'PIX' && !cpfCnpjForPix?.replace(/\D/g, '').match(/^(\d{11}|\d{14})$/)) {
      setCreatingPayment(false);
      toast({ title: "CPF/CNPJ obrigatório", description: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.", variant: "destructive" });
      return;
    }
    setCreatingPayment(true);
    setMessage("");
    try {
      const body: any = {
        customerId,
        registrationId: pendingPayment.id,
        billingType,
        address: address ? {
          postalCode: address.postalCode,
          street: address.street,
          number: address.number,
          complement: address.complement || undefined,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state
        } : undefined
      };
      if (billingType === 'PIX') {
        const cpfVal = cpfCnpjForPix ?? pixCpfCnpjRef.current;
        const cleanCpf = cpfVal ? String(cpfVal).replace(/\D/g, '') : '';
        if (cleanCpf && (cleanCpf.length === 11 || cleanCpf.length === 14)) {
          body.cpfCnpj = cleanCpf;
        }
      }
      if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
        body.creditCard = creditCard;
        // Usar endereço já preenchido na página e telefone do cadastro (OTP) quando existirem
        const postalCode = (creditCardHolderInfo.postalCode || address?.postalCode || '').replace(/\D/g, '');
        const addressNumber = creditCardHolderInfo.addressNumber || address?.number || '0';
        const phone = (pendingPayment.phone || creditCardHolderInfo.phone || '').replace(/\D/g, '');
        body.creditCardHolderInfo = {
          ...creditCardHolderInfo,
          name: creditCardHolderInfo.name,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          email: pendingPayment.email,
          postalCode: postalCode || creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: addressNumber || creditCardHolderInfo.addressNumber || '0',
          phone: phone || creditCardHolderInfo.phone.replace(/\D/g, '')
        };
      }
      console.log('Calling create-asaas-payment', { billingType, registrationId: pendingPayment.id, customerId, hasAddress: !!address, hasCpfCnpj: !!body.cpfCnpj });
      // Usar fetch para capturar o body em respostas 4xx (Supabase invoke não retorna o body no erro)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dlbiwguzbiosaoyrcvay.supabase.co";
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-asaas-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      console.log('create-asaas-payment response', { status: res.status, ok: res.ok, data });
      if (!res.ok) {
        const errMsg = data?.error || data?.message || (typeof data?.details === 'string' ? data.details : data?.details?.[0]?.description) || `Erro ${res.status}`;
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);
      if (billingType === 'PIX' && !data?.pixCode && !data?.pixQrCodeBase64) {
        console.warn('create-asaas-payment: resposta sem PIX', data);
      }
      if (data?.isPaid) {
        setPaymentStatus('paid');
        const hasRegisterError = !!data?.registerUserError;
        setMessage(
          hasRegisterError
            ? `Pagamento confirmado. ${data.registerUserError}`
            : "Pagamento confirmado. Faça login com seu e-mail e a senha definida no cadastro."
        );
        setCreatingPayment(false);
        setShowCardForm(false);
        toast({
          title: "Pagamento confirmado!",
          description: hasRegisterError ? data.registerUserError : "Redirecionando para login..."
        });
        setTimeout(() => navigate('/auth'), hasRegisterError ? 4000 : 1500);
        return;
      }
      // Sempre refetch após criar cobrança para ter pix_code/pix_qr_code_url do banco e exibir PIX/estado correto
      const { data: refetch } = await supabase.functions.invoke('get-pending-payment', {
        body: { email: email.trim().toLowerCase() }
      });
      if (refetch?.found && refetch.registration) {
        const reg = refetch.registration;
        const hasPixFromRefetch = reg.pixCode || reg.pixQrCodeUrl;
        const hasPixFromResponse = data?.pixCode || data?.pixQrCodeBase64;
        setPlan(refetch.plan ?? null);
        if (reg.address) setAddress(reg.address);
        if (billingType === 'PIX') {
          const merged = {
            ...reg,
            paymentMethod: 'PIX' as const,
            pixCode: reg.pixCode ?? data?.pixCode ?? undefined,
            pixQrCodeUrl: reg.pixQrCodeUrl ?? (data?.pixQrCodeBase64 ? `data:image/png;base64,${data.pixQrCodeBase64}` : undefined)
          };
          setPendingPayment(merged);
          if (hasPixFromRefetch || hasPixFromResponse) {
            toast({ title: "Cobrança PIX gerada", description: "Pague com o QR Code ou copie o código." });
          }
        } else {
          setPendingPayment(reg);
        }
      }
      setShowCardForm(false);
    } catch (err: any) {
      setMessage(err.message || "Erro ao criar pagamento.");
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCreatingPayment(false);
    }
  };

  // Check if user is logged in and get email, then auto-search once
  useEffect(() => {
    if (hasAutoSearched.current) return;
    
    const checkAndSearch = async () => {
      const emailParam = searchParams.get('email');
      let emailToUse = emailParam;
      
      // If no email in URL, check if user is logged in
      if (!emailToUse) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          emailToUse = session.user.email;
        }
      }
      
      if (emailToUse && isValidEmail(emailToUse)) {
        setEmail(emailToUse);
        hasAutoSearched.current = true;
        // Search after email is set
        setTimeout(() => {
          handleSearch();
        }, 200);
      }
    };
    
    checkAndSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      // Manual search - reset auto-search flag
      hasAutoSearched.current = false;
    }
    
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

      if (data.paid && data.registration?.id) {
        // Chama check-payment-status para garantir que register-user seja executado (cria conta se ainda não existe)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dlbiwguzbiosaoyrcvay.supabase.co";
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const checkRes = await fetch(`${supabaseUrl}/functions/v1/check-payment-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ registrationId: data.registration.id })
        });
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData?.registerUserError) {
          console.warn("[check-payment-status] registerUserError:", checkData.registerUserError);
        }
        setPaymentStatus('paid');
        const hasRegisterError = !!checkData?.registerUserError;
        setMessage(
          hasRegisterError
            ? `Pagamento confirmado. ${checkData.registerUserError}`
            : "Pagamento confirmado. Faça login com seu e-mail e a senha definida no cadastro."
        );
        toast({
          title: "Pagamento confirmado!",
          description: hasRegisterError ? checkData.registerUserError : "Redirecionando para login..."
        });
        setTimeout(() => navigate('/auth'), hasRegisterError ? 4000 : 1500);
        return;
      }
      if (data.paid) {
        setPaymentStatus('paid');
        setMessage("Pagamento confirmado. Faça login com seu e-mail e a senha definida no cadastro.");
        toast({ title: "Pagamento confirmado!", description: "Redirecionando para login..." });
        setTimeout(() => navigate('/auth'), 1500);
        return;
      }

      // Found pending payment
      setPaymentStatus('pending');
      setPendingPayment(data.registration);
      setPlan(data.plan);
      if (data.registration?.address) setAddress(data.registration.address);

    } catch (error: any) {
      setMessage(error.message || "Erro ao buscar pagamento.");
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (registrationId: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dlbiwguzbiosaoyrcvay.supabase.co";
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const callCheckPaymentStatus = async (regId: string) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/check-payment-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify({ registrationId: regId })
      });
      return res.json().catch(() => ({}));
    };

    const handlePaidResponse = (checkData: Record<string, unknown>) => {
      const hasRegisterError = !!checkData?.registerUserError;
      if (hasRegisterError) {
        console.warn("[check-payment-status] registerUserError:", checkData.registerUserError);
      }
      setPaymentStatus('paid');
      setMessage(
        hasRegisterError
          ? `Pagamento confirmado. ${checkData.registerUserError}`
          : "Pagamento confirmado. Faça login com seu e-mail e a senha definida no cadastro."
      );
      toast({
        title: "Pagamento confirmado!",
        description: hasRegisterError ? String(checkData.registerUserError) : "Redirecionando para login..."
      });
      setTimeout(() => navigate('/auth'), hasRegisterError ? 4000 : 1500);
    };

    try {
      setCheckingPayment(true);

      const data = await callCheckPaymentStatus(registrationId);

      if (data?.isPaid || data?.registrationStatus === 'paid') {
        handlePaidResponse(data);
        return;
      }

      if (data?.error) {
        console.warn('check-payment-status retornou erro:', data.error);
      }

      // Fallback: chamar check-payment-status com registrationId do get-pending-payment
      if (email && isValidEmail(email)) {
        const { data: pending } = await supabase.functions.invoke('get-pending-payment', {
          body: { email: email.trim().toLowerCase() }
        });
        if (pending?.paid && pending?.registration?.id) {
          const checkData = await callCheckPaymentStatus(pending.registration.id);
          if (checkData?.isPaid || checkData?.registrationStatus === 'paid') {
            handlePaidResponse(checkData);
          }
        }
      }
    } catch (err) {
      console.error('Payment status check error:', err);
      if (email && isValidEmail(email)) {
        try {
          const { data: pending } = await supabase.functions.invoke('get-pending-payment', {
            body: { email: email.trim().toLowerCase() }
          });
          if (pending?.paid && pending?.registration?.id) {
            const checkData = await callCheckPaymentStatus(pending.registration.id);
            if (checkData?.isPaid || checkData?.registrationStatus === 'paid') {
              handlePaidResponse(checkData);
            }
          }
        } catch (_) {}
      }
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

              {/* Address (required for both PIX and Cartão) */}
              {(!pendingPayment.paymentMethod || (!pendingPayment.pixCode && !pendingPayment.boletoUrl && !pendingPayment.invoiceUrl)) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Endereço (obrigatório)</p>
                  <AddressForm
                    value={address}
                    onChange={setAddress}
                    disabled={creatingPayment}
                  />
                </div>
              )}

              {/* Choose payment method when no payment created yet */}
              {(!pendingPayment.paymentMethod || (!pendingPayment.pixCode && !pendingPayment.boletoUrl && !pendingPayment.invoiceUrl)) && !showCardForm && !showPixCpfForm && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Escolha como pagar:</p>
                  <Button
                    className="w-full h-12 justify-start gap-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/30"
                    variant="outline"
                    disabled={creatingPayment}
                    onClick={() => setShowCardForm(true)}
                  >
                    <FileText className="h-5 w-5" />
                    <span>Cartão de Crédito</span>
                  </Button>
                  <Button
                    className="w-full h-12 justify-start gap-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
                    variant="outline"
                    disabled={creatingPayment}
                    onClick={() => {
                      if (!isPaymentAddressValid(address)) {
                        toast({ title: "Endereço obrigatório", description: "Preencha CEP, Número, Logradouro, Bairro, Cidade e UF acima.", variant: "destructive" });
                        return;
                      }
                      setShowPixCpfForm(true);
                    }}
                  >
                    <QrCode className="h-5 w-5" />
                    <span>PIX</span>
                  </Button>
                  {!isPaymentAddressValid(address) && (
                    <p className="text-xs text-muted-foreground">Preencha CEP e Número no endereço para gerar o PIX.</p>
                  )}
                </div>
              )}

              {/* PIX CPF/CNPJ form - shown when user clicks PIX */}
              {(!pendingPayment.paymentMethod || (!pendingPayment.pixCode && !pendingPayment.boletoUrl && !pendingPayment.invoiceUrl)) && showPixCpfForm && !showCardForm && (
                <div className="space-y-4">
                  <p className="text-sm font-medium">Informe seu CPF ou CNPJ para gerar o PIX</p>
                  <div className="space-y-2">
                    <Label htmlFor="pix-cpf-cnpj">CPF ou CNPJ</Label>
                    <Input
                      id="pix-cpf-cnpj"
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      value={pixCpfCnpj}
                      onChange={(e) => setPixCpfCnpj(formatCpfCnpj(e.target.value))}
                      disabled={creatingPayment}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowPixCpfForm(false)} disabled={creatingPayment}>
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={creatingPayment || !pixCpfCnpj.replace(/\D/g, '')}
                      onClick={() => {
                        const cpfToUse = pixCpfCnpjRef.current || pixCpfCnpj;
                        const clean = cpfToUse.replace(/\D/g, '');
                        if (clean.length !== 11 && clean.length !== 14) {
                          toast({ title: "CPF/CNPJ inválido", description: "Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).", variant: "destructive" });
                          return;
                        }
                        createPayment('PIX', undefined, undefined, clean);
                      }}
                    >
                      {creatingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar PIX"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Card form when user chose Cartão (endereço já preenchido acima; telefone do cadastro) */}
              {(!pendingPayment.paymentMethod || (!pendingPayment.pixCode && !pendingPayment.boletoUrl && !pendingPayment.invoiceUrl)) && showCardForm && (
                <div className="space-y-4">
                  {address && (
                    <p className="text-xs text-muted-foreground">
                      Endereço: {address.street}, {address.number} {address.complement ? `, ${address.complement}` : ''} – {address.neighborhood}, {address.city}/{address.state} – CEP {address.postalCode?.replace(/(\d{5})(\d{3})/, '$1-$2')}
                    </p>
                  )}
                  <CreditCardInput
                    key={pendingPayment.id}
                    onCardChange={setCardData}
                    onHolderInfoChange={setHolderInfo}
                    disabled={creatingPayment}
                    defaultPhone={pendingPayment.phone}
                    defaultPostalCode={address?.postalCode}
                    defaultAddressNumber={address?.number}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCardForm(false)} disabled={creatingPayment}>
                      Voltar
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={creatingPayment || !cardData || !holderInfo}
                      onClick={() => {
                        console.log('Pagar com cartão clicked', { cardData: !!cardData, holderInfo: !!holderInfo, address, isValid: isPaymentAddressValid(address), creatingPayment });
                        if (!isPaymentAddressValid(address)) {
                          toast({ title: "Endereço obrigatório", description: "Preencha o endereço acima antes de pagar com cartão.", variant: "destructive" });
                          return;
                        }
                        if (!cardData || !holderInfo) {
                          toast({ title: "Dados incompletos", description: "Preencha todos os dados do cartão.", variant: "destructive" });
                          return;
                        }
                        console.log('Calling createPayment("CREDIT_CARD")');
                        createPayment('CREDIT_CARD', cardData || undefined, holderInfo || undefined);
                      }}
                    >
                      {creatingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pagar com cartão"}
                    </Button>
                  </div>
                </div>
              )}

              {/* PIX Payment: código PIX (copia e cola) + QR Code */}
              {pendingPayment.paymentMethod === 'PIX' && !pendingPayment.pixCode && !pendingPayment.pixQrCodeUrl && (
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Gerando PIX... Aguarde ou recarregue a página.</p>
                </div>
              )}
              {pendingPayment.paymentMethod === 'PIX' && (pendingPayment.pixCode || pendingPayment.pixQrCodeUrl) && (
                <div className="space-y-4 text-center">
                  <h3 className="font-semibold flex items-center justify-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Pague com PIX
                  </h3>
                  {pendingPayment.pixQrCodeUrl && (
                    <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                      <p className="text-xs text-muted-foreground mb-2">QR Code</p>
                      <img 
                        src={pendingPayment.pixQrCodeUrl} 
                        alt="QR Code PIX" 
                        className="w-48 h-48 mx-auto"
                      />
                    </div>
                  )}
                  {pendingPayment.pixCode && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Código PIX (copia e cola)</p>
                      <div className="flex gap-2">
                        <Input 
                          value={pendingPayment.pixCode} 
                          readOnly 
                          className="text-xs font-mono flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={copyPixCode}
                          title="Copiar código"
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

              {/* Verificação só ao clicar em "Já paguei" */}
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Após pagar, clique em &quot;Já paguei&quot; para verificar a confirmação.
                </p>
              </div>

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

              <Button 
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
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
