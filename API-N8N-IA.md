# 🏦 IAFÉ Finanças — API para n8n (WhatsApp AI)

**Versão da API:** 1.0  
Esta documentação guia a Inteligência Artificial do n8n no processamento de intenções financeiras recebidas via WhatsApp, chamando os endpoints corretos do Supabase.

> 🌐 **Base URL**: `https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1`
> 🔐 **Autenticação**: Header padrão `Authorization: Bearer <SUPABASE_ANON_KEY>`
> 📦 **Content-Type**: `application/json`

---

## 📋 Índice de Endpoints

| # | Endpoint Pai | Descrição Principal |
|---|--------------|---------------------|
| 1 | `/get-user-by-phone` | Buscar perfil do usuário, status, bancos e cartões vinculados. |
| 2 | `/get-categories` | Listar árvore de categorias (Receitas/Despesas) com filtros. |
| 3 | `/manage-accounts-by-phone` | Criar ou listar as instituições reais do usuário (Bancos / Cartões). |
| 4 | `/add-transaction-by-phone` | Criar nova entrada financeira (Receita, Despesa ou Transferência). |
| 5 | `/get-transactions-by-phone` | Consultar extrato e resumo de saldo do mês. |
| 6 | `/update-transaction-by-phone` | Corrigir ou alterar dados de uma transação existente. |
| 7 | `/cancel-transaction-by-phone` | Excluir/estornar uma transação errada. |
| 8 | `/add-appointment` | Agendar um lembrete no calendário financeiro. |
| 9 | `/get-appointments-by-phone` | Listar todos os lembretes pendentes/futuros. |
| 10 | `/update-appointment-by-phone`| Atualizar o status de um lembrete (ex: concluir). |
| 11 | `/delete-appointment` | Excluir um agendamento. |

---

## 🛠️ Regras Globais & Formatação (Instruções IA)

Para garantir o sucesso das requisições, siga estas diretrizes globais:

1. **Autenticação**: Configure seu nó HTTP Request no n8n usando a header `Authorization: Bearer <SUA_ANON_KEY>`.
2. **Telefone (`phone`)**: Aceita vários formatos, a API limpa automaticamente, mas o padrão recomendado é apenas números com DDI e código de área. *(Ex: `5511999999999`)*.
3. **Busca Inicial**: Em todo novo fluxo, SEMPRE confirme que o usuário existe batendo no `/get-user-by-phone`. Guarde a lista de Bancos e Cartões em memória para usar nos IDs de transação.

---

## 📚 Dicionário de Dados Críticos

Antes de criar uma transação, entenda detalhadamente os valores permitidos para os campos de pagamento.

### 1. Tipos de Movimentação (`type`)
* `"income"`: Receitas (Entradas, pagamentos recebidos, salários).
* `"expense"`: Despesas (Gastos, pagamentos efetuados, boletos), **bem como Transferências (saídas da conta principal)**.

### 2. Categorias e Subcategorias (`category`)
O sistema divide em Grupos (Categorias Maiores) e Values (Subcategorias).
**Para a API, você SEMPRE envia o `value` (a Subcategoria).**
* Exemplo: Para registrar um gasto em "Alimentação", você envia o value específico: `"supermercado"`, `"restaurante"`, ou `"delivery"`.
* Se não souber exatamente a subcategoria, consulte o endpoint `/get-categories`.

### 3. Transferências 🔁
Para registrar uma transferência entre contas pelo WhatsApp:
* O sistema lida com a transferência enviando uma **Despesa (`"expense"`)**.
* Você DEVE enviar rigorosamente `category: "transferencia"`.
* O `payment_method` DEVE ser `"transfer"`.
* Somente será debitado da conta de origem informada (`bank_account_id`).

### 4. Métodos de Pagamento (`payment_method`)
Controla de onde o dinheiro deve sair (Obrigatório para `"expense"`).

| Valor | Nome | Regras e Dependências |
|-------|------|-----------------------|
| `"debit"` | Débito em Conta | Transação sai do saldo atual. **Exige** um `bank_account_id` válido. |
| `"pix"` | PIX | Transação sai/entra do saldo instantâneo. **Exige** um `bank_account_id` válido. |
| `"boleto"` | Boleto Bancário | Usado normalmente com `"expense"`. **Exige** um `bank_account_id` válido. |
| `"transfer"` | Transferência | Usado para transferir saldo. **Exige** `category: "transferencia"`. **Exige** um `bank_account_id` válido. |
| `"credit"` | Cartão de Crédito | Vai para a fatura do cartão. **Ignora** bancos. **Exige** `credit_card_id`. Aceita `total_installments`. |

