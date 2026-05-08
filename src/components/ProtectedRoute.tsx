import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { checkSubscriptionAccess, SubscriptionAccessResult } from "@/utils/subscription";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const SUBSCRIPTION_BYPASS_PATHS = ["/assinatura", "/alterar-senha"];

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessResult, setAccessResult] = useState<SubscriptionAccessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const runAccessCheck = async (currentUser: User | null) => {
      if (!currentUser) {
        if (mounted) setAccessResult(null);
        return;
      }
      const access = await checkSubscriptionAccess(currentUser.id);
      if (mounted) setAccessResult(access);
    };

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session?.user) {
          if (mounted) {
            setUser(null);
            setAccessResult(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) setUser(session.user);
        await runAccessCheck(session.user);
        if (mounted) setLoading(false);
      } catch (error) {
        console.error("Error checking auth:", error);
        if (mounted) {
          setUser(null);
          setAccessResult(null);
          setLoading(false);
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const nextUser = session?.user || null;
        setUser(nextUser);
        await runAccessCheck(nextUser);
        if (mounted) setLoading(false);
      }
    );

    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth timeout, redirecting to login");
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    checkSubscriptionAccess(user.id).then((access) => {
      if (!cancelled) setAccessResult(access);
    });
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

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
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (accessResult && !accessResult.allowed) {
    const isOnBypassPath = SUBSCRIPTION_BYPASS_PATHS.some((p) =>
      location.pathname.startsWith(p),
    );
    if (!isOnBypassPath) {
      return (
        <Navigate
          to="/assinatura"
          state={{ from: location, blockedReason: accessResult.reason }}
          replace
        />
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
