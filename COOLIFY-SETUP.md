# Configuração para Coolify - IAFÉ Finanças

## ✅ O que foi configurado

### 1. Dockerfile
- Build multi-stage com Node.js e Nginx
- Otimizado para produção
- Servindo arquivos estáticos via Nginx

### 2. Nginx Configuration
- Configurado para SPA (Single Page Application)
- Suporte a rotas do React Router
- Compressão Gzip habilitada
- Headers de segurança configurados

### 3. Variáveis de Ambiente

#### Frontend (configurar no Coolify)
```
VITE_SUPABASE_URL=https://dlbiwguzbiosaoyrcvay.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
PORT=8080
```

#### Supabase Edge Functions (configurar no Supabase Dashboard)
```
WEBHOOK_BASE_URL=https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com
```

**Importante**: A URL completa do webhook será:
`{WEBHOOK_BASE_URL}/webhook/CODIGO-OTP`

Onde `CODIGO-OTP` é literalmente o nome do endpoint (não é variável).

## 📋 Passos para Deploy

### 1. No Coolify
1. Conecte o repositório Git
2. Configure as variáveis de ambiente do frontend:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `PORT` (opcional)
3. Inicie o deploy

### 2. No Supabase Dashboard
1. Acesse: https://supabase.com/dashboard/project/dlbiwguzbiosaoyrcvay/settings/functions
2. Vá em "Environment Variables"
3. Adicione: `WEBHOOK_BASE_URL` com a URL base do seu webhook

## 🔧 Arquivos Criados/Modificados

- ✅ `Dockerfile` - Configuração Docker
- ✅ `nginx.conf` - Configuração Nginx
- ✅ `.dockerignore` - Arquivos ignorados no build
- ✅ `vite.config.ts` - Atualizado para usar variável PORT
- ✅ `src/integrations/supabase/client.ts` - Atualizado para usar variáveis de ambiente
- ✅ `supabase/functions/generate-otp/index.ts` - Atualizado para usar WEBHOOK_BASE_URL

## 📝 Notas

- O projeto usa Vite, então as variáveis de ambiente do frontend devem começar com `VITE_`
- O webhook só será chamado se `WEBHOOK_BASE_URL` estiver configurado
- Se o webhook falhar, o OTP ainda será gerado (não bloqueia o fluxo)
