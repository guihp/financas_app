import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const TestWebhook = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testWebhook = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: {}
      });

      if (error) {
        throw error;
      }

      setResult(data);
      toast({
        title: "Webhook disparado com sucesso!",
        description: "Verifique os logs para mais detalhes."
      });
    } catch (error) {
      console.error('Erro ao chamar webhook:', error);
      toast({
        title: "Erro",
        description: "Erro ao disparar webhook de teste",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Teste de Webhook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testWebhook} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Disparando..." : "Disparar Webhook de Teste"}
        </Button>
        
        {result && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">Resultado:</p>
            <pre className="text-xs mt-2 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};