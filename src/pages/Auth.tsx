import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DollarSign, Mail, Lock, User, ArrowLeft, Eye, EyeOff, QrCode, FileText, Loader2, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { 
  isValidEmail, 
  isValidPhone, 
  isStrongPassword, 
  isValidFullName,
  sanitizeText 
} from "@/utils/validation";

// Payment data interface
interface PaymentData {
  paymentId: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  pixCode?: string;
  pixQrCodeBase64?: string;
  boletoUrl?: string;
  registrationId: string;
  customerId: string;
}

// Plan interface
interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
}

const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  // Payment states
  const [paymentStep, setPaymentStep] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "BOLETO">("PIX");
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Format phone number to (DDD) 9 XXXX-XXXX
  // Sempre adiciona o 9 depois do DDD automaticamente
  const formatPhone = (value: string) => {
    // Remove all non-numeric characters
    let numbers = value.replace(/\D/g, '');
    
    // Se tiver mais de 2 dígitos (DDD completo), garantir que o 3º dígito seja 9
    if (numbers.length > 2) {
      const ddd = numbers.slice(0, 2);
      let rest = numbers.slice(2);
      
      // Se o primeiro dígito após o DDD não for 9, adiciona o 9
      if (rest.length > 0 && rest[0] !== '9') {
        rest = '9' + rest;
      }
      
      // Limita o resto a 9 dígitos (9 + 8 números)
      rest = rest.slice(0, 9);
      numbers = ddd + rest;
    }
    
    // Limit to 11 digits total (DDD + 9 + 8 dígitos)
    const limited = numbers.slice(0, 11);
    
    // Format: (XX) 9 XXXX-XXXX
    if (limited.length <= 2) {
      return limited.length > 0 ? `(${limited}` : '';
    } else if (limited.length <= 3) {
      // Só DDD + 9
      return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    } else if (limited.length <= 7) {
      // DDD + 9 + primeiros 4 dígitos
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)} ${limited.slice(3)}`;
    } else {
      // Completo: (XX) 9 XXXX-XXXX
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 3)} ${limited.slice(3, 7)}-${limited.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    // Reset OTP state when phone changes (only if OTP was already sent)
    if (otpSent) {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode("");
    }
  };

  const handleGenerateOTP = async (cleanPhone: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-otp', {
        body: {
          phone: cleanPhone,
          email: email,
          full_name: fullName
        }
      });

      if (error) {
        throw new Error(error.message || "Erro ao gerar código OTP.");
      }

      return true;
    } catch (error: any) {
      throw error;
    }
  };

  // Create Asaas customer and get payment info
  const handleCreateCustomer = async () => {
    setCreatingPayment(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const sanitizedEmail = email.trim().toLowerCase();
      const sanitizedFullName = sanitizeText(fullName, 100);

      // Create customer in Asaas
      const { data, error } = await supabase.functions.invoke('create-asaas-customer', {
        body: {
          email: sanitizedEmail,
          full_name: sanitizedFullName,
          phone: cleanPhone,
          password: password
        }
      });

      if (error) {
        throw new Error(error.message || "Erro ao criar cliente.");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setCustomerId(data.customerId);
      setRegistrationId(data.registrationId);
      setPlan(data.plan);
      
      return { customerId: data.customerId, registrationId: data.registrationId };
    } catch (error: any) {
      throw error;
    } finally {
      setCreatingPayment(false);
    }
  };

  // Create payment in Asaas
  const handleCreatePayment = async (custId: string, regId: string, method: "PIX" | "BOLETO") => {
    setCreatingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-asaas-payment', {
        body: {
          customerId: custId,
          registrationId: regId,
          billingType: method
        }
      });

      if (error) {
        throw new Error(error.message || "Erro ao criar cobrança.");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setPaymentData({
        ...data,
        registrationId: regId,
        customerId: custId
      });

      // Start polling for payment status
      startPaymentPolling(regId);

      return data;
    } catch (error: any) {
      throw error;
    } finally {
      setCreatingPayment(false);
    }
  };

  // Check payment status
  const checkPaymentStatus = async (regId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { registrationId: regId }
      });

      if (error) {
        console.error('Payment status check error:', error);
        return false;
      }

      if (data.isPaid || data.registrationStatus === 'paid') {
        setPaymentConfirmed(true);
        stopPaymentPolling();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Payment status check error:', error);
      return false;
    }
  };

  // Start polling for payment status
  const startPaymentPolling = (regId: string) => {
    // Stop any existing polling
    stopPaymentPolling();
    
    // Poll every 5 seconds
    pollingRef.current = setInterval(async () => {
      setCheckingPayment(true);
      const isPaid = await checkPaymentStatus(regId);
      setCheckingPayment(false);
      
      if (isPaid) {
        toast({
          title: "Pagamento confirmado!",
          description: "Criando sua conta...",
        });
        // Complete registration
        await completeRegistration(regId);
      }
    }, 5000);
  };

  // Stop polling
  const stopPaymentPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Complete registration after payment
  const completeRegistration = async (regId: string) => {
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const sanitizedEmail = email.trim().toLowerCase();
      const sanitizedFullName = sanitizeText(fullName, 100);

      const { data: registerData, error: registerError } = await supabase.functions.invoke('register-user', {
        body: {
          email: sanitizedEmail,
          full_name: sanitizedFullName,
          phone: cleanPhone,
          registrationId: regId
        }
      });

      let errorMessage = "";
      if (registerError) {
        try {
          const errorContext = (registerError as any).context;
          if (errorContext && typeof errorContext.json === 'function') {
            const errorBody = await errorContext.json();
            errorMessage = errorBody?.error || registerError.message || "Erro ao criar conta.";
          } else {
            errorMessage = registerError.message || "Erro ao criar conta.";
          }
        } catch {
          errorMessage = registerError.message || "Erro ao criar conta.";
        }
      }

      if (!registerError && registerData?.error) {
        errorMessage = registerData.error;
      }

      if (errorMessage) {
        console.error('Register error:', errorMessage);
        setMessage(errorMessage);
        toast({
          title: "Erro ao criar conta",
          description: errorMessage,
          variant: "destructive"
        });
      } else if (registerData && !registerData.error) {
        toast({
          title: "Conta criada com sucesso!",
          description: "Fazendo login automático...",
        });
        
        // Auto login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          toast({
            title: "Conta criada!",
            description: "Faça login manualmente.",
          });
          resetSignupForm();
          setActiveTab("login");
        } else {
          toast({
            title: "Login realizado!",
            description: "Bem-vindo à IAFÉ Finanças!",
          });
        }
      }
    } catch (error: any) {
      setMessage(error.message || "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Reset signup form
  const resetSignupForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    setConfirmPassword("");
    setOtpCode("");
    setOtpSent(false);
    setOtpVerified(false);
    setPaymentStep(false);
    setPaymentData(null);
    setPlan(null);
    setRegistrationId(null);
    setCustomerId(null);
    setPaymentConfirmed(false);
    stopPaymentPolling();
  };

  // Copy PIX code to clipboard
  const copyPixCode = async () => {
    if (paymentData?.pixCode) {
      try {
        await navigator.clipboard.writeText(paymentData.pixCode);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPaymentPolling();
    };
  }, []);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Validar email
    if (!email || !isValidEmail(email)) {
      setMessage("Por favor, informe um e-mail válido.");
      setLoading(false);
      return;
    }

    // Validar senha
    if (!password || password.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    // Sanitizar email
    const sanitizedEmail = email.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });

      if (error) {
        if (error.message === "Invalid login credentials") {
          setMessage("E-mail ou senha incorretos.");
        } else {
          setMessage(error.message);
        }
      } else {
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta.",
        });
      }
    } catch (error) {
      setMessage("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    // Validar email
    if (!email || !isValidEmail(email)) {
      setMessage("Por favor, informe um e-mail válido.");
      return;
    }

    // Validar nome completo
    const fullNameValidation = isValidFullName(fullName);
    if (!fullNameValidation.valid) {
      setMessage(fullNameValidation.message);
      return;
    }

    // Validar senha
    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }

    const passwordValidation = isStrongPassword(password);
    if (!passwordValidation.valid) {
      setMessage(passwordValidation.message);
      return;
    }

    // Validar telefone
    const cleanPhone = phone.replace(/\D/g, '');
    if (!isValidPhone(phone)) {
      setMessage("Por favor, informe um número de telefone válido com DDD (11 dígitos).");
      return;
    }

    // Sanitizar dados
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedFullName = sanitizeText(fullName, 100);

    // If OTP not sent yet, generate and send it
    if (!otpSent) {
      setLoading(true);
      try {
        await handleGenerateOTP(cleanPhone);
        setOtpSent(true);
        toast({
          title: "Código OTP enviado!",
          description: "Verifique seu WhatsApp para receber o código de verificação.",
        });
      } catch (error: any) {
        setMessage(error.message || "Erro ao enviar código OTP.");
        toast({
          title: "Erro",
          description: error.message || "Erro ao enviar código OTP.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
      return; // Stop here, wait for user to verify OTP
    }

    // If OTP sent but not verified, verify it first
    if (otpSent && !otpVerified) {
      if (!otpCode || otpCode.length !== 6) {
        setMessage("Por favor, informe o código de 6 dígitos.");
        return;
      }

      setVerifyingOtp(true);
      try {
        // Trim e garantir que o código tem 6 dígitos
        const trimmedCode = otpCode.trim();
        
        if (!trimmedCode || trimmedCode.length !== 6) {
          setMessage("Por favor, informe um código de 6 dígitos.");
          setVerifyingOtp(false);
          return;
        }

        console.log('Verifying OTP:', { phone: cleanPhone, code: trimmedCode });

        const { data, error } = await supabase.functions.invoke('verify-otp', {
          body: {
            phone: cleanPhone,
            code: trimmedCode
          }
        });

        if (error) {
          console.error('OTP verification error:', error);
          const errorMessage = error.message || "Código inválido ou expirado.";
          setMessage(errorMessage);
          toast({
            title: "Erro na verificação",
            description: errorMessage,
            variant: "destructive"
          });
          setVerifyingOtp(false);
          return;
        }

        if (!data || !data.success) {
          console.error('OTP verification failed:', data);
          setMessage("Código inválido ou expirado. Por favor, solicite um novo código.");
          toast({
            title: "Erro na verificação",
            description: "Código inválido ou expirado. Por favor, solicite um novo código.",
            variant: "destructive"
          });
          setVerifyingOtp(false);
          return;
        }

        // OTP verified successfully, proceed to payment step
        setOtpVerified(true);
        toast({
          title: "Código verificado!",
          description: "Preparando etapa de pagamento...",
        });

        // Create Asaas customer and proceed to payment
        try {
          const { customerId: custId, registrationId: regId } = await handleCreateCustomer();
          setPaymentStep(true);
          setVerifyingOtp(false);
          
          toast({
            title: "Escolha a forma de pagamento",
            description: "Selecione PIX ou Boleto para continuar.",
          });
        } catch (customerError: any) {
          console.error('Customer creation error:', customerError);
          setMessage(customerError.message || "Erro ao preparar pagamento.");
          toast({
            title: "Erro",
            description: customerError.message || "Erro ao preparar pagamento.",
            variant: "destructive"
          });
          setVerifyingOtp(false);
        }
      } catch (error: any) {
        setMessage("Erro inesperado ao verificar código.");
        toast({
          title: "Erro",
          description: "Erro inesperado ao verificar código.",
          variant: "destructive"
        });
        setVerifyingOtp(false);
      }
      return;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!email) {
      setMessage("Por favor, informe seu e-mail.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setResetEmailSent(true);
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });
      }
    } catch (error: any) {
      setMessage("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Logo variant="horizontal" size="md" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">
              {activeTab === "login" && "Bem-vindo"}
              {activeTab === "signup" && "Criar Conta"}
              {activeTab === "forgot" && "Recuperar Senha"}
            </CardTitle>
            <CardDescription>
              {activeTab === "login" && "Entre na sua conta"}
              {activeTab === "signup" && "Cadastre-se para começar"}
              {activeTab === "forgot" && "Digite seu e-mail para recuperar"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as "login" | "signup" | "forgot");
            setMessage("");
            setResetEmailSent(false);
            // Reset OTP and payment state when switching tabs
            setOtpSent(false);
            setOtpVerified(false);
            setOtpCode("");
            setPaymentStep(false);
            setPaymentData(null);
            setPlan(null);
            setRegistrationId(null);
            setCustomerId(null);
            setPaymentConfirmed(false);
            stopPaymentPolling();
          }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              <TabsTrigger value="forgot">Recuperar</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {message && (
                  <Alert>
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90" 
                  disabled={loading}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            {/* Signup Tab */}
            <TabsContent value="signup" className="space-y-4 mt-4">
              {/* Payment Step */}
              {paymentStep ? (
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

                  {/* Payment Confirmed */}
                  {paymentConfirmed ? (
                    <div className="text-center space-y-4">
                      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                      <h3 className="text-xl font-semibold text-green-600">Pagamento Confirmado!</h3>
                      <p className="text-muted-foreground">Criando sua conta...</p>
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </div>
                  ) : paymentData ? (
                    /* Show Payment Info */
                    <div className="space-y-4">
                      {paymentData.pixQrCodeBase64 && (
                        <div className="space-y-4 text-center">
                          <h3 className="font-semibold flex items-center justify-center gap-2">
                            <QrCode className="h-5 w-5" />
                            Pague com PIX
                          </h3>
                          <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                            <img 
                              src={`data:image/png;base64,${paymentData.pixQrCodeBase64}`} 
                              alt="QR Code PIX" 
                              className="w-48 h-48 mx-auto"
                            />
                          </div>
                          {paymentData.pixCode && (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Ou copie o código:</p>
                              <div className="flex gap-2">
                                <Input 
                                  value={paymentData.pixCode} 
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

                      {paymentData.boletoUrl && (
                        <div className="space-y-4 text-center">
                          <h3 className="font-semibold flex items-center justify-center gap-2">
                            <FileText className="h-5 w-5" />
                            Boleto Bancário
                          </h3>
                          <Button 
                            type="button"
                            onClick={() => window.open(paymentData.boletoUrl, '_blank')}
                            className="w-full"
                          >
                            Abrir Boleto
                          </Button>
                        </div>
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
                        onClick={async () => {
                          if (registrationId) {
                            setCheckingPayment(true);
                            const isPaid = await checkPaymentStatus(registrationId);
                            setCheckingPayment(false);
                            if (isPaid) {
                              toast({
                                title: "Pagamento confirmado!",
                                description: "Criando sua conta...",
                              });
                              await completeRegistration(registrationId);
                            } else {
                              toast({
                                title: "Pagamento pendente",
                                description: "Ainda não identificamos seu pagamento.",
                              });
                            }
                          }
                        }}
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
                    </div>
                  ) : (
                    /* Payment Method Selection */
                    <div className="space-y-4">
                      <Label>Escolha a forma de pagamento:</Label>
                      <RadioGroup 
                        value={paymentMethod} 
                        onValueChange={(v) => setPaymentMethod(v as "PIX" | "BOLETO")}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem value="PIX" id="pix" />
                          <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer flex-1">
                            <QrCode className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">PIX</p>
                              <p className="text-xs text-muted-foreground">Pagamento instantâneo</p>
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                          <RadioGroupItem value="BOLETO" id="boleto" />
                          <Label htmlFor="boleto" className="flex items-center gap-2 cursor-pointer flex-1">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">Boleto</p>
                              <p className="text-xs text-muted-foreground">Vencimento em 1 dia útil</p>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>

                      <Button 
                        type="button"
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={async () => {
                          if (customerId && registrationId) {
                            try {
                              await handleCreatePayment(customerId, registrationId, paymentMethod);
                            } catch (error: any) {
                              setMessage(error.message || "Erro ao gerar pagamento.");
                              toast({
                                title: "Erro",
                                description: error.message || "Erro ao gerar pagamento.",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                        disabled={creatingPayment}
                      >
                        {creatingPayment ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Gerando cobrança...
                          </>
                        ) : (
                          `Gerar ${paymentMethod === 'PIX' ? 'QR Code PIX' : 'Boleto'}`
                        )}
                      </Button>
                    </div>
                  )}

                  {message && (
                    <Alert>
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  )}

                  {/* Back Button */}
                  {!paymentConfirmed && (
                    <Button 
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        stopPaymentPolling();
                        setPaymentStep(false);
                        setPaymentData(null);
                        setOtpVerified(false);
                        setOtpSent(false);
                        setOtpCode("");
                      }}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  )}
                </div>
              ) : (
                /* Regular Signup Form */
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome Completo *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Seu nome completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Telefone *</Label>
                    <div className="relative">
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="(11) 9 9999-9999"
                        value={phone}
                        onChange={handlePhoneChange}
                        maxLength={17}
                        required
                        disabled={otpVerified}
                      />
                    </div>
                    {otpSent && !paymentStep && (
                      <div className="space-y-2">
                        <Alert>
                          <AlertDescription>
                            Código OTP enviado para seu WhatsApp! Digite o código abaixo para verificar.
                          </AlertDescription>
                        </Alert>
                        <Label htmlFor="signup-otp">Código de Verificação *</Label>
                        <Input
                          id="signup-otp"
                          type="text"
                          placeholder="000000"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          className="text-center text-lg font-mono tracking-widest"
                          required
                        />
                        {otpVerified && (
                          <p className="text-sm text-green-600">✓ Código verificado com sucesso!</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirmar Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirme sua senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {message && (
                    <Alert>
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={loading || verifyingOtp || creatingPayment}
                  >
                    {loading && !otpSent ? "Enviando código..." : 
                     verifyingOtp ? "Verificando código..." :
                     creatingPayment ? "Preparando pagamento..." :
                     otpSent && !otpVerified ? "Verificar Código" :
                     "Continuar"}
                  </Button>
                  {otpSent && !otpVerified && (
                    <p className="text-sm text-muted-foreground text-center">
                      Digite o código recebido no WhatsApp e clique em "Verificar Código" para prosseguir.
                    </p>
                  )}
                  {!otpSent && (
                    <p className="text-xs text-muted-foreground text-center">
                      Ao continuar, você receberá um código de verificação no WhatsApp e será direcionado para a página de pagamento.
                    </p>
                  )}
                </form>
              )}
            </TabsContent>

            {/* Forgot Password Tab */}
            <TabsContent value="forgot" className="space-y-4 mt-4">
              {resetEmailSent ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Um e-mail foi enviado para {email} com instruções para redefinir sua senha.
                      Verifique sua caixa de entrada e spam.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={() => {
                      setActiveTab("login");
                      setResetEmailSent(false);
                    }}
                    className="w-full"
                  >
                    Voltar para Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
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
                    <Alert>
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={loading}
                  >
                    {loading ? "Enviando..." : "Enviar E-mail de Recuperação"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;