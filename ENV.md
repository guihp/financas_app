# Variáveis de Ambiente

## Frontend (Vite)

Estas variáveis devem ser configuradas no Coolify ou no ambiente de produção:

- `VITE_SUPABASE_URL` - URL do projeto Supabase (ex: https://seu-projeto.supabase.co)
- `VITE_SUPABASE_ANON_KEY` - Chave anon/public do Supabase

## Supabase Edge Functions

As Edge Functions do Supabase usam variáveis de ambiente configuradas automaticamente pelo Supabase:

- `SUPABASE_URL` - Configurado automaticamente
- `SUPABASE_SERVICE_ROLE_KEY` - Configurado automaticamente
- `WEBHOOK_BASE_URL` - **IMPORTANTE**: URL base do webhook (sem o /webhook/CODIGO-OTP)

### Exemplo de WEBHOOK_BASE_URL:
```
WEBHOOK_BASE_URL=https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com
```

A URL completa será construída automaticamente como:
`{WEBHOOK_BASE_URL}/webhook/CODIGO-OTP`

Onde `CODIGO-OTP` é literalmente o nome do endpoint, não uma variável.

## Configuração no Coolify

1. Acesse as configurações do projeto no Coolify
2. Vá em "Environment Variables"
3. Adicione as variáveis acima
4. Para Edge Functions, configure `WEBHOOK_BASE_URL` nas variáveis de ambiente do projeto Supabase
