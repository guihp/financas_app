import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Plus, Power, PowerOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const AdminPromotionalCodes = () => {
    const [codes, setCodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // New Code form state
    const [newCode, setNewCode] = useState("");
    const [newDiscount, setNewDiscount] = useState("20");
    const [newInfluencer, setNewInfluencer] = useState("");
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        fetchCodes();
    }, []);

    const fetchCodes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('promotional_codes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCodes(data || []);
        } catch (error: any) {
            console.error('Error fetching promo codes:', error);
            toast.error('Erro ao carregar códigos promocionais: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCode.trim()) {
            toast.error("O código é obrigatório");
            return;
        }

        try {
            const { error } = await supabase
                .from("promotional_codes")
                .insert({
                    code: newCode.toUpperCase().trim(),
                    discount_percentage: Number(newDiscount),
                    influencer_name: newInfluencer.trim() || null,
                    active: isActive
                });

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toast.error("Este código promocional já existe.");
                } else {
                    throw error;
                }
                return;
            }

            toast.success("Código promocional criado com sucesso!");
            setIsDialogOpen(false);

            // Reset form
            setNewCode("");
            setNewDiscount("20");
            setNewInfluencer("");
            setIsActive(true);

            fetchCodes();
        } catch (error: any) {
            console.error('Error creating promo code:', error);
            toast.error("Erro ao criar código: " + error.message);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("promotional_codes")
                .update({ active: !currentStatus })
                .eq("id", id);

            if (error) throw error;

            toast.success(`Código promocional ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
            fetchCodes();
        } catch (error: any) {
            console.error("Error toggling promo code status:", error);
            toast.error("Erro ao alterar status: " + error.message);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Códigos Promocionais</CardTitle>
                    <CardDescription>
                        Gerencie descontos e vínculos com influenciadores.
                    </CardDescription>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Novo Código
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Criar Código Promocional</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateCode} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Código <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Gift className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="code"
                                        placeholder="Ex: IAFE20"
                                        value={newCode}
                                        onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                                        className="pl-9 uppercase"
                                        maxLength={20}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="discount">Desconto (%) <span className="text-red-500">*</span></Label>
                                <Input
                                    id="discount"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={newDiscount}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        if (val <= 100) {
                                            setNewDiscount(e.target.value);
                                        }
                                    }}
                                    className="font-mono"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="influencer">Vincular Influenciador (Opcional)</Label>
                                <Input
                                    id="influencer"
                                    placeholder="Nome do influenciador ou campanha"
                                    value={newInfluencer}
                                    onChange={(e) => setNewInfluencer(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                    id="active"
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                />
                                <Label htmlFor="active">{isActive ? 'Código Ativo' : 'Código Inativo'}</Label>
                            </div>

                            <DialogFooter className="pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    Criar Código
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Desconto</TableHead>
                                <TableHead>Influenciador</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {codes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                        Nenhum código promocional encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                codes.map((code) => (
                                    <TableRow key={code.id} className={!code.active ? "opacity-60 bg-muted/20" : ""}>
                                        <TableCell className="font-mono font-medium">
                                            {code.code}
                                        </TableCell>
                                        <TableCell>
                                            {code.discount_percentage}%
                                        </TableCell>
                                        <TableCell>
                                            {code.influencer_name || <span className="text-muted-foreground italic">Nenhum</span>}
                                        </TableCell>
                                        <TableCell>
                                            {code.active ? (
                                                <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>
                                            ) : (
                                                <Badge variant="secondary">Inativo</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={code.active ? "text-red-500 mb-0 hover:text-red-600 hover:bg-red-500/10" : "text-green-500 mb-0 hover:text-green-600 hover:bg-green-500/10"}
                                                onClick={() => handleToggleStatus(code.id, code.active)}
                                                title={code.active ? "Desativar Código" : "Ativar Código"}
                                            >
                                                {code.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
