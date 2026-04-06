import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RefreshCw, CalendarIcon, Power, PowerOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const AdminAppSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const [fullPrice, setFullPrice] = useState("");
    const [promoDiscount, setPromoDiscount] = useState("");
    const [trialDays, setTrialDays] = useState("");
    const [promoDays, setPromoDays] = useState("");
    const [isPromoActive, setIsPromoActive] = useState(false);
    const [enablePromoCode, setEnablePromoCode] = useState(true);
    const [adminPermissions, setAdminPermissions] = useState({
        leads: true,
        users: false,
        promo_codes: false,
        settings: false,
    });
    const { toast } = useToast();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const result = await supabase
                .from("app_settings" as any)
                .select("*")
                .limit(1)
                .single();
            const data: any = result.data;
            const error = result.error;

            if (error && error.code !== "PGRST116") {
                throw error;
            }

            if (data) {
                setSettingsId(data.id);
                setFullPrice(data.product_full_price.toString());
                
                const fullPriceVal = Number(data.product_full_price);
                const promoPriceVal = Number(data.product_promo_price);
                if (fullPriceVal > 0 && promoPriceVal < fullPriceVal) {
                    const discount = Math.round((1 - (promoPriceVal / fullPriceVal)) * 100);
                    setPromoDiscount(discount.toString());
                } else {
                    setPromoDiscount("0");
                }
                
                setTrialDays(data.trial_days.toString());
                if (data.promo_days !== null && data.promo_days !== undefined) {
                    setPromoDays(data.promo_days.toString());
                    setIsPromoActive(data.promo_days > 0);
                }
                if (data.enable_promo_code !== undefined) {
                    setEnablePromoCode(data.enable_promo_code);
                }
                if (data.admin_permissions) {
                    setAdminPermissions({
                        leads: data.admin_permissions.leads ?? true,
                        users: data.admin_permissions.users ?? false,
                        promo_codes: data.admin_permissions.promo_codes ?? false,
                        settings: data.admin_permissions.settings ?? false,
                    });
                }
            }
        } catch (error: any) {
            toast({
                title: "Erro ao buscar configurações",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const fullPriceNum = parseFloat(fullPrice);
            const discountNum = parseFloat(promoDiscount) || 0;
            const calculatedPromoPrice = fullPriceNum - (fullPriceNum * discountNum / 100);

            const updates = {
                product_full_price: fullPriceNum,
                product_promo_price: calculatedPromoPrice,
                trial_days: parseInt(trialDays, 10),
                promo_days: isPromoActive && promoDays ? parseInt(promoDays, 10) : 0,
                enable_promo_code: enablePromoCode,
                admin_permissions: adminPermissions,
            };

            let error;
            if (settingsId) {
                const result: any = await supabase
                    .from("app_settings" as any)
                    .update(updates)
                    .eq("id", settingsId);
                error = result.error;
            } else {
                const result: any = await supabase
                    .from("app_settings" as any)
                    .insert([updates])
                    .select()
                    .single();
                error = result.error;
                if (result.data) {
                    setSettingsId(result.data.id);
                }
            }

            if (error) throw error;

            // Sync plans table with the full price so it stays consistent
            if (!isNaN(fullPriceNum) && fullPriceNum > 0) {
                const { error: planError } = await supabase
                    .from("plans")
                    .update({ price: fullPriceNum, updated_at: new Date().toISOString() } as any)
                    .eq("active", true);
                if (planError) {
                    console.error("Failed to sync plans table:", planError);
                }
            }

            toast({
                title: "Sucesso",
                description: "Configurações salvas corretamente.",
            });
        } catch (error: any) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const [updatingSubs, setUpdatingSubs] = useState(false);

    const handleUpdateSubscriptions = async () => {
        setUpdatingSubs(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

            const { data, error } = await supabase.functions.invoke('update-subscriptions-price', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            toast({
                title: "Assinaturas Atualizadas",
                description: `${data.updated} atualizadas, ${data.alreadyCorrect} já corretas, ${data.errors} erros de ${data.total} total.`,
            });
        } catch (error: any) {
            toast({
                title: "Erro ao atualizar assinaturas",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setUpdatingSubs(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const getPromoEndDateStr = () => {
        if (!promoDays || !isPromoActive) return null;
        const days = parseInt(promoDays, 10);
        if (isNaN(days) || days <= 0) return null;
        return format(addDays(new Date(), days), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    };

    return (
        <div className="max-w-2xl bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6">Valores e Trial do Sistema</h2>
            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="fullPrice">Valor Cheio (R$)</Label>
                        <Input
                            id="fullPrice"
                            type="number"
                            step="0.01"
                            value={fullPrice}
                            onChange={(e) => setFullPrice(e.target.value)}
                            placeholder="Ex: 49.90"
                            required
                        />
                        <p className="text-xs text-muted-foreground">O preço original do produto.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="promoDiscount">Desconto da Promoção Relâmpago (%)</Label>
                        <Input
                            id="promoDiscount"
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={promoDiscount}
                            onChange={(e) => setPromoDiscount(e.target.value)}
                            placeholder="Ex: 20"
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            {fullPrice && promoDiscount ? (
                                <>O valor da promoção será: <strong className="text-emerald-500">{(parseFloat(fullPrice) * (1 - parseFloat(promoDiscount) / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></>
                            ) : "Digite a porcentagem do desconto global."}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="trialDays">Dias de Trial/Promoção</Label>
                        <Input
                            id="trialDays"
                            type="number"
                            step="1"
                            value={trialDays}
                            onChange={(e) => setTrialDays(e.target.value)}
                            placeholder="Ex: 7"
                            required
                        />
                        <p className="text-xs text-muted-foreground">Período gratuito para compras com cartão de crédito.</p>
                    </div>

                    <div className="space-y-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 col-span-1 md:col-span-2 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            {isPromoActive ? <Power className="w-24 h-24" /> : <PowerOff className="w-24 h-24" />}
                        </div>
                        <div className="flex items-center justify-between border-b border-orange-500/20 pb-4 relative z-10">
                            <div>
                                <Label className="text-base text-orange-600 font-bold flex items-center gap-2">
                                    Status da Promoção Relâmpago
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">Ligue para limitar o valor promocional por alguns dias no checkout.</p>
                            </div>
                            <Switch
                                checked={isPromoActive}
                                onCheckedChange={setIsPromoActive}
                                className="data-[state=checked]:bg-orange-500"
                            />
                        </div>

                        {isPromoActive && (
                            <div className="space-y-3 pt-2 relative z-10">
                                <Label htmlFor="promoDays" className="text-sm font-semibold">Duração da Promoção (Dias)</Label>
                                <div className="flex gap-4 items-center">
                                    <Input
                                        id="promoDays"
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={promoDays}
                                        onChange={(e) => setPromoDays(e.target.value)}
                                        placeholder="Ex: 90"
                                        className="w-32 bg-background"
                                        required={isPromoActive}
                                    />
                                    {getPromoEndDateStr() && (
                                        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full font-medium">
                                            <CalendarIcon className="w-4 h-4" />
                                            Encerra em {getPromoEndDateStr()}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">Após o período configurado, novos clientes pagarão o valor integral no lugar da oferta.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-4 col-span-1 md:col-span-2">
                        <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Módulo de Cupom</Label>
                                <p className="text-sm text-muted-foreground">
                                    Exibir campo "Código Promocional" na tela de cadastro.
                                </p>
                            </div>
                            <Switch
                                checked={enablePromoCode}
                                onCheckedChange={setEnablePromoCode}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-border">
                    <div>
                        <h3 className="text-lg font-semibold text-primary">Permissões Globais da Equipe (Cargo Admin)</h3>
                        <p className="text-sm text-muted-foreground">Aqui você escolhe em tempo real o que os usuários atribuídos com a função `admin` lá na tela de Cadastros vão poder ver dentro do painel deles.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Acesso: Funil de Vendas</Label>
                                <p className="text-xs text-muted-foreground">
                                    Pode acessar o CRM para ajudar a reciclar leads e faturar.
                                </p>
                            </div>
                            <Switch
                                checked={adminPermissions.leads}
                                onCheckedChange={(val) => setAdminPermissions(prev => ({ ...prev, leads: val }))}
                            />
                        </div>

                        <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Acesso: Controle de Usuários</Label>
                                <p className="text-xs text-muted-foreground">
                                    Pode ver a lista de clientes, alterar banimentos ou trocar senhas.
                                </p>
                            </div>
                            <Switch
                                checked={adminPermissions.users}
                                onCheckedChange={(val) => setAdminPermissions(prev => ({ ...prev, users: val }))}
                            />
                        </div>

                        <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Acesso: Códigos Promocionais</Label>
                                <p className="text-xs text-muted-foreground">
                                    Pode criar, pausar ou alterar os códigos de marketing ativos.
                                </p>
                            </div>
                            <Switch
                                checked={adminPermissions.promo_codes}
                                onCheckedChange={(val) => setAdminPermissions(prev => ({ ...prev, promo_codes: val }))}
                            />
                        </div>

                        <div className="flex flex-row items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base text-red-600">Acesso: Configurações Vitais</Label>
                                <p className="text-xs text-muted-foreground">
                                    Pode alterar o preço, valor do trial e tudo o que há de mais sensível no sistema inteiro. Recomenda-se DESLIGAR!
                                </p>
                            </div>
                            <Switch
                                checked={adminPermissions.settings}
                                onCheckedChange={(val) => setAdminPermissions(prev => ({ ...prev, settings: val }))}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={updatingSubs || saving}
                        onClick={handleUpdateSubscriptions}
                        className="min-w-[120px]"
                    >
                        {updatingSubs ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Atualizando...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Atualizar Assinaturas
                            </>
                        )}
                    </Button>
                    <Button type="submit" disabled={saving} className="min-w-[120px]">
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Salvar Configurações
                            </>
                        )}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    O botão "Atualizar Assinaturas" aplica o valor cheio para todas as assinaturas ativas no Asaas. Use após salvar os novos valores.
                </p>
            </form>
        </div>
    );
};
