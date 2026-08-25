import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationPreferenceRow } from "@/integrations/supabase/types";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://dlbiwguzbiosaoyrcvay.supabase.co";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

export const DEFAULT_NOTIFICATION_PREFS: Omit<
  NotificationPreferenceRow,
  "user_id" | "created_at" | "updated_at"
> = {
  push_enabled: true,
  in_app_enabled: true,
  appointment_enabled: true,
  transaction_expense_enabled: true,
  transaction_income_enabled: true,
  shopping_list_created_enabled: true,
  shopping_item_added_enabled: true,
  shopping_list_finished_enabled: true,
  engagement_inactive_2d_enabled: true,
  budget_threshold_enabled: true,
  invoice_due_enabled: true,
};

export type PreferenceToggleKey = keyof typeof DEFAULT_NOTIFICATION_PREFS;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function callManagePush(
  method: "POST" | "DELETE",
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: "Sessão expirada" };

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/manage-push-subscription`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        apikey:
          import.meta.env.VITE_SUPABASE_ANON_KEY ||
          "",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const json = await res.json();
      message = json?.error || json?.message || message;
    } catch {
      /* ignore */
    }
    return { ok: false, error: message };
  }

  return { ok: true };
}

export function usePushNotifications(userId: string | undefined) {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferenceRow | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSubscriptionState = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);
    setPermission(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  const loadPrefs = useCallback(async () => {
    if (!userId) {
      setPrefs(null);
      setPrefsLoading(false);
      return;
    }

    setPrefsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) {
        console.warn("notification_preferences fetch:", fetchError.message);
        setPrefs({ user_id: userId, ...DEFAULT_NOTIFICATION_PREFS });
        return;
      }

      if (data) {
        setPrefs(data as NotificationPreferenceRow);
      } else {
        const row = { user_id: userId, ...DEFAULT_NOTIFICATION_PREFS };
        const { data: inserted, error: insertError } = await supabase
          .from("notification_preferences")
          .upsert(row, { onConflict: "user_id" })
          .select("*")
          .maybeSingle();

        if (insertError) {
          console.warn("notification_preferences upsert:", insertError.message);
          setPrefs(row);
        } else {
          setPrefs((inserted as NotificationPreferenceRow) || row);
        }
      }
    } finally {
      setPrefsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshSubscriptionState();
  }, [refreshSubscriptionState]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  const subscribe = useCallback(async () => {
    setError(null);

    if (!VAPID_PUBLIC_KEY) {
      setError("VITE_VAPID_PUBLIC_KEY não configurada");
      // #region agent log
      fetch('http://127.0.0.1:7555/ingest/a8f36c2f-592a-4e64-97c2-85dc6e6c5989',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e03f61'},body:JSON.stringify({sessionId:'e03f61',runId:'pre-fix',hypothesisId:'N1',location:'usePushNotifications.ts:subscribe',message:'vapid missing',data:{vapidConfigured:false},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return false;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Push não é suportado neste navegador");
      // #region agent log
      fetch('http://127.0.0.1:7555/ingest/a8f36c2f-592a-4e64-97c2-85dc6e6c5989',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e03f61'},body:JSON.stringify({sessionId:'e03f61',runId:'pre-fix',hypothesisId:'N2',location:'usePushNotifications.ts:subscribe',message:'push unsupported',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return false;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Permissão de notificação negada");
        // #region agent log
        fetch('http://127.0.0.1:7555/ingest/a8f36c2f-592a-4e64-97c2-85dc6e6c5989',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e03f61'},body:JSON.stringify({sessionId:'e03f61',runId:'pre-fix',hypothesisId:'N3',location:'usePushNotifications.ts:subscribe',message:'permission denied',data:{perm},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      // #region agent log
      fetch('http://127.0.0.1:7555/ingest/a8f36c2f-592a-4e64-97c2-85dc6e6c5989',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e03f61'},body:JSON.stringify({sessionId:'e03f61',runId:'pre-fix',hypothesisId:'N4',location:'usePushNotifications.ts:subscribe',message:'sw ready',data:{scope:reg.scope,active:Boolean(reg.active)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = sub.toJSON();
      const result = await callManagePush("POST", {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
      });

      // #region agent log
      fetch('http://127.0.0.1:7555/ingest/a8f36c2f-592a-4e64-97c2-85dc6e6c5989',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e03f61'},body:JSON.stringify({sessionId:'e03f61',runId:'pre-fix',hypothesisId:'N5',location:'usePushNotifications.ts:subscribe',message:'manage-push result',data:{ok:result.ok,error:result.error||null,endpointHost:(json.endpoint||'').split('/')[2]||null,hasKeys:Boolean(json.keys?.p256dh&&json.keys?.auth)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (!result.ok) {
        setError(result.error || "Falha ao salvar inscrição");
        return false;
      }

      if (userId) {
        await supabase
          .from("notification_preferences")
          .upsert(
            {
              user_id: userId,
              ...(prefs || DEFAULT_NOTIFICATION_PREFS),
              push_enabled: true,
            },
            { onConflict: "user_id" }
          );
        setPrefs((prev) =>
          prev
            ? { ...prev, push_enabled: true }
            : { user_id: userId, ...DEFAULT_NOTIFICATION_PREFS, push_enabled: true }
        );
      }

      setIsSubscribed(true);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao ativar push";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [prefs, userId]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await callManagePush("DELETE", { endpoint });
      }

      if (userId) {
        await supabase
          .from("notification_preferences")
          .upsert(
            {
              user_id: userId,
              ...(prefs || DEFAULT_NOTIFICATION_PREFS),
              push_enabled: false,
            },
            { onConflict: "user_id" }
          );
        setPrefs((prev) =>
          prev
            ? { ...prev, push_enabled: false }
            : { user_id: userId, ...DEFAULT_NOTIFICATION_PREFS, push_enabled: false }
        );
      }

      setIsSubscribed(false);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao desativar push";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [prefs, userId]);

  const updatePrefs = useCallback(
    async (patch: Partial<NotificationPreferenceRow>) => {
      if (!userId) return false;
      setError(null);

      const next = {
        ...(prefs || { user_id: userId, ...DEFAULT_NOTIFICATION_PREFS }),
        ...patch,
        user_id: userId,
      };

      setPrefs(next);

      const { error: updateError } = await supabase
        .from("notification_preferences")
        .upsert(next, { onConflict: "user_id" });

      if (updateError) {
        setError(updateError.message);
        await loadPrefs();
        return false;
      }

      return true;
    },
    [loadPrefs, prefs, userId]
  );

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    prefs,
    prefsLoading,
    vapidConfigured: Boolean(VAPID_PUBLIC_KEY),
    subscribe,
    unsubscribe,
    updatePrefs,
    refreshSubscriptionState,
    reloadPrefs: loadPrefs,
  };
}
