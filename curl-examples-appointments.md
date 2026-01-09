# APIs de Agendamentos - Exemplos cURL

## 1. Criar Agendamento por API

**Endpoint:** `POST /functions/v1/add-appointment`

```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@email.com",
    "title": "Consulta médica",
    "description": "Consulta de rotina com cardiologista",
    "date": "2025-08-10",
    "time": "14:30"
  }'
```

**Parâmetros obrigatórios:**
- `email`: E-mail do usuário cadastrado
- `title`: Título do agendamento
- `date`: Data no formato YYYY-MM-DD

**Parâmetros opcionais:**
- `description`: Descrição do agendamento
- `time`: Horário no formato HH:MM

## 2. Excluir Agendamento por API

**Endpoint:** `DELETE /functions/v1/delete-appointment`

```bash
curl -X DELETE "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-appointment" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@email.com",
    "appointment_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Parâmetros obrigatórios:**
- `email`: E-mail do usuário
- `appointment_id`: ID UUID do agendamento a ser excluído

## Respostas das APIs

### Sucesso (200)
```json
{
  "success": true,
  "message": "Agendamento criado com sucesso",
  "appointment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Consulta médica",
    "description": "Consulta de rotina",
    "date": "2025-08-10",
    "time": "14:30",
    "status": "pending"
  }
}
```

### Erro (400/404/500)
```json
{
  "error": "Descrição do erro"
}
```