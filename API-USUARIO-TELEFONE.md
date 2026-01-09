# API - Busca de Usuário por Telefone

Esta documentação descreve como buscar informações de um usuário através do número de telefone nas APIs disponíveis.

## Visão Geral

O sistema permite buscar dados de usuários através do número de telefone, facilitando a integração com sistemas externos que utilizam o telefone como identificador principal.

## Endpoints Disponíveis

### 1. Buscar Agendamentos por Telefone

**GET** `/functions/v1/get-appointments-by-phone`

#### Parâmetros da Query
- `phone` (obrigatório): Número de telefone no formato brasileiro com código do país (ex: 5531991234567)
- `limit` (opcional): Número máximo de agendamentos a retornar (padrão: sem limite)

#### Exemplo de Requisição
```bash
curl -X GET "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/get-appointments-by-phone?phone=5531991234567&limit=10" \
  -H "Content-Type: application/json"
```

#### Resposta de Sucesso (200)
```json
{
  "success": true,
  "appointments": [
    {
      "id": "uuid-appointment-id",
      "title": "Consulta Médica",
      "description": "Consulta de rotina",
      "date": "2024-03-15",
      "time": "14:30:00",
      "status": "pending",
      "created_at": "2024-03-10T10:00:00Z",
      "updated_at": "2024-03-10T10:00:00Z"
    }
  ],
  "total": 1
}
```

### 2. Buscar Transações por Telefone

**GET** `/functions/v1/get-transactions-by-phone`

#### Parâmetros da Query
- `phone` (obrigatório): Número de telefone no formato brasileiro com código do país
- `type` (opcional): Filtrar por tipo de transação ("income" ou "expense")
- `category` (opcional): Filtrar por categoria específica
- `limit` (opcional): Número máximo de transações a retornar

#### Exemplo de Requisição
```bash
curl -X GET "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/get-transactions-by-phone?phone=5531991234567&type=income&limit=50" \
  -H "Content-Type: application/json"
```

#### Resposta de Sucesso (200)
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid-transaction-id",
      "amount": 1500.00,
      "type": "income",
      "category": "salary",
      "description": "Salário mensal",
      "date": "2024-03-01",
      "created_at": "2024-03-01T09:00:00Z",
      "updated_at": "2024-03-01T09:00:00Z"
    }
  ],
  "summary": {
    "total": 1,
    "total_income": 1500.00,
    "total_expense": 0.00,
    "balance": 1500.00
  }
}
```

## Códigos de Status HTTP

| Código | Descrição | Exemplo de Resposta |
|--------|-----------|-------------------|
| 200 | Sucesso | `{"success": true, "data": [...]}` |
| 400 | Parâmetros inválidos | `{"error": "Phone number is required"}` |
| 404 | Usuário não encontrado | `{"error": "User not found with this phone number"}` |
| 405 | Método não permitido | `{"error": "Method not allowed"}` |
| 500 | Erro interno do servidor | `{"error": "Internal server error"}` |

## Validações

### Formato do Telefone
- Deve conter código do país (55 para Brasil)
- Deve conter código de área (2 dígitos)
- Deve conter o número (8 ou 9 dígitos)
- Formato aceito: `5531991234567` (sem espaços, parênteses ou traços)

### Exemplos de Telefones Válidos
- `5531991234567` (celular com 9 dígitos)
- `5531012345678` (fixo com 8 dígitos)

## Autenticação

**Importante**: Estes endpoints são públicos e não requerem autenticação JWT. Eles foram configurados com `verify_jwt = false` para facilitar a integração com sistemas externos.

## Limitações e Considerações

1. **Rate Limiting**: Implemente controle de taxa no lado do cliente para evitar sobrecarga
2. **Dados Sensíveis**: Os endpoints retornam apenas dados básicos do usuário
3. **Formato do Telefone**: Certifique-se de formatar o telefone corretamente antes de fazer a requisição
4. **Logs**: Todas as requisições são registradas para auditoria

## Integração

### Exemplo em JavaScript
```javascript
const phone = "5531991234567";
const limit = 10;

// Buscar agendamentos
const appointmentsResponse = await fetch(
  `https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/get-appointments-by-phone?phone=${phone}&limit=${limit}`
);
const appointmentsData = await appointmentsResponse.json();

// Buscar transações
const transactionsResponse = await fetch(
  `https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/get-transactions-by-phone?phone=${phone}&limit=${limit}`
);
const transactionsData = await transactionsResponse.json();
```

### Exemplo em Python
```python
import requests

phone = "5531991234567"
base_url = "https://psyebemhvnwkhnypqgge.supabase.co/functions/v1"

# Buscar agendamentos
appointments_response = requests.get(
    f"{base_url}/get-appointments-by-phone",
    params={"phone": phone, "limit": 10}
)
appointments_data = appointments_response.json()

# Buscar transações
transactions_response = requests.get(
    f"{base_url}/get-transactions-by-phone",
    params={"phone": phone, "type": "income", "limit": 50}
)
transactions_data = transactions_response.json()
```

## Segurança

- Os endpoints validam o formato do telefone antes de processar
- Implementação de logs detalhados para auditoria
- Row Level Security (RLS) aplicado no banco de dados
- Validação server-side em todas as operações

## Suporte

Para dúvidas ou problemas com a API, verifique:
1. O formato do número de telefone
2. Os logs da aplicação
3. Os códigos de status HTTP retornados