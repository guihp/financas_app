import { useOutletContext } from "react-router-dom";
import { useState } from "react";
import { User } from "@supabase/supabase-js";
import {
  Bell,
  BellOff,
  Download,
  Loader2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PwaInstallDialog } from "@/components/PwaInstallDialog";
import {
  DEFAULT_NOTIFICATION_PREFS,
  usePushNotifications,
  type PreferenceToggleKey,
} from "@/hooks/usePushNotifications";

interface OutletContextType {
  user: User;
  isSuperAdmin: boolean;
}

const PREF_LABELS: { key: PreferenceToggleKey; label: string; hint: string }[] =
  [
    {
      key: "push_enabled",
      label: "Notificações push",
      hint: "Alertas do sistema mesmo com o app fechado",
    },
    {
      key: "in_app_enabled",
      label: "Centro in-app",
      hint: "Mostrar alertas no sino dentro do app",
    },
    {
      key: "appointment_enabled",
      label: "Agenda",
      hint: "Lembretes de compromissos (1h15, 1h, 15min, agora)",
    },
    {
      key: "transaction_expense_enabled",
      label: "Despesas",
      hint: "Quando uma despesa for registrada",
    },
    {
      key: "transaction_income_enabled",
      label: "Receitas",
      hint: "Quando uma receita for registrada",
    },
    {
      key: "shopping_list_created_enabled",
      label: "Nova lista de compras",
      hint: "Quando uma lista for criada",
    },
    {
      key: "shopping_item_added_enabled",
      label: "Item na lista",
      hint: "Quando um item for adicionado",
    },
    {
      key: "shopping_list_finished_enabled",
      label: "Lista finalizada",
      hint: "Quando a lista for concluída",
    },
    {
      key: "engagement_inactive_2d_enabled",
      label: "Reengajamento",
      hint: "Lembrete após 2 dias sem uso",
    },
    {
      key: "budget_threshold_enabled",
      label: "Orçamento",
      hint: "Alertas de limite (80%/100%)",
    },
    {
      key: "invoice_due_enabled",
      label: "Faturas",
      hint: "Vencimento próximo de faturas",
    },
  ];

const NotificationsPage = () => {
  const { user } = useOutletContext<OutletContextType>();
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    prefs,
    prefsLoading,
    vapidConfigured,
    subscribe,
    unsubscribe,
    updatePrefs,
  } = usePushNotifications(user.id);

  const values = prefs || { user_id: user.id, ...DEFAULT_NOTIFICATION_PREFS };

  const permissionLabel =
    permission === "granted"
      ? "Permitido"
      : permission === "denied"
        ? "Bloqueado no navegador"
        : "Ainda não solicitado";

  const handleToggle = async (key: PreferenceToggleKey, checked: boolean) => {
    if (key === "push_enabled") {
      if (checked) {
        const ok = await subscribe();
        if (ok) toast.success("Push ativado");
        else toast.error(error || "Não foi possível ativar o push");
        return;
      }
      const ok = await unsubscribe();
      if (ok) toast.success("Push desativado");
      else toast.error(error || "Não foi possível desativar o push");
      return;
    }

    const ok = await updatePrefs({ [key]: checked });
    if (!ok) toast.error(error || "Falha ao salvar preferência");
  };

  const handleInstallHint = () => {
    setShowInstallDialog(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
        <p className="text-sm text-muted-foreground">
          Controle push, alertas in-app e o que você quer receber.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {isSubscribed ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            Push no dispositivo
          </CardTitle>
          <CardDescription>
            Status do navegador e inscrição Web Push (VAPID).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Suporte do navegador</dt>
              <dd className="font-medium">
                {isSupported ? "Sim" : "Não suportado"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Permissão</dt>
              <dd className="font-medium">{permissionLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Inscrito</dt>
              <dd className="font-medium">{isSubscribed ? "Sim" : "Não"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Chave VAPID</dt>
              <dd className="font-medium">
                {vapidConfigured ? "Configurada" : "Ausente"}
              </dd>
            </div>
          </dl>

          {!vapidConfigured && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Defina <code className="font-mono">VITE_VAPID_PUBLIC_KEY</code> no
              ambiente de build para ativar push.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading || !isSupported || !vapidConfigured}
              onClick={async () => {
                const ok = await subscribe();
                if (ok) toast.success("Push ativado");
                else toast.error(error || "Falha ao ativar");
              }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Ativar push
            </Button>
            <Button
              variant="outline"
              disabled={loading || !isSubscribed}
              onClick={async () => {
                const ok = await unsubscribe();
                if (ok) toast.success("Push desativado");
                else toast.error(error || "Falha ao desativar");
              }}
            >
              Desativar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5" />
            Instalar app (PWA)
          </CardTitle>
          <CardDescription>
            Instale para atalho na tela inicial e melhor entrega de push.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={handleInstallHint}>
            <Download className="h-4 w-4" />
            Como instalar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferências</CardTitle>
          <CardDescription>
            Escolha os tipos de alerta. Preferências são salvas na sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {prefsLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando preferências...
            </div>
          ) : (
            PREF_LABELS.map((item, index) => (
              <div key={item.key}>
                {index > 0 && <Separator className="my-1" />}
                <div className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                  <Switch
                    checked={Boolean(values[item.key])}
                    disabled={loading}
                    onCheckedChange={(checked) =>
                      void handleToggle(item.key, checked)
                    }
                    aria-label={item.label}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <PwaInstallDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
      />
    </div>
  );
};

export default NotificationsPage;
