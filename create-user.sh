#!/bin/bash

# Script para criar o primeiro usuário super_admin
# Você precisa da SERVICE_ROLE_KEY do Supabase

SUPABASE_URL="https://dlbiwguzbiosaoyrcvay.supabase.co"
SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY_AQUI"

# Dados do usuário
EMAIL="appfinancas@iafeoficial.com"
PASSWORD="Iafeoficial123!"
FULL_NAME="App Finanças Admin"

echo "Criando usuário: $EMAIL"

# Criar usuário via API do Supabase
RESPONSE=$(curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"email_confirm\": true,
    \"user_metadata\": {
      \"full_name\": \"$FULL_NAME\"
    }
  }")

echo "Resposta da API:"
echo $RESPONSE | jq .

# Extrair user_id da resposta
USER_ID=$(echo $RESPONSE | jq -r '.id // empty')

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
  echo ""
  echo "✅ Usuário criado com sucesso!"
  echo "User ID: $USER_ID"
  echo ""
  echo "Agora atribuindo role de super_admin..."
  
  # A role será atribuída automaticamente pela migration que criamos
  echo "✅ Role de super_admin será atribuída automaticamente"
else
  echo ""
  echo "❌ Erro ao criar usuário. Verifique a SERVICE_ROLE_KEY"
fi
