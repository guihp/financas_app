import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, Clock, Plus, Trash2, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

interface Appointment {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface AppointmentsProps {
  user: User;
}

export const Appointments = ({ user }: AppointmentsProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
  });
  const { toast } = useToast();

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agendamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCreateAppointment = async () => {
    if (!newAppointment.title || !newAppointment.date) {
      toast({
        title: "Erro",
        description: "Título e data são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Validar se a data não é muito distante no futuro (máximo 2 anos)
    const selectedDate = new Date(newAppointment.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Resetar horas para comparação apenas da data
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(today.getFullYear() + 2);

    if (selectedDate < today) {
      toast({
        title: "Erro",
        description: "A data não pode ser anterior ao dia atual.",
        variant: "destructive",
      });
      return;
    }

    if (selectedDate > maxFutureDate) {
      toast({
        title: "Erro",
        description: "A data não pode ser superior a 2 anos no futuro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("appointments").insert({
        title: newAppointment.title,
        description: newAppointment.description,
        date: newAppointment.date,
        time: newAppointment.time || null,
        user_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso!",
      });

      setNewAppointment({ title: "", description: "", date: "", time: "" });
      setIsDialogOpen(false);
      fetchAppointments();
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o agendamento.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Agendamento excluído com sucesso!",
      });

      fetchAppointments();
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o agendamento.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      fetchAppointments();
    } catch (error) {
      console.error("Error updating appointment status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-white">
            <Calendar className="h-5 w-5 text-primary" />
            Agendamentos
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                <span className="whitespace-nowrap">Novo Agendamento</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={newAppointment.title}
                    onChange={(e) =>
                      setNewAppointment({ ...newAppointment, title: e.target.value })
                    }
                    placeholder="Digite o título do agendamento"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newAppointment.description}
                    onChange={(e) =>
                      setNewAppointment({ ...newAppointment, description: e.target.value })
                    }
                    placeholder="Digite uma descrição (opcional)"
                  />
                </div>
                <div>
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) =>
                      setNewAppointment({ ...newAppointment, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="time">Horário</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newAppointment.time}
                    onChange={(e) =>
                      setNewAppointment({ ...newAppointment, time: e.target.value })
                    }
                  />
                </div>
                <Button onClick={handleCreateAppointment} className="w-full">
                  Criar Agendamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum agendamento encontrado.</p>
            <p className="text-sm">Crie seu primeiro agendamento!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className={`group flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-accent/50 ${
                  appointment.status === 'completed' ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleStatus(appointment.id, appointment.status)}
                    className="hover:scale-110 transition-transform"
                  >
                    {getStatusIcon(appointment.status)}
                  </button>
                  <div>
                    <h4 className={`font-medium ${appointment.status === 'completed' ? 'line-through' : ''}`}>
                      {appointment.title}
                    </h4>
                    {appointment.description && (
                      <p className="text-sm text-muted-foreground">
                        {appointment.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {appointment.date.split('-').reverse().join('/')}
                      </span>
                      {appointment.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appointment.time}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteAppointment(appointment.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};