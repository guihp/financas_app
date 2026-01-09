import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Edit } from "lucide-react";

interface EditUserDialogProps {
  userId: string;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  onSuccess?: () => void;
}

export const EditUserDialog = ({ 
  userId, 
  userEmail, 
  userName, 
  userPhone,
  onSuccess 
}: EditUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(userName || "");
  const [phone, setPhone] = useState(userPhone || "");
  const [email, setEmail] = useState(userEmail);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    if (!email.trim()) {
      toast.error("O email é obrigatório");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const { error } = await supabase.functions.invoke('admin-update-user-profile', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          user_id: userId,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim()
        }
      });

      if (error) {
        toast.error(`Erro ao atualizar dados: ${error.message}`);
        return;
      }

      toast.success("Dados atualizados com sucesso!");
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error("Erro ao atualizar dados do usuário");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-1" />
          Editar Dados
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Dados do Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name">Nome Completo *</Label>
              <Input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Digite o nome completo"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite o email"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Digite o telefone (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};