# Guia de Deploy - Coolify

## Pré-requisitos

- Conta no Coolify
- Projeto Supabase configurado
- Repositório Git do projeto

## Passo 1: Configurar Variáveis de Ambiente no Coolify

No painel do Coolify, configure as seguintes variáveis de ambiente:

### Variáveis do Frontend

```
VITE_SUPABASE_URL=https://dlbiwguzbiosaoyrcvay.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
PORT=8080
```

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
3. Configure as variáveis de ambiente (Passo 1)
4. Inicie o deploy

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

### Problema: Variáveis de ambiente não funcionam
- Certifique-se de que as variáveis começam com `VITE_` para o frontend
- Reinicie o container após adicionar variáveis

### Problema: Webhook não funciona
- Verifique se `WEBHOOK_BASE_URL` está configurado no Supabase
- Verifique os logs das Edge Functions no Supabase Dashboard

### Problema: Build falha
- Verifique se todas as dependências estão no package.json
- Verifique os logs de build no Coolify
