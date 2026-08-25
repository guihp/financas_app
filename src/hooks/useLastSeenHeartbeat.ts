import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Updates profiles.last_seen_at on mount, window focus, and a light interval.
 * Used by engagement-notifications (inactive 2d) on the backend.
 */
export function useLastSeenHeartbeat(userId: string | undefined) {
  const lastSentAt = useRef(0);

  const beat = useCallback(async () => {
    if (!userId) return;

    const now = Date.now();
    // Debounce rapid focus events
    if (now - lastSentAt.current < 30_000) return;
    lastSentAt.current = now;

    const { error } = await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      console.warn("last_seen_at heartbeat:", error.message);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    void beat();

    const onFocus = () => {
      void beat();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void beat();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      void beat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [beat, userId]);
}
