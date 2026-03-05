import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Clock, Phone, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AdminLeadsList = () => {
    const [leadsSemOtp, setLeadsSemOtp] = useState<any[]>([]);
    const [leadsSemPagar, setLeadsSemPagar] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            // 1. Leads sem OTP (Abandoned at first step)
            const { data: noOtpData, error: noOtpError } = await supabase
                .from('otp_codes')
                .select('*')
                .eq('verified', false)
                .order('created_at', { ascending: false })
                .limit(50);

            if (noOtpError) throw noOtpError;
            setLeadsSemOtp(noOtpData || []);

            // 2. Leads que criaram perfil (passaram OTP) mas não têm assinatura ativa
            // Fazemos um fetch de profiles que não tenham assinatura "active"
            // (Para simplificar no front, buscamos users e conferimos as subscriptions)
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('user_id, full_name, created_at, phone')
                .order('created_at', { ascending: false })
                .limit(200);

            if (profilesError) throw profilesError;

            // Busca as assinaturas ativas para cruzar
            const { data: activeSubs, error: subsError } = await supabase
                .from('subscriptions')
                .select('user_id')
                .eq('status', 'active');

            if (subsError) throw subsError;

            const activeUserIds = new Set(activeSubs?.map(sub => sub.user_id));

            // Filtra perfis que NÃO estão na lista de ativos e têm telefone (indica que passaram do inicio)
            const droppedCheckout = (profilesData || [])
                .filter(p => !activeUserIds.has(p.user_id))
                .slice(0, 50); // limitamos aos últimos 50

            setLeadsSemPagar(droppedCheckout);
        } catch (error) {
            console.error("Erro ao buscar leads:", error);
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

    if (loading) {
        return <div className="animate-pulse space-y-4">
            <div className="h-40 bg-muted/20 rounded-xl" />
            <div className="h-40 bg-muted/20 rounded-xl" />
        </div>;
    }

    return (
        <div className="space-y-6">
            <Card className="border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <UserX className="h-5 w-5 text-destructive" />
                        Abandonos no Checkout (Falta Pagar)
                    </CardTitle>
                    <CardDescription>
                        Passaram do OTP e criaram o perfil, mas não possuem assinatura ativa. Ótimo público para remarketing e suporte manual.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {leadsSemPagar.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">Nenhum abandono de checkout recente.</p>
                    ) : (
                        <div className="rounded-md border border-border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead>Data</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Telefone</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leadsSemPagar.map((lead) => (
                                        <TableRow key={lead.user_id || lead.created_at}>
                                            <TableCell className="text-sm">
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(lead.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {lead.full_name || "Sem Nome"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="font-mono bg-background">
                                                        {formatPhone(lead.phone)}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-8 shadow-sm flex items-center gap-1 ml-auto"
                                                    onClick={() => copyToClipboard(lead.phone)}
                                                    disabled={!lead.phone}
                                                >
                                                    <Phone className="h-3 w-3" />
                                                    <span className="hidden sm:inline text-xs">Copiar Celular</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border opacity-90">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        Leads Frios (Não enviaram OTP)
                    </CardTitle>
                    <CardDescription>
                        Inseriram o celular no primeiro passo mas não confirmaram o código.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {leadsSemOtp.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">Nenhum lead frio recente.</p>
                    ) : (
                        <div className="rounded-md border border-border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead>Data / Hora</TableHead>
                                        <TableHead>Celular Inserido</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leadsSemOtp.map((lead) => (
                                        <TableRow key={lead.id}>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm")}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono bg-background text-muted-foreground">
                                                    {formatPhone(lead.phone_number)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
