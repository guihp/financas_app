import { supabase } from "@/integrations/supabase/client";

const GRACE_PERIOD_HOURS = 12;

export interface SubscriptionAccessResult {
  allowed: boolean;
  reason:
    | "super_admin"
    | "admin"
    | "active"
    | "trial_active"
    | "trial_grace"
    | "trial_expired"
    | "expired"
    | "cancelled"
    | "overdue"
    | "no_subscription"
    | "no_customer"
    | "error";
  isExpired: boolean;
  daysExpiredAgo: number;
}

const grant = (reason: SubscriptionAccessResult["reason"]): SubscriptionAccessResult => ({
  allowed: true,
  reason,
  isExpired: false,
  daysExpiredAgo: 0,
});

const block = (
  reason: SubscriptionAccessResult["reason"],
  daysExpiredAgo = 0,
): SubscriptionAccessResult => ({
  allowed: false,
  reason,
  isExpired: true,
  daysExpiredAgo: Math.max(0, daysExpiredAgo),
});

const verifyAsaasFallback = async (): Promise<boolean> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) return false;
    const url = `${import.meta.env.VITE_SUPABASE_URL || "https://dlbiwguzbiosaoyrcvay.supabase.co"}/functions/v1/check-subscription-status`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
        "Content-Type": "application/json",
      },
    });
    const result = await res.json();
    return Boolean(result?.paid);
  } catch (e) {
    console.warn("Failed to check Asaas status:", e);
    return false;
  }
};

const checkRoles = async (userId: string): Promise<SubscriptionAccessResult | null> => {
  try {
    const { data: roleData } = await supabase.rpc("is_super_admin");
    if (roleData === true) return grant("super_admin");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roles?.some((r) => r.role === "admin")) return grant("admin");
  } catch (e) {
    console.warn("Could not check role status:", e);
  }
  return null;
};

export const checkSubscriptionAccess = async (
  userId: string,
): Promise<SubscriptionAccessResult> => {
  const roleResult = await checkRoles(userId);
  if (roleResult) return roleResult;

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code === "PGRST116") return block("no_subscription");
    if (error) {
      console.error("Subscription check error:", error);
      return block("error");
    }
    if (!data) return block("no_subscription");
    if (!data.asaas_customer_id) return block("no_customer");

    const now = new Date();

    if (data.status === "active" && !data.is_trial) return grant("active");

    if (data.status === "active" && data.is_trial && data.trial_ends_at) {
      const trialEnd = new Date(data.trial_ends_at);
      if (trialEnd >= now) return grant("trial_active");

      if (data.current_period_end) {
        const periodEnd = new Date(data.current_period_end);
        const todayMidnight = new Date(now.toISOString().split("T")[0]);
        if (periodEnd >= todayMidnight && periodEnd > trialEnd) return grant("active");
      }

      const graceEnd = new Date(trialEnd.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);

      if (now <= graceEnd) {
        if (await verifyAsaasFallback()) return grant("active");
        return grant("trial_grace");
      }

      if (await verifyAsaasFallback()) return grant("active");

      const daysAgo = Math.ceil((now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24));
      return block("trial_expired", daysAgo);
    }

    if (data.status === "active") return grant("active");

    if (data.is_trial && data.trial_ends_at) {
      const trialEnd = new Date(data.trial_ends_at);
      const graceEnd = new Date(trialEnd.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);
      if (graceEnd < now) {
        const daysAgo = Math.ceil((now.getTime() - graceEnd.getTime()) / (1000 * 60 * 60 * 24));
        return block("trial_expired", daysAgo);
      }
      return grant("trial_grace");
    }

    if (data.status === "expired" || data.status === "cancelled" || data.status === "overdue") {
      const endDate = data.current_period_end ? new Date(data.current_period_end) : now;
      const daysAgo = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      const reason: SubscriptionAccessResult["reason"] =
        data.status === "expired" ? "expired" : data.status === "overdue" ? "overdue" : "cancelled";
      return block(reason, daysAgo);
    }

    return grant("active");
  } catch (e) {
    console.error("Subscription check error:", e);
    return block("error");
  }
};

export const SUBSCRIPTION_BLOCK_MESSAGE =
  "Sua assinatura está inativa. Renove em https://financas.iafeoficial.com/auth para continuar acessando.";
