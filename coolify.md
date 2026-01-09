# Configuração para Coolify

## Variáveis de Ambiente Necessárias

Configure as seguintes variáveis de ambiente no Coolify:

### Variáveis do Frontend (VITE_*)
- `VITE_SUPABASE_URL` - URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave anon/public do Supabase

### Variáveis do Supabase Edge Functions
As Edge Functions do Supabase usam automaticamente as variáveis de ambiente do projeto Supabase:
- `SUPABASE_URL` - Configurado automaticamente pelo Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Configurado automaticamente pelo Supabase
- `WEBHOOK_BASE_URL` - URL base do webhook (sem o /webhook/CODIGO-OTP)

## Exemplo de Configuração no Coolify

1. Acesse as configurações do seu projeto no Coolify
2. Vá em "Environment Variables"
3. Adicione as variáveis:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
WEBHOOK_BASE_URL=https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com
```

## Nota sobre Webhook

A URL do webhook será construída automaticamente como:
`{WEBHOOK_BASE_URL}/webhook/CODIGO-OTP`

Onde `CODIGO-OTP` é literalmente o nome do endpoint, não uma variável.

## Build e Deploy

O Coolify detectará automaticamente que é um projeto Vite/React e fará o build e deploy.

Certifique-se de que:
- Node.js está instalado no ambiente
- O comando de build é: `npm run build`
- O diretório de output é: `dist`
