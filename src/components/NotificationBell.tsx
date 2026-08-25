import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  deepLinkForNotification,
  useNotifications,
} from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  userId: string;
  className?: string;
}

export function NotificationBell({ userId, className }: NotificationBellProps) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications(userId);

  const handleOpen = async (id: string, type: string, data: unknown) => {
    await markAsRead(id);
    const path = deepLinkForNotification({
      type,
      data: data as never,
    });
    navigate(path);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative shrink-0", className)}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} notificações não lidas`
              : "Notificações"
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px] leading-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(100vw-1.5rem,22rem)] p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}`
                : "Tudo em dia"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => void markAllAsRead()}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Ler todas
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("/notificacoes")}
              aria-label="Configurações de notificações"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-80">
          {loading && notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda.
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((item) => {
                const unread = !item.read_at;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                        unread && "bg-primary/5"
                      )}
                      onClick={() =>
                        void handleOpen(item.id, item.type, item.data)
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            unread ? "font-semibold" : "font-medium"
                          )}
                        >
                          {item.title}
                        </p>
                        {unread && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {item.body && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {item.body}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/80">
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm"
            onClick={() => navigate("/notificacoes")}
          >
            Gerenciar notificações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
