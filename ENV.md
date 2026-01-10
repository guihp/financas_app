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

## Configuração no Coolify

1. Acesse as configurações do projeto no Coolify
2. Vá em "Environment Variables"
3. Adicione as variáveis acima
4. Para Edge Functions, configure `WEBHOOK_BASE_URL` nas variáveis de ambiente do projeto Supabase
