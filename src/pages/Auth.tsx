import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, Gift, Sparkles, FileText, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { TermsOfUseContent } from "@/components/TermsOfUseContent";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  isValidEmail, 
  isValidPhoneForCountry,
  isStrongPassword, 
  isValidFullName,
  sanitizeText,
  formatPhoneForCountry,
  getCleanPhoneForBackend,
  PHONE_COUNTRY_NAMES,
  type PhoneCountry
} from "@/utils/validation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRIAL_DAYS = 7;

const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>("BR");
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
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [termsStepDone, setTermsStepDone] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneForCountry(e.target.value, phoneCountry);
    setPhone(formatted);
    if (otpSent) {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpCode("");
    }
  };

  const handlePhoneCountryChange = (value: string) => {
    const country = value as PhoneCountry;
    setPhoneCountry(country);
    // Reformatar dígitos existentes para o novo formato do país
    const digits = phone.replace(/\D/g, '');
    setPhone(formatPhoneForCountry(digits, country));
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
          full_name: fullName,
          pais: PHONE_COUNTRY_NAMES[phoneCountry]
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

  const resetSignupForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    setPhoneCountry("BR");
    setConfirmPassword("");
    setOtpCode("");
    setOtpSent(false);
    setOtpVerified(false);
    setRegistrationComplete(false);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();

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

    if (!email || !isValidEmail(email)) {
      setMessage("Por favor, informe um e-mail válido.");
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

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

    if (!email || !isValidEmail(email)) {
      setMessage("Por favor, informe um e-mail válido.");
      return;
    }

    const fullNameValidation = isValidFullName(fullName);
    if (!fullNameValidation.valid) {
      setMessage(fullNameValidation.message);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }

    const passwordValidation = isStrongPassword(password);
    if (!passwordValidation.valid) {
      setMessage(passwordValidation.message);
      return;
    }

    const cleanPhone = getCleanPhoneForBackend(phone, phoneCountry);
    if (!isValidPhoneForCountry(phone, phoneCountry)) {
      const messages: Record<PhoneCountry, string> = {
        BR: "Por favor, informe um número de telefone válido com DDD (11 dígitos).",
        US: "Por favor, informe um número de telefone válido dos EUA (10 dígitos).",
        PT: "Por favor, informe um número de telefone válido de Portugal (9 dígitos).",
        IE: "Por favor, informe um número de telefone válido da Irlanda (9 dígitos).",
        ES: "Por favor, informe um número de telefone válido da Espanha (9 dígitos).",
      };
      setMessage(messages[phoneCountry]);
      return;
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedFullName = sanitizeText(fullName, 100);

    // Step 1: Send OTP
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
      return;
    }

    // Step 2: Verify OTP and create account
    if (otpSent && !otpVerified) {
      if (!otpCode || otpCode.length !== 6) {
        setMessage("Por favor, informe o código de 6 dígitos.");
        return;
      }

      setVerifyingOtp(true);
      try {
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

        // OTP verified! Create Asaas customer and pending registration (no user yet)
        setOtpVerified(true);
        toast({
          title: "Código verificado!",
          description: "Redirecionando para pagamento...",
        });

        try {
          const { data: customerData, error: customerError } = await supabase.functions.invoke('create-asaas-customer', {
            body: {
              email: sanitizedEmail,
              full_name: sanitizedFullName,
              phone: cleanPhone,
              password: password,
              terms_accepted: acceptedTerms
            }
          });

          if (customerError) {
            let errorMessage = "Erro ao iniciar cadastro.";
            if (customerError.message) errorMessage = customerError.message;
            else if (customerError.context?.body) {
              try {
                const body = typeof customerError.context.body === 'string'
                  ? JSON.parse(customerError.context.body) : customerError.context.body;
                if (body?.error) errorMessage = body.error;
              } catch (_) {}
            }
            throw new Error(errorMessage);
          }

          if (customerData?.error) {
            throw new Error(customerData.error);
          }

          setRegistrationComplete(true);
          toast({
            title: "Cadastro iniciado",
            description: "Conclua o pagamento para ativar sua conta.",
          });

          navigate(`/pagamento-pendente?email=${encodeURIComponent(sanitizedEmail)}`);
        } catch (err: any) {
          console.error('create-asaas-customer error:', err);
          setMessage(err.message || "Erro ao iniciar cadastro.");
          toast({
            title: "Erro",
            description: err.message || "Erro ao iniciar cadastro.",
            variant: "destructive"
          });
          setOtpVerified(false);
        }

        setVerifyingOtp(false);
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
            <Logo variant="horizontal" size="xl" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">
              {activeTab === "login" && "Bem-vindo"}
              {activeTab === "signup" && "Criar Conta"}
              {activeTab === "forgot" && "Recuperar Senha"}
            </CardTitle>
            <CardDescription>
              {activeTab === "login" && "Entre na sua conta"}
              {activeTab === "signup" && "Comece grátis por 7 dias"}
              {activeTab === "forgot" && "Digite seu e-mail para recuperar"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab}           onValueChange={(v) => {
            setActiveTab(v as "login" | "signup" | "forgot");
            setMessage("");
            setResetEmailSent(false);
            setOtpSent(false);
            setOtpVerified(false);
            setOtpCode("");
            setRegistrationComplete(false);
            if (v !== "signup") {
              setTermsStepDone(false);
              setTermsScrolledToBottom(false);
              setAcceptedTerms(false);
              setPhone("");
              setPhoneCountry("BR");
            }
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
              {/* Step 1: Accept Terms of Use */}
              {!termsStepDone && !registrationComplete && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-5 w-5 text-primary" />
                    <p className="text-sm font-medium">
                      Leia os Termos de Uso até o final para continuar
                    </p>
                  </div>
                  <div
                    className="rounded-xl border border-border bg-muted/30 overflow-y-auto px-4 py-3 max-h-[280px] scroll-smooth"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const threshold = 40;
                      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
                      if (isAtBottom) setTermsScrolledToBottom(true);
                    }}
                  >
                    <TermsOfUseContent className="pr-2" />
                  </div>
                  {!termsScrolledToBottom && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                      <ChevronDown className="h-3.5 w-3.5" />
                      Role até o final dos termos para habilitar a opção abaixo
                    </p>
                  )}
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptedTerms}
                      onCheckedChange={(v) => setAcceptedTerms(v === true)}
                      disabled={!termsScrolledToBottom}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="accept-terms"
                      className={`text-sm cursor-pointer select-none ${
                        termsScrolledToBottom
                          ? "text-foreground"
                          : "text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      Li e aceito integralmente os Termos de Uso da IAFÉ Finanças
                    </label>
                  </div>
                  <Button
                    type="button"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={!acceptedTerms}
                    onClick={() => setTermsStepDone(true)}
                  >
                    Continuar para o cadastro
                  </Button>
                </div>
              )}

              {/* Registration Complete */}
              {registrationComplete ? (
                <div className="text-center space-y-6 py-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="h-10 w-10 text-white" />
                    </div>
                    <Sparkles className="h-6 w-6 text-yellow-400 absolute top-0 right-1/4 animate-pulse" />
                    <Sparkles className="h-4 w-4 text-yellow-400 absolute bottom-0 left-1/4 animate-pulse" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold text-green-600 mb-2">Conta Criada!</h3>
                    <p className="text-muted-foreground">Bem-vindo ao IAFÉ Finanças</p>
                  </div>

                  <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Gift className="h-6 w-6 text-primary" />
                      <span className="text-lg font-semibold text-primary">Período Gratuito</span>
                    </div>
                    <p className="text-4xl font-bold text-primary mb-1">{TRIAL_DAYS} dias</p>
                    <p className="text-sm text-muted-foreground">grátis para explorar</p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Entrando automaticamente...</span>
                  </div>
                </div>
              ) : termsStepDone ? (
                /* Regular Signup Form - only after accepting terms */
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Trial Banner */}
                  {!otpSent && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Gift className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-700 dark:text-green-400">
                            {TRIAL_DAYS} dias grátis!
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-500">
                            Teste todas as funcionalidades sem compromisso
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                        disabled={otpVerified}
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
                        disabled={otpVerified}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Telefone (WhatsApp) *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={phoneCountry}
                        onValueChange={handlePhoneCountryChange}
                        disabled={otpVerified}
                      >
                        <SelectTrigger className="w-[120px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BR">
                            <span className="flex items-center gap-2">
                              <span>🇧🇷</span> Brasil
                            </span>
                          </SelectItem>
                          <SelectItem value="US">
                            <span className="flex items-center gap-2">
                              <span>🇺🇸</span> EUA
                            </span>
                          </SelectItem>
                          <SelectItem value="PT">
                            <span className="flex items-center gap-2">
                              <span>🇵🇹</span> Portugal
                            </span>
                          </SelectItem>
                          <SelectItem value="IE">
                            <span className="flex items-center gap-2">
                              <span>🇮🇪</span> Irlanda
                            </span>
                          </SelectItem>
                          <SelectItem value="ES">
                            <span className="flex items-center gap-2">
                              <span>🇪🇸</span> Espanha
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder={
                          phoneCountry === "BR" ? "(11) 9 9999-9999" :
                          phoneCountry === "US" ? "(555) 123-4567" :
                          "912 345 678"
                        }
                        value={phone}
                        onChange={handlePhoneChange}
                        maxLength={
                          phoneCountry === "BR" ? 17 :
                          phoneCountry === "US" ? 14 : 11
                        }
                        required
                        disabled={otpVerified}
                        className="flex-1"
                      />
                    </div>
                    {otpSent && !otpVerified && (
                      <div className="space-y-2 mt-4">
                        <Alert className="bg-primary/5 border-primary/20">
                          <AlertDescription className="text-sm">
                            Código OTP enviado para seu WhatsApp! Digite o código abaixo.
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
                        disabled={otpVerified}
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
                        disabled={otpVerified}
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
                    disabled={loading || verifyingOtp}
                  >
                    {loading && !otpSent ? "Enviando código..." : 
                     verifyingOtp ? "Criando sua conta..." :
                     otpSent && !otpVerified ? "Verificar e Criar Conta" :
                     "Começar Grátis"}
                  </Button>
                  
                  {otpSent && !otpVerified && (
                    <p className="text-sm text-muted-foreground text-center">
                      Digite o código recebido no WhatsApp e clique em "Verificar e Criar Conta".
                    </p>
                  )}
                  
                  {!otpSent && (
                    <p className="text-xs text-muted-foreground text-center">
                      Ao continuar, você receberá um código de verificação no WhatsApp.
                      Sem compromisso, cancele quando quiser.
                    </p>
                  )}
                </form>
              ) : null}
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
