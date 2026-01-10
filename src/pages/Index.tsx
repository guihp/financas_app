import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dashboard } from "@/components/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    // Timeout de segurança: se nada acontecer em 10 segundos, parar o loading
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("Loading timeout reached, forcing stop");
        setLoading((prevLoading) => {
          if (prevLoading) {
            return false;
          }
          return prevLoading;
        });
        // Se chegou aqui por timeout, provavelmente não tem sessão válida
        navigate("/auth");
      }
    }, 10000);

    // Função para verificar se usuário existe e está ativo
    const validateUser = async (sessionUser: User): Promise<boolean> => {
      try {
        console.log("Validating user:", sessionUser.id);
        
        // Verificar se usuário tem perfil (se foi deletado, não terá perfil)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', sessionUser.id)
          .single();

        if (profileError) {
          console.error("User profile query error:", profileError);
          // PGRST116 = no rows found - pode ser que o perfil ainda não foi criado
          // Nesse caso, permitir acesso mas logar o erro
          if (profileError.code !== 'PGRST116') {
            console.warn("Profile error is not PGRST116, allowing access anyway");
          }
          // Não bloquear acesso por falta de perfil, apenas logar
        } else if (!profileData) {
          console.warn("User profile not found but no error, allowing access");
        } else {
          console.log("User profile found:", profileData.id);
        }

        // Verificar se sessão ainda é válida
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error("Invalid session - auth error:", authError);
          if (mounted) {
            setLoading(false);
            await supabase.auth.signOut();
            navigate("/auth");
          }
          return false;
        }

        if (!currentUser || currentUser.id !== sessionUser.id) {
          console.error("Invalid session - user mismatch");
          if (mounted) {
            setLoading(false);
            await supabase.auth.signOut();
            navigate("/auth");
          }
          return false;
        }

        console.log("User validation successful");
        return true;
      } catch (error) {
        console.error("Error validating user:", error);
        // Em caso de erro na validação, permitir acesso mas logar
        console.warn("Allowing access despite validation error");
        return true; // Permitir acesso mesmo com erro na validação
      }
    };

    // Função para processar sessão
    const processSession = async (session: Session | null, isInitialCheck = false) => {
      if (!mounted) return;

      try {
        // Limpar timeout se tudo correu bem
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (!session) {
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
            if (isInitialCheck) {
              navigate("/auth");
            }
          }
          return;
        }

        // Validar usuário antes de permitir acesso
        const isValid = await validateUser(session.user);
        
        if (!mounted) return;

        if (isValid) {
          setSession(session);
          setUser(session.user);
        } else {
          setSession(null);
          setUser(null);
        }
        
        if (mounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error processing session:", error);
        if (mounted) {
          setLoading(false);
          navigate("/auth");
        }
      }
    };

    // Check for existing session first
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setLoading(false);
            navigate("/auth");
          }
          return;
        }

        // Se não tem sessão, redirecionar imediatamente
        if (!session) {
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
            navigate("/auth");
          }
          return;
        }

        await processSession(session, true);
      } catch (error) {
        console.error("Unexpected error in getSession:", error);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (mounted) {
          setLoading(false);
          navigate("/auth");
        }
      }
    })();

    // Set up auth state listener AFTER initial check
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        // Não processar eventos durante a checagem inicial
        if (event === 'INITIAL_SESSION') return;
        await processSession(session, false);
      }
    );

    subscription = authSubscription;

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return <Dashboard user={user} />;
};

export default Index;
