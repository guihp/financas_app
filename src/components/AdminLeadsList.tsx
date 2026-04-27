import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, UserX, Clock, CreditCard, Gift, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanCard {
    id: string;
    name: string;
    email?: string;
    phone: string;
    date: string;
    tag?: string;
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
            // 1. Fetch global profiles
            const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            const profileEmails = new Set(profiles?.map(p => p.email?.toLowerCase()));
            const profileUserIds = new Set(profiles?.map(p => p.user_id));

            // 2. Fetch partial leads
            const { data: partialLeads } = await supabase.from('partial_leads').select('*').order('updated_at', { ascending: false });
            
            // 3. Fetch Pending Registrations
            const { data: pendingRegs } = await supabase.from('pending_registrations').select('*').order('created_at', { ascending: false });

            // 4. Fetch Subscriptions (without implicit join due to missing FK constraint)
            const { data: subscriptions, error: subsError } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
            if (subsError) console.error("Error fetching subscriptions:", subsError);
            
            // 5. Fetch Desistentes
            const { data: desistentes } = await supabase.from('desistentes').select('*').order('canceled_at', { ascending: false });

            // --- BUILD COLUMNS ---
            
            // Col 1: Formulário Incompleto (Partial Leads not in profiles and not in pending regs by email or phone)
            const pendingRegEmails = new Set(pendingRegs?.map(pr => pr.email?.toLowerCase()));
            const pendingRegPhones = new Set(pendingRegs?.filter(pr => pr.phone).map(pr => pr.phone));
            const profilePhones = new Set(profiles?.filter(p => p.phone).map(p => p.phone));
            
            const c1: KanbanCard[] = [];
            partialLeads?.forEach(pl => {
                const hasEmail = profileEmails.has(pl.email?.toLowerCase()) || pendingRegEmails.has(pl.email?.toLowerCase());
                const hasPhone = pl.phone && (profilePhones.has(pl.phone) || pendingRegPhones.has(pl.phone));
                
                if (!hasEmail && !hasPhone) {
                    c1.push({
                        id: pl.id,
                        name: pl.full_name || "Sem Nome",
                        email: pl.email,
                        phone: pl.phone || "",
                        date: pl.updated_at
                    });
                }
            });

            // Col 2: Abandonados (Trial/Checkout) 
            // - pending_registrations that are not paid OR profiles without any active subscription
            // - subscriptions where trial expired and they haven't paid
            
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
            
            // Add pending regs that never became a profile
            pendingRegs?.forEach(pr => {
                if (pr.status !== 'paid' && !profileEmails.has(pr.email?.toLowerCase())) {
                    c2.push({
                        id: pr.id,
                        name: pr.full_name || "Sem Nome",
                        email: pr.email,
                        phone: pr.phone || "",
                        date: pr.created_at,
                        tag: pr.payment_method === 'CREDIT_CARD' ? 'Cartão Rejeitado' : 'Pix Pendente'
                    });
                }
            });
            // Add profiles that have no active sub and are not explicitly cancelled
            profiles?.forEach(p => {
                if (!activeSubUserIds.has(p.user_id) && !canceledUserIds.has(p.user_id)) {
                    // check if they have inactive subs
                    const hasInactive = subscriptions?.some(s => s.user_id === p.user_id);
                    if (!hasInactive) {
                        c2.push({
                            id: p.user_id,
                            name: p.full_name || "Sem Nome",
                            email: p.email,
                            phone: p.phone || "",
                            date: p.created_at,
                            tag: 'Perfil Sem Pagto'
                        });
                    }
                }
            });

            // Col 3: Nos 7 Dias Gratuitos (is_trial = true & status = active)
            const c3: KanbanCard[] = [];
            // Col 4: Pagantes Oficiais (is_trial = false & status = active)
            const c4: KanbanCard[] = [];
            // Col 5: Cancelados (Desistentes + Subscriptions Inactive)
            const c5: KanbanCard[] = [];
            
            subscriptions?.forEach(s => {
                const isActiveStatus = s.status === 'active' || s.status === 'ACTIVE';
                const isExpiredTrial = s.is_trial && s.trial_ends_at && new Date(s.trial_ends_at) < now;
                const periodEnd = s.current_period_end ? new Date(s.current_period_end) : null;
                if (periodEnd) periodEnd.setHours(0, 0, 0, 0);
                const hasActivePeriod = !!periodEnd && periodEnd >= today;
                
                if (isActiveStatus) {
                    const prof = profiles?.find(p => p.user_id === s.user_id);
                    const card = {
                        id: s.id,
                        name: prof?.full_name || "Sem Nome",
                        email: prof?.email,
                        phone: prof?.phone || "",
                        date: s.created_at,
                        tag: s.is_trial ? 'Trial' : 'Assinante'
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
                    tag: 'Desistente'
                });
            });
            subscriptions?.forEach(s => {
                const isActiveStatus = s.status === 'active' || s.status === 'ACTIVE';
                // Expired trials already pushed to C2
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
                            : 'Inativo'
                    });
                }
            });

            // Sort all by date desc
            const sorter = (a: KanbanCard, b: KanbanCard) => new Date(b.date).getTime() - new Date(a.date).getTime();

            setCol1(c1.sort(sorter));
            setCol2(c2.sort(sorter));
            setCol3(c3.sort(sorter));
            setCol4(c4.sort(sorter));
            setCol5(c5.sort(sorter));

        } catch (error) {
            console.error("Erro ao buscar leads do funil:", error);
        } finally {
            setLoading(false);
        }
    };

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

    const KanbanColumn = ({ title, icon, items, colorClass }: { title: string, icon: React.ReactNode, items: KanbanCard[], colorClass: string }) => (
        <div className="flex-shrink-0 w-[300px] flex flex-col bg-muted/20 border rounded-xl overflow-hidden snap-center">
            <div className={`p-4 border-b flex items-center gap-2 ${colorClass} bg-opacity-10`}>
                {icon}
                <h3 className="font-semibold text-sm flex-1">{title}</h3>
                <Badge variant="secondary" className="font-mono">{items.length}</Badge>
            </div>
            <div className="p-3 flex flex-col gap-3 overflow-y-auto max-h-[600px] customized-scrollbar">
                {items.length === 0 ? (
                    <p className="text-muted-foreground text-xs text-center py-8">Vazio</p>
                ) : (
                    items.map(item => (
                        <Card key={item.id} className="cursor-default hover:border-primary/50 transition-colors">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="text-sm font-semibold truncate" title={item.name}>{item.name}</h4>
                                    {item.tag && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                                            {item.tag}
                                        </Badge>
                                    )}
                                </div>
                                {item.email && <p className="text-xs text-muted-foreground truncate" title={item.email}>{item.email}</p>}
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(item.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                </div>
                                <div className="pt-2 border-t flex justify-between items-center">
                                    <span className="text-xs font-mono">{formatPhone(item.phone)}</span>
                                    {item.phone && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-md hover:bg-primary/20"
                                            onClick={() => copyToClipboard(item.phone)}
                                            title="Copiar Celular"
                                        >
                                            <Copy className="h-3 w-3" />
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
        return <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted/20 rounded mb-6" />
            <div className="flex gap-4">
                <div className="h-[400px] w-[300px] bg-muted/20 rounded-xl" />
                <div className="h-[400px] w-[300px] bg-muted/20 rounded-xl" />
                <div className="h-[400px] w-[300px] bg-muted/20 rounded-xl" />
            </div>
        </div>;
    }

    return (
        <div className="space-y-4 w-full min-w-0 flex flex-col">
            <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <UserX className="h-5 w-5 text-orange-500" />
                    Funil de Conversão e Abandonos
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Visualize em qual etapa os leads estão parando e faça contato ativo pelo WhatsApp.
                </p>
            </div>

            <div className="flex overflow-x-auto gap-4 pb-4 snap-x w-full max-w-full">
                <KanbanColumn 
                    title="Formulário Incompleto" 
                    icon={<AlertCircle className="h-4 w-4 text-orange-500" />} 
                    items={col1} 
                    colorClass="text-orange-500"
                />
                <KanbanColumn 
                    title="Abandonos (Trial/Checkout)" 
                    icon={<CreditCard className="h-4 w-4 text-rose-500" />} 
                    items={col2} 
                    colorClass="text-rose-500"
                />
                <KanbanColumn 
                    title="No Trial (7 Dias)" 
                    icon={<Gift className="h-4 w-4 text-primary" />} 
                    items={col3} 
                    colorClass="text-primary"
                />
                <KanbanColumn 
                    title="Pagantes Oficiais" 
                    icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} 
                    items={col4} 
                    colorClass="text-green-500"
                />
                <KanbanColumn 
                    title="Cancelados/Inativos" 
                    icon={<UserX className="h-4 w-4 text-muted-foreground" />} 
                    items={col5} 
                    colorClass="text-muted-foreground"
                />
            </div>
        </div>
    );
};
