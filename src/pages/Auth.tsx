import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, Gift, Sparkles, FileText, ChevronDown, Circle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { TermsOfUseContent } from "@/components/TermsOfUseContent";
import { Checkbox } from "@/components/ui/checkbox";
import { friendlyError } from "@/utils/friendlyError";
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
import { checkSubscriptionAccess } from "@/utils/subscription";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const TRIAL_DAYS = 7;

// Linha de requisito de senha: neutra (cinza) antes de digitar, verde quando ok,
// vermelha quando falta. Espelha a regra de isStrongPassword (8+ chars, 3 de 4 tipos).
function PwReqRow({ state, children }: { state: "neutral" | "ok" | "bad"; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {state === "neutral" ? (
        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : state === "ok" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      )}
      <span className={state === "neutral" ? "text-muted-foreground" : state === "ok" ? "text-green-700 dark:text-green-400" : "text-destructive"}>
        {children}
      </span>
    </li>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const touched = password.length > 0;
  const minLen = password.length >= 8;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const number = /[0-9]/.test(password);
  const special = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const typesCount = [upper, lower, number, special].filter(Boolean).length;
  const typesOk = typesCount >= 3;
  const st = (ok: boolean): "neutral" | "ok" | "bad" => (!touched ? "neutral" : ok ? "ok" : "bad");

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-foreground">Requisitos da senha</p>
      <ul className="space-y-1 text-xs">
        <PwReqRow state={st(minLen)}>Pelo menos 8 caracteres</PwReqRow>
        <PwReqRow state={st(typesOk)}>
          Pelo menos 3 dos tipos abaixo{touched ? ` (você tem ${typesCount} de 4)` : ""}
        </PwReqRow>
      </ul>
      <ul className="space-y-1 pl-5 text-xs">
        <PwReqRow state={st(upper)}>Letra maiúscula (A-Z)</PwReqRow>
        <PwReqRow state={st(lower)}>Letra minúscula (a-z)</PwReqRow>
        <PwReqRow state={st(number)}>Número (0-9)</PwReqRow>
        <PwReqRow state={st(special)}>Caractere especial (!@#$…)</PwReqRow>
      </ul>
    </div>
  );
}

interface AuthProps {
  defaultTab?: "login" | "signup" | "forgot";
}

const Auth = ({ defaultTab = "login" }: AuthProps) => {
  const [activeTab, setActiveTab] = useState<"login" | "signup" | "forgot">(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>("BR");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [showTerms, setShowTerms] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneForCountry(e.target.value, phoneCountry);
    setPhone(formatted);
  };

  const handlePhoneCountryChange = (value: string) => {
    const country = value as PhoneCountry;
    setPhoneCountry(country);
    const digits = phone.replace(/\D/g, '');
    setPhone(formatPhoneForCountry(digits, country));
  };

  const resetSignupForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setPhone("");
    setPhoneCountry("BR");
    setConfirmPassword("");
    setRegistrationComplete(false);
  };

  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;

      const access = await checkSubscriptionAccess(session.user.id);
      if (cancelled) return;

      if (access.allowed) {
        navigate("/");
      } else {
        // Keep the session and send the user to /assinatura, the one route
        // ProtectedRoute allows while blocked. Signing out here used to trap the
        // customer: the message pointed back to /auth, and /auth signed them out
        // again — no reachable renewal screen.
        navigate("/assinatura", { state: { blockedReason: access.reason } });
      }
    };
    checkUser();

    return () => {
      cancelled = true;
    };
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });

      if (error) {
        if (error.message === "Invalid login credentials") {
          setMessage("E-mail ou senha incorretos.");
        } else {
          setMessage(error.message);
        }
        setLoading(false);
        return;
      }

      if (!data?.user) {
        setMessage("Erro inesperado ao autenticar.");
        setLoading(false);
        return;
      }

      const access = await checkSubscriptionAccess(data.user.id);
      if (!access.allowed) {
        // Do NOT sign out: the user must be able to reach /assinatura to pay.
        // ProtectedRoute keeps every other route blocked while access.allowed is false.
        toast({
          title: "Assinatura inativa",
          description: "Renove seu plano para voltar a usar o IAFÉ Finanças.",
        });
        navigate("/assinatura", { state: { blockedReason: access.reason } });
        setLoading(false);
        return;
      }

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo de volta.",
      });
      navigate("/");
    } catch (error) {
      setMessage("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePartialLeadSave = async () => {
    // Only save if we have at least an email and it looks roughly like an email
    if (email && email.includes("@")) {
      try {
        const cleanPhone = phone ? getCleanPhoneForBackend(phone, phoneCountry) : null;
        const { error } = await supabase.rpc("capture_partial_lead", {
          p_email: email.trim().toLowerCase(),
          p_full_name: fullName.trim() || null,
          p_phone: cleanPhone || null,
        });
        if (error) {
          console.error("Failed to capture partial lead:", {
            code: error.code,
            message: error.message,
            details: error.details,
          });
        }
      } catch (err) {
        // Silent for visitor UX; log for debugging
        console.error("Failed to capture partial lead (unexpected):", err);
      }
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

    setLoading(true);

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
        // FunctionsHttpError: a mensagem real fica no corpo da resposta (context).
        let errorMessage = "Erro ao iniciar cadastro.";
        if (customerError.context && typeof customerError.context.json === 'function') {
          const body = await customerError.context.json().catch(() => null);
          if (body?.error) errorMessage = body.error;
        }
        throw new Error(errorMessage);
      }

      if (customerData?.error) {
        throw new Error(customerData.error);
      }

      setRegistrationComplete(true);
      // Persist credentials in sessionStorage so PagamentoPendente can auto-login
      // the user as soon as the payment is confirmed. Cleared after sign in.
      try {
        sessionStorage.setItem('pending_auth_email', sanitizedEmail);
        sessionStorage.setItem('pending_auth_password', password);
      } catch (_) { /* ignore quota errors */ }
      toast({
        title: "Cadastro iniciado",
        description: "Conclua o pagamento para ativar sua conta.",
      });

      let checkoutUrl = `/pagamento-pendente?email=${encodeURIComponent(sanitizedEmail)}`;
      if (customerData?.plan) {
        checkoutUrl += `&originalPrice=${customerData.plan.original_price}&finalPrice=${customerData.plan.price}&discount=${customerData.plan.applied_discount}`;
      }

      navigate(checkoutUrl);
    } catch (err: any) {
      console.error('create-asaas-customer error:', err);
      setMessage(friendlyError(err, "Erro ao iniciar cadastro."));
      toast({
        title: "Erro",
        description: friendlyError(err, "Erro ao iniciar cadastro."),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
        redirectTo: `${window.location.origin}/reset-password`,
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
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Termos de Uso</DialogTitle>
            <DialogDescription>Leia nossos termos de uso abaixo.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 border rounded-md">
            <TermsOfUseContent />
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowTerms(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Card className="w-full max-w-md bg-gradient-card shadow-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Logo variant="horizontal" size="lg" />
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
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as "login" | "signup" | "forgot");
            setMessage("");
            setResetEmailSent(false);
            setRegistrationComplete(false);
            setRegistrationComplete(false);
            if (v !== "signup") {
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
              ) : (
                /* Regular Signup Form - only after accepting terms */
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Trial Banner */}
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
                          Teste todas as funcionalidades e tenha controle total do seu dinheiro!
                        </p>
                      </div>
                    </div>
                  </div>

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
                        onBlur={handlePartialLeadSave}
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
                        onBlur={handlePartialLeadSave}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Telefone (WhatsApp) *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={phoneCountry}
                        onValueChange={handlePhoneCountryChange}
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
                        onBlur={handlePartialLeadSave}
                        maxLength={
                          phoneCountry === "BR" ? 17 :
                            phoneCountry === "US" ? 14 : 11
                        }
                        required
                        className="flex-1"
                      />
                    </div>
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

                  <PasswordChecklist password={password} />

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
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <XCircle className="h-3.5 w-3.5 shrink-0" /> As senhas não coincidem
                      </p>
                    )}
                    {confirmPassword.length > 0 && confirmPassword === password && (
                      <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> As senhas coincidem
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptedTerms}
                      onCheckedChange={(v) => setAcceptedTerms(v === true)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="accept-terms"
                      className="text-sm cursor-pointer select-none text-foreground"
                    >
                      Li e aceito os{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-primary hover:underline font-medium"
                      >
                        termos de uso
                      </button>
                      {" "}da IAFÉ Finanças
                    </label>
                  </div>

                  {message && (
                    <Alert variant="destructive">
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={loading || !acceptedTerms}
                  >
                    {loading ? "Criando sua conta..." : "Começar Grátis"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Ao criar sua conta, você recebe pelo WhatsApp nosso trial com tudo liberado para organizar sua vida financeira de verdade.
                  </p>
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
