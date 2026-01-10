# Solução: Erro 401 Unauthorized no Docker Hub

## ❌ Erro Encontrado

```
ERROR: failed to authorize: failed to fetch oauth token: unexpected status from GET request to https://auth.docker.io/token?scope=repository%3Alibrary%2Fnginx%3Apull&service=registry.docker.io: 401 Unauthorized
```

## 🔍 Causa

O Coolify está tentando fazer pull das imagens base (`node:20-alpine` e `nginx:alpine`) do Docker Hub, mas está recebendo erro 401 porque:

1. **Não há credenciais do Docker Hub configuradas** no Coolify
2. **Rate limiting** - usuários não autenticados têm limites de pull no Docker Hub

## ✅ Solução: Configurar Docker Hub no Coolify

### Opção 1: Usar conta Docker Hub (Recomendado)

1. **Crie uma conta no Docker Hub** (se não tiver):
   - Acesse: https://hub.docker.com/signup
   - Complete o cadastro

2. **Crie um Access Token** (mais seguro que usar senha):
   - Faça login no Docker Hub
   - Acesse: https://hub.docker.com/settings/security
   - Clique em "New Access Token"
   - Dê um nome descritivo (ex: "coolify-production")
   - Copie o token gerado (você só verá uma vez!)

3. **Configure no Coolify**:
   - Acesse seu projeto no Coolify
   - Vá em **Settings** (ícone de engrenagem)
   - Procure por **"Docker Hub Registry"** ou **"Registry Credentials"**
   - Preencha:
     - **Username**: seu usuário do Docker Hub
     - **Password/Token**: o token de acesso criado acima
   - Salve as configurações

4. **Tente o deploy novamente**

### Opção 2: Configurar como Build Arguments (Alternativa)

Se a Opção 1 não funcionar, você pode tentar configurar as credenciais diretamente no build:

1. No Coolify, vá em **Build Settings**
2. Adicione nas **Build Arguments**:
   ```
   DOCKER_REGISTRY_USER=seu_usuario
   DOCKER_REGISTRY_TOKEN=seu_token
   ```
3. Atualize o Dockerfile para usar essas credenciais (requer modificação)

### Opção 3: Usar Registry Mirror (Avançado)

Se você tiver acesso a um registry mirror do Docker Hub, configure nas configurações do servidor Coolify.

## 🔧 Verificação

Após configurar as credenciais, o deploy deve conseguir:
- ✅ Fazer pull de `node:20-alpine`
- ✅ Fazer pull de `nginx:alpine`
- ✅ Prosseguir com o build

## 📝 Notas Importantes

- **Tokens são mais seguros que senhas**: Use sempre Access Tokens ao invés de senhas
- **Rate Limits**: Contas autenticadas têm limites muito maiores que usuários anônimos
- **Tokens podem ser revogados**: Se você perder acesso, crie um novo token e atualize no Coolify

## 🆘 Se ainda não funcionar

1. Verifique se o token/credenciais estão corretos
2. Teste fazer login manualmente: `docker login -u seu_usuario -p seu_token`
3. Verifique logs do Coolify para mais detalhes
4. Entre em contato com o suporte do Coolify se o problema persistir