---

## 4. Criar Transação (`add-transaction-by-phone`)
Endpoint principal para adicionar despesas, receitas ou transferências. 

**POST** `/add-transaction-by-phone`

### Estrutura Base
| Campo | Tipo | Req. | Explicação |
|-------|------|------|------------|
| `phone` | `string` | ✅ | Número do celular |
| `type` | `string` | ✅ | `"income"` ou `"expense"` |
| `amount` | `number` | ✅ | Valor financeiro em float (ex: `150.50`) |
| `category` | `string` | ✅ | Slug da **subcategoria** (ex: `"supermercado"`, `"transferencia"`) |
| `payment_method` | `string` | ⚠️ | `"debit"`, `"pix"`, `"boleto"`, `"credit"`, `"transfer"`. (Obrigatório se `"expense"`) |
| `description` | `string` | ❌ | Descrição humanizada (ex: "Jantar na pizzaria") |
| `date` | `string` | ❌ | Data exata da transação `YYYY-MM-DD`. Pode ser data **passada**, **presente** ou **futura**. (Se não enviado, assume Hoje) |

### Variáveis Estruturais de Acordo com Pagamento
| Se `payment_method` for... | Você DEVE enviar... | Opcional |
|----------------------------|---------------------|----------|
| `"debit"`, `"pix"`, `"boleto"`, `"transfer"` | `bank_account_id` | - |
| `"credit"` | `credit_card_id` | `total_installments` (Ex: `5` para parcelamento em 5x) |

> *Nota: Se a IA não passar o ID do banco ou do cartão, o sistema usará o PRIMEIRO que o usuário tiver cadastrado (o banco/cartão padrão).*

### Exemplo 1: Transferência
```json
{
  "phone": "5511999999999",
  "type": "expense",
  "amount": 500.00,
  "category": "transferencia",
  "description": "Transferência para poupança",
  "payment_method": "transfer",
  "bank_account_id": "uuid-da-conta-bancaria-de-origem"
}
```

### Exemplo 2: Cartão de Crédito Parcelado
```json
{
  "phone": "5511999999999",
  "type": "expense",
  "amount": 1200.00,
  "category": "eletronicos_pessoais",
  "description": "Smart TV Samsung",
  "payment_method": "credit",
  "credit_card_id": "uuid-do-cartao-de-credito",
  "total_installments": 10
}
```

### Exemplo 3: Receita Mensal
```json
{
  "phone": "5511999999999",
  "type": "income",
  "amount": 5000.00,
  "category": "salario",
  "description": "Salário da Empresa X",
  "bank_account_id": "uuid-da-conta-bancaria"
}
```

---

## 🤖 Fluxos Mentais para o Desenho do Prompt na IA (n8n)

1. **"Gastei 50 na padaria"** -> É `"expense"`. Categoria (value/subcategoria): `"padaria"`. Método não explícito: `"debit"`. Chame `add-transaction-by-phone`.
2. **"Comprei um PS5 por 3500 no Nubank dividido em 5x"** -> É `"expense"`. Categoria `"eletronicos_pessoais"`. Método `"credit"`. Encontre ID do "Nubank" dentro de `credit_cards`. Envie `total_installments = 5`.
3. **"Mandei 200 pro Itaú ontem"** -> É `"expense"`. Método: `"transfer"`. Categoria: `"transferencia"`. Calcular a data de ontem no formato `YYYY-MM-DD` e enviar no campo `date`.
4. **"Qual meu saldo do mês?"** -> Chame `get-transactions-by-phone` -> Retorne o `summary.balance`.
5. **"Quais categorias existem para comida?"** -> Chame `get-categories?group=Alimentação`.

### ⚠️ Notas sobre Receitas e Despesas Fixas / Recorrentes
A funcionalidade de "Despesa Fixa" ou "Receita Mensal Fixa" multiplica a mesma entrada pelos meses seguintes. 
A API `/add-transaction-by-phone` suporta isso **nativamente em uma única chamada**. Se o usuário pedir para "*lançar uma despesa fixa de 100 reais por 12 meses*", a IA do n8n deverá enviar no payload os campos opcionais `"is_fixed": true` e `"fixed_months": 12` (ou quantidade desejada de meses). O servidor se encarregará de criar todas as cópias futuras automaticamente.

---

*Nota: O formato da data (`YYYY-MM-DD`) e o padrão de escrita com `.00` para moedas evitam discrepâncias no banco de dados e devem ser estritamente seguidos nas conversões feitas pela IA do n8n.*
