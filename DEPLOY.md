# Guia de Deploy - Coolify

## Pré-requisitos

- Conta no Coolify
- Projeto Supabase configurado
- Repositório Git do projeto

## Passo 1: Configurar Variáveis de Ambiente no Coolify

No painel do Coolify, vá em **"Environment Variables"** e configure as seguintes variáveis:

### Variáveis do Frontend (OBRIGATÓRIAS para o build)

**IMPORTANTE**: Essas variáveis devem estar configuradas ANTES do build, pois o Vite as incorpora no código durante o build.

```
VITE_SUPABASE_URL=https://dlbiwguzbiosaoyrcvay.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsYml3Z3V6Ymlvc2FveXJjdmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NTgxNzIsImV4cCI6MjA4MzUzNDE3Mn0.g31h4C8ugNXinlYVGXL-GrP1TQxUOX-u-eqxhI_Rkjk
```

**Nota**: O Dockerfile está configurado para aceitar essas variáveis como `ARG` durante o build, então elas serão automaticamente passadas pelo Coolify.

### Variáveis do Supabase (Edge Functions)

**IMPORTANTE**: Configure no Dashboard do Supabase:

1. Acesse: https://supabase.com/dashboard/project/dlbiwguzbiosaoyrcvay/settings/functions
2. Vá em "Environment Variables"
3. Adicione:
   ```
   WEBHOOK_BASE_URL=https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com
   ```

**Nota**: A URL completa do webhook será construída automaticamente como:
`{WEBHOOK_BASE_URL}/webhook/CODIGO-OTP`

Onde `CODIGO-OTP` é literalmente o nome do endpoint (não é uma variável).

## Passo 2: Deploy no Coolify

1. Conecte seu repositório Git ao Coolify
2. O Coolify detectará automaticamente o Dockerfile
3. **IMPORTANTE**: Configure as variáveis de ambiente ANTES de fazer o deploy (Passo 1)
4. Inicie o deploy
5. Aguarde o build completar (pode levar alguns minutos)

## Passo 3: Verificar Deploy

Após o deploy, acesse a URL fornecida pelo Coolify e verifique:
- ✅ Aplicação carrega corretamente
- ✅ Login funciona
- ✅ Cadastro de novos usuários funciona
- ✅ OTP é enviado via webhook

## Estrutura do Projeto

- `Dockerfile` - Configuração Docker para build e deploy
- `nginx.conf` - Configuração Nginx para servir a aplicação
- `.dockerignore` - Arquivos ignorados no build Docker
- `vite.config.ts` - Configuração Vite (usa variável PORT)
- `src/integrations/supabase/client.ts` - Cliente Supabase (usa variáveis VITE_*)

## Troubleshooting

### Problema: 502 Bad Gateway
- **Causa mais comum**: Variáveis de ambiente não configuradas antes do build
- **Solução**: 
  1. Vá em "Environment Variables" no Coolify
  2. Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
  3. Faça um novo deploy (as variáveis precisam estar presentes durante o build)

### Problema: Variáveis de ambiente não funcionam
- Certifique-se de que as variáveis começam com `VITE_` para o frontend
- **IMPORTANTE**: Variáveis `VITE_*` precisam estar configuradas ANTES do build
- Se você adicionou variáveis após o build, faça um novo deploy

### Problema: Webhook não funciona
- Verifique se `WEBHOOK_BASE_URL` está configurado no Supabase
- Verifique os logs das Edge Functions no Supabase Dashboard

### Problema: Build falha
- Verifique se todas as dependências estão no package.json
- Verifique os logs de build no Coolify
