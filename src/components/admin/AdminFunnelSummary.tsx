import { ArrowRight, CircleUser, Gift, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStep {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}

interface AdminFunnelSummaryProps {
  leads: number;
  trial: number;
  paying: number;
  className?: string;
}

export function AdminFunnelSummary({ leads, trial, paying, className }: AdminFunnelSummaryProps) {
  const top = Math.max(leads, trial, paying, 1);

  const steps: FunnelStep[] = [
    {
      label: "No funil",
      value: leads,
      icon: <CircleUser className="h-4 w-4" />,
      accent: "from-blue-500/20 to-blue-500/5 border-blue-500/25 text-blue-400",
    },
    {
      label: "Em trial",
      value: trial,
      icon: <Gift className="h-4 w-4" />,
      accent: "from-primary/20 to-primary/5 border-primary/25 text-primary",
    },
    {
      label: "Pagantes",
      value: paying,
      icon: <TrendingUp className="h-4 w-4" />,
      accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-400",
    },
  ];

  const convTrial = leads > 0 ? Math.round((trial / leads) * 100) : 0;
  const convPay = trial > 0 ? Math.round((paying / trial) * 100) : 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-stretch">
        {steps.map((step, index) => (
          <div key={step.label} className="contents">
            <div
              className={cn(
                "rounded-xl border bg-gradient-to-br p-4 shadow-sm",
                step.accent
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  {step.label}
                </span>
                {step.icon}
              </div>
              <div className="text-3xl font-bold tabular-nums">{step.value}</div>
              <div className="mt-3 h-2 rounded-full bg-black/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-current opacity-60 transition-all duration-500"
                  style={{ width: `${Math.max((step.value / top) * 100, step.value > 0 ? 8 : 0)}%` }}
                />
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="hidden sm:flex flex-col items-center justify-center px-1 text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                <span className="text-[10px] font-medium mt-1 tabular-nums">
                  {index === 0 ? `${convTrial}%` : `${convPay}%`}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex sm:hidden justify-center gap-6 text-xs text-muted-foreground">
        <span>Funil → Trial: <strong className="text-foreground">{convTrial}%</strong></span>
        <span>Trial → Pago: <strong className="text-foreground">{convPay}%</strong></span>
      </div>
    </div>
  );
}
