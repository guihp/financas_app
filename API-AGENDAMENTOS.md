# API de Agendamentos - Documentação

## Visão Geral
Esta API permite gerenciar agendamentos através de endpoints REST. Todos os endpoints requerem autenticação e utilizam o sistema de RLS (Row Level Security) do Supabase.

## Base URL
```
https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/
```

## Autenticação
Todas as requisições devem incluir o header de autorização:
```
Authorization: Bearer {seu_token_jwt}
```

---

## 1. Criar Agendamento

### Endpoint
```
POST /add-appointment
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {token}
```

### Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | ✅ | Telefone do usuário cadastrado (formato: +5511999999999) |
| `title` | string | ✅ | Título do agendamento |
| `date` | string | ✅ | Data no formato YYYY-MM-DD |
| `description` | string | ❌ | Descrição detalhada do agendamento |
| `time` | string | ❌ | Horário no formato HH:MM |

### Exemplo de Requisição
```bash
curl -X POST "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "phone": "+5511999999999",
    "title": "Consulta médica",
    "description": "Consulta de rotina com cardiologista",
    "date": "2025-08-15",
    "time": "14:30"
  }'
```

### Exemplo de Requisição JavaScript
```javascript
const response = await fetch('https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/add-appointment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    phone: '+5511999999999',
    title: 'Reunião de trabalho',
    description: 'Discussão do projeto Q1',
    date: '2025-08-15',
    time: '09:00'
  })
});

const data = await response.json();
```

### Resposta de Sucesso (201)
```json
{
  "success": true,
  "message": "Agendamento criado com sucesso",
  "appointment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "c75703d8-b5f3-423f-be50-cbbbef9310cb",
    "title": "Consulta médica",
    "description": "Consulta de rotina com cardiologista",
    "date": "2025-08-15",
    "time": "14:30:00",
    "status": "pending",
    "created_at": "2025-08-07T21:30:00.123456Z",
    "updated_at": "2025-08-07T21:30:00.123456Z"
  }
}
```

---

## 2. Excluir Agendamento

### Endpoint
```
DELETE /delete-appointment
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {token}
```

### Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | ✅ | Telefone do usuário |
| `appointment_id` | string | ✅ | ID UUID do agendamento |

### Exemplo de Requisição
```bash
curl -X DELETE "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-appointment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "email": "usuario@email.com",
    "appointment_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Exemplo de Requisição JavaScript
```javascript
const response = await fetch('https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-appointment', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    email: 'usuario@email.com',
    appointment_id: '550e8400-e29b-41d4-a716-446655440000'
  })
});

const data = await response.json();
```

### Resposta de Sucesso (200)
```json
{
  "success": true,
  "message": "Agendamento excluído com sucesso"
}
```

---

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| `200` | Sucesso |
| `201` | Criado com sucesso |
| `400` | Requisição inválida - parâmetros obrigatórios ausentes |
| `401` | Não autorizado - token inválido |
| `404` | Usuário ou agendamento não encontrado |
| `405` | Método não permitido |
| `500` | Erro interno do servidor |

---

## Códigos de Erro

### 400 - Bad Request
```json
{
  "error": "Email, título e data são obrigatórios"
}
```

### 401 - Unauthorized
```json
{
  "error": "Token de autorização inválido"
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

---

## Validações de Dados

### Data
- Formato obrigatório: `YYYY-MM-DD`
- Não pode ser anterior ao dia atual
- Não pode ser superior a 2 anos no futuro

### Horário
- Formato: `HH:MM` (24 horas)
- Exemplo: `14:30`, `09:00`, `23:45`

### E-mail
- Deve ser um e-mail válido
- Deve estar cadastrado no sistema

---

## Exemplos Práticos

### 1. Agendamento Simples (apenas data)
```json
{
  "email": "usuario@email.com",
  "title": "Dentista",
  "date": "2025-08-20"
}
```

### 2. Agendamento Completo
```json
{
  "email": "usuario@email.com",
  "title": "Reunião de Planejamento",
  "description": "Reunião para definir metas do próximo trimestre",
  "date": "2025-08-25",
  "time": "14:30"
}
```

### 3. Agendamento de Emergência
```json
{
  "email": "usuario@email.com",
  "title": "Consulta Urgente",
  "description": "Consulta médica de emergência",
  "date": "2025-08-08",
  "time": "08:00"
}
```

---

## Notas Importantes

1. **Timezone**: Todas as datas são tratadas em UTC. Certifique-se de converter para o timezone correto na sua aplicação.

2. **Autenticação**: Os tokens JWT têm validade limitada. Implemente renovação automática de tokens.

3. **Rate Limiting**: A API tem limites de taxa. Em caso de muitas requisições, aguarde antes de tentar novamente.

4. **CORS**: A API está configurada para aceitar requisições de qualquer origem (`*`).

5. **Logs**: Todas as operações são logadas para auditoria e debugging.

---

## Suporte

Para dúvidas ou problemas com a API:
- Verifique os logs do Edge Function no [painel do Supabase](https://supabase.com/dashboard/project/psyebemhvnwkhnypqgge/functions)
- Consulte a documentação do banco de dados
- Verifique se o usuário está autenticado corretamente