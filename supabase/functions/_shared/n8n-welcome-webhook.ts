import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const N8N_WELCOME_WEBHOOK_URL =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/enviar-mensagem-inicio';

const WELCOME_SENT_META_KEY = 'welcome_n8n_sent_at';

export type WelcomeWebhookPayload = {
  nome: string;
  email: string;
  telefone: string;
};

/** Returns true if welcome webhook was already sent for this user. */
export async function wasWelcomeWebhookSent(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) return false;
  return Boolean(data.user.user_metadata?.[WELCOME_SENT_META_KEY]);
}

/**
 * Sends the n8n "mensagem início" webhook once per user (dedupe via auth user_metadata).
 */
export async function notifyWelcomeMessageN8n(
  supabaseAdmin: SupabaseClient,
  payload: WelcomeWebhookPayload,
  userId?: string
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const nome = payload.nome?.trim();
  const email = payload.email?.toLowerCase().trim();
  const telefone = payload.telefone?.replace(/\D/g, '') ?? '';

  if (!nome || !email || !telefone) {
    console.warn('notifyWelcomeMessageN8n: missing nome, email or telefone', {
      hasNome: Boolean(nome),
      hasEmail: Boolean(email),
      hasTelefone: Boolean(telefone)
    });
    return { sent: false, error: 'missing_fields' };
  }

  if (userId) {
    const alreadySent = await wasWelcomeWebhookSent(supabaseAdmin, userId);
    if (alreadySent) {
      console.log('notifyWelcomeMessageN8n: already sent for user', userId);
      return { sent: false, skipped: true };
    }
  }

  try {
    const response = await fetch(N8N_WELCOME_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, telefone })
    });
    const text = await response.text();
    console.log('n8n welcome webhook response:', response.status, text);

    if (!response.ok) {
      return { sent: false, error: `http_${response.status}` };
    }

    if (userId) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const existingMeta = userData?.user?.user_metadata ?? {};
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existingMeta,
          [WELCOME_SENT_META_KEY]: new Date().toISOString()
        }
      });
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('notifyWelcomeMessageN8n failed:', message);
    return { sent: false, error: message };
  }
}

/** Fire-and-forget when EdgeRuntime.waitUntil is available. */
export function scheduleWelcomeMessageN8n(
  supabaseAdmin: SupabaseClient,
  payload: WelcomeWebhookPayload,
  userId?: string
): void {
  const promise = notifyWelcomeMessageN8n(supabaseAdmin, payload, userId);
  // @ts-ignore Edge runtime
  if (typeof EdgeRuntime !== 'undefined') {
    // @ts-ignore
    EdgeRuntime.waitUntil(promise);
  }
}
