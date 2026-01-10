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

**Importante**: As URLs completas dos webhooks serão construídas automaticamente:
- `{WEBHOOK_BASE_URL}/webhook/CODIGO-OTP` - Para código OTP
- `{WEBHOOK_BASE_URL}/webhook/registra_ai_lembrete` - Para lembretes de agendamentos

Onde `CODIGO-OTP` e `registra_ai_lembrete` são literalmente os nomes dos endpoints (não são variáveis).

## 📋 Passos para Deploy

### ⚠️ IMPORTANTE: Configurar Docker Hub antes do Deploy

**ERRO COMUM**: `401 Unauthorized` ao fazer pull de imagens base

**SOLUÇÃO**: Configure credenciais do Docker Hub no Coolify:

1. **No Coolify Dashboard:**
   - Vá em **Settings** (Configurações) → **Docker Hub Registry**
   - Se não tiver conta no Docker Hub, crie em: https://hub.docker.com/signup
   - Adicione suas credenciais:
     - Username: seu usuário do Docker Hub
     - Password: sua senha ou token de acesso (recomendado)
   
2. **Para criar um token de acesso (mais seguro):**
   - Acesse: https://hub.docker.com/settings/security
   - Clique em "New Access Token"
   - Dê um nome (ex: "coolify-deploy")
   - Copie o token gerado
   - Use este token como senha no Coolify

3. **Alternativa (se não quiser usar Docker Hub):**
   - Configure um registry mirror nas configurações do Coolify
   - Ou use imagens de um registry privado

### 1. No Coolify
1. ✅ **Configure Docker Hub primeiro** (veja acima)
2. Conecte o repositório Git: `https://github.com/guihp/financas_app.git`
3. Configure as variáveis de ambiente do frontend (Build Arguments):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Certifique-se de que o **Build Command** está como: `docker build`
5. Certifique-se de que o **Dockerfile** está no caminho: `./Dockerfile`
6. Inicie o deploy

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
- ✅ `supabase/functions/appointment-notifications/index.ts` - Atualizado para usar WEBHOOK_BASE_URL
- ✅ `supabase/functions/test-webhook/index.ts` - Atualizado para usar WEBHOOK_BASE_URL

## 📝 Notas

- O projeto usa Vite, então as variáveis de ambiente do frontend devem começar com `VITE_`
- Os webhooks só serão chamados se `WEBHOOK_BASE_URL` estiver configurado
- Se o webhook falhar, o OTP ainda será gerado (não bloqueia o fluxo)
- O webhook de lembretes de agendamentos é ativado automaticamente via cron job a cada 5 minutos (configurado na migration `20260109234545_update_appointment_notifications_cron.sql`)
