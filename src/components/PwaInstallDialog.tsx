import { Download, Monitor, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/usePwaInstall";

interface PwaInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PwaInstallDialog({ open, onOpenChange }: PwaInstallDialogProps) {
  const { canInstall, isStandalone, promptInstall } = usePwaInstall();

  const handleInstall = async () => {
    const ok = await promptInstall();
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Instalar app
          </DialogTitle>
          <DialogDescription>
            Instale o IAFÉ FINANCE na tela inicial para abrir mais rápido e
            receber alertas com o app fechado.
          </DialogDescription>
        </DialogHeader>

        {isStandalone ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            O app já está instalado neste dispositivo.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {canInstall && (
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-3">
                <p className="mb-2 font-medium text-foreground">
                  Instalação rápida disponível
                </p>
                <Button className="w-full" onClick={() => void handleInstall()}>
                  <Download className="h-4 w-4" />
                  Instalar agora
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Smartphone className="h-4 w-4 text-foreground/80" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Android (Chrome)</p>
                  <p className="text-muted-foreground">
                    Toque no menu ⋮ do Chrome → <strong>Instalar aplicativo</strong>{" "}
                    ou <strong>Adicionar à tela inicial</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Share className="h-4 w-4 text-foreground/80" />
                </div>
                <div>
                  <p className="font-medium text-foreground">iPhone / iPad (Safari)</p>
                  <p className="text-muted-foreground">
                    Toque em <strong>Compartilhar</strong> →{" "}
                    <strong>Adicionar à Tela de Início</strong> → Adicionar.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Monitor className="h-4 w-4 text-foreground/80" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Computador</p>
                  <p className="text-muted-foreground">
                    No Chrome ou Edge, use o ícone de instalação na barra de
                    endereço ou o menu → <strong>Instalar IAFÉ FINANCE</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
