import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, UserX, Clock, CreditCard, Gift, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminFunnelSummary } from "@/components/admin/AdminFunnelSummary";
import {
    AdminPaymentMethodBadge,
    buildPaymentMethodByEmail,
    resolvePaidPaymentMethod,
} from "@/components/admin/AdminPaymentMethodBadge";
import { cn } from "@/lib/utils";

interface KanbanCard {
    id: string;
    name: string;
    email?: string;
    phone: string;
    date: string;
    tag?: string;
    paymentMethod?: string | null;
}

export const AdminLeadsList = () => {
    const [loading, setLoading] = useState(true);

    const [col1, setCol1] = useState<KanbanCard[]>([]);
    const [col2, setCol2] = useState<KanbanCard[]>([]);
    const [col3, setCol3] = useState<KanbanCard[]>([]);
    const [col4, setCol4] = useState<KanbanCard[]>([]);
    const [col5, setCol5] = useState<KanbanCard[]>([]);

    useEffect(() => {
        fetchKanbanData();
    }, []);

    const fetchKanbanData = async () => {
        setLoading(true);
        try {
            const [
                { data: profiles, error: profilesError },
                { data: partialLeads, error: partialError },
                { data: pendingRegs, error: pendingError },
                { data: subscriptions, error: subsError },
                { data: desistentes, error: desistentesError },
            ] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                supabase.from('partial_leads').select('*').order('updated_at', { ascending: false }),
                supabase.from('pending_registrations').select('*').order('created_at', { ascending: false }),
                supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
                supabase.from('desistentes').select('*').order('canceled_at', { ascending: false }),
            ]);

            if (profilesError || partialError || pendingError || subsError || desistentesError) {
                console.error("Erro ao buscar dados do funil:", {
                    profilesError,
                    partialError,
                    pendingError,
                    subsError,
                    desistentesError,
                });
                toast.error("Não foi possível carregar o funil de conversão.");
            }

            const profileEmails = new Set(profiles?.map(p => p.email?.toLowerCase()));

            const paymentMethodByEmail = buildPaymentMethodByEmail(pendingRegs || []);

            const resolvePaymentMethod = (email?: string, asaasSubscriptionId?: string | null) =>
                resolvePaidPaymentMethod(email, paymentMethodByEmail, asaasSubscriptionId);

            const pendingRegEmails = new Set(pendingRegs?.map(pr => pr.email?.toLowerCase()));
            const pendingRegPhones = new Set(pendingRegs?.filter(pr => pr.phone).map(pr => pr.phone));
            const profilePhones = new Set(profiles?.filter(p => p.phone).map(p => p.phone));

            // Col1: só leads ainda sem profile e sem pending (pending vai para Abandonos)
            const c1: KanbanCard[] = [];
            partialLeads?.forEach(pl => {
                const emailKey = pl.email?.toLowerCase();
                const hasProfile = profileEmails.has(emailKey) || (pl.phone && profilePhones.has(pl.phone));
                const hasPending = pendingRegEmails.has(emailKey) || (pl.phone && pendingRegPhones.has(pl.phone));

                if (!hasProfile && !hasPending) {
                    c1.push({
                        id: pl.id,
                        name: pl.full_name || "Sem Nome",
                        email: pl.email,
                        phone: pl.phone || "",
                        date: pl.updated_at || pl.created_at,
                        tag: 'Formulário incompleto',
                    });
                }
            });

            const now = new Date();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const activeSubUserIds = new Set(subscriptions?.filter(s => {
                const isActive = s.status === 'active' || s.status === 'ACTIVE';
                if (!isActive) return false;

                if (s.is_trial) {
                    const isExpiredTrial = s.trial_ends_at && new Date(s.trial_ends_at) < now;
                    return !isExpiredTrial;
                }

                const periodEnd = s.current_period_end ? new Date(s.current_period_end) : null;
                if (periodEnd) periodEnd.setHours(0, 0, 0, 0);
                return !!periodEnd && periodEnd >= today;
            }).map(s => s.user_id));

            const canceledUserIds = new Set(desistentes?.map(d => d.user_id));
            const c2: KanbanCard[] = [];
            const pendingEmailsInCol2 = new Set<string>();

            // Abandonos: pending não pago — inclusive se já existir profile (pagamento pendente)
            // Um card por e-mail (mais recente), para não poluir o Kanban
            const unpaidPending = [...(pendingRegs || [])]
                .filter((pr) => pr.status !== 'paid')
                .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

            unpaidPending.forEach(pr => {
                const emailKey = pr.email?.toLowerCase();
                if (emailKey && pendingEmailsInCol2.has(emailKey)) return;

                const alreadyHasProfile = emailKey ? profileEmails.has(emailKey) : false;
                const methodTag = pr.payment_method === 'CREDIT_CARD' ? 'Cartão Rejeitado' : 'Pix Pendente';

                c2.push({
                    id: pr.id,
                    name: pr.full_name || "Sem Nome",
                    email: pr.email,
                    phone: pr.phone || "",
                    date: pr.updated_at || pr.created_at,
                    tag: alreadyHasProfile ? `Pagamento pendente (já tem conta)` : methodTag,
                });
                if (emailKey) pendingEmailsInCol2.add(emailKey);
            });

            profiles?.forEach(p => {
                if (!activeSubUserIds.has(p.user_id) && !canceledUserIds.has(p.user_id)) {
                    const emailKey = p.email?.toLowerCase();
                    // Evita duplicar quem já está em Abandonos via pending_registrations
                    if (emailKey && pendingEmailsInCol2.has(emailKey)) return;

                    const hasInactive = subscriptions?.some(s => s.user_id === p.user_id);
                    if (!hasInactive) {
                        c2.push({
                            id: p.user_id,
                            name: p.full_name || "Sem Nome",
                            email: p.email,
                            phone: p.phone || "",
                            date: p.created_at,
                            tag: 'Perfil Sem Pagto',
                        });
                    }
                }
            });

            const c3: KanbanCard[] = [];
            const c4: KanbanCard[] = [];
            const c5: KanbanCard[] = [];

            subscriptions?.forEach(s => {
                const isActiveStatus = s.status === 'active' || s.status === 'ACTIVE';
                const isExpiredTrial = s.is_trial && s.trial_ends_at && new Date(s.trial_ends_at) < now;
                const periodEnd = s.current_period_end ? new Date(s.current_period_end) : null;
                if (periodEnd) periodEnd.setHours(0, 0, 0, 0);
                const hasActivePeriod = !!periodEnd && periodEnd >= today;

                if (isActiveStatus) {
                    const prof = profiles?.find(p => p.user_id === s.user_id);
                    const card: KanbanCard = {
                        id: s.id,
                        name: prof?.full_name || "Sem Nome",
                        email: prof?.email,
                        phone: prof?.phone || "",
                        date: s.created_at,
                        tag: s.is_trial ? 'Trial' : 'Assinante',
                        paymentMethod: !s.is_trial
                            ? resolvePaymentMethod(prof?.email, s.asaas_subscription_id)
                            : undefined,
                    };

                    if (isExpiredTrial) {
                        card.tag = 'Trial Expirado';
                        c2.push(card);
                    } else if (s.is_trial) {
                        c3.push(card);
                    } else if (hasActivePeriod) {
                        c4.push(card);
                    } else {
                        card.tag = 'Periodo Expirado';
                        c5.push(card);
                    }
                }
            });

            desistentes?.forEach(d => {
                c5.push({
                    id: d.id,
                    name: d.full_name || "Sem Nome",
                    email: d.email,
                    phone: d.phone || "",
                    date: d.canceled_at,
                    tag: 'Desistente',
                });
            });

            subscriptions?.forEach(s => {
                const isActiveStatus = s.status === 'active' || s.status === 'ACTIVE';
                if (!isActiveStatus && !canceledUserIds.has(s.user_id)) {
                    const prof = profiles?.find(p => p.user_id === s.user_id);
                    c5.push({
                        id: s.id,
                        name: prof?.full_name || "Sem Nome",
                        email: prof?.email,
                        phone: prof?.phone || "",
                        date: s.created_at,
                        tag: (s.status === 'canceled' || s.status === 'CANCELED' || s.status === 'cancelled' || s.status === 'CANCELLED')
                            ? 'Cancelado'
                            : 'Inativo',
                    });
                }
            });

            const sorter = (a: KanbanCard, b: KanbanCard) => new Date(b.date).getTime() - new Date(a.date).getTime();

            setCol1(c1.sort(sorter));
            setCol2(c2.sort(sorter));
            setCol3(c3.sort(sorter));
            setCol4(c4.sort(sorter));
            setCol5(c5.sort(sorter));

        } catch (error) {
            console.error("Erro ao buscar leads do funil:", error);
            toast.error("Não foi possível carregar o funil de conversão.");
        } finally {
            setLoading(false);
        }
    };

    const funnelStats = useMemo(() => {
        const inFunnel = col1.length + col2.length;
        const weekAgo = subDays(new Date(), 7).getTime();
        const recentUpdates = [...col1, ...col2].filter(
            (c) => new Date(c.date).getTime() >= weekAgo
        ).length;
        return {
            leads: inFunnel + col3.length + col4.length,
            trial: col3.length,
            paying: col4.length,
            pixPaying: col4.filter((c) => c.paymentMethod === "PIX").length,
            cardPaying: col4.filter((c) => c.paymentMethod === "CREDIT_CARD").length,
            recentUpdates,
        };
    }, [col1, col2, col3, col4]);

    const formatPhone = (phone: string) => {
        if (!phone) return "N/A";
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
        }
        return phone;
    };

    const copyToClipboard = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
    };

    const KanbanColumn = ({
        title,
        subtitle,
        icon,
        items,
        accent,
        headerExtra,
    }: {
        title: string;
        subtitle?: string;
        icon: React.ReactNode;
        items: KanbanCard[];
        accent: string;
        headerExtra?: React.ReactNode;
    }) => (
        <div className="flex-shrink-0 w-[min(100%,320px)] flex flex-col rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm overflow-hidden snap-center shadow-sm">
            <div className={cn("p-4 border-b border-border/60 bg-gradient-to-r", accent)}>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-black/10 p-2">{icon}</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm leading-tight">{title}</h3>
                            <Badge variant="secondary" className="font-mono shrink-0">{items.length}</Badge>
                        </div>
                        {subtitle && (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{subtitle}</p>
                        )}
                        {headerExtra}
                    </div>
                </div>
            </div>
            <div className="p-3 flex flex-col gap-3 overflow-y-auto max-h-[min(70vh,640px)] customized-scrollbar">
                {items.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-xl border border-dashed border-border/60 bg-muted/10">
                        <p className="text-muted-foreground text-xs">Nenhum lead nesta etapa</p>
                    </div>
                ) : (
                    items.map(item => (
                        <Card key={item.id} className="border-border/70 bg-background/80 hover:border-primary/40 hover:shadow-md transition-all">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="text-sm font-semibold truncate" title={item.name}>{item.name}</h4>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        {item.tag && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                                {item.tag}
                                            </Badge>
                                        )}
                                        {item.paymentMethod && (
                                            <AdminPaymentMethodBadge method={item.paymentMethod} size="xs" />
                                        )}
                                    </div>
                                </div>
                                {item.email && (
                                    <p className="text-xs text-muted-foreground truncate" title={item.email}>{item.email}</p>
                                )}
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    {format(new Date(item.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                </div>
                                <div className="pt-2 border-t border-border/50 flex justify-between items-center gap-2">
                                    <span className="text-xs font-mono truncate">{formatPhone(item.phone)}</span>
                                    {item.phone && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-md hover:bg-primary/15 shrink-0"
                                            onClick={() => copyToClipboard(item.phone)}
                                            title="Copiar Celular"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="h-28 bg-muted/20 rounded-2xl" />
                <div className="flex gap-4 overflow-hidden">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-[420px] w-[320px] bg-muted/20 rounded-2xl shrink-0" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full min-w-0 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserX className="h-5 w-5 text-orange-500" />
                        Funil de Conversão e Abandonos
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Acompanhe cada etapa do checkout, identifique abandonos e veja como cada assinante pagou (PIX ou cartão).
                    </p>
                    {funnelStats.recentUpdates > 0 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                            {funnelStats.recentUpdates} lead{funnelStats.recentUpdates === 1 ? "" : "s"} atualizado
                            {funnelStats.recentUpdates === 1 ? "" : "s"} nos últimos 7 dias (Formulário Incompleto + Abandonos)
                        </p>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={fetchKanbanData} className="shrink-0 gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Atualizar
                </Button>
            </div>

            <Card className="border-border/80 bg-gradient-to-br from-card to-orange-500/5">
                <CardContent className="p-4 sm:p-6">
                    <AdminFunnelSummary
                        leads={funnelStats.leads}
                        trial={funnelStats.trial}
                        paying={funnelStats.paying}
                    />
                    {funnelStats.paying > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap gap-3">
                            <span className="text-xs text-muted-foreground">Pagantes oficiais:</span>
                            <AdminPaymentMethodBadge method="PIX" />
                            <span className="text-xs font-semibold tabular-nums">{funnelStats.pixPaying}</span>
                            <AdminPaymentMethodBadge method="CREDIT_CARD" />
                            <span className="text-xs font-semibold tabular-nums">{funnelStats.cardPaying}</span>
                            {funnelStats.paying - funnelStats.pixPaying - funnelStats.cardPaying > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    +{funnelStats.paying - funnelStats.pixPaying - funnelStats.cardPaying} sem método identificado
                                </span>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex overflow-x-auto gap-4 pb-2 snap-x w-full max-w-full no-scrollbar">
                <KanbanColumn
                    title="Formulário Incompleto"
                    subtitle="Pararam antes de concluir o cadastro"
                    icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
                    items={col1}
                    accent="from-orange-500/15 to-transparent"
                />
                <KanbanColumn
                    title="Abandonos (Trial/Checkout)"
                    subtitle="Checkout pendente ou trial expirado"
                    icon={<CreditCard className="h-4 w-4 text-rose-500" />}
                    items={col2}
                    accent="from-rose-500/15 to-transparent"
                />
                <KanbanColumn
                    title="No Trial (7 Dias)"
                    subtitle="Cartão cadastrado ou período gratuito ativo"
                    icon={<Gift className="h-4 w-4 text-primary" />}
                    items={col3}
                    accent="from-primary/15 to-transparent"
                />
                <KanbanColumn
                    title="Pagantes Oficiais"
                    subtitle="Assinatura ativa e paga"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    items={col4}
                    accent="from-emerald-500/15 to-transparent"
                    headerExtra={
                        col4.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {funnelStats.pixPaying > 0 && <AdminPaymentMethodBadge method="PIX" size="xs" />}
                                {funnelStats.cardPaying > 0 && <AdminPaymentMethodBadge method="CREDIT_CARD" size="xs" />}
                            </div>
                        ) : undefined
                    }
                />
                <KanbanColumn
                    title="Cancelados/Inativos"
                    subtitle="Desistências e assinaturas encerradas"
                    icon={<UserX className="h-4 w-4 text-muted-foreground" />}
                    items={col5}
                    accent="from-muted/40 to-transparent"
                />
            </div>
        </div>
    );
};
