# Documentação - Sistema de Agendamentos

## Visão Geral
O sistema de agendamentos permite que usuários criem, visualizem e gerenciem seus compromissos de forma intuitiva, com interface estilo To-Do do Windows.

## Funcionalidades

### Interface Web
- **Visualização em lista**: Agendamentos organizados por data e hora
- **Status visual**: Ícones indicam se o agendamento está pendente ou concluído
- **Criação rápida**: Modal com formulário simples para novos agendamentos
- **Exclusão**: Botão de exclusão que aparece ao passar o mouse
- **Toggle de status**: Clique no ícone para marcar como concluído/pendente

### Campos do Agendamento
- **Título** (obrigatório): Nome do compromisso
- **Descrição** (opcional): Detalhes adicionais
- **Data** (obrigatório): Data do agendamento
- **Horário** (opcional): Hora específica
- **Status**: pending (padrão), completed, cancelled

## APIs Disponíveis

### 1. Criar Agendamento
**Endpoint:** `POST /functions/v1/add-appointment`

**Exemplo cURL:**
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511999999999",
    "title": "Reunião de trabalho",
    "description": "Discussão do projeto Q1",
    "date": "2025-08-15",
    "time": "09:00"
  }'
```

**Parâmetros:**
- `phone` (obrigatório): Telefone do usuário cadastrado (formato: +5511999999999)
- `title` (obrigatório): Título do agendamento
- `date` (obrigatório): Data no formato YYYY-MM-DD
- `description` (opcional): Descrição detalhada
- `time` (opcional): Horário no formato HH:MM

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Agendamento criado com sucesso",
  "appointment": {
    "id": "uuid-gerado",
    "title": "Reunião de trabalho",
    "description": "Discussão do projeto Q1",
    "date": "2025-08-15",
    "time": "09:00",
    "status": "pending",
    "created_at": "2025-08-07T20:30:00Z"
  }
}
```

### 2. Excluir Agendamento
**Endpoint:** `DELETE /functions/v1/delete-appointment`

**Exemplo cURL:**
```bash
curl -X DELETE "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5511999999999",
    "appointment_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Parâmetros:**
- `phone` (obrigatório): Telefone do usuário
- `appointment_id` (obrigatório): ID UUID do agendamento

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Agendamento excluído com sucesso"
}
```

## Códigos de Erro

### 400 - Bad Request
```json
{
  "error": "Telefone, título e data são obrigatórios"
}
```

### 404 - Not Found
```json
{
  "error": "Usuário não encontrado"
}
```
```json
{
  "error": "Agendamento não encontrado ou acesso negado"
}
```

### 405 - Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```

### 500 - Internal Server Error
```json
{
  "error": "Erro interno do servidor"
}
```

## Banco de Dados

### Tabela: appointments
```sql
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Políticas RLS
- Usuários só podem ver seus próprios agendamentos
- Usuários só podem criar/editar/excluir seus próprios agendamentos
- Autenticação obrigatória para todas as operações

## Integração

### No Dashboard
O componente `<Appointments />` está integrado na página principal e requer:
- Usuário autenticado
- Conexão com Supabase configurada
- Componentes UI (Dialog, Button, Input, etc.)

### Dependências
- `@supabase/supabase-js`: Cliente Supabase
- `date-fns`: Formatação de datas
- `lucide-react`: Ícones
- Componentes UI customizados (shadcn/ui)

## Exemplos de Uso

### Agendamento Simples
```json
{
  "phone": "+5511999999999",
  "title": "Consulta médica",
  "date": "2025-08-20"
}
```

### Agendamento Completo
```json
{
  "phone": "+5511999999999",
  "title": "Reunião de negócios",
  "description": "Apresentação de proposta para cliente",
  "date": "2025-08-25",
  "time": "14:30"
}
```

## Segurança
- Todas as operações requerem autenticação
- RLS (Row Level Security) ativo
- Validação de dados no servidor
- CORS configurado para aplicações web
- Logs detalhados para debugging