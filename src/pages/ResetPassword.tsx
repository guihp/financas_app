import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className="flex items-center gap-2 text-sm">
        {met ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
            <XCircle className="w-4 h-4 text-red-500" />
        )}
        <span className={met ? "text-green-600" : "text-muted-foreground"}>{text}</span>
    </div>
);

export default function ResetPassword() {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        // Check if the user really came from a recovery link
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                toast({
                    title: "Link inválido ou expirado",
                    description: "Por favor, solicite a recuperação de senha novamente.",
                    variant: "destructive",
                });
                navigate("/auth");
            }
        });

        // Supabase auth listener to handle the password recovery flow
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event == "PASSWORD_RECOVERY") {
                console.log("Password recovery event triggered.");
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [navigate, toast]);

    const passwordRequirements = {
        length: newPassword.length >= 8,
        uppercase: /[A-Z]/.test(newPassword),
        lowercase: /[a-z]/.test(newPassword),
        number: /\d/.test(newPassword),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    };

    const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);
    const passwordsMatch = newPassword === confirmPassword && newPassword !== "";

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (!allRequirementsMet) {
            setErrorMsg("A senha não atende aos requisitos mínimos.");
            return;
        }

        if (!passwordsMatch) {
            setErrorMsg("As senhas não coincidem.");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                toast({
                    title: "Senha atualizada com sucesso!",
                    description: "Você já pode acessar o sistema com sua nova senha.",
                });
                navigate("/dash");
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Erro ao atualizar a senha");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-background">
            <Card className="w-full max-w-md shadow-lg border-border">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Criar Nova Senha</CardTitle>
                    <CardDescription>
                        Digite sua nova senha abaixo para redefinir o acesso.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">

                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nova Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="new-password"
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Sua nova senha segura"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            {/* Password Requirements */}
                            {newPassword && (
                                <div className="space-y-2 mt-3 bg-muted/50 p-3 rounded-md">
                                    <PasswordRequirement met={passwordRequirements.length} text="Pelo menos 8 caracteres" />
                                    <PasswordRequirement met={passwordRequirements.uppercase} text="Uma letra maiúscula" />
                                    <PasswordRequirement met={passwordRequirements.lowercase} text="Uma letra minúscula" />
                                    <PasswordRequirement met={passwordRequirements.number} text="Um número" />
                                    <PasswordRequirement met={passwordRequirements.special} text="Um caractere especial" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirm-password"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirme a nova senha"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            {confirmPassword && (
                                <div className="flex items-center gap-2 text-sm mt-2">
                                    {passwordsMatch ? (
                                        <>
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-green-600">Senhas coincidem</span>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="w-4 h-4 text-red-500" />
                                            <span className="text-red-500">Senhas não coincidem</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {errorMsg && (
                            <Alert variant="destructive">
                                <AlertDescription>{errorMsg}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary/90 mt-6"
                            disabled={loading || !allRequirementsMet || !passwordsMatch}
                        >
                            {loading ? "Salvando..." : "Redefinir Senha"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
