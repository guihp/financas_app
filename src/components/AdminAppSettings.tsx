import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export const AdminAppSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const [fullPrice, setFullPrice] = useState("");
    const [promoPrice, setPromoPrice] = useState("");
    const [trialDays, setTrialDays] = useState("");
    const [promoDays, setPromoDays] = useState("");
    const [enablePromoCode, setEnablePromoCode] = useState(true);
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
                setPromoPrice(data.product_promo_price.toString());
                setTrialDays(data.trial_days.toString());
                if (data.promo_days !== null && data.promo_days !== undefined) {
                    setPromoDays(data.promo_days.toString());
                }
                if (data.enable_promo_code !== undefined) {
                    setEnablePromoCode(data.enable_promo_code);
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
            const updates = {
                product_full_price: parseFloat(fullPrice),
                product_promo_price: parseFloat(promoPrice),
                trial_days: parseInt(trialDays, 10),
                promo_days: promoDays ? parseInt(promoDays, 10) : null,
                enable_promo_code: enablePromoCode,
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

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

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
                        <Label htmlFor="promoPrice">Valor Promocional (R$)</Label>
                        <Input
                            id="promoPrice"
                            type="number"
                            step="0.01"
                            value={promoPrice}
                            onChange={(e) => setPromoPrice(e.target.value)}
                            placeholder="Ex: 29.90"
                            required
                        />
                        <p className="text-xs text-muted-foreground">O valor exibido atualmente em pagamentos e checkout.</p>
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

                    <div className="space-y-2">
                        <Label htmlFor="promoDays">Duração do Valor Promocional (Dias)</Label>
                        <Input
                            id="promoDays"
                            type="number"
                            step="1"
                            value={promoDays}
                            onChange={(e) => setPromoDays(e.target.value)}
                            placeholder="Ex: 90"
                        />
                        <p className="text-xs text-muted-foreground">Opcional: Quantos dias a fatura ficará no valor em promoção antes de voltar ao valor cheio.</p>
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

                <div className="pt-4 border-t border-border flex justify-end">
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
            </form>
        </div>
    );
};
