# 🏦 IAFÉ Finanças — API para n8n (WhatsApp AI)

> **Base URL**: `https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1`
>
> **Autenticação**: Header `Authorization: Bearer <SUPABASE_ANON_KEY>`
>
> **Content-Type**: `application/json`

---

## 📋 Índice

| # | Endpoint | Método | Descrição |
|---|----------|--------|-----------|
| 1 | [get-user-by-phone](#1-get-user-by-phone) | GET | Buscar usuário + seus bancos e cartões |
| 2 | [get-categories](#2-get-categories) | GET | Listar categorias (com filtros) |
| 3 | [manage-accounts-by-phone](#3-manage-accounts-by-phone) | GET/POST | Listar/criar bancos e cartões |
| 4 | [add-transaction-by-phone](#4-add-transaction-by-phone) | POST | Criar transação (receita ou despesa) |
| 5 | [get-transactions-by-phone](#5-get-transactions-by-phone) | GET | Listar transações + saldo |
| 6 | [update-transaction-by-phone](#6-update-transaction-by-phone) | PUT | Editar transação existente |
| 7 | [cancel-transaction-by-phone](#7-cancel-transaction-by-phone) | POST | Deletar transação |
| 8 | [add-appointment](#8-add-appointment) | POST | Criar agendamento |
| 9 | [get-appointments-by-phone](#9-get-appointments-by-phone) | GET | Listar agendamentos |
| 10 | [delete-appointment](#10-delete-appointment) | POST | Deletar agendamento |
| 11 | [update-appointment-by-phone](#11-update-appointment-by-phone) | PUT | Editar agendamento |

---

## 🔑 Autenticação

Todos os endpoints usam a **ANON KEY** do Supabase no header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

No n8n, configure um **HTTP Request** node com:
- **Authentication**: Header Auth
- **Header Name**: `Authorization`
- **Header Value**: `Bearer <SUA_ANON_KEY>`

---

## 📞 Formato do Telefone

Todos os endpoints que recebem `phone` aceitam qualquer formato:
- `5511999999999` (recomendado)
- `+5511999999999`
- `11999999999`
- `5511888888888` (sem nono dígito — será corrigido automaticamente)

---

## 1. get-user-by-phone

Verifica se o usuário existe e está ativo.

### Request
```
GET /get-user-by-phone?phone=5511999999999
```

### Response 200 (Sucesso)
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "full_name": "João Silva",
    "email": "joao@email.com",
    "phone": "5511999999999",
    "created_at": "2025-01-01T00:00:00Z"
  },
  "active": true,
  "status": "active",
  "bank_accounts": [
    { "id": "uuid", "name": "Nubank" }
  ],
  "credit_cards": [
    { "id": "uuid", "name": "Nubank Crédito" }
  ]
}
```

### Response 404 (Não encontrado)
```json
{
  "error": "User not found with this phone number",
  "phone": "5511999999999",
  "active": false
}
```

### Uso no n8n (IA)
> Sempre comece verificando se o usuário existe. Use `bank_accounts` e `credit_cards` para saber os IDs ao criar transações.

---

## 2. get-categories

Retorna todas as categorias disponíveis, com filtros opcionais.

### Request
```
GET /get-categories
GET /get-categories?type=income
GET /get-categories?type=expense&group=Moradia
```

### Query Parameters

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `type` | string | ❌ | `"income"` ou `"expense"` |
| `group` | string | ❌ | Filtrar por grupo (ex: "Moradia") |

### Response 200
```json
{
  "success": true,
  "total": 10,
  "groups": ["Moradia"],
  "categories": [
    { "value": "aluguel", "label": "Aluguel", "group": "Moradia", "emoji": "🏠" },
    { "value": "condominio", "label": "Condomínio", "group": "Moradia", "emoji": "🏢" }
  ],
  "by_group": {
    "Moradia": [{ "value": "aluguel", "label": "Aluguel", "emoji": "🏠" }]
  }
}
```

### Uso no n8n (IA)
> Use `value` como slug ao criar transações. Se não souber a categoria, chame este endpoint para encontrar a mais adequada.

---

## 3. manage-accounts-by-phone

Lista, cria bancos e cartões de crédito do usuário.

### GET — Listar bancos e cartões
```
GET /manage-accounts-by-phone?phone=5511999999999
```

### Response 200 (GET)
```json
{
  "success": true,
  "bank_accounts": [
    { "id": "uuid", "name": "Nubank", "color": "#8B5CF6" }
  ],
  "credit_cards": [
    { "id": "uuid", "name": "Nubank Crédito", "closing_day": 3, "due_day": 10, "card_limit": 5000 }
  ],
  "total_banks": 1,
  "total_cards": 1
}
```

### POST — Criar banco
```json
{
  "phone": "5511999999999",
  "action": "create_bank",
  "name": "Nubank"
}
```
> A cor é detectada automaticamente para Nubank, Itaú, Bradesco, BB, Caixa, Santander, Inter, C6, PicPay, etc.

### POST — Criar cartão de crédito
```json
{
  "phone": "5511999999999",
  "action": "create_card",
  "name": "Nubank Crédito",
  "closing_day": 3,
  "due_day": 10,
  "card_limit": 5000
}
```

### Campos (POST)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | ✅ | Telefone |
| `action` | string | ✅ | `"create_bank"` ou `"create_card"` |
| `name` | string | ✅ | Nome do banco/cartão |
| `color` | string | ❌ | Cor hex (auto-detecta se omitido) |
| `closing_day` | number | ✅* | Dia fechamento fatura (1-31) |
| `due_day` | number | ✅* | Dia vencimento fatura (1-31) |
| `card_limit` | number | ❌ | Limite do cartão |

> \* Obrigatório apenas para `create_card`

### Response 200 (criar banco)
```json
{
  "success": true,
  "message": "Banco \"Nubank\" criado!",
  "bank_account": { "id": "uuid", "name": "Nubank", "color": "#8B5CF6" }
}
```

### Uso no n8n (IA)
> Quando o add-transaction retornar `NO_BANK_ACCOUNT` ou `NO_CREDIT_CARD`, a IA pode **criar o banco/cartão automaticamente** via este endpoint em vez de mandar o usuário pro app!

---

## 4. add-transaction-by-phone

Cria uma nova transação (despesa ou receita) para o usuário.

### Request
```
POST /add-transaction-by-phone
```

### Body (Despesa simples)
```json
{
  "phone": "5511999999999",
  "type": "expense",
  "amount": 150.50,
  "description": "Compras no supermercado",
  "category": "supermercado",
  "date": "2025-02-24",
  "payment_method": "debit",
  "bank_account_id": "uuid-do-banco"
}
```

### Body (Receita)
```json
{
  "phone": "5511999999999",
  "type": "income",
  "amount": 5000,
  "description": "Salário",
  "category": "salario",
  "date": "2025-02-05",
  "bank_account_id": "uuid-do-banco"
}
```

### Body (Cartão de crédito com parcelas)
```json
{
  "phone": "5511999999999",
  "type": "expense",
  "amount": 500,
  "description": "TV nova",
  "category": "eletronicos",
  "date": "2025-02-24",
  "payment_method": "credit",
  "credit_card_id": "uuid-do-cartao",
  "total_installments": 10
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | ✅ | Telefone do usuário |
| `type` | string | ✅ | `"income"` ou `"expense"` |
| `amount` | number | ✅ | Valor (ex: 150.50) |
| `category` | string | ✅ | Categoria (ver lista abaixo) |
| `description` | string | ❌ | Descrição livre |
| `date` | string | ❌ | Data `YYYY-MM-DD` (padrão: hoje) |
| `payment_method` | string | ❌* | `"debit"`, `"pix"`, `"credit"`, `"boleto"` |
| `bank_account_id` | string | ❌** | UUID do banco |
| `credit_card_id` | string | ❌*** | UUID do cartão |
| `total_installments` | number | ❌ | Número de parcelas (crédito) |

> \* Obrigatório para despesas. Se não informar, registra sem método.
>
> \** Se não informar, usa o primeiro banco cadastrado. **Erro se não houver banco.**
>
> \*** Se não informar, usa o primeiro cartão cadastrado. **Erro se não houver cartão.**

### Response 200 (Sucesso)
```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "type": "expense",
    "amount": 150.50,
    "description": "Compras no supermercado",
    "category": "supermercado",
    "date": "2025-02-24",
    "payment_method": "debit",
    "bank_account_id": "uuid"
  },
  "message": "💸 Despesa de R$ 150.50 (Débito) adicionada com sucesso!"
}
```

### ⚠️ Erros Possíveis

| Code | HTTP | Significado | O que a IA deve fazer |
|------|------|-------------|----------------------|
| `NO_BANK_ACCOUNT` | 400 | Usuário não tem banco cadastrado | Pedir pro usuário cadastrar um banco no app |
| `NO_CREDIT_CARD` | 400 | Usuário não tem cartão cadastrado | Pedir pro usuário cadastrar um cartão no app |
| `INVALID_BANK_ACCOUNT` | 400 | UUID do banco inválido | Listar bancos do usuário e perguntar qual |
| `INVALID_CREDIT_CARD` | 400 | UUID do cartão inválido | Listar cartões do usuário e perguntar qual |
| — | 404 | Usuário não encontrado | Verificar número de telefone |
| — | 400 | Campos obrigatórios | Pedir os campos que faltam |

### Exemplo de erro
```json
{
  "error": "Para pagamento via DEBIT, é necessário ter uma conta bancária cadastrada",
  "dica": "O usuário precisa cadastrar pelo menos um banco no app (menu Bancos e Cartões)",
  "code": "NO_BANK_ACCOUNT"
}
```

---

## 5. get-transactions-by-phone

Lista transações do usuário com filtros e resumo de saldo.

### Request
```
GET /get-transactions-by-phone?phone=5511999999999&type=expense&limit=10
```

### Query Parameters

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | ✅ | Telefone do usuário |
| `type` | string | ❌ | Filtrar: `"income"` ou `"expense"` |
| `category` | string | ❌ | Filtrar por categoria |
| `limit` | number | ❌ | Limite de resultados (padrão: todos) |

### Response 200
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "expense",
      "amount": 150.50,
      "description": "Supermercado",
      "category": "supermercado",
      "date": "2025-02-24",
      "payment_method": "debit",
      "bank_account_id": "uuid"
    }
  ],
  "summary": {
    "total": 25,
    "totalIncome": 5000,
    "totalExpense": 3200.50,
    "balance": 1799.50
  }
}
```

### Uso no n8n (IA)
> O `summary.balance` é o **saldo do mês**. Use-o quando o usuário perguntar "qual meu saldo?" ou "quanto já gastei?".

---

## 6. update-transaction-by-phone

Edita uma transação existente. Apenas os campos enviados serão atualizados.

### Request
```
PUT /update-transaction-by-phone
```

### Body
```json
{
  "phone": "5511999999999",
  "transaction_id": "uuid-da-transacao",
  "amount": 200,
  "description": "Compras corrigido",
  "category": "supermercado"
}
```

### Campos editáveis

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `phone` | string | ✅ Obrigatório |
| `transaction_id` | string | ✅ Obrigatório — ID retornado no create |
| `type` | string | ❌ "income" ou "expense" |
| `amount` | number | ❌ Novo valor |
| `description` | string | ❌ Nova descrição |
| `category` | string | ❌ Nova categoria |
| `date` | string | ❌ Nova data YYYY-MM-DD |

### Response 200
```json
{
  "success": true,
  "message": "Transaction updated successfully",
  "transaction": { ... }
}
```

---

## 7. cancel-transaction-by-phone

Deleta uma transação.

### Request
```
POST /cancel-transaction-by-phone
```

### Body
```json
{
  "phone": "5511999999999",
  "transaction_id": "uuid-da-transacao"
}
```

### Response 200
```json
{
  "success": true,
  "canceled_transaction": { ... },
  "message": "Transação cancelada com sucesso!"
}
```

### Response 404
```json
{
  "error": "Transação não encontrada ou não pertence ao usuário"
}
```

---

## 8. add-appointment

Cria um agendamento/lembrete financeiro.

### Request
```
POST /add-appointment
```

### Body
```json
{
  "phone": "5511999999999",
  "title": "Pagar aluguel",
  "description": "R$ 1.500 - transferência via PIX",
  "date": "2025-03-10",
  "time": "09:00"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | ✅ | Telefone |
| `title` | string | ✅ | Título do agendamento |
| `date` | string | ✅ | Data `YYYY-MM-DD` |
| `description` | string | ❌ | Detalhes |
| `time` | string | ❌ | Horário `HH:MM` |

### Response 200
```json
{
  "success": true,
  "message": "Agendamento criado com sucesso",
  "appointment": {
    "id": "uuid",
    "title": "Pagar aluguel",
    "date": "2025-03-10",
    "time": "09:00",
    "status": "pending"
  }
}
```

---

## 9. get-appointments-by-phone

Lista agendamentos do usuário, ordenados por data.

### Request
```
GET /get-appointments-by-phone?phone=5511999999999
```

### Response 200
```json
{
  "success": true,
  "appointments": [
    {
      "id": "uuid",
      "title": "Pagar aluguel",
      "description": "R$ 1.500",
      "date": "2025-03-10",
      "time": "09:00",
      "status": "pending"
    }
  ],
  "total": 3
}
```

---

## 10. delete-appointment

Deleta um agendamento por ID.

### Request
```
POST /delete-appointment
```

### Body
```json
{
  "phone": "5511999999999",
  "appointment_id": "uuid-do-agendamento"
}
```

### Response 200
```json
{
  "success": true,
  "message": "Agendamento deletado com sucesso"
}
```

---

## 11. update-appointment-by-phone

Edita um agendamento existente.

### Request
```
PUT /update-appointment-by-phone
```

### Body
```json
{
  "phone": "5511999999999",
  "appointment_id": "uuid-do-agendamento",
  "title": "Pagar internet",
  "date": "2025-03-15",
  "time": "10:00",
  "status": "completed"
}
```

### Campos editáveis

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `phone` | string | ✅ Obrigatório |
| `appointment_id` | string | ✅ Obrigatório |
| `title` | string | ❌ |
| `description` | string | ❌ |
| `date` | string | ❌ YYYY-MM-DD |
| `time` | string | ❌ HH:MM |
| `status` | string | ❌ "pending", "completed", "cancelled" |

---

## 📂 Categorias Disponíveis

A IA deve usar o **value** (slug em minúsculo sem acento). Principais categorias:

### 🍽️ Alimentação
`supermercado`, `restaurante`, `lanchonete`, `padaria`, `delivery`, `acougue`, `feira_hortifruti`, `bebidas`

### 🏠 Moradia
`aluguel`, `condominio`, `iptu`, `energia_eletrica`, `agua_esgoto`, `gas`, `internet`, `tv_assinatura`, `manutencao_casa`, `seguro_residencial`

### 🚗 Transporte
`combustivel`, `estacionamento`, `pedagio`, `uber_taxi`, `onibus_metro`, `seguro_veiculo`, `ipva`, `manutencao_veiculo`

### 💊 Saúde
`plano_saude`, `farmacia`, `consulta_medica`, `dentista`, `exames`, `terapia`, `academia`

### 📚 Educação
`escola_faculdade`, `curso_online`, `material_escolar`, `livros`, `idiomas`, `treinamentos`

### 🎮 Lazer
`cinema_teatro`, `streaming`, `jogos`, `viagens`, `hospedagem`, `passeios`, `shows`, `hobbies`

### 💰 Receitas (income)
`salario`, `freelance`, `investimentos`, `vendas`, `aluguel_recebido`, `outros_receita`

### 🔧 Outros
`presentes`, `cosmeticos`, `doacoes`, `dizimo`, `imposto_renda`, `outros`

---

## 🤖 Instruções para a IA no n8n

### Fluxo recomendado

```
1. Usuário manda mensagem no WhatsApp
2. IA interpreta a intenção
3. Se financeiro → chamar endpoint correspondente
4. Retornar resposta formatada ao usuário
```

### Exemplos de Interpretação

| Mensagem do Usuário | Ação da IA |
|---------------------|-----------|
| "Gastei 50 reais no almoço" | `POST add-transaction-by-phone` type=expense, amount=50, category=restaurante, payment_method=debit |
| "Recebi 3000 de salário" | `POST add-transaction-by-phone` type=income, amount=3000, category=salario |
| "Qual meu saldo?" | `GET get-transactions-by-phone` → usar `summary.balance` |
| "Quanto gastei esse mês?" | `GET get-transactions-by-phone` → usar `summary.totalExpense` |
| "Me lembra de pagar o aluguel dia 10" | `POST add-appointment` title="Pagar aluguel", date=YYYY-MM-10 |
| "Comprei uma TV de 2000 no cartão em 10x" | `POST add-transaction-by-phone` type=expense, amount=2000, category=eletronicos, payment_method=credit, total_installments=10 |
| "Paguei o boleto da internet" | `POST add-transaction-by-phone` type=expense, amount=X, category=internet, payment_method=boleto |
| "Cancela a última transação" | `GET get-transactions-by-phone` (limit=1) → `POST cancel-transaction-by-phone` com o ID |
| "Quais meus agendamentos?" | `GET get-appointments-by-phone` |

### Tratamento de Erros pela IA

| Código | Resposta sugerida | Ação da IA |
|--------|-------------------|------------|
| `NO_BANK_ACCOUNT` | "Qual banco você usa? Vou cadastrar pra você!" | Chamar `manage-accounts-by-phone` com `create_bank` |
| `NO_CREDIT_CARD` | "Qual cartão de crédito? Preciso do dia de fechamento e vencimento." | Chamar `manage-accounts-by-phone` com `create_card` |
| `INVALID_BANK_ACCOUNT` | "Esse banco não foi encontrado. Qual você quer usar?" | Listar bancos via GET `manage-accounts-by-phone` |
| `INVALID_CREDIT_CARD` | "Esse cartão não foi encontrado. Qual você quer usar?" | Listar cartões via GET `manage-accounts-by-phone` |
| 404 (user not found) | "Não encontrei uma conta com esse número. Você já se cadastrou?" | — |

---

## 🔧 Configuração no n8n

### Node HTTP Request (exemplo)

```
Method: POST
URL: https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/add-transaction-by-phone
Headers:
  Authorization: Bearer <SUPABASE_ANON_KEY>
  Content-Type: application/json
Body (JSON):
  {
    "phone": "{{ $json.phone }}",
    "type": "expense",
    "amount": {{ $json.amount }},
    "description": "{{ $json.description }}",
    "category": "{{ $json.category }}",
    "payment_method": "debit"
  }
```

### Variáveis de Ambiente Sugeridas

| Variável | Valor |
|----------|-------|
| `SUPABASE_URL` | `https://dlbiwguzbiosaoyrcvay.supabase.co` |
| `SUPABASE_ANON_KEY` | Sua chave anon |
| `BASE_API_URL` | `https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1` |
