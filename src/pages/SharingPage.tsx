import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check, X, Mail, Loader2, Users } from "lucide-react";

interface OutletContextType {
    user: User;
}

interface Connection {
    id: string;
    requester_id: string;
    recipient_id: string | null;
    email: string;
    status: string;
    created_at: string;
    requester?: {
        email: string;
        full_name?: string;
        avatar_url?: string;
    };
    recipient?: {
        email: string;
        full_name?: string;
        avatar_url?: string;
    };
}

const SharingPage = () => {
    const { user } = useOutletContext<OutletContextType>();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchConnections = async () => {
        try {
            // Fetch connections where I am requester OR recipient
            const { data, error } = await supabase
                .from('account_connections')
                .select(`
          *,
          requester:profiles!account_connections_requester_id_fkey(email, full_name, avatar_url),
          recipient:profiles!account_connections_recipient_id_fkey(email, full_name, avatar_url)
        `)
                .or(`requester_id.eq.${user.id},email.eq.${user.email},recipient_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setConnections(data || []);
        } catch (error) {
            console.error('Error fetching connections:', error);
            toast({
                title: "Erro ao carregar conexões",
                description: "Não foi possível carregar sua lista de compartilhamento.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchConnections();
        }
    }, [user]);

    const handleInvite = async () => {
        if (!inviteEmail) return;

        setInviting(true);
        try {
            const { error } = await supabase.functions.invoke('invite-user', {
                body: { email: inviteEmail }
            });

            if (error) throw error;

            toast({
                title: "Convite enviado!",
                description: `Um e-mail foi enviado para ${inviteEmail}.`,
            });
            setInviteEmail("");
            setIsInviteOpen(false);
            fetchConnections();
        } catch (error: any) {
            console.error('Error inviting user:', error);
            let msg = "Erro ao enviar convite.";
            try {
                const body = JSON.parse(error.message);
                if (body.error) msg = body.error;
            } catch (e) {
                // ignore
            }

            toast({
                title: "Erro",
                description: msg,
                variant: "destructive",
            });
        } finally {
            setInviting(false);
        }
    };

    const handleRespond = async (invitationId: string, action: 'accept' | 'reject') => {
        setProcessingId(invitationId);
        try {
            const { error } = await supabase.functions.invoke('respond-invitation', {
                body: { invitationId, action }
            });

            if (error) throw error;

            toast({
                title: action === 'accept' ? "Convite aceito!" : "Convite recusado",
                description: action === 'accept'
                    ? "Agora vocês compartilham o acesso financeiro."
                    : "O convite foi removido.",
            });
            fetchConnections();
        } catch (error) {
            console.error('Error responding to invitation:', error);
            toast({
                title: "Erro",
                description: "Não foi possível processar sua resposta.",
                variant: "destructive",
            });
        } finally {
            setProcessingId(null);
        }
    };

    const activeConnections = connections.filter(c => c.status === 'accepted');
    const receivedInvitations = connections.filter(c => c.status === 'pending' && c.email === user.email);
    const sentInvitations = connections.filter(c => c.status === 'pending' && c.requester_id === user.id);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-32 lg:pb-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Compartilhamento de Conta</h1>
                    <p className="text-muted-foreground mt-1">Convide pessoas para compartilhar despesas e receitas.</p>
                </div>

                <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Convidar
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Convidar Usuário</DialogTitle>
                            <DialogDescription>
                                Digite o e-mail da pessoa com quem você deseja compartilhar suas finanças.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Input
                                    placeholder="exemplo@email.com"
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Cancelar</Button>
                            <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
                                {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Enviar Convite
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Received Invitations */}
            {receivedInvitations.length > 0 && (
                <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
                            <Mail className="h-5 w-5" />
                            Convites Recebidos
                        </CardTitle>
                        <CardDescription>
                            Pessoas querendo compartilhar finanças com você.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {receivedInvitations.map(invite => (
                                <div key={invite.id} className="flex items-center justify-between bg-white dark:bg-background p-4 rounded-lg shadow-sm border">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={invite.requester?.avatar_url} />
                                            <AvatarFallback>{invite.requester?.email?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{invite.requester?.full_name || 'Usuário'}</p>
                                            <p className="text-sm text-muted-foreground">{invite.requester?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRespond(invite.id, 'reject')}
                                            disabled={processingId === invite.id}
                                        >
                                            Recusar
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleRespond(invite.id, 'accept')}
                                            disabled={processingId === invite.id}
                                        >
                                            {processingId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Active Connections */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Conexões Ativas
                    </CardTitle>
                    <CardDescription>
                        Pessoas com acesso compartilhado às suas finanças.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {activeConnections.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Você ainda não compartilha sua conta com ninguém.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Desde</TableHead>
                                    {/* <TableHead className="text-right">Ações</TableHead> */}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeConnections.map(conn => {
                                    const isRequester = conn.requester_id === user.id;
                                    const otherUser = isRequester ? conn.recipient : conn.requester;

                                    return (
                                        <TableRow key={conn.id}>
                                            <TableCell className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={otherUser?.avatar_url} />
                                                    <AvatarFallback>{otherUser?.email?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{otherUser?.full_name || 'Usuário'}</span>
                                                    <span className="text-xs text-muted-foreground">{otherUser?.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    Ativo
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(conn.created_at).toLocaleDateString()}
                                            </TableCell>
                                            {/* <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell> */}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Sent Invitations */}
            {sentInvitations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Convites Enviados</CardTitle>
                        <CardDescription>
                            Convites aguardando resposta.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>E-mail</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Enviado em</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sentInvitations.map(invite => (
                                    <TableRow key={invite.id}>
                                        <TableCell>{invite.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">Pendente</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(invite.created_at).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default SharingPage;
