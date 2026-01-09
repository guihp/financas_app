import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const ApiTestForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone: "",
    type: "",
    amount: "",
    description: "",
    category: "",
    date: ""
  });
  const [cancelData, setCancelData] = useState({
    phone: "",
    transaction_id: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('add-transaction-by-phone', {
        body: {
          phone: formData.phone,
          type: formData.type,
          amount: parseFloat(formData.amount),
          description: formData.description,
          category: formData.category,
          date: formData.date || undefined
        }
      });

      if (error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: data.message,
      });

      // Limpar formulário
      setFormData({
        phone: "",
        type: "",
        amount: "",
        description: "",
        category: "",
        date: ""
      });

    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('cancel-transaction-by-phone', {
        body: {
          phone: cancelData.phone,
          transaction_id: cancelData.transaction_id
        }
      });

      if (error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: data.message,
      });

      // Limpar formulário
      setCancelData({
        phone: "",
        transaction_id: ""
      });

    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao cancelar transação",
        variant: "destructive",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Teste APIs de Transação</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="add" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Adicionar Transação</TabsTrigger>
            <TabsTrigger value="cancel">Cancelar Transação</TabsTrigger>
          </TabsList>
          
          <TabsContent value="add">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Ex: +5511999999999"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descrição da transação"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  placeholder="Ex: alimentação, transporte"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="date">Data (opcional)</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Adicionar Transação"}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">URL da API:</h4>
              <code className="text-sm bg-background p-2 rounded block">
                https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-transaction-by-phone
              </code>
            </div>
          </TabsContent>

          <TabsContent value="cancel">
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <Label htmlFor="cancel-phone">Telefone</Label>
                <Input
                  id="cancel-phone"
                  type="tel"
                  placeholder="Ex: +5511999999999"
                  value={cancelData.phone}
                  onChange={(e) => setCancelData({...cancelData, phone: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="transaction-id">ID da Transação</Label>
                <Input
                  id="transaction-id"
                  placeholder="UUID da transação"
                  value={cancelData.transaction_id}
                  onChange={(e) => setCancelData({...cancelData, transaction_id: e.target.value})}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={cancelLoading} variant="destructive">
                {cancelLoading ? "Cancelando..." : "Cancelar Transação"}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">URL da API:</h4>
              <code className="text-sm bg-background p-2 rounded block">
                https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/cancel-transaction-by-phone
              </code>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};