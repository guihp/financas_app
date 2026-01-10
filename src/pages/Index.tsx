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
    // Função para verificar se usuário existe e está ativo
    const validateUser = async (sessionUser: User) => {
      try {
        // Verificar se usuário tem perfil (se foi deletado, não terá perfil)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', sessionUser.id)
          .single();

        if (profileError || !profileData) {
          console.error("User profile not found:", profileError);
          toast({
            title: "Usuário não encontrado",
            description: "Seu perfil não foi encontrado. Por favor, entre em contato com o suporte.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          navigate("/auth");
          return false;
        }

        // Verificar se sessão ainda é válida
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !currentUser || currentUser.id !== sessionUser.id) {
          console.error("Invalid session:", authError);
          await supabase.auth.signOut();
          navigate("/auth");
          return false;
        }

        return true;
      } catch (error) {
        console.error("Error validating user:", error);
        await supabase.auth.signOut();
        navigate("/auth");
        return false;
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (!session) {
          setUser(null);
          setLoading(false);
          navigate("/auth");
          return;
        }

        // Validar usuário antes de permitir acesso
        const isValid = await validateUser(session.user);
        
        if (isValid) {
          setUser(session.user);
        } else {
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setSession(null);
        setUser(null);
        setLoading(false);
        navigate("/auth");
        return;
      }

      // Validar usuário antes de permitir acesso
      const isValid = await validateUser(session.user);
      
      if (isValid) {
        setSession(session);
        setUser(session.user);
      } else {
        setSession(null);
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
