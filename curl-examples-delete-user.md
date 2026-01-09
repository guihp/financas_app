# Exemplos cURL - API de Exclusão de Usuário

## Exemplo Básico
```bash
curl -X POST https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@exemplo.com"
  }'
```

## Exemplo com Verificação de Resposta
```bash
curl -X POST https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@exemplo.com"
  }' \
  -w "\nStatus Code: %{http_code}\n"
```

## Exemplo para Desenvolvimento/Teste
```bash
# Excluir usuário de teste
curl -X POST https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@exemplo.com"
  }' \
  -s | jq .
```

## Script Bash para Exclusão em Lote
```bash
#!/bin/bash

# Lista de emails para excluir
emails=("usuario1@exemplo.com" "usuario2@exemplo.com" "usuario3@exemplo.com")

for email in "${emails[@]}"; do
  echo "Excluindo usuário: $email"
  
  response=$(curl -X POST https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\"}" \
    -s)
  
  if echo "$response" | jq -e '.success' > /dev/null; then
    echo "✓ Usuário $email excluído com sucesso"
  else
    echo "✗ Falha ao excluir $email: $(echo "$response" | jq -r '.error')"
  fi
  
  # Pausa de 1 segundo entre requests
  sleep 1
done
```

## Comando para Debug/Validação
```bash
# Com output detalhado para debugging
curl -X POST https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@exemplo.com"
  }' \
  -v \
  -w "\n\nTempo total: %{time_total}s\nStatus: %{http_code}\n"
```

## Exemplo com Tratamento de Erro
```bash
#!/bin/bash

EMAIL="usuario@exemplo.com"

response=$(curl -X POST https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\"}" \
  -s \
  -w "%{http_code}")

# Separar body e status code
body=$(echo "$response" | head -n -1)
status_code=$(echo "$response" | tail -n 1)

case $status_code in
  200)
    echo "✓ Usuário excluído com sucesso"
    echo "$body" | jq .
    ;;
  400)
    echo "✗ Erro de parâmetros: $(echo "$body" | jq -r '.error')"
    ;;
  404)
    echo "✗ Usuário não encontrado: $(echo "$body" | jq -r '.error')"
    ;;
  500)
    echo "✗ Erro do servidor: $(echo "$body" | jq -r '.error')"
    ;;
  *)
    echo "✗ Erro inesperado (Status: $status_code)"
    echo "$body"
    ;;
esac
```

## Teste de Email Inválido
```bash
# Teste sem email (deve retornar erro 400)
curl -X POST https://psyebemhvnwkhnypqgge.supabase.co/functions/v1/delete-user \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n"
```