import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

const DISMISS_KEY = "iafe-pwa-install-dismissed";

export function PwaInstallBanner() {
  const { canInstall, isStandalone, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (isStandalone) return;
    if (canInstall) setVisible(true);
  }, [canInstall, isStandalone]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    await promptInstall();
    dismiss();
  };

  if (!visible || !canInstall) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 lg:bottom-6">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border bg-card p-3 text-card-foreground shadow-lg">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instalar IAFÉ FINANCE</p>
          <p className="text-xs text-muted-foreground">
            Acesse mais rápido e receba alertas mesmo com o app fechado.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => void install()}>
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={dismiss}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
