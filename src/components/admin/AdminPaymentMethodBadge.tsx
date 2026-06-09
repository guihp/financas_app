import { CreditCard, QrCode, FileText, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SubscriptionPaymentMethod = "PIX" | "CREDIT_CARD" | "BOLETO" | string | null | undefined;

const METHOD_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  PIX: {
    label: "PIX",
    icon: <QrCode className="h-3 w-3" />,
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  CREDIT_CARD: {
    label: "Cartão",
    icon: <CreditCard className="h-3 w-3" />,
    className: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  BOLETO: {
    label: "Boleto",
    icon: <FileText className="h-3 w-3" />,
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
};

const REGISTRATION_STATUS_PRIORITY: Record<string, number> = {
  registered: 1,
  paid: 2,
  card_registered: 3,
  pending_payment: 4,
  expired: 5,
  cancelled: 6,
};

type PendingRegistrationPayment = {
  email?: string | null;
  payment_method?: string | null;
  created_at?: string;
  status?: string | null;
};

/** Fonte principal no Supabase: `pending_registrations.payment_method` (PIX | CREDIT_CARD | BOLETO). */
export function buildPaymentMethodByEmail(
  registrations: PendingRegistrationPayment[]
): Map<string, string> {
  const grouped = new Map<string, PendingRegistrationPayment[]>();

  for (const reg of registrations) {
    const email = reg.email?.toLowerCase();
    if (!email || !reg.payment_method) continue;
    const list = grouped.get(email) ?? [];
    list.push(reg);
    grouped.set(email, list);
  }

  const map = new Map<string, string>();
  for (const [email, regs] of grouped) {
    const best = [...regs].sort((a, b) => {
      const pa = REGISTRATION_STATUS_PRIORITY[a.status || ""] ?? 99;
      const pb = REGISTRATION_STATUS_PRIORITY[b.status || ""] ?? 99;
      if (pa !== pb) return pa - pb;
      return (
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    })[0];
    if (best.payment_method) map.set(email, best.payment_method);
  }

  return map;
}

/** Fallback: assinatura Asaas ativa indica cadastro via cartão (trial/cobrança recorrente). */
export function resolvePaidPaymentMethod(
  email: string | undefined | null,
  methodByEmail: Map<string, string>,
  asaasSubscriptionId?: string | null
): string | null {
  if (email) {
    const fromRegistration = methodByEmail.get(email.toLowerCase());
    if (fromRegistration) return fromRegistration;
  }

  if (
    asaasSubscriptionId &&
    asaasSubscriptionId !== "trial_extended"
  ) {
    return "CREDIT_CARD";
  }

  return null;
}

export function AdminPaymentMethodBadge({
  method,
  size = "sm",
  showUnknown = false,
  className,
}: {
  method: SubscriptionPaymentMethod;
  size?: "sm" | "xs";
  showUnknown?: boolean;
  className?: string;
}) {
  if (!method) {
    if (!showUnknown) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 font-medium text-muted-foreground",
          size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
          className
        )}
      >
        <HelpCircle className="h-3 w-3" />
        N/D
      </span>
    );
  }

  const config = METHOD_CONFIG[method] ?? {
    label: method,
    icon: <HelpCircle className="h-3 w-3" />,
    className: "bg-muted/50 text-muted-foreground border-border/60",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        config.className,
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
