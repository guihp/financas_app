# Variáveis de Ambiente

## Frontend (Vite)

Estas variáveis devem ser configuradas no Coolify ou no ambiente de produção:

- `VITE_SUPABASE_URL` - URL do projeto Supabase (ex: https://seu-projeto.supabase.co)
- `VITE_SUPABASE_ANON_KEY` - Chave anon/public do Supabase

## Supabase Edge Functions

As Edge Functions do Supabase usam variáveis de ambiente configuradas automaticamente pelo Supabase:

- `SUPABASE_URL` - Configurado automaticamente
- `SUPABASE_SERVICE_ROLE_KEY` - Configurado automaticamente
- `WEBHOOK_BASE_URL` - **IMPORTANTE**: URL base do webhook (sem o caminho do endpoint)
- `ASAAS_API_KEY` - **IMPORTANTE**: Chave da API do Asaas (sandbox ou produção)
- `ASAAS_BASE_URL` - URL base da API do Asaas (padrão: https://api-sandbox.asaas.com/v3)

### Exemplo de WEBHOOK_BASE_URL:
```
WEBHOOK_BASE_URL=https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com
```

As URLs completas serão construídas automaticamente como:
- `{WEBHOOK_BASE_URL}/webhook/CODIGO-OTP` - Para envio de código OTP
- `{WEBHOOK_BASE_URL}/webhook/registra_ai_lembrete` - Para lembretes de agendamentos

Onde `CODIGO-OTP` e `registra_ai_lembrete` são literalmente os nomes dos endpoints, não variáveis.

## Webhooks Disponíveis

### 1. Webhook de Código OTP (`/webhook/CODIGO-OTP`)
- **Função Edge**: `generate-otp`
- **Quando é ativado**: Quando um usuário tenta criar uma conta
- **Payload enviado**:
  ```json
  {
    "codigo_usuario": "11999999999",
    "email": "usuario@exemplo.com",
    "nome": "Nome Completo",
    "codigo_verificacao": "123456"
  }
  ```

### 2. Webhook de Lembretes de Agendamentos (`/webhook/registra_ai_lembrete`)
- **Função Edge**: `appointment-notifications`
- **Quando é ativado**: Automaticamente a cada 5 minutos via cron job (Supabase pg_cron)
- **Como funciona**:
  1. Um cron job no Supabase executa a Edge Function `appointment-notifications` a cada 5 minutos
  2. A função verifica agendamentos pendentes
  3. Calcula os horários de notificação (1h15min antes, 1h antes, 15min antes, agora)
  4. Se estiver dentro de uma janela de 5 minutos do horário de notificação, envia o webhook
  5. Registra a notificação na tabela `appointment_notifications_sent` para evitar duplicatas
- **Payload enviado**:
  ```json
  {
    "notification_type": "1_hour_15_minutes_before",
    "appointment": {
      "id": "uuid-do-agendamento",
      "title": "Consulta",
      "description": "Descrição da consulta",
      "date": "2025-01-10",
      "time": "14:30",
      "user_phone": "11999999999",
      "user_name": "Nome Completo"
    },
    "scheduled_datetime": "2025-01-10T14:30:00.000Z",
    "notification_time": "2025-01-10T13:15:00.000Z"
  }
  ```
- **Tipos de notificação**:
  - `1_hour_15_minutes_before` - 1 hora e 15 minutos antes
  - `1_hour_before` - 1 hora antes
  - `15_minutes_before` - 15 minutos antes
  - `now` - No momento do agendamento

## Verificando o Cron Job

O cron job está configurado na migration `20260109234545_update_appointment_notifications_cron.sql`.

Para verificar se está ativo:
```sql
SELECT * FROM cron.job WHERE jobname = 'appointment-notifications';
```

Para ver histórico de execuções:
```sql
SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'appointment-notifications');
```

## Integração Asaas (Pagamentos)

### Configuração

1. **ASAAS_API_KEY**: Chave da API do Asaas
   - Sandbox: Começa com `$aact_hmlg_...`
   - Produção: Começa com `$aact_prod_...`

2. **ASAAS_BASE_URL**: 
   - Sandbox: `https://api-sandbox.asaas.com/v3`
   - Produção: `https://api.asaas.com/v3`

### Webhook de Pagamentos

Configure o webhook no painel do Asaas para enviar eventos para:

```
https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/financas-asaas
```

O n8n deve então encaminhar os eventos para a Edge Function `process-asaas-webhook`:

```
POST https://dlbiwguzbiosaoyrcvay.supabase.co/functions/v1/process-asaas-webhook
Authorization: Bearer {SUPABASE_ANON_KEY}
Content-Type: application/json
Body: { event, payment }
```

### Eventos Suportados

- `PAYMENT_CONFIRMED` - Pagamento confirmado
- `PAYMENT_RECEIVED` - Pagamento recebido
- `PAYMENT_OVERDUE` - Pagamento vencido
- `PAYMENT_DELETED` - Pagamento excluído
- `PAYMENT_REFUNDED` - Pagamento estornado

### Fluxo de Pagamento no Cadastro (cadastro só após pagamento)

O usuário só é criado no banco **depois** de cadastrar o método de pagamento e pagar.

1. Usuário preenche formulário (nome, e-mail, telefone, senha), aceita termos e verifica OTP na tela de Auth.
2. Sistema chama `create-asaas-customer` (cria cliente no Asaas e registro em `pending_registrations`). **Nenhum usuário é criado ainda.**
3. Redirecionamento para `/pagamento-pendente?email=...`. Usuário escolhe PIX ou Cartão de Crédito.
4. Frontend chama `create-asaas-payment` com `registrationId` e `customerId` (retornados por `get-pending-payment`).
5. **Cartão aprovado na hora:** `create-asaas-payment` marca o registro como pago e invoca `register-user` com `registrationId`. Conta criada em `auth.users` + `profiles` + `subscriptions`.
6. **PIX:** usuário paga; Asaas envia evento para webhook n8n → n8n encaminha para `process-asaas-webhook` → função marca registro como pago e invoca `register-user` com `registrationId`. Conta criada.
7. Usuário vê "Pagamento confirmado. Faça login com seu e-mail e a senha definida no cadastro." e acessa `/auth` para entrar.

### Variáveis Asaas

- `ASAAS_API_KEY` – Chave da API (sandbox ou produção).
- `ASAAS_BASE_URL` – Base da API (ex.: `https://api-sandbox.asaas.com/v3`).
- Webhook: configurar no painel Asaas para apontar para o n8n; n8n encaminha para a Edge Function `process-asaas-webhook`.

### PIX no Sandbox – Confirmação manual obrigatória

No **Sandbox**, o PIX **não é confirmado automaticamente**. Após gerar o PIX e simular o pagamento:

1. Acesse o [Painel Asaas Sandbox](https://sandbox.asaas.com)
2. Vá em Cobranças e localize a cobrança PIX
3. Clique em **"Confirmar pagamento"** / **"CONFIRM PAYMENT"**
4. O Asaas enviará o webhook `PAYMENT_RECEIVED` e o usuário será criado

Ou use a API: `POST /v3/sandbox/payment/{id}/confirm` com o ID da cobrança.

### Webhook e formato do payload

O n8n deve repassar o webhook do Asaas **mantendo o payload original** (JSON com `event` e `payment`). O `process-asaas-webhook` espera:
- `payment.id` ou `paymentId` – ID da cobrança (pay_xxx)
- `payment.externalReference` ou `externalReference` – ID do registro (UUID em `pending_registrations`)

Se o n8n transformar o payload, verifique se esses campos estão presentes. Logs da Edge Function mostram `receivedKeys` em caso de 400.

### Eventos Asaas utilizados

- `PAYMENT_CONFIRMED` – Pagamento confirmado (cartão/PIX).
- `PAYMENT_RECEIVED` / `PAYMENT_RECEIVED_IN_CASH` – Pagamento recebido.
- `PAYMENT_OVERDUE` – Pagamento vencido.
- `PAYMENT_DELETED` / `PAYMENT_REFUNDED` – Cancelamento/estorno.

### Edge Functions de Pagamento

- `create-asaas-customer` – Cria cliente no Asaas e registro em `pending_registrations` (aceita `terms_accepted`).
- `create-asaas-payment` – Cria cobrança (PIX ou Cartão). Se cartão aprovado na hora, marca como pago e chama `register-user`.

### Cobrança recorrente (cartão salvo)

**Estado atual:** O pagamento com cartão é **avulso** (uma única cobrança). O cartão **não** fica salvo para cobrança automática no mês seguinte. A tabela `subscriptions` armazena apenas o período (início/fim) e o `asaas_customer_id`, mas **não** usa a API de Assinaturas do Asaas.

**Para cobrança automática mensal**, seria necessário:

1. Usar a API de **Assinaturas** do Asaas (`POST /subscriptions`) em vez de cobrança avulsa.
2. Criar assinatura vinculada ao cartão – o Asaas armazena o cartão e cobra automaticamente a cada ciclo.
3. Persistir o `asaas_subscription_id` na tabela `subscriptions` e processar webhooks de renovação.
- `get-pending-payment` – Busca pagamento pendente por e-mail.
- `check-payment-status` – Verifica status do pagamento no Asaas (polling). **Deploy obrigatório** para polling em tempo real; se retornar 404, o front usa `get-pending-payment` como fallback (status atualizado pelo webhook).
- `process-asaas-webhook` – Recebe webhooks do Asaas, marca registro como pago e chama `register-user` com `registrationId`.

**Deploy das funções de pagamento** (no diretório do projeto):
```bash
supabase functions deploy create-asaas-customer
supabase functions deploy create-asaas-payment
supabase functions deploy get-pending-payment
supabase functions deploy check-payment-status
supabase functions deploy process-asaas-webhook
```

## Configuração no Coolify

1. Acesse as configurações do projeto no Coolify
2. Vá em "Environment Variables"
3. Adicione as variáveis acima
4. Para Edge Functions, configure `WEBHOOK_BASE_URL` e `ASAAS_API_KEY` nas variáveis de ambiente do projeto Supabase

### Variáveis Necessárias no Supabase

No painel do Supabase, vá em Project Settings > Edge Functions > Secrets e adicione:

- `WEBHOOK_BASE_URL` = https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com
- `ASAAS_API_KEY` = $aact_hmlg_... (sua chave da API)
- `ASAAS_BASE_URL` = https://api-sandbox.asaas.com/v3
