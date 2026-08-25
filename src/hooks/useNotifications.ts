import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationRow } from "@/integrations/supabase/types";

export function deepLinkForNotification(
  notification: Pick<NotificationRow, "type" | "data">
): string {
  const data = (notification.data || {}) as Record<string, unknown>;
  if (typeof data.url === "string" && data.url.startsWith("/")) return data.url;
  if (typeof data.path === "string" && data.path.startsWith("/")) return data.path;

  const type = notification.type || "";
  if (type.startsWith("appointment")) return "/agenda";
  if (type.startsWith("transaction")) return "/transactions";
  if (type.startsWith("shopping")) return "/lista-compras";
  if (type === "budget_threshold") return "/orcamentos";
  if (type === "invoice_due") return "/faturas";
  if (type === "engagement_inactive_2d") return "/dash";
  return "/dash";
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      console.warn("notifications fetch:", fetchError.message);
      setError(fetchError.message);
      setNotifications([]);
    } else {
      setNotifications((data as NotificationRow[]) || []);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as NotificationRow;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev].slice(0, 50);
            });
            return;
          }

          if (payload.eventType === "UPDATE") {
            const row = payload.new as NotificationRow;
            setNotifications((prev) =>
              prev.map((n) => (n.id === row.id ? row : n))
            );
            return;
          }

          if (payload.eventType === "DELETE") {
            const row = payload.old as { id?: string };
            if (row?.id) {
              setNotifications((prev) => prev.filter((n) => n.id !== row.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: readAt } : n))
    );

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", id);

    if (updateError) {
      console.warn("markAsRead:", updateError.message);
      await fetchNotifications();
      return false;
    }
    return true;
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return false;
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt }))
    );

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);

    if (updateError) {
      console.warn("markAllAsRead:", updateError.message);
      await fetchNotifications();
      return false;
    }
    return true;
  }, [fetchNotifications, userId]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deepLinkForNotification,
  };
}
