import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";

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

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
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

    // Validate basic fields first
    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    // Validate phone format
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      setMessage("Por favor, informe um número de telefone válido com DDD.");
      return;
    }

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
        const { data, error } = await supabase.functions.invoke('verify-otp', {
          body: {
            phone: cleanPhone,
            code: otpCode
          }
        });

        if (error) {
          setMessage(error.message || "Código inválido ou expirado.");
          toast({
            title: "Erro",
            description: error.message || "Código inválido ou expirado.",
            variant: "destructive"
          });
          setVerifyingOtp(false);
          return;
        }

        // OTP verified successfully, now create the account
        setOtpVerified(true);
        toast({
          title: "Código verificado!",
          description: "Criando sua conta...",
        });

        // Create the account
        setLoading(true);
        try {
          const { data: registerData, error: registerError } = await supabase.functions.invoke('register-user', {
            body: {
              email,
              password,
              full_name: fullName,
              phone: cleanPhone,
              otp_code: otpCode
            }
          });

          if (registerError) {
            setMessage(registerError.message || "Erro ao criar conta.");
            setOtpVerified(false); // Reset verification on error
          } else {
            toast({
              title: "Conta criada com sucesso!",
              description: "Você pode fazer login agora.",
            });
            setActiveTab("login");
            setEmail("");
            setPassword("");
            setFullName("");
            setPhone("");
            setConfirmPassword("");
            setOtpCode("");
            setOtpSent(false);
            setOtpVerified(false);
          }
        } catch (registerError: any) {
          setMessage(registerError.message || "Erro inesperado. Tente novamente.");
          setOtpVerified(false); // Reset verification on error
        } finally {
          setLoading(false);
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
            // Reset OTP state when switching tabs
            setOtpSent(false);
            setOtpVerified(false);
            setOtpCode("");
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
                  {otpSent && (
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
                      placeholder="Mínimo 6 caracteres"
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
                  disabled={loading || verifyingOtp}
                >
                  {loading && !otpSent ? "Enviando código..." : 
                   verifyingOtp ? "Verificando código..." :
                   otpSent && !otpVerified ? "Verificar e Criar Conta" :
                   otpVerified ? "Criando conta..." :
                   "Criar Conta"}
                </Button>
                {otpSent && !otpVerified && (
                  <p className="text-sm text-muted-foreground text-center">
                    Digite o código recebido no WhatsApp e clique novamente em "Criar Conta" para verificar e criar sua conta.
                  </p>
                )}
              </form>
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