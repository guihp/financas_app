import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

export const SUBSCRIPTION_BLOCK_MESSAGE =
  "Sua assinatura está inativa. Renove em https://financas.iafeoficial.com/auth para continuar acessando.";

export const SUBSCRIPTION_INACTIVE_CODE = "SUBSCRIPTION_INACTIVE";

export async function isUserSubscriptionInactive(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_subscription_inactive", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[is_subscription_inactive] RPC error:", error);
    return false;
  }
  return data === true;
}
