import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook que retorna os IDs de todos os usuários cujas transações
 * o usuário atual pode ver (o próprio + contas conectadas com status 'accepted').
 */
export function useConnectedUserIds(currentUserId: string | undefined) {
    const [allUserIds, setAllUserIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUserId) return;

        const fetchConnectedIds = async () => {
            try {
                // Buscar conexões aceitas onde sou requester ou recipient
                const { data, error } = await supabase
                    .from("account_connections")
                    .select("requester_id, recipient_id")
                    .eq("status", "accepted")
                    .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`);

                if (error) {
                    console.error("Error fetching connected user IDs:", error);
                    setAllUserIds([currentUserId]);
                    return;
                }

                const connectedIds = new Set<string>([currentUserId]);
                (data || []).forEach((conn) => {
                    if (conn.requester_id && conn.requester_id !== currentUserId) {
                        connectedIds.add(conn.requester_id);
                    }
                    if (conn.recipient_id && conn.recipient_id !== currentUserId) {
                        connectedIds.add(conn.recipient_id);
                    }
                });

                setAllUserIds(Array.from(connectedIds));
            } catch (err) {
                console.error("Error in useConnectedUserIds:", err);
                setAllUserIds([currentUserId]);
            } finally {
                setLoading(false);
            }
        };

        fetchConnectedIds();
    }, [currentUserId]);

    return { allUserIds, loading };
}
